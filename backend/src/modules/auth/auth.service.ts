import bcrypt from 'bcryptjs';
import { identityStore } from '../../data/identity.store.js';
import { userStore } from '../../data/user.store.js';
import { env } from '../../config/env.js';
import { sendVerificationEmail } from '../../services/mailer.js';
import type { OAuthProfile } from '../../services/oauth.js';
import { HttpError } from '../../utils/http-error.js';
import { getExpiresInSeconds, signAccessToken } from '../../utils/token.js';
import {
  isBanned,
  isPermanentBan,
  toPublicUser,
  type PublicUser,
  type UserRecord,
} from '../users/user.model.js';
import type { LoginInput, SignupInput } from './auth.schema.js';
import type { ChangePasswordInput } from './auth.schema.js';
import type { UserRecord as PasswordOwner } from '../users/user.model.js';

const SALT_ROUNDS = 10;

/**
 * Refuses a suspended account, saying why and until when.
 *
 * Shared by login and the request middleware: a ban has to stop the next
 * request too, not just the next sign-in, or anyone already holding a token
 * carries on for the rest of its seven days.
 */
export function assertNotBanned(user: UserRecord): void {
  if (!isBanned(user)) return;

  const until = isPermanentBan(user)
    ? 'This suspension does not expire.'
    : `It lifts on ${new Date(user.bannedUntil as string).toUTCString()}.`;

  throw HttpError.banned(
    `This account is suspended. ${user.bannedReason ? `Reason: ${user.bannedReason}. ` : ''}${until}`,
    {
      bannedUntil: user.bannedUntil,
      reason: user.bannedReason,
      permanent: isPermanentBan(user),
    },
  );
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  /**
   * Where the client should go next. The server decides, because it is the
   * only side that knows whether the address is confirmed and the profile
   * built — the SPA would otherwise have to infer it from three flags.
   */
  next: 'verify-email' | 'onboarding' | 'dashboard';
}

/** False when the message could not be sent, so the UI can offer a resend. */
export interface SignupResult extends AuthResult {
  verificationEmailSent: boolean;
  verificationEmailError: string | null;
}

/**
 * Where this account should be sent.
 *
 * Exported because `/api/auth/me` returns it too: the SPA reads that on every
 * load, and re-deriving the same rule client-side is how the two drift apart.
 */
export function nextStepFor(user: UserRecord): AuthResult['next'] {
  // The address only blocks the way forward when confirmation is switched on.
  // With it off, an unconfirmed account is a normal account.
  if (env.mail.requireVerification && !user.emailVerified) return 'verify-email';
  if (!user.onboardingCompleted) return 'onboarding';
  return 'dashboard';
}

function buildAuthResult(user: UserRecord): AuthResult {
  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  return {
    user: toPublicUser(user),
    accessToken,
    tokenType: 'Bearer',
    expiresIn: getExpiresInSeconds(accessToken),
    next: nextStepFor(user),
  };
}

/** Issues a confirmation token and mails the link. */
async function issueVerification(user: UserRecord): Promise<{ sent: boolean; error: string | null }> {
  const { token } = await identityStore.createVerificationToken(user.id, user.email);
  const url = `${env.appUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const result = await sendVerificationEmail({
    to: user.email,
    firstName: user.firstName,
    url,
  });

  // Without a provider configured the link is only in the server log, which is
  // useless to anyone running this from the outside — say so plainly.
  if (!result.delivered) {
    console.warn(`[auth] Confirmation link for ${user.email}: ${url}`);
  }

  return { sent: result.delivered, error: result.reason };
}

/** Step 1 of signup — is this address free? Asked before the password screen. */
export async function isEmailAvailable(email: string): Promise<boolean> {
  return (await userStore.findByEmail(email)) === null;
}

export async function signup(input: SignupInput): Promise<SignupResult> {
  const existing = await userStore.findByEmail(input.email);
  if (existing) {
    throw HttpError.conflict('An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await userStore.create({
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName ?? null,
    roles: input.roles,
    // Marked confirmed at creation while the gate is off, rather than left
    // false and ignored. A row saying `email_verified = false` on an account
    // that was never going to be asked would be a lie in the database, and
    // switching the gate on later would then lock out everybody who signed up
    // in the meantime.
    emailVerified: !env.mail.requireVerification,
  });

  if (!env.mail.requireVerification) {
    return { ...buildAuthResult(user), verificationEmailSent: false, verificationEmailError: null };
  }

  const verification = await issueVerification(user);

  return {
    ...buildAuthResult(user),
    verificationEmailSent: verification.sent,
    verificationEmailError: verification.error,
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await userStore.findByEmail(input.email);

  // Compare against a dummy hash when the user is missing, or has no password
  // because they signed up through a provider, so response timing does not
  // reveal which of those is the case.
  const hash =
    user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
  const passwordMatches = await bcrypt.compare(input.password, hash);

  if (!user || !user.passwordHash || !passwordMatches) {
    throw HttpError.unauthorized('Incorrect email or password.');
  }

  // Checked after the password, not before: refusing early would let anyone
  // discover which addresses are suspended without knowing the password.
  assertNotBanned(user);

  return buildAuthResult(user);
}

export async function verifyEmail(token: string): Promise<AuthResult> {
  const consumed = await identityStore.consumeVerificationToken(token);
  if (!consumed) {
    throw HttpError.badRequest(
      'This confirmation link has expired or has already been used. Request a new one.',
    );
  }

  const user = await userStore.setEmailVerified(consumed.userId, true);
  if (!user) {
    throw HttpError.notFound('The account this link belongs to no longer exists.');
  }

  // A fresh token is returned so the browser can go straight into onboarding
  // without a second sign-in — the person just proved they own the address.
  return buildAuthResult(user);
}

export async function resendVerification(email: string): Promise<{ sent: boolean; error: string | null }> {
  const user = await userStore.findByEmail(email);

  // Always reports success to the caller. Saying "no such account" here turns
  // this endpoint into a way to test which addresses are registered.
  if (!user || user.emailVerified || !env.mail.requireVerification) {
    return { sent: true, error: null };
  }

  return issueVerification(user);
}

// -- OAuth --------------------------------------------------------------------

export interface OAuthLoginResult extends AuthResult {
  /** True when this call created the account rather than signing one in. */
  created: boolean;
}

/**
 * Signs in through a provider, creating the account on first use.
 *
 * Matching on the provider's account id first, then on a *verified* email, is
 * what makes this safe: matching on an unverified address would let anyone who
 * can make a provider assert an arbitrary email take over that account.
 */
export async function loginWithProvider(profile: OAuthProfile): Promise<OAuthLoginResult> {
  const identity = await identityStore.findIdentity(profile.provider, profile.providerAccountId);

  if (identity) {
    const user = await userStore.findById(identity.userId);
    if (!user) throw HttpError.notFound('The linked account no longer exists.');
    assertNotBanned(user);
    return { ...buildAuthResult(user), created: false };
  }

  if (profile.email && profile.emailVerified) {
    const byEmail = await userStore.findByEmail(profile.email);
    if (byEmail) {
      // A provider sign-in must not be a way around a suspension.
      assertNotBanned(byEmail);
      await identityStore.linkIdentity({
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        userId: byEmail.id,
        email: profile.email,
        profileUrl: profile.profileUrl,
      });
      return { ...buildAuthResult(byEmail), created: false };
    }
  }

  if (!profile.email) {
    throw HttpError.badRequest(
      'That account did not share an email address, so we cannot create a profile from it.',
    );
  }

  const created = await userStore.create({
    email: profile.email,
    // No password: this account signs in through the provider. One can be set
    // later from the profile page.
    passwordHash: null,
    firstName: profile.firstName,
    lastName: profile.lastName,
    roles: ['Full-Stack Developer'],
    emailVerified: profile.emailVerified,
    avatarUrl: profile.avatarUrl,
  });

  await identityStore.linkIdentity({
    provider: profile.provider,
    providerAccountId: profile.providerAccountId,
    userId: created.id,
    email: profile.email,
    profileUrl: profile.profileUrl,
  });

  return { ...buildAuthResult(created), created: true };
}

/** Attaches a provider to the account already signed in. */
export async function connectProvider(
  userId: string,
  profile: OAuthProfile,
): Promise<void> {
  const existing = await identityStore.findIdentity(
    profile.provider,
    profile.providerAccountId,
  );

  if (existing && existing.userId !== userId) {
    throw HttpError.conflict(
      `That ${profile.provider} account is already connected to a different TapTim account.`,
    );
  }

  await identityStore.linkIdentity({
    provider: profile.provider,
    providerAccountId: profile.providerAccountId,
    userId,
    email: profile.email,
    profileUrl: profile.profileUrl,
  });
}

export async function disconnectProvider(user: UserRecord, provider: string): Promise<void> {
  const identities = await identityStore.listIdentitiesFor(user.id);

  // Removing the only way in would lock the account out entirely.
  if (identities.length === 1 && identities[0].provider === provider && !user.passwordHash) {
    throw HttpError.badRequest(
      'This is the only way you can sign in. Set a password first, then disconnect.',
    );
  }

  const removed = await identityStore.unlinkIdentity(user.id, provider);
  if (!removed) {
    throw HttpError.notFound(`No ${provider} account is connected.`);
  }
}

/**
 * Sets a new password.
 *
 * Proving the old one is what stops a session left open on a shared machine
 * from becoming a permanent takeover — the session can be ended; a changed
 * password cannot be un-changed by its owner.
 */
export async function changePassword(
  user: PasswordOwner,
  input: ChangePasswordInput,
): Promise<void> {
  if (user.passwordHash) {
    const proven =
      input.currentPassword !== undefined &&
      (await bcrypt.compare(input.currentPassword, user.passwordHash));
    if (!proven) {
      throw HttpError.badRequest('Your current password is not right.', [
        { field: 'currentPassword', message: 'That is not your current password.' },
      ]);
    }
    if (await bcrypt.compare(input.newPassword, user.passwordHash)) {
      throw HttpError.badRequest('That is already your password.', [
        { field: 'newPassword', message: 'Pick one you are not using now.' },
      ]);
    }
  }

  const updated = await userStore.setPasswordHash(
    user.id,
    await bcrypt.hash(input.newPassword, SALT_ROUNDS),
  );
  if (!updated) throw HttpError.notFound('The account for this token no longer exists.');
}

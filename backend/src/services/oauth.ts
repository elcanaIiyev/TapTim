import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

/**
 * Google and LinkedIn sign-in.
 *
 * Both are OpenID Connect, so one shape covers them: send the person to the
 * provider, take back a `code`, swap it for tokens, then read `/userinfo`. The
 * only differences are the three endpoints and the scope string, which is why
 * they are a table rather than two near-identical modules.
 */

export const OAUTH_PROVIDERS = ['google', 'linkedin'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  label: string;
}

const PROVIDERS: Record<OAuthProvider, ProviderConfig> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    label: 'Google',
  },
  linkedin: {
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    // LinkedIn moved to OpenID Connect in 2023; the old /v2/me endpoint needs
    // permissions most apps are no longer granted.
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    scope: 'openid profile email',
    label: 'LinkedIn',
  },
};

export function providerLabel(provider: OAuthProvider): string {
  return PROVIDERS[provider].label;
}

export function isProviderConfigured(provider: OAuthProvider): boolean {
  return env.oauth[provider].configured;
}

/** The provider must send the browser back to exactly this, byte for byte. */
export function redirectUri(provider: OAuthProvider): string {
  return `http://localhost:${env.port}/api/auth/oauth/${provider}/callback`;
}

/**
 * The `state` parameter, as a short-lived signed token.
 *
 * State exists to stop an attacker starting a flow and having the victim's
 * browser complete it. Signing it means the callback can verify the value came
 * from us without keeping server-side session storage for a 60-second window.
 */
interface StatePayload {
  provider: OAuthProvider;
  /** `connect` links a provider to an account already signed in. */
  intent: 'login' | 'connect';
  /** Set only for `connect`, naming the account doing the linking. */
  userId?: string;
  nonce: string;
}

const STATE_TTL_SECONDS = 600;

export function encodeState(payload: Omit<StatePayload, 'nonce'>): string {
  return jwt.sign({ ...payload, nonce: Math.random().toString(36).slice(2) }, env.jwtSecret, {
    expiresIn: STATE_TTL_SECONDS,
  });
}

export function decodeState(state: string): StatePayload {
  try {
    const decoded = jwt.verify(state, env.jwtSecret);
    if (typeof decoded === 'string') throw new Error('malformed');
    return decoded as unknown as StatePayload;
  } catch {
    throw HttpError.badRequest(
      'This sign-in link has expired or was tampered with. Start again from the sign-in page.',
    );
  }
}

export function authorizeUrl(provider: OAuthProvider, state: string): string {
  const config = PROVIDERS[provider];
  const credentials = env.oauth[provider];

  if (!credentials.configured) {
    throw HttpError.badRequest(
      `${config.label} sign-in is not configured on this server. ` +
        `Set ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET.`,
    );
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: credentials.clientId as string,
    redirect_uri: redirectUri(provider),
    scope: config.scope,
    state,
  });

  // Google only returns a refresh token, and only re-prompts for consent, when
  // asked. LinkedIn accepts neither parameter.
  if (provider === 'google') {
    params.set('access_type', 'offline');
    params.set('prompt', 'select_account');
  }

  return `${config.authorizeUrl}?${params.toString()}`;
}

/** What a provider tells us about the person, normalised across both. */
export interface OAuthProfile {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
}

interface OpenIdUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
}

async function exchangeCodeForToken(provider: OAuthProvider, code: string): Promise<string> {
  const config = PROVIDERS[provider];
  const credentials = env.oauth[provider];

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(provider),
      client_id: credentials.clientId as string,
      client_secret: credentials.clientSecret as string,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error(`[oauth] ${provider} token exchange failed (${response.status}): ${detail}`);
    throw HttpError.badRequest(
      `${config.label} rejected the sign-in. The most common cause is a redirect URI that does ` +
        `not exactly match "${redirectUri(provider)}" in the provider's app settings.`,
    );
  }

  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) {
    throw HttpError.badRequest(`${config.label} returned no access token.`);
  }
  return body.access_token;
}

export async function fetchProfile(
  provider: OAuthProvider,
  code: string,
): Promise<OAuthProfile> {
  const config = PROVIDERS[provider];
  const accessToken = await exchangeCodeForToken(provider, code);

  const response = await fetch(config.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error(`[oauth] ${provider} userinfo failed (${response.status}): ${detail}`);
    throw HttpError.badRequest(`Could not read your ${config.label} profile.`);
  }

  const info = (await response.json()) as OpenIdUserInfo;

  // `given_name` is not guaranteed. Fall back to splitting `name`, then to the
  // local part of the email, so an account always has something to display.
  const nameParts = (info.name ?? '').trim().split(/\s+/).filter(Boolean);
  const firstName =
    info.given_name?.trim() || nameParts[0] || info.email?.split('@')[0] || 'There';
  const lastName = info.family_name?.trim() || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : null);

  return {
    provider,
    providerAccountId: info.sub,
    email: info.email?.toLowerCase() ?? null,
    // Google states this explicitly; LinkedIn only returns confirmed addresses.
    emailVerified: info.email_verified ?? provider === 'linkedin',
    firstName,
    lastName,
    avatarUrl: info.picture ?? null,
    profileUrl: null,
  };
}

import bcrypt from 'bcryptjs';
import { userStore } from '../../data/user.store.js';
import { HttpError } from '../../utils/http-error.js';
import { getExpiresInSeconds, signAccessToken } from '../../utils/token.js';
import { toPublicUser, type PublicUser } from '../users/user.model.js';
import type { LoginInput, SignupInput } from './auth.schema.js';

const SALT_ROUNDS = 10;

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

function buildAuthResult(user: Parameters<typeof toPublicUser>[0]): AuthResult {
  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  return {
    user: toPublicUser(user),
    accessToken,
    tokenType: 'Bearer',
    expiresIn: getExpiresInSeconds(accessToken),
  };
}

export async function signup(input: SignupInput): Promise<AuthResult> {
  const existing = await userStore.findByEmail(input.email);
  if (existing) {
    throw HttpError.conflict('An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await userStore.create({
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    primaryRole: input.primaryRole,
    skills: input.skills ?? [],
  });

  return buildAuthResult(user);
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await userStore.findByEmail(input.email);

  // Compare against a dummy hash when the user is missing so that response
  // timing does not reveal whether an email is registered.
  const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
  const passwordMatches = await bcrypt.compare(input.password, hash);

  if (!user || !passwordMatches) {
    throw HttpError.unauthorized('Incorrect email or password.');
  }

  return buildAuthResult(user);
}

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from './http-error.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options = { expiresIn: env.jwtExpiresIn } as jwt.SignOptions;
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    if (typeof decoded === 'string' || !decoded.sub || typeof decoded.sub !== 'string') {
      throw HttpError.unauthorized('Malformed access token.');
    }
    return { sub: decoded.sub, email: String((decoded as jwt.JwtPayload).email ?? '') };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw HttpError.unauthorized('Access token has expired. Please log in again.');
    }
    throw HttpError.unauthorized('Invalid access token.');
  }
}

/** Seconds until expiry, surfaced to clients so they can schedule a refresh. */
export function getExpiresInSeconds(token: string): number {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === 'string' || !decoded.exp) return 0;
  return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
}

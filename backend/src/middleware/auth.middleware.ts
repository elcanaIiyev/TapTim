import type { Request, RequestHandler } from 'express';
import { userStore } from '../data/user.store.js';
import { assertNotBanned } from '../modules/auth/auth.service.js';
import { isBanned, type UserRecord } from '../modules/users/user.model.js';
import { HttpError } from '../utils/http-error.js';
import { verifyAccessToken } from '../utils/token.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRecord;
    }
  }
}

function bearerToken(req: Request): string | null {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

/** Rejects the request unless a valid `Authorization: Bearer <token>` is present. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = bearerToken(req);

  if (!token) {
    next(HttpError.unauthorized('Missing Bearer token in Authorization header.'));
    return;
  }

  void (async () => {
    try {
      const payload = verifyAccessToken(token);
      const user = await userStore.findById(payload.sub);
      if (!user) {
        next(HttpError.unauthorized('The account for this token no longer exists.'));
        return;
      }
      // A token issued before the ban is still cryptographically valid, so the
      // suspension has to be enforced per request or it does not start until
      // the token expires — up to seven days later.
      assertNotBanned(user);
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  })();
};

/**
 * Attaches `req.user` when a valid token is present and does nothing when it is
 * not. Used by endpoints that are public but personalise their response — the
 * participant directory hides the viewer from their own results.
 *
 * An invalid or expired token is treated as "not signed in" rather than an
 * error, so a stale token in localStorage cannot break a public page.
 */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = bearerToken(req);
  if (!token) {
    next();
    return;
  }

  void (async () => {
    try {
      const payload = verifyAccessToken(token);
      const user = await userStore.findById(payload.sub);
      // A suspended account is treated as signed out on public pages rather
      // than being refused: those pages work fine anonymously, and an error
      // banner on the events list helps nobody.
      if (user && !isBanned(user)) req.user = user;
    } catch {
      /* anonymous request */
    }
    next();
  })();
};

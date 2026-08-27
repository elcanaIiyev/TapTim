import type { RequestHandler } from 'express';
import { userStore } from '../data/user.store.js';
import type { UserRecord } from '../modules/users/user.model.js';
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

/** Rejects the request unless a valid `Authorization: Bearer <token>` is present. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');

  if (!header?.startsWith('Bearer ')) {
    next(HttpError.unauthorized('Missing Bearer token in Authorization header.'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    next(HttpError.unauthorized('Missing Bearer token in Authorization header.'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    userStore
      .findById(payload.sub)
      .then((user) => {
        if (!user) {
          next(HttpError.unauthorized('The account for this token no longer exists.'));
          return;
        }
        req.user = user;
        next();
      })
      .catch(next);
  } catch (error) {
    next(error);
  }
};

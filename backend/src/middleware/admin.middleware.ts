import type { RequestHandler } from 'express';
import { atLeast, type AccountRole } from '../modules/users/account-role.js';
import { HttpError } from '../utils/http-error.js';

/**
 * Gate for the admin console, parameterised by the minimum site role required.
 *
 * Mounted after `optionalAuth` rather than `requireAuth`, so that a request
 * with no token falls through to the same 404 as a signed-in ordinary user.
 * Using `requireAuth` would answer anonymous probes with a 401, which confirms
 * the route exists.
 *
 * Anyone below the bar gets a **404, not a 403**. A 403 says "this endpoint is
 * real and you are merely unprivileged", which turns probing into
 * reconnaissance. A 404 makes the console API indistinguishable from a route
 * that was never built — the same answer the SPA gives for the page itself.
 */
export function requireRole(minimum: AccountRole): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !atLeast(req.user.accountRole, minimum)) {
      next(HttpError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
      return;
    }
    next();
  };
}

/**
 * Moderation gate for endpoints that are otherwise owner-only.
 *
 * Unlike `requireRole` this is *not* a 404 gate — these routes exist publicly
 * and already answer ordinary users, so hiding them would be pointless. It only
 * reports whether the caller may act on something they do not own.
 */
export function canModerate(role: AccountRole | undefined): boolean {
  return role !== undefined && atLeast(role, 'moderator');
}

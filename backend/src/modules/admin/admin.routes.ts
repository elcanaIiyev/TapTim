import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middleware/admin.middleware.js';
import { optionalAuth } from '../../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  banAccountHandler,
  deleteAccountHandler,
  listAccountsHandler,
  unbanAccountHandler,
  updateAccountHandler,
} from './admin.controller.js';
import {
  banAccountSchema,
  deleteAccountSchema,
  listAccountsQuerySchema,
  updateAccountSchema,
} from './admin.schema.js';

const idParam = z.object({ id: z.string().uuid('Account id must be a UUID.') });

export const adminRouter = Router();

// `optionalAuth`, not `requireAuth`: an anonymous probe should get the same 404
// as a signed-in ordinary user, rather than a 401 that confirms the route is
// real. Moderators clear this bar; what they may *change* is narrowed further
// in the service.
adminRouter.use(optionalAuth, requireRole('moderator'));

adminRouter.get(
  '/accounts',
  validateQuery(listAccountsQuerySchema),
  asyncHandler(listAccountsHandler),
);

adminRouter.patch(
  '/accounts/:id',
  validateParams(idParam),
  validateBody(updateAccountSchema),
  asyncHandler(updateAccountHandler),
);

// -- moderation ---------------------------------------------------------------
// Suspension is open to moderators — it is what the tier exists for — while
// deletion stays admin-only, checked in the service. Both refuse to act on an
// account at or above the caller's own rank.

adminRouter.post(
  '/accounts/:id/ban',
  validateParams(idParam),
  validateBody(banAccountSchema),
  asyncHandler(banAccountHandler),
);

adminRouter.delete('/accounts/:id/ban', validateParams(idParam), asyncHandler(unbanAccountHandler));

/**
 * Deletion carries a body, so it is a POST rather than a DELETE: the confirmed
 * email has to travel with the request, and DELETE bodies are widely dropped by
 * proxies and ignored by fetch implementations.
 */
adminRouter.post(
  '/accounts/:id/delete',
  validateParams(idParam),
  validateBody(deleteAccountSchema),
  asyncHandler(deleteAccountHandler),
);

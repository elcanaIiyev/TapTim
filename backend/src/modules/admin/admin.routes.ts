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
import { listAccountsHandler, updateAccountHandler } from './admin.controller.js';
import { listAccountsQuerySchema, updateAccountSchema } from './admin.schema.js';

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

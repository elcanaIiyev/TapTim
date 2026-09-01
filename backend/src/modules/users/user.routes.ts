import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth } from '../../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  getMeHandler,
  getUserHandler,
  listUsersHandler,
  updateMeHandler,
} from './user.controller.js';
import { listUsersQuerySchema, updateProfileSchema } from './user.schema.js';

const idParamSchema = z.object({ id: z.string().uuid('Participant id must be a UUID.') });

export const userRouter = Router();

// `/me` is declared before `/:id` so the literal is not captured as an id.
userRouter.get('/me', requireAuth, asyncHandler(getMeHandler));
userRouter.patch('/me', requireAuth, validateBody(updateProfileSchema), asyncHandler(updateMeHandler));

userRouter.get('/', optionalAuth, validateQuery(listUsersQuerySchema), asyncHandler(listUsersHandler));
userRouter.get('/:id', validateParams(idParamSchema), asyncHandler(getUserHandler));

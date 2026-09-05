import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { optionalAuth, requireAuth } from '../../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { createExperienceSchema, updateExperienceSchema } from './experience.schema.js';
import {
  createExperienceHandler,
  deleteExperienceHandler,
  getMeHandler,
  getUserHandler,
  listExperiencesHandler,
  listUsersHandler,
  endorseHandler,
  endorsementsHandler,
  profileOptionsHandler,
  removeAvatarHandler,
  updateExperienceHandler,
  updateMeHandler,
  uploadAvatarHandler,
  withdrawEndorsementHandler,
} from './user.controller.js';
import {
  endorseSkillSchema,
  listUsersQuerySchema,
  updateProfileSchema,
} from './user.schema.js';

const idParamSchema = z.object({ id: z.string().uuid('Participant id must be a UUID.') });

/**
 * Avatars are held in memory rather than written to a temp file: they go
 * straight back out to Supabase Storage, so touching the disk would only add a
 * cleanup problem. The size cap is enforced here as well as in the storage
 * service so an oversized body is rejected before it is fully buffered.
 */
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

export const userRouter = Router();

/** Public: the SPA renders its chips from this before anyone signs in. */
userRouter.get('/profile-options', profileOptionsHandler);

// `/me` and its children are declared before `/:id` so the literal is not
// captured as an id.
userRouter.get('/me', requireAuth, asyncHandler(getMeHandler));
userRouter.patch('/me', requireAuth, validateBody(updateProfileSchema), asyncHandler(updateMeHandler));

userRouter.post(
  '/me/avatar',
  requireAuth,
  avatarUpload.single('avatar'),
  asyncHandler(uploadAvatarHandler),
);
userRouter.delete('/me/avatar', requireAuth, asyncHandler(removeAvatarHandler));

userRouter.get('/me/experiences', requireAuth, asyncHandler(listExperiencesHandler));
userRouter.post(
  '/me/experiences',
  requireAuth,
  validateBody(createExperienceSchema),
  asyncHandler(createExperienceHandler),
);
userRouter.patch(
  '/me/experiences/:id',
  requireAuth,
  validateParams(idParamSchema),
  validateBody(updateExperienceSchema),
  asyncHandler(updateExperienceHandler),
);
userRouter.delete(
  '/me/experiences/:id',
  requireAuth,
  validateParams(idParamSchema),
  asyncHandler(deleteExperienceHandler),
);

// Endorsements hang off a participant, so they sit under `/:id` — declared
// before the bare `/:id` read so the sub-path is not swallowed by it.
userRouter.get(
  '/:id/endorsements',
  optionalAuth,
  validateParams(idParamSchema),
  asyncHandler(endorsementsHandler),
);
userRouter.post(
  '/:id/endorsements',
  requireAuth,
  validateParams(idParamSchema),
  validateBody(endorseSkillSchema),
  asyncHandler(endorseHandler),
);
userRouter.delete(
  '/:id/endorsements',
  requireAuth,
  validateParams(idParamSchema),
  validateBody(endorseSkillSchema),
  asyncHandler(withdrawEndorsementHandler),
);

userRouter.get('/', optionalAuth, validateQuery(listUsersQuerySchema), asyncHandler(listUsersHandler));
userRouter.get('/:id', validateParams(idParamSchema), asyncHandler(getUserHandler));

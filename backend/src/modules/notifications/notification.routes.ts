import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateParams } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  listHandler,
  markAllReadHandler,
  markReadHandler,
} from './notification.controller.js';

const idParam = z.object({ id: z.string().uuid('Notification id must be a UUID.') });

export const notificationRouter = Router();

// Everything here is about the caller's own feed, so there is no public surface.
notificationRouter.use(requireAuth);

notificationRouter.get('/', asyncHandler(listHandler));

// Declared before `/:id/read` so the literal is not captured as an id.
notificationRouter.post('/read-all', asyncHandler(markAllReadHandler));
notificationRouter.post('/:id/read', validateParams(idParam), asyncHandler(markReadHandler));

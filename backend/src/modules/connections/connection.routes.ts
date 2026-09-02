import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  conversationHandler,
  disconnectHandler,
  overviewHandler,
  requestHandler,
  respondHandler,
  sendMessageHandler,
} from './connection.controller.js';
import {
  requestConnectionSchema,
  respondConnectionSchema,
  sendMessageSchema,
} from './connection.schema.js';

const idParam = z.object({ id: z.string().uuid('Connection id must be a UUID.') });
const userParam = z.object({ userId: z.string().uuid('Participant id must be a UUID.') });

export const connectionRouter = Router();

// Everything here is about the caller's own relationships, so there is no
// public surface at all.
connectionRouter.use(requireAuth);

connectionRouter.get('/', asyncHandler(overviewHandler));
connectionRouter.post('/', validateBody(requestConnectionSchema), asyncHandler(requestHandler));

// `/messages` is declared before `/:id` so the literal is not read as an id.
connectionRouter.get(
  '/messages/:userId',
  validateParams(userParam),
  asyncHandler(conversationHandler),
);
connectionRouter.post(
  '/messages/:userId',
  validateParams(userParam),
  validateBody(sendMessageSchema),
  asyncHandler(sendMessageHandler),
);

connectionRouter.patch(
  '/:id',
  validateParams(idParam),
  validateBody(respondConnectionSchema),
  asyncHandler(respondHandler),
);
connectionRouter.delete('/:id', validateParams(idParam), asyncHandler(disconnectHandler));

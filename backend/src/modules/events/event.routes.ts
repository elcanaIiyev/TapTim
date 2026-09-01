import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createEventHandler,
  deleteEventHandler,
  getEventHandler,
  listCategoriesHandler,
  listEventsHandler,
  updateEventHandler,
} from './event.controller.js';
import { createEventSchema, listEventsQuerySchema, updateEventSchema } from './event.schema.js';

export const eventRouter = Router();

// Declared before `/:id` so "categories" is not swallowed by the param route.
eventRouter.get('/categories', asyncHandler(listCategoriesHandler));
eventRouter.get('/', validateQuery(listEventsQuerySchema), asyncHandler(listEventsHandler));
eventRouter.post('/', requireAuth, validateBody(createEventSchema), asyncHandler(createEventHandler));

eventRouter.get('/:id', asyncHandler(getEventHandler));
eventRouter.patch(
  '/:id',
  requireAuth,
  validateBody(updateEventSchema),
  asyncHandler(updateEventHandler),
);
eventRouter.delete('/:id', requireAuth, asyncHandler(deleteEventHandler));

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createEventHandler,
  deleteEventHandler,
  eventStatsHandler,
  getEventHandler,
  listFacetsHandler,
  listEventsHandler,
  myEventFitHandler,
  updateEventHandler,
} from './event.controller.js';
import { createEventSchema, listEventsQuerySchema, updateEventSchema } from './event.schema.js';

export const eventRouter = Router();

// Declared before `/:id` so "facets" is not swallowed by the param route.
// Two filter axes rather than one list: `format` is how an event runs,
// `domains` is what it is about, and they are orthogonal.
eventRouter.get('/facets', asyncHandler(listFacetsHandler));
eventRouter.get('/', validateQuery(listEventsQuerySchema), asyncHandler(listEventsHandler));
eventRouter.post('/', requireAuth, validateBody(createEventSchema), asyncHandler(createEventHandler));

eventRouter.get('/:id', asyncHandler(getEventHandler));

// What this event rewards, and how the caller measures up against it. Declared
// after `/:id` is fine — Express matches on the full path, and neither of these
// can be mistaken for an event id.
eventRouter.get('/:id/stats', asyncHandler(eventStatsHandler));
eventRouter.get('/:id/my-fit', requireAuth, asyncHandler(myEventFitHandler));
eventRouter.patch(
  '/:id',
  requireAuth,
  validateBody(updateEventSchema),
  asyncHandler(updateEventHandler),
);
eventRouter.delete('/:id', requireAuth, asyncHandler(deleteEventHandler));

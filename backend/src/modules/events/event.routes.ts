import { Router } from 'express';
import { validateQuery } from '../../middleware/validate.middleware.js';
import {
  getEventHandler,
  listCategoriesHandler,
  listEventsHandler,
} from './event.controller.js';
import { listEventsQuerySchema } from './event.schema.js';

export const eventRouter = Router();

// Declared before `/:id` so "categories" is not swallowed by the param route.
eventRouter.get('/categories', listCategoriesHandler);
eventRouter.get('/', validateQuery(listEventsQuerySchema), listEventsHandler);
eventRouter.get('/:id', getEventHandler);

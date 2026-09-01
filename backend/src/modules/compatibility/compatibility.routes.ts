import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { compareHandler, matchesHandler } from './compatibility.controller.js';
import { compatibilitySchema, matchesQuerySchema } from './compatibility.schema.js';

export const compatibilityRouter = Router();

compatibilityRouter.post(
  '/',
  requireAuth,
  validateBody(compatibilitySchema),
  asyncHandler(compareHandler),
);

compatibilityRouter.get(
  '/matches',
  requireAuth,
  validateQuery(matchesQuerySchema),
  asyncHandler(matchesHandler),
);

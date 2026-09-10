import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { compareHandler, labHandler, matchesHandler } from './compatibility.controller.js';
import { compatibilitySchema, labSchema, matchesQuerySchema } from './compatibility.schema.js';

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

compatibilityRouter.post('/lab', requireAuth, validateBody(labSchema), asyncHandler(labHandler));

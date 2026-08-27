import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { loginHandler, meHandler, signupHandler } from './auth.controller.js';
import { loginSchema, signupSchema } from './auth.schema.js';

export const authRouter = Router();

authRouter.post('/signup', validateBody(signupSchema), asyncHandler(signupHandler));
authRouter.post('/login', validateBody(loginSchema), asyncHandler(loginHandler));
authRouter.get('/me', requireAuth, asyncHandler(meHandler));

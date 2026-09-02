import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  checkEmailHandler,
  disconnectProviderHandler,
  loginHandler,
  meHandler,
  oauthCallbackHandler,
  oauthConnectHandler,
  oauthStartHandler,
  providersHandler,
  resendVerificationHandler,
  signupHandler,
  verifyEmailHandler,
} from './auth.controller.js';
import {
  checkEmailSchema,
  loginSchema,
  resendVerificationSchema,
  signupSchema,
  verifyEmailSchema,
} from './auth.schema.js';

export const authRouter = Router();

// -- email + password ---------------------------------------------------------

/** Step 1 of the signup wizard: is this address free, before asking for more? */
authRouter.post('/check-email', validateBody(checkEmailSchema), asyncHandler(checkEmailHandler));
authRouter.post('/signup', validateBody(signupSchema), asyncHandler(signupHandler));
authRouter.post('/login', validateBody(loginSchema), asyncHandler(loginHandler));
authRouter.get('/me', requireAuth, asyncHandler(meHandler));

// -- email confirmation -------------------------------------------------------

authRouter.post('/verify-email', validateBody(verifyEmailSchema), asyncHandler(verifyEmailHandler));
authRouter.post(
  '/resend-verification',
  validateBody(resendVerificationSchema),
  asyncHandler(resendVerificationHandler),
);

// -- OAuth --------------------------------------------------------------------

authRouter.get('/providers', providersHandler);

// Declared before `/oauth/:provider` so the literal segments are not captured
// as a provider name.
authRouter.get(
  '/oauth/:provider/callback',
  asyncHandler(async (req, res) => {
    await oauthCallbackHandler(req, res);
  }),
);
authRouter.get('/oauth/:provider/connect', requireAuth, oauthConnectHandler);
authRouter.delete('/oauth/:provider', requireAuth, asyncHandler(disconnectProviderHandler));

/** Browser entry point — redirects to the provider's consent screen. */
authRouter.get('/oauth/:provider', oauthStartHandler);

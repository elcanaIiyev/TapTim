import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createCertificateHandler,
  deleteCertificateHandler,
  getCertificateHandler,
  listCertificatesHandler,
  reverifyCertificateHandler,
  updateCertificateHandler,
} from './certificate.controller.js';
import {
  createCertificateSchema,
  listCertificatesQuerySchema,
  updateCertificateSchema,
} from './certificate.schema.js';

const idParam = z.object({ id: z.string().uuid('Certificate id must be a UUID.') });

export const certificateRouter = Router();

// Certificates are always the caller's own — there is no public listing.
certificateRouter.use(requireAuth);

certificateRouter.get(
  '/',
  validateQuery(listCertificatesQuerySchema),
  asyncHandler(listCertificatesHandler),
);
certificateRouter.post(
  '/',
  validateBody(createCertificateSchema),
  asyncHandler(createCertificateHandler),
);

certificateRouter.get('/:id', validateParams(idParam), asyncHandler(getCertificateHandler));
certificateRouter.patch(
  '/:id',
  validateParams(idParam),
  validateBody(updateCertificateSchema),
  asyncHandler(updateCertificateHandler),
);
certificateRouter.delete('/:id', validateParams(idParam), asyncHandler(deleteCertificateHandler));
certificateRouter.post(
  '/:id/verify',
  validateParams(idParam),
  asyncHandler(reverifyCertificateHandler),
);

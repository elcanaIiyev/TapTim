import type { Request, Response } from 'express';
import { getValidatedQuery } from '../../middleware/validate.middleware.js';
import { HttpError } from '../../utils/http-error.js';
import type {
  CreateCertificateInput,
  ListCertificatesQuery,
  UpdateCertificateInput,
} from './certificate.schema.js';
import * as certificateService from './certificate.service.js';

function requireUser(req: Request) {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
}

export async function listCertificatesHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const query = getValidatedQuery<ListCertificatesQuery>(req);
  const items = await certificateService.listCertificates(user.id, query);
  res.status(200).json({ data: items, meta: { total: items.length } });
}

export async function getCertificateHandler(req: Request, res: Response) {
  const user = requireUser(req);
  res.status(200).json({ data: await certificateService.getCertificate(req.params.id, user.id) });
}

export async function createCertificateHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const created = await certificateService.createCertificate(
    req.body as CreateCertificateInput,
    user.id,
  );
  res.status(201).json({ data: created });
}

export async function updateCertificateHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const updated = await certificateService.updateCertificate(
    req.params.id,
    req.body as UpdateCertificateInput,
    user.id,
  );
  res.status(200).json({ data: updated });
}

export async function deleteCertificateHandler(req: Request, res: Response) {
  const user = requireUser(req);
  await certificateService.deleteCertificate(req.params.id, user.id);
  res.status(204).send();
}

export async function reverifyCertificateHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const verified = await certificateService.reverifyCertificate(req.params.id, user.id);
  res.status(200).json({ data: verified });
}

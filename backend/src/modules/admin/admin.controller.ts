import type { Request, Response } from 'express';
import { getValidatedQuery } from '../../middleware/validate.middleware.js';
import { HttpError } from '../../utils/http-error.js';
import type { ListAccountsQuery, UpdateAccountInput } from './admin.schema.js';
import * as adminService from './admin.service.js';

function requireUser(req: Request) {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
}

export async function listAccountsHandler(req: Request, res: Response) {
  const query = getValidatedQuery<ListAccountsQuery>(req);
  const { items, total, limit, offset, summary } = await adminService.listAccounts(query);
  res.status(200).json({ data: items, meta: { total, limit, offset, summary } });
}

export async function updateAccountHandler(req: Request, res: Response) {
  const actor = requireUser(req);
  const updated = await adminService.updateAccount(
    req.params.id,
    req.body as UpdateAccountInput,
    actor,
  );
  res.status(200).json({ data: updated });
}

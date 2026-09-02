import type { Request, Response } from 'express';
import { getValidatedQuery } from '../../middleware/validate.middleware.js';
import { HttpError } from '../../utils/http-error.js';
import type {
  BanAccountInput,
  DeleteAccountInput,
  ListAccountsQuery,
  UpdateAccountInput,
} from './admin.schema.js';
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


export async function banAccountHandler(req: Request, res: Response) {
  const actor = requireUser(req);
  const updated = await adminService.banAccount(
    req.params.id,
    req.body as BanAccountInput,
    actor,
  );
  res.status(200).json({ data: updated });
}

export async function unbanAccountHandler(req: Request, res: Response) {
  const actor = requireUser(req);
  res.status(200).json({ data: await adminService.unbanAccount(req.params.id, actor) });
}

export async function deleteAccountHandler(req: Request, res: Response) {
  const actor = requireUser(req);
  const removed = await adminService.deleteAccount(
    req.params.id,
    req.body as DeleteAccountInput,
    actor,
  );
  res.status(200).json({ data: { deleted: true, email: removed.email } });
}

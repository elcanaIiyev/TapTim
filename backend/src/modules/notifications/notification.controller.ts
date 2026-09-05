import type { Request, Response } from 'express';
import { HttpError } from '../../utils/http-error.js';
import * as notifications from './notification.service.js';

function requireUser(req: Request) {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
}

export async function listHandler(req: Request, res: Response) {
  const user = requireUser(req);
  res.status(200).json({ data: await notifications.feed(user.id) });
}

export async function markReadHandler(req: Request, res: Response) {
  const user = requireUser(req);
  res.status(200).json({ data: await notifications.markRead(user.id, req.params.id) });
}

export async function markAllReadHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const marked = await notifications.markAllRead(user.id);
  res.status(200).json({ data: { marked } });
}

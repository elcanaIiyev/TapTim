import type { Request, Response } from 'express';
import { getValidatedQuery } from '../../middleware/validate.middleware.js';
import { HttpError } from '../../utils/http-error.js';
import { toPublicUser } from './user.model.js';
import type { ListUsersQuery, UpdateProfileInput } from './user.schema.js';
import * as userService from './user.service.js';

function requireUser(req: Request) {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
}

export async function listUsersHandler(req: Request, res: Response) {
  const query = getValidatedQuery<ListUsersQuery>(req);
  const { items, total, limit, offset } = await userService.listUsers(query, req.user?.id);
  res.status(200).json({ data: items, meta: { total, limit, offset } });
}

export async function getMeHandler(req: Request, res: Response) {
  const user = requireUser(req);
  res.status(200).json({
    data: {
      ...toPublicUser(user),
      profileCompleteness: userService.profileCompleteness(user),
    },
  });
}

export async function updateMeHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const updated = await userService.updateProfile(user.id, req.body as UpdateProfileInput);
  res.status(200).json({ data: updated });
}

export async function getUserHandler(req: Request, res: Response) {
  res.status(200).json({ data: await userService.getProfile(req.params.id) });
}

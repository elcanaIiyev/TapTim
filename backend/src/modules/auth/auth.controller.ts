import type { Request, Response } from 'express';
import { HttpError } from '../../utils/http-error.js';
import { toPublicUser } from '../users/user.model.js';
import type { LoginInput, SignupInput } from './auth.schema.js';
import * as authService from './auth.service.js';

export async function signupHandler(req: Request, res: Response) {
  const result = await authService.signup(req.body as SignupInput);
  res.status(201).json({ data: result });
}

export async function loginHandler(req: Request, res: Response) {
  const result = await authService.login(req.body as LoginInput);
  res.status(200).json({ data: result });
}

export async function meHandler(req: Request, res: Response) {
  if (!req.user) {
    throw HttpError.unauthorized();
  }
  res.status(200).json({ data: toPublicUser(req.user) });
}

import type { Request, Response } from 'express';
import { HttpError } from '../../utils/http-error.js';
import type {
  RequestConnectionInput,
  RespondConnectionInput,
  SendMessageInput,
} from './connection.schema.js';
import * as connectionService from './connection.service.js';

function requireUser(req: Request) {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
}

export async function overviewHandler(req: Request, res: Response) {
  const user = requireUser(req);
  res.status(200).json({ data: await connectionService.overview(user.id) });
}

export async function requestHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { userId } = req.body as RequestConnectionInput;
  res.status(201).json({ data: await connectionService.requestConnection(user.id, userId) });
}

export async function respondHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { action } = req.body as RespondConnectionInput;
  res.status(200).json({ data: await connectionService.respond(user.id, req.params.id, action) });
}

export async function disconnectHandler(req: Request, res: Response) {
  const user = requireUser(req);
  await connectionService.disconnect(user.id, req.params.id);
  res.status(204).send();
}

export async function conversationHandler(req: Request, res: Response) {
  const user = requireUser(req);
  res.status(200).json({ data: await connectionService.conversation(user.id, req.params.userId) });
}

export async function sendMessageHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { body } = req.body as SendMessageInput;
  const message = await connectionService.sendMessage(user.id, req.params.userId, body);
  res.status(201).json({ data: message });
}

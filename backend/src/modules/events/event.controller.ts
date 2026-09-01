import type { Request, Response } from 'express';
import { getValidatedQuery } from '../../middleware/validate.middleware.js';
import { HttpError } from '../../utils/http-error.js';
import type { CreateEventInput, ListEventsQuery, UpdateEventInput } from './event.schema.js';
import * as eventService from './event.service.js';

function requireUser(req: Request) {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
}

export async function listEventsHandler(req: Request, res: Response) {
  const query = getValidatedQuery<ListEventsQuery>(req);
  const { items, total, limit, offset } = await eventService.listEvents(query);
  res.status(200).json({ data: items, meta: { total, limit, offset } });
}

export async function listCategoriesHandler(_req: Request, res: Response) {
  res.status(200).json({ data: await eventService.listCategories() });
}

export async function getEventHandler(req: Request, res: Response) {
  res.status(200).json({ data: await eventService.getEventById(req.params.id) });
}

export async function createEventHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const event = await eventService.createEvent(req.body as CreateEventInput, user.id);
  res.status(201).json({ data: event });
}

export async function updateEventHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const event = await eventService.updateEvent(
    req.params.id,
    req.body as UpdateEventInput,
    user.id,
  );
  res.status(200).json({ data: event });
}

export async function deleteEventHandler(req: Request, res: Response) {
  const user = requireUser(req);
  await eventService.deleteEvent(req.params.id, user);
  res.status(204).send();
}

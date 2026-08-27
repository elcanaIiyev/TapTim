import type { Request, Response } from 'express';
import { getValidatedQuery } from '../../middleware/validate.middleware.js';
import type { ListEventsQuery } from './event.schema.js';
import * as eventService from './event.service.js';

export function listEventsHandler(req: Request, res: Response) {
  const query = getValidatedQuery<ListEventsQuery>(req);
  const { items, total, limit, offset } = eventService.listEvents(query);
  res.status(200).json({ data: items, meta: { total, limit, offset } });
}

export function listCategoriesHandler(_req: Request, res: Response) {
  res.status(200).json({ data: eventService.listCategories() });
}

export function getEventHandler(req: Request, res: Response) {
  res.status(200).json({ data: eventService.getEventById(req.params.id) });
}

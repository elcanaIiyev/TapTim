import type { Request, Response } from 'express';
import { getValidatedQuery } from '../../middleware/validate.middleware.js';
import { HttpError } from '../../utils/http-error.js';
import { labReport } from '../events/event-stats.service.js';
import type { CompatibilityInput, LabInput, MatchesQuery } from './compatibility.schema.js';
import * as compatibilityService from './compatibility.service.js';

function requireUser(req: Request) {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
}

export async function compareHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const result = await compatibilityService.comparePair(req.body as CompatibilityInput, user);
  res.status(200).json({ data: result });
}

export async function matchesHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const query = getValidatedQuery<MatchesQuery>(req);
  const matches = await compatibilityService.findMatches(query, user);
  res.status(200).json({ data: matches, meta: { total: matches.length } });
}

export async function labHandler(req: Request, res: Response) {
  requireUser(req);
  const { eventId, userIds } = req.body as LabInput;
  res.status(200).json({ data: await labReport(eventId, userIds) });
}

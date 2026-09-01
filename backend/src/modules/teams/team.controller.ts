import type { Request, Response } from 'express';
import { getValidatedQuery } from '../../middleware/validate.middleware.js';
import { HttpError } from '../../utils/http-error.js';
import type {
  ApplyToTeamInput,
  CreateTeamInput,
  InviteToTeamInput,
  ListRequestsQuery,
  ListTeamsQuery,
  RespondToRequestInput,
  SuggestionsQuery,
  TransferOwnershipInput,
  UpdateTeamInput,
} from './team.schema.js';
import * as teamService from './team.service.js';

function requireUser(req: Request) {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
}

export async function listTeamsHandler(req: Request, res: Response) {
  const query = getValidatedQuery<ListTeamsQuery>(req);
  const { items, total, limit, offset } = await teamService.listTeams(query, req.user?.id);
  res.status(200).json({ data: items, meta: { total, limit, offset } });
}

export async function getTeamHandler(req: Request, res: Response) {
  res.status(200).json({ data: await teamService.getTeam(req.params.id) });
}

export async function createTeamHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const team = await teamService.createTeam(req.body as CreateTeamInput, user);
  res.status(201).json({ data: team });
}

export async function updateTeamHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const team = await teamService.updateTeam(req.params.id, req.body as UpdateTeamInput, user.id);
  res.status(200).json({ data: team });
}

export async function deleteTeamHandler(req: Request, res: Response) {
  const user = requireUser(req);
  await teamService.deleteTeam(req.params.id, user);
  res.status(204).send();
}

export async function applyToTeamHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const request = await teamService.applyToTeam(
    req.params.id,
    req.body as ApplyToTeamInput,
    user,
  );
  res.status(201).json({ data: request });
}

export async function inviteToTeamHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const request = await teamService.inviteToTeam(
    req.params.id,
    req.body as InviteToTeamInput,
    user,
  );
  res.status(201).json({ data: request });
}

export async function respondToRequestHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { action } = req.body as RespondToRequestInput;
  const request = await teamService.respondToRequest(req.params.requestId, action, user);
  res.status(200).json({ data: request });
}

export async function listRequestsHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const query = getValidatedQuery<ListRequestsQuery>(req);
  res.status(200).json({ data: await teamService.listRequests(query, user) });
}

export async function leaveTeamHandler(req: Request, res: Response) {
  const user = requireUser(req);
  await teamService.leaveTeam(req.params.id, user);
  res.status(204).send();
}

export async function removeMemberHandler(req: Request, res: Response) {
  const user = requireUser(req);
  await teamService.removeMember(req.params.id, req.params.userId, user.id);
  res.status(204).send();
}

export async function transferOwnershipHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { newOwnerId } = req.body as TransferOwnershipInput;
  const team = await teamService.transferOwnership(req.params.id, newOwnerId, user.id);
  res.status(200).json({ data: team });
}

export async function suggestMembersHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const query = getValidatedQuery<SuggestionsQuery>(req);
  const suggestions = await teamService.suggestMembers(req.params.id, query, user.id);
  res.status(200).json({ data: suggestions, meta: { total: suggestions.length } });
}

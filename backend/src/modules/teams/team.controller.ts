import type { Request, Response } from 'express';
import { getValidatedQuery } from '../../middleware/validate.middleware.js';
import { deleteImage, isStorageConfigured } from '../../services/storage.js';
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
import * as eventStats from '../events/event-stats.service.js';
import * as teamChat from './team-chat.service.js';
import * as teamPublic from './team-public.service.js';

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

export async function teamRequestsHandler(req: Request, res: Response) {
  const user = requireUser(req);
  res.status(200).json({ data: await teamService.listTeamRequests(req.params.id, user) });
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

/**
 * Suggestions are scored under the *event's* weights and against what this team
 * is missing for it, rather than in the abstract — a great generalist who
 * duplicates the team is not the answer a team with a hole wants.
 */
export async function suggestMembersHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const query = getValidatedQuery<SuggestionsQuery>(req);
  const suggestions = await eventStats.suggestForTeam(req.params.id, user.id, query.limit);
  res.status(200).json({ data: suggestions, meta: { total: suggestions.length } });
}

/** What this team is missing for its event. Owner or member. */
/**
 * Upload or replace a team's logo.
 *
 * The old object is deleted only after the row has been written, and the delete
 * is not awaited: a failed cleanup should leave an orphan in the bucket, not
 * fail a request whose actual work already succeeded.
 */
export async function publicTeamPageHandler(req: Request, res: Response) {
  res.status(200).json({ data: await teamPublic.publicPage(req.params.id) });
}

export async function teamChannelHandler(req: Request, res: Response) {
  const user = requireUser(req);
  res.status(200).json({ data: await teamChat.channel(req.params.id, user.id) });
}

export async function sendTeamMessageHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { body } = req.body as { body: string };
  res.status(201).json({ data: await teamChat.send(req.params.id, user.id, body) });
}

export async function uploadTeamLogoHandler(req: Request, res: Response) {
  const user = requireUser(req);

  if (!isStorageConfigured()) {
    throw HttpError.badRequest('Image uploads are not configured on this server.');
  }
  const file = req.file;
  if (!file) {
    throw HttpError.badRequest('Attach an image under the field name "logo".');
  }

  const result = await teamService.setTeamLogo(req.params.id, user.id, {
    buffer: file.buffer,
    mimetype: file.mimetype,
    size: file.size,
  });
  if (result.previousPath) void deleteImage(result.previousPath);

  res.status(200).json({ data: result.team });
}

export async function removeTeamLogoHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const result = await teamService.removeTeamLogo(req.params.id, user.id);
  if (result.previousPath) void deleteImage(result.previousPath);
  res.status(200).json({ data: result.team });
}

export async function teamGapsHandler(req: Request, res: Response) {
  requireUser(req);
  res.status(200).json({ data: await eventStats.teamReport(req.params.id) });
}

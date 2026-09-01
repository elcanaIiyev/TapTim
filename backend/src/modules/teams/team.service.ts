import { certificateStore } from '../../data/certificate.store.js';
import { eventStore } from '../../data/event.store.js';
import {
  AlreadyOnEventTeamError,
  TeamFullError,
  teamStore,
  type TeamUpdate,
} from '../../data/team.store.js';
import { userStore } from '../../data/user.store.js';
import { isUniqueViolation } from '../../db/pool.js';
import { canModerate } from '../../middleware/admin.middleware.js';
import { HttpError } from '../../utils/http-error.js';
import { scoreAgainstTeam } from '../compatibility/compatibility.engine.js';
import { toDirectoryUser, type DirectoryUser, type UserRecord } from '../users/user.model.js';
import type { TeamDetail, TeamRecord, TeamRequestRecord } from './team.model.js';
import type {
  ApplyToTeamInput,
  CreateTeamInput,
  InviteToTeamInput,
  ListRequestsQuery,
  ListTeamsQuery,
  SuggestionsQuery,
  UpdateTeamInput,
} from './team.schema.js';

/** Translates the store's race-condition errors into HTTP responses. */
function rethrowAsHttp(error: unknown): never {
  if (error instanceof TeamFullError) {
    throw HttpError.conflict(error.message);
  }
  if (error instanceof AlreadyOnEventTeamError) {
    throw HttpError.conflict(error.message);
  }
  if (isUniqueViolation(error, 'teams_event_name_key')) {
    throw HttpError.conflict('A team with this name already exists for this event.');
  }
  if (isUniqueViolation(error, 'team_requests_open_key')) {
    throw HttpError.conflict('There is already an open request for this participant and team.');
  }
  if (isUniqueViolation(error, 'team_members_pkey')) {
    throw HttpError.conflict('This participant is already on the team.');
  }
  throw error;
}

export interface ListTeamsResult {
  items: TeamRecord[];
  total: number;
  limit: number;
  offset: number;
}

export async function listTeams(
  query: ListTeamsQuery,
  viewerId?: string,
): Promise<ListTeamsResult> {
  if (query.mine && !viewerId) {
    throw HttpError.unauthorized('Sign in to list your own teams.');
  }

  const { items, total } = await teamStore.list({
    eventId: query.eventId,
    status: query.status,
    lookingForRole: query.lookingForRole,
    search: query.search,
    hasOpenSeats: query.hasOpenSeats,
    memberId: query.mine ? viewerId : undefined,
    limit: query.limit,
    offset: query.offset,
  });

  return { items, total, limit: query.limit, offset: query.offset };
}

export async function getTeam(id: string): Promise<TeamDetail> {
  const team = await teamStore.findDetail(id);
  if (!team) {
    throw HttpError.notFound(`No team found with id "${id}".`);
  }
  return team;
}

async function requireOwnedTeam(id: string, actorId: string): Promise<TeamDetail> {
  const team = await getTeam(id);
  if (team.ownerId !== actorId) {
    throw HttpError.forbidden('Only the team owner can do this.');
  }
  return team;
}

export async function createTeam(input: CreateTeamInput, owner: UserRecord): Promise<TeamDetail> {
  const event = await eventStore.findById(input.eventId);
  if (!event) {
    throw HttpError.notFound(`No event found with id "${input.eventId}".`);
  }

  if (input.maxSize > event.teamSize.max) {
    throw HttpError.badRequest(
      `${event.name} allows at most ${event.teamSize.max} people per team.`,
      [{ field: 'maxSize', message: `Must be ${event.teamSize.max} or fewer for this event.` }],
    );
  }

  const existing = await teamStore.findEventMembership(owner.id, input.eventId);
  if (existing) {
    throw HttpError.conflict('You are already on a team for this event.', {
      teamId: existing,
    });
  }

  try {
    return await teamStore.create({
      eventId: input.eventId,
      ownerId: owner.id,
      ownerRole: owner.primaryRole,
      name: input.name,
      description: input.description,
      lookingFor: input.lookingFor,
      requiredSkills: input.requiredSkills,
      maxSize: input.maxSize,
    });
  } catch (error) {
    rethrowAsHttp(error);
  }
}

export async function updateTeam(
  id: string,
  input: UpdateTeamInput,
  actorId: string,
): Promise<TeamDetail> {
  const team = await requireOwnedTeam(id, actorId);

  // Shrinking below the current roster would leave members in seats that no
  // longer exist, so it is rejected rather than silently truncating.
  if (input.maxSize !== undefined && input.maxSize < team.memberCount) {
    throw HttpError.badRequest(
      `The team already has ${team.memberCount} members.`,
      [{ field: 'maxSize', message: `Must be at least ${team.memberCount}.` }],
    );
  }

  const patch: TeamUpdate = {
    name: input.name,
    description: input.description,
    lookingFor: input.lookingFor,
    requiredSkills: input.requiredSkills,
    maxSize: input.maxSize,
    status: input.status,
  };
  for (const key of Object.keys(patch) as Array<keyof TeamUpdate>) {
    if (patch[key] === undefined) delete patch[key];
  }

  try {
    await teamStore.update(id, patch);
  } catch (error) {
    rethrowAsHttp(error);
  }

  return getTeam(id);
}

/**
 * Deleting a team is the one team action a moderator can take without owning
 * it: an abandoned or abusive team otherwise sits on the event forever, since
 * only its owner could remove it and the owner is exactly who has gone quiet.
 */
export async function deleteTeam(id: string, actor: UserRecord): Promise<void> {
  const team = await getTeam(id);

  if (team.ownerId !== actor.id && !canModerate(actor.accountRole)) {
    throw HttpError.forbidden('Only the team owner can do this.');
  }

  const removed = await teamStore.remove(id);
  if (!removed) throw HttpError.notFound(`No team found with id "${id}".`);
}

// -- membership ---------------------------------------------------------------

export async function leaveTeam(teamId: string, user: UserRecord): Promise<void> {
  const team = await getTeam(teamId);

  const isMember = team.members.some((member) => member.userId === user.id);
  if (!isMember) {
    throw HttpError.badRequest('You are not a member of this team.');
  }

  // An ownerless team has nobody who can accept requests or edit the roster,
  // so the owner has to hand over first — or delete the team outright.
  if (team.ownerId === user.id) {
    throw HttpError.badRequest(
      team.memberCount > 1
        ? 'Transfer ownership to another member before leaving.'
        : 'You are the last member — delete the team instead of leaving it.',
    );
  }

  await teamStore.removeMember(teamId, user.id);
}

export async function removeMember(
  teamId: string,
  memberId: string,
  actorId: string,
): Promise<void> {
  const team = await requireOwnedTeam(teamId, actorId);

  if (memberId === team.ownerId) {
    throw HttpError.badRequest('The owner cannot be removed from their own team.');
  }
  if (!team.members.some((member) => member.userId === memberId)) {
    throw HttpError.notFound('That participant is not on this team.');
  }

  await teamStore.removeMember(teamId, memberId);
}

/** Hands the team to an existing member. The previous owner stays on the roster. */
export async function transferOwnership(
  teamId: string,
  newOwnerId: string,
  actorId: string,
): Promise<TeamDetail> {
  const team = await requireOwnedTeam(teamId, actorId);

  if (newOwnerId === actorId) {
    throw HttpError.badRequest('You already own this team.');
  }
  if (!team.members.some((member) => member.userId === newOwnerId)) {
    throw HttpError.badRequest('The new owner must already be a member of the team.');
  }

  await teamStore.update(teamId, { ownerId: newOwnerId });
  await teamStore.setOwnerFlag(teamId, newOwnerId);
  return getTeam(teamId);
}

// -- requests -----------------------------------------------------------------

function assertJoinable(team: TeamRecord): void {
  if (team.status === 'disbanded') {
    throw HttpError.conflict('This team has been disbanded.');
  }
  if (team.status === 'locked') {
    throw HttpError.conflict('This team has locked its roster.');
  }
  if (team.openSeats === 0) {
    throw HttpError.conflict('This team has no open seats left.');
  }
}

export async function applyToTeam(
  teamId: string,
  input: ApplyToTeamInput,
  user: UserRecord,
): Promise<TeamRequestRecord> {
  const team = await getTeam(teamId);
  assertJoinable(team);

  if (team.members.some((member) => member.userId === user.id)) {
    throw HttpError.conflict('You are already on this team.');
  }

  const existing = await teamStore.findEventMembership(user.id, team.eventId);
  if (existing) {
    throw HttpError.conflict('You are already on a team for this event.', { teamId: existing });
  }

  // A pending invite means the team already wants them: accept it rather than
  // opening a second request that says the same thing.
  const invites = await teamStore.listRequests({
    teamId,
    userId: user.id,
    kind: 'invite',
    status: 'pending',
  });
  if (invites.length > 0) {
    throw HttpError.conflict('This team has already invited you — accept the invitation instead.', {
      requestId: invites[0].id,
    });
  }

  try {
    return await teamStore.createRequest({
      teamId,
      userId: user.id,
      kind: 'application',
      message: input.message,
      createdBy: user.id,
    });
  } catch (error) {
    rethrowAsHttp(error);
  }
}

export async function inviteToTeam(
  teamId: string,
  input: InviteToTeamInput,
  actor: UserRecord,
): Promise<TeamRequestRecord> {
  const team = await requireOwnedTeam(teamId, actor.id);
  assertJoinable(team);

  const invitee = await userStore.findById(input.userId);
  if (!invitee) {
    throw HttpError.notFound(`No participant found with id "${input.userId}".`);
  }
  if (team.members.some((member) => member.userId === invitee.id)) {
    throw HttpError.conflict('That participant is already on this team.');
  }

  const existing = await teamStore.findEventMembership(invitee.id, team.eventId);
  if (existing) {
    throw HttpError.conflict('That participant is already on a team for this event.');
  }

  try {
    return await teamStore.createRequest({
      teamId,
      userId: invitee.id,
      kind: 'invite',
      message: input.message,
      createdBy: actor.id,
    });
  } catch (error) {
    rethrowAsHttp(error);
  }
}

export async function respondToRequest(
  requestId: string,
  action: 'accept' | 'decline' | 'cancel',
  actor: UserRecord,
): Promise<TeamRequestRecord> {
  const request = await teamStore.findRequestById(requestId);
  if (!request) {
    throw HttpError.notFound(`No request found with id "${requestId}".`);
  }
  if (request.status !== 'pending') {
    throw HttpError.conflict(`This request was already ${request.status}.`);
  }

  const team = await getTeam(request.teamId);

  // Who may answer depends on which way the request points: the recipient of an
  // invitation, or the owner of the team an application was sent to.
  const recipientId = request.kind === 'invite' ? request.userId : team.ownerId;

  if (action === 'cancel') {
    if (request.createdBy !== actor.id) {
      throw HttpError.forbidden('Only whoever raised this request can cancel it.');
    }
    const cancelled = await teamStore.setRequestStatus(requestId, 'cancelled');
    if (!cancelled) throw HttpError.conflict('This request is no longer pending.');
    return cancelled;
  }

  if (recipientId !== actor.id) {
    throw HttpError.forbidden('This request is not addressed to you.');
  }

  if (action === 'decline') {
    const declined = await teamStore.setRequestStatus(requestId, 'declined');
    if (!declined) throw HttpError.conflict('This request is no longer pending.');
    return declined;
  }

  assertJoinable(team);

  const joiner =
    request.userId === actor.id ? actor : await userStore.findById(request.userId);
  if (!joiner) {
    throw HttpError.notFound('The participant on this request no longer exists.');
  }

  try {
    const accepted = await teamStore.acceptRequest(requestId, joiner.primaryRole);
    if (!accepted) throw HttpError.conflict('This request is no longer pending.');
    return accepted;
  } catch (error) {
    rethrowAsHttp(error);
  }
}

export async function listRequests(
  query: ListRequestsQuery,
  actor: UserRecord,
): Promise<TeamRequestRecord[]> {
  if (query.direction === 'outgoing') {
    // Everything this account raised — applications it sent and invitations it
    // issued as a team owner.
    const raised = await teamStore.listRequests({ kind: query.kind, status: query.status });
    return raised.filter((request) => request.createdBy === actor.id);
  }

  const [invitesToMe, applicationsToMyTeams] = await Promise.all([
    teamStore.listRequests({ userId: actor.id, kind: 'invite', status: query.status }),
    teamStore.listRequests({ ownerId: actor.id, kind: 'application', status: query.status }),
  ]);

  const combined = [...invitesToMe, ...applicationsToMyTeams].filter(
    (request) => query.kind === undefined || request.kind === query.kind,
  );

  return combined.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// -- suggestions --------------------------------------------------------------

export interface MemberSuggestion {
  user: DirectoryUser;
  score: number;
  band: 'excellent' | 'strong' | 'moderate' | 'weak';
  averagePairScore: number;
  fillsNeededRole: boolean;
  matchedRequiredSkills: string[];
  summary: string;
}

/**
 * Ranks participants who could fill a team's open seats. Candidates already on
 * a team for the same event are excluded — they are not available, so scoring
 * them would just pad the list.
 */
export async function suggestMembers(
  teamId: string,
  query: SuggestionsQuery,
  actorId: string,
): Promise<MemberSuggestion[]> {
  const team = await requireOwnedTeam(teamId, actorId);

  if (team.openSeats === 0) return [];

  const takenUserIds = await teamStore.findEventMemberIds(team.eventId);

  const { items: candidates } = await userStore.list({
    lookingForTeam: true,
    primaryRole: undefined,
    excludeUserIds: takenUserIds.length > 0 ? takenUserIds : undefined,
    // Over-fetch relative to `limit`: scoring happens in the application, so
    // the database cannot order by fit and the top N must be picked here.
    limit: 50,
    offset: 0,
  });

  if (candidates.length === 0) return [];

  const members = await userStore.findManyByIds(team.members.map((member) => member.userId));

  const certificateCounts = await certificateStore.verifiedCountsFor([
    ...candidates.map((candidate) => candidate.id),
    ...members.map((member) => member.id),
  ]);

  return candidates
    .map((candidate) => {
      const fit = scoreAgainstTeam(
        candidate,
        members,
        { lookingFor: team.lookingFor, requiredSkills: team.requiredSkills },
        certificateCounts,
      );
      return { user: toDirectoryUser(candidate), ...fit };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, query.limit);
}

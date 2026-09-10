import { certificateStore } from '../../data/certificate.store.js';
import { eventStore } from '../../data/event.store.js';
import { teamChatStore } from '../../data/team-chat.store.js';
import {
  AlreadyOnEventTeamError,
  TeamFullError,
  teamStore,
  type TeamUpdate,
} from '../../data/team.store.js';
import { userStore } from '../../data/user.store.js';
import { isUniqueViolation } from '../../db/pool.js';
import { canModerate } from '../../middleware/admin.middleware.js';
import { uploadTeamLogo } from '../../services/storage.js';
import { HttpError } from '../../utils/http-error.js';
import { notify, notifyMany } from '../notifications/notification.service.js';
import { scoreAgainstTeam, type TeamFitResult } from '../compatibility/compatibility.engine.js';
import {
  displayRole,
  toDirectoryUser,
  type DirectoryUser,
  type UserRecord,
} from '../users/user.model.js';
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

/** A team as listed, with the viewer's unread count when it is their own. */
export type ListedTeam = TeamRecord & { unread?: number };

export interface ListTeamsResult {
  items: ListedTeam[];
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

  // Unread counts only make sense for someone's own teams, and only there is
  // the extra query worth issuing — browsing a public event's teams should not
  // pay for a badge nobody is shown.
  if (query.mine && viewerId) {
    const unread = await teamChatStore.unreadCounts(viewerId);
    return {
      items: items.map((team) => ({ ...team, unread: unread.get(team.id) ?? 0 })),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

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
      // `team_members.role` is the position this person plays *on this team* —
      // still singular, because a roster slot is one seat. Their first-listed
      // role is the sensible default; a per-team override is a separate feature.
      ownerRole: displayRole(owner.roles) ?? 'Full-Stack Developer',
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

/**
 * Replaces a team's logo.
 *
 * Returns the path of the image it displaced so the caller can delete it after
 * the row is committed. Deleting inside this function would mean a failed write
 * had already destroyed the old file, leaving the team with no logo at all.
 */
export async function setTeamLogo(
  id: string,
  actorId: string,
  file: { buffer: Buffer; mimetype: string; size: number },
): Promise<{ team: TeamDetail; previousPath: string | null }> {
  await requireOwnedTeam(id, actorId);
  const previousPath = await teamStore.logoPathOf(id);
  const stored = await uploadTeamLogo(id, file);

  const updated = await teamStore.update(id, { logoUrl: stored.url, logoPath: stored.path });
  if (!updated) throw HttpError.notFound('That team no longer exists.');

  return { team: await getTeam(id), previousPath };
}

/** Removes the logo, falling the UI back to the generated monogram. */
export async function removeTeamLogo(
  id: string,
  actorId: string,
): Promise<{ team: TeamDetail; previousPath: string | null }> {
  await requireOwnedTeam(id, actorId);
  const previousPath = await teamStore.logoPathOf(id);

  const updated = await teamStore.update(id, { logoUrl: null, logoPath: null });
  if (!updated) throw HttpError.notFound('That team no longer exists.');

  return { team: await getTeam(id), previousPath };
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

  // Being removed is otherwise entirely silent — the team simply stops
  // appearing on your Teams tab with no explanation.
  await notify({
    userId: memberId,
    actorId: actorId,
    kind: 'removed-from-team',
    title: `You were removed from ${team.name}`,
    link: '/teams',
  });
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
    const created = await teamStore.createRequest({
      teamId,
      userId: user.id,
      kind: 'application',
      message: input.message,
      createdBy: user.id,
    });

    // The owner is the one who has to act on this, and until now the only way
    // to find out was to go and look at the team.
    await notify({
      userId: team.ownerId,
      actorId: user.id,
      kind: 'team-application',
      title: `${user.fullName} asked to join ${team.name}`,
      body: input.message,
      link: `/teams/${teamId}`,
    });

    return created;
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
    const created = await teamStore.createRequest({
      teamId,
      userId: invitee.id,
      kind: 'invite',
      message: input.message,
      createdBy: actor.id,
    });

    await notify({
      userId: invitee.id,
      actorId: actor.id,
      kind: 'team-invitation',
      title: `${actor.fullName} invited you to ${team.name}`,
      body: input.message,
      link: '/teams',
    });

    return created;
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
    // Whoever raised it may withdraw it, and so may whoever owns the team now.
    // An invitation belongs to the team rather than to the person who clicked,
    // and after a handover it must not sit in the new owner's list as something
    // they can see but not take back.
    const ownsTeamNow = request.kind === 'invite' && team.ownerId === actor.id;
    if (request.createdBy !== actor.id && !ownsTeamNow) {
      throw HttpError.forbidden('Only whoever raised this request, or the team owner, can cancel it.');
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

    // Told to whoever raised it — a decline is otherwise completely silent, and
    // someone waiting on an answer deserves to stop waiting.
    await notify({
      userId: request.createdBy,
      actorId: actor.id,
      kind: 'request-declined',
      title:
        request.kind === 'invite'
          ? `${actor.fullName} declined your invitation to ${team.name}`
          : `${team.name} declined your application`,
      link: `/teams/${team.id}`,
    });

    return declined;
  }

  assertJoinable(team);

  const joiner =
    request.userId === actor.id ? actor : await userStore.findById(request.userId);
  if (!joiner) {
    throw HttpError.notFound('The participant on this request no longer exists.');
  }

  try {
    const accepted = await teamStore.acceptRequest(
      requestId,
      displayRole(joiner.roles) ?? 'Full-Stack Developer',
    );
    if (!accepted) throw HttpError.conflict('This request is no longer pending.');

    // Two audiences, and they are not told the same thing. Whoever raised the
    // request wants to know it was answered; the people already on the team
    // want to know who just walked in.
    await notify({
      userId: request.createdBy,
      actorId: actor.id,
      kind: 'request-accepted',
      title:
        request.kind === 'invite'
          ? `${joiner.fullName} joined ${team.name}`
          : `You are in — ${team.name} accepted you`,
      link: `/teams/${team.id}`,
    });

    await notifyMany(
      team.members
        .map((member) => member.userId)
        .filter((id) => id !== joiner.id && id !== request.createdBy),
      {
        actorId: joiner.id,
        kind: 'team-member-joined',
        title: `${joiner.fullName} joined ${team.name}`,
        link: `/teams/${team.id}`,
      },
    );

    return accepted;
  } catch (error) {
    rethrowAsHttp(error);
  }
}

/**
 * A request as a person reads it.
 *
 * The bare record names two ids and nothing else, which is why the Teams page
 * could only ever say "you were invited to a team" — it had no way to say which
 * team, or who, short of a request per row. The names ride along instead.
 */
export interface TeamRequestView extends TeamRequestRecord {
  team: { id: string; name: string; eventId: string; logoUrl: string | null };
  /** Who the request is about: the invitee, or the applicant. */
  user: {
    id: string;
    fullName: string;
    firstName: string;
    avatarUrl: string | null;
    roles: string[];
  } | null;
}

async function withNames(requests: TeamRequestRecord[]): Promise<TeamRequestView[]> {
  if (requests.length === 0) return [];

  const teamIds = [...new Set(requests.map((request) => request.teamId))];
  const [teams, people] = await Promise.all([
    Promise.all(teamIds.map((id) => teamStore.findById(id))),
    userStore.findManyByIds([...new Set(requests.map((request) => request.userId))]),
  ]);
  const teamById = new Map(
    teams.filter((team): team is TeamRecord => team !== null).map((team) => [team.id, team]),
  );
  const personById = new Map(people.map((person) => [person.id, person]));

  return requests.flatMap((request) => {
    const team = teamById.get(request.teamId);
    // Gone between the two reads. Nothing about it is actionable any more.
    if (!team) return [];
    const person = personById.get(request.userId);
    return [
      {
        ...request,
        team: { id: team.id, name: team.name, eventId: team.eventId, logoUrl: team.logoUrl },
        user: person
          ? {
              id: person.id,
              fullName: person.fullName,
              firstName: person.firstName,
              avatarUrl: person.avatarUrl,
              roles: person.roles,
            }
          : null,
      },
    ];
  });
}

export async function listRequests(
  query: ListRequestsQuery,
  actor: UserRecord,
): Promise<TeamRequestView[]> {
  if (query.direction === 'outgoing') {
    // Everything this account raised — applications it sent and invitations it
    // issued as a team owner. Filtered in SQL: this used to fetch the newest
    // 200 requests on the whole platform and keep the caller's, which would
    // have quietly dropped theirs as soon as the site was busier than that.
    return withNames(
      await teamStore.listRequests({ createdBy: actor.id, kind: query.kind, status: query.status }),
    );
  }

  const [invitesToMe, applicationsToMyTeams] = await Promise.all([
    teamStore.listRequests({ userId: actor.id, kind: 'invite', status: query.status }),
    teamStore.listRequests({ ownerId: actor.id, kind: 'application', status: query.status }),
  ]);

  const combined = [...invitesToMe, ...applicationsToMyTeams].filter(
    (request) => query.kind === undefined || request.kind === query.kind,
  );

  return withNames(combined.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

/**
 * Everything still open on one team: who it has invited, and who has asked in.
 *
 * Visible to the whole roster, not just the owner — "who have we invited" is a
 * question the team asks together, and nothing here is private from the people
 * the newcomer would be joining. Only the owner can act on it.
 */
export async function listTeamRequests(
  teamId: string,
  actor: UserRecord,
): Promise<TeamRequestView[]> {
  const team = await getTeam(teamId);
  const onTeam = team.members.some((member) => member.userId === actor.id);
  if (!onTeam && !canModerate(actor.accountRole)) {
    throw HttpError.forbidden('Only people on this team can see its pending requests.');
  }
  return withNames(await teamStore.listRequests({ teamId, status: 'pending' }));
}

// -- suggestions --------------------------------------------------------------

/**
 * A ranked candidate for a team's open seat: the person, plus the engine's
 * verdict on them.
 *
 * The fit fields come straight from `TeamFitResult` rather than being restated
 * here — a second copy of that shape would silently go stale the moment the
 * engine gained or renamed a field.
 */
export type MemberSuggestion = { user: DirectoryUser } & TeamFitResult;

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
    roles: undefined,
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

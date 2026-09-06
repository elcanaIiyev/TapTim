import type { PoolClient } from 'pg';
import { query, queryOne, withTransaction } from '../db/pool.js';
import {
  mapTeamRequestRow,
  mapTeamRow,
  type TeamDetail,
  type TeamMember,
  type TeamRecord,
  type TeamRequestRecord,
  type TeamRequestRow,
  type TeamRow,
} from '../modules/teams/team.model.js';
import {
  mapUserRow,
  toDirectoryUser,
  type TeamRole,
  type UserRow,
} from '../modules/users/user.model.js';

const TEAM_COLUMNS = `
  t.id, t.event_id, t.owner_id, t.name, t.description, t.looking_for,
  t.required_skills, t.max_size, t.status, t.logo_url, t.created_at, t.updated_at,
  (select count(*) from team_members m where m.team_id = t.id) as member_count
`;

const REQUEST_COLUMNS = `
  id, team_id, user_id, kind, status, message, created_by, created_at, updated_at
`;

/**
 * Every column `mapUserRow` reads, prefixed for the join.
 *
 * Kept exhaustive on purpose: a missing column here does not fail loudly, it
 * silently yields `undefined` for that field on every team member — so a
 * roster would quietly lose people's languages or age while everything still
 * appeared to work. Adding a user column means adding it here too.
 */
const USER_COLUMNS_PREFIXED = `
  u.id, u.email, u.password_hash, u.full_name, u.first_name, u.last_name,
  u.roles, u.skills, u.bio, u.avatar_url, u.avatar_path, u.verified,
  u.experience_level, u.availability, u.hours_per_week, u.timezone_offset,
  u.personality, u.skill_levels, u.looking_for_team, u.github_url, u.linkedin_url,
  u.portfolio_url, u.account_role, u.date_of_birth, u.pronouns,
  u.location_city, u.location_country, u.languages, u.interest_domains,
  u.goals, u.hackathons_attended, u.preferred_team_size, u.discord_handle,
  u.email_verified, u.onboarding_completed, u.banned_until, u.banned_reason,
  u.banned_at, u.banned_by, u.availability_confirmed_at, u.created_at, u.updated_at
`;

export interface ListTeamsFilter {
  eventId?: string;
  status?: string;
  ownerId?: string;
  /** Teams this user is a member of. */
  memberId?: string;
  lookingForRole?: string;
  search?: string;
  hasOpenSeats?: boolean;
  limit: number;
  offset: number;
}

export interface CreateTeamInput {
  eventId: string;
  ownerId: string;
  ownerRole: TeamRole;
  name: string;
  description: string | null;
  lookingFor: string[];
  requiredSkills: string[];
  maxSize: number;
}

const UPDATABLE_COLUMNS = {
  name: 'name',
  description: 'description',
  lookingFor: 'looking_for',
  requiredSkills: 'required_skills',
  maxSize: 'max_size',
  status: 'status',
  ownerId: 'owner_id',
  logoUrl: 'logo_url',
  logoPath: 'logo_path',
} as const;

export type TeamUpdate = Partial<Record<keyof typeof UPDATABLE_COLUMNS, unknown>>;

/** Raised when a team is already at `max_size`. Translated to 409 by the service. */
export class TeamFullError extends Error {
  constructor() {
    super('This team has no open seats left.');
    this.name = 'TeamFullError';
  }
}

/** Raised when the user already belongs to another team for the same event. */
export class AlreadyOnEventTeamError extends Error {
  constructor() {
    super('This participant is already on a team for this event.');
    this.name = 'AlreadyOnEventTeamError';
  }
}

interface MemberRow extends UserRow {
  member_role: string;
  is_owner: boolean;
  joined_at: Date;
}

function mapMemberRow(row: MemberRow): TeamMember {
  return {
    userId: row.id,
    role: row.member_role as TeamRole,
    isOwner: row.is_owner,
    joinedAt: row.joined_at.toISOString(),
    user: toDirectoryUser(mapUserRow(row)),
  };
}

/**
 * Inserts a membership after checking capacity under a row lock. The lock is
 * what makes the check correct: two people accepting the last seat at the same
 * time would both pass an unlocked count.
 */
async function insertMembership(
  client: PoolClient,
  teamId: string,
  userId: string,
  role: string,
  isOwner: boolean,
): Promise<void> {
  const team = await client.query<{ max_size: number; event_id: string; status: string }>(
    'select max_size, event_id, status from teams where id = $1 for update',
    [teamId],
  );
  const row = team.rows[0];
  if (!row) throw new Error(`Team ${teamId} disappeared mid-transaction.`);

  const counted = await client.query<{ count: string }>(
    'select count(*)::text as count from team_members where team_id = $1',
    [teamId],
  );
  if (Number(counted.rows[0]?.count ?? 0) >= row.max_size) {
    throw new TeamFullError();
  }

  await client.query(
    'insert into team_members (team_id, user_id, role, is_owner) values ($1, $2, $3, $4)',
    [teamId, userId, role, isOwner],
  );

  // The (user_id, event_id) primary key is what actually enforces "one team per
  // event"; a 23505 here means the participant joined another team first.
  try {
    await client.query(
      'insert into team_event_membership (user_id, event_id, team_id) values ($1, $2, $3)',
      [userId, row.event_id, teamId],
    );
  } catch (error) {
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') {
      throw new AlreadyOnEventTeamError();
    }
    throw error;
  }

  // Filling the last seat closes recruitment automatically so the team stops
  // appearing in "open seats" listings without the owner having to notice.
  await client.query(
    `update teams set status = 'full'
     where id = $1 and status = 'recruiting'
       and (select count(*) from team_members m where m.team_id = $1) >= max_size`,
    [teamId],
  );
}

class TeamStore {
  async list(filter: ListTeamsFilter): Promise<{ items: TeamRecord[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filter.eventId) {
      values.push(filter.eventId);
      conditions.push(`t.event_id = $${values.length}`);
    }
    if (filter.status) {
      values.push(filter.status);
      conditions.push(`t.status = $${values.length}`);
    } else {
      conditions.push(`t.status <> 'disbanded'`);
    }
    if (filter.ownerId) {
      values.push(filter.ownerId);
      conditions.push(`t.owner_id = $${values.length}`);
    }
    if (filter.memberId) {
      values.push(filter.memberId);
      conditions.push(
        `exists (select 1 from team_members m where m.team_id = t.id and m.user_id = $${values.length})`,
      );
    }
    if (filter.lookingForRole) {
      values.push(filter.lookingForRole);
      conditions.push(`$${values.length} = any(t.looking_for)`);
    }
    if (filter.search) {
      values.push(`%${filter.search}%`);
      conditions.push(`(t.name ilike $${values.length} or t.description ilike $${values.length})`);
    }
    if (filter.hasOpenSeats) {
      conditions.push(
        `(select count(*) from team_members m where m.team_id = t.id) < t.max_size`,
      );
    }

    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';

    const totalRow = await queryOne<{ count: string }>(
      `select count(*)::text as count from teams t ${where}`,
      values,
    );

    values.push(filter.limit, filter.offset);
    const rows = await query<TeamRow>(
      `select ${TEAM_COLUMNS} from teams t ${where}
       order by t.created_at desc
       limit $${values.length - 1} offset $${values.length}`,
      values,
    );

    return { items: rows.map(mapTeamRow), total: Number(totalRow?.count ?? 0) };
  }

  async findById(id: string): Promise<TeamRecord | null> {
    const row = await queryOne<TeamRow>(`select ${TEAM_COLUMNS} from teams t where t.id = $1`, [id]);
    return row ? mapTeamRow(row) : null;
  }

  async findMembers(teamId: string): Promise<TeamMember[]> {
    const rows = await query<MemberRow>(
      `select ${USER_COLUMNS_PREFIXED}, m.role as member_role, m.is_owner, m.joined_at
       from team_members m
       join users u on u.id = m.user_id
       where m.team_id = $1
       order by m.is_owner desc, m.joined_at asc`,
      [teamId],
    );
    return rows.map(mapMemberRow);
  }

  async findDetail(id: string): Promise<TeamDetail | null> {
    const team = await this.findById(id);
    if (!team) return null;
    return { ...team, members: await this.findMembers(id) };
  }

  async create(input: CreateTeamInput): Promise<TeamDetail> {
    return withTransaction(async (client) => {
      const inserted = await client.query<TeamRow>(
        `insert into teams (event_id, owner_id, name, description, looking_for, required_skills, max_size)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning id, event_id, owner_id, name, description, looking_for,
                   required_skills, max_size, status, created_at, updated_at, 0 as member_count`,
        [
          input.eventId,
          input.ownerId,
          input.name,
          input.description,
          input.lookingFor,
          input.requiredSkills,
          input.maxSize,
        ],
      );

      const team = mapTeamRow(inserted.rows[0]);
      await insertMembership(client, team.id, input.ownerId, input.ownerRole, true);

      const refreshed = await client.query<TeamRow>(
        `select ${TEAM_COLUMNS} from teams t where t.id = $1`,
        [team.id],
      );
      return { ...mapTeamRow(refreshed.rows[0]), members: [] as TeamMember[] };
    }).then(async (team) => ({ ...team, members: await this.findMembers(team.id) }));
  }

  /**
   * The storage key of a team's current logo.
   *
   * Kept off `TeamRecord` on purpose: every team response would then carry an
   * internal bucket path that no client has any use for. Only the two calls
   * that replace or clear a logo need it, and they ask for it directly.
   */
  async logoPathOf(id: string): Promise<string | null> {
    const row = await queryOne<{ logo_path: string | null }>(
      'select logo_path from teams where id = $1',
      [id],
    );
    return row?.logo_path ?? null;
  }

  async update(id: string, patch: TeamUpdate): Promise<TeamRecord | null> {
    const entries = Object.entries(patch).filter(([key]) => key in UPDATABLE_COLUMNS);
    if (entries.length === 0) return this.findById(id);

    const assignments: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of entries) {
      values.push(value);
      assignments.push(
        `${UPDATABLE_COLUMNS[key as keyof typeof UPDATABLE_COLUMNS]} = $${values.length}`,
      );
    }

    values.push(id);
    const updated = await queryOne<{ id: string }>(
      `update teams set ${assignments.join(', ')} where id = $${values.length} returning id`,
      values,
    );
    return updated ? this.findById(id) : null;
  }

  async remove(id: string): Promise<boolean> {
    const rows = await query<{ id: string }>('delete from teams where id = $1 returning id', [id]);
    return rows.length > 0;
  }

  async addMember(teamId: string, userId: string, role: string): Promise<void> {
    await withTransaction((client) => insertMembership(client, teamId, userId, role, false));
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    return withTransaction(async (client) => {
      const deleted = await client.query<{ user_id: string }>(
        'delete from team_members where team_id = $1 and user_id = $2 returning user_id',
        [teamId, userId],
      );
      if (deleted.rowCount === 0) return false;

      await client.query('delete from team_event_membership where user_id = $1 and team_id = $2', [
        userId,
        teamId,
      ]);

      // Freeing a seat reopens recruitment, mirroring the auto-close on join.
      await client.query(
        `update teams set status = 'recruiting'
         where id = $1 and status = 'full'`,
        [teamId],
      );
      return true;
    });
  }

  /**
   * Moves the `is_owner` flag to a single member. Written as one statement so
   * the team never momentarily has two owners or none.
   */
  async setOwnerFlag(teamId: string, newOwnerId: string): Promise<void> {
    await query('update team_members set is_owner = (user_id = $2) where team_id = $1', [
      teamId,
      newOwnerId,
    ]);
  }

  async isMember(teamId: string, userId: string): Promise<boolean> {
    const row = await queryOne<{ user_id: string }>(
      'select user_id from team_members where team_id = $1 and user_id = $2',
      [teamId, userId],
    );
    return row !== null;
  }

  /** The team this user already belongs to for a given event, if any. */
  async findEventMembership(userId: string, eventId: string): Promise<string | null> {
    const row = await queryOne<{ team_id: string }>(
      'select team_id from team_event_membership where user_id = $1 and event_id = $2',
      [userId, eventId],
    );
    return row?.team_id ?? null;
  }

  /** How many teams each of these users sits on, for the admin console. */
  async teamCountsFor(userIds: readonly string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const rows = await query<{ user_id: string; count: string }>(
      `select user_id, count(*)::text as count from team_members
       where user_id = any($1::uuid[])
       group by user_id`,
      [userIds],
    );
    return new Map(rows.map((row) => [row.user_id, Number(row.count)]));
  }

  /** Ids of everyone already on a team for this event — excluded from suggestions. */
  async findEventMemberIds(eventId: string): Promise<string[]> {
    const rows = await query<{ user_id: string }>(
      'select user_id from team_event_membership where event_id = $1',
      [eventId],
    );
    return rows.map((row) => row.user_id);
  }

  // -- requests -------------------------------------------------------------

  async createRequest(input: {
    teamId: string;
    userId: string;
    kind: string;
    message: string | null;
    createdBy: string;
  }): Promise<TeamRequestRecord> {
    const row = await queryOne<TeamRequestRow>(
      `insert into team_requests (team_id, user_id, kind, message, created_by)
       values ($1, $2, $3, $4, $5)
       returning ${REQUEST_COLUMNS}`,
      [input.teamId, input.userId, input.kind, input.message, input.createdBy],
    );
    if (!row) throw new Error('Insert returned no team_request row.');
    return mapTeamRequestRow(row);
  }

  async findRequestById(id: string): Promise<TeamRequestRecord | null> {
    const row = await queryOne<TeamRequestRow>(
      `select ${REQUEST_COLUMNS} from team_requests where id = $1`,
      [id],
    );
    return row ? mapTeamRequestRow(row) : null;
  }

  async listRequests(filter: {
    teamId?: string;
    userId?: string;
    kind?: string;
    status?: string;
    /** Requests aimed at teams this user owns. */
    ownerId?: string;
  }): Promise<TeamRequestRecord[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filter.teamId) {
      values.push(filter.teamId);
      conditions.push(`team_id = $${values.length}`);
    }
    if (filter.userId) {
      values.push(filter.userId);
      conditions.push(`user_id = $${values.length}`);
    }
    if (filter.kind) {
      values.push(filter.kind);
      conditions.push(`kind = $${values.length}`);
    }
    if (filter.status) {
      values.push(filter.status);
      conditions.push(`status = $${values.length}`);
    }
    if (filter.ownerId) {
      values.push(filter.ownerId);
      conditions.push(
        `team_id in (select id from teams where owner_id = $${values.length})`,
      );
    }

    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const rows = await query<TeamRequestRow>(
      `select ${REQUEST_COLUMNS} from team_requests ${where} order by created_at desc limit 200`,
      values,
    );
    return rows.map(mapTeamRequestRow);
  }

  async setRequestStatus(id: string, status: string): Promise<TeamRequestRecord | null> {
    const row = await queryOne<TeamRequestRow>(
      `update team_requests set status = $2 where id = $1 and status = 'pending'
       returning ${REQUEST_COLUMNS}`,
      [id, status],
    );
    return row ? mapTeamRequestRow(row) : null;
  }

  /**
   * Marks a request accepted and seats the member in one transaction, so a
   * failure to seat never leaves an "accepted" request without a membership.
   */
  async acceptRequest(id: string, role: string): Promise<TeamRequestRecord | null> {
    return withTransaction(async (client) => {
      const updated = await client.query<TeamRequestRow>(
        `update team_requests set status = 'accepted'
         where id = $1 and status = 'pending'
         returning ${REQUEST_COLUMNS}`,
        [id],
      );
      const row = updated.rows[0];
      if (!row) return null;

      await insertMembership(client, row.team_id, row.user_id, role, false);

      // Any other open request for this person on this team is now moot.
      await client.query(
        `update team_requests set status = 'cancelled'
         where team_id = $1 and user_id = $2 and status = 'pending' and id <> $3`,
        [row.team_id, row.user_id, id],
      );

      return mapTeamRequestRow(row);
    });
  }

  async count(): Promise<number> {
    const row = await queryOne<{ count: string }>('select count(*)::text as count from teams');
    return Number(row?.count ?? 0);
  }
}

export const teamStore = new TeamStore();

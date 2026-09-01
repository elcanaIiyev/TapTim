import { query, queryOne, withTransaction } from '../db/pool.js';
import { mapUserRow, type UserRecord, type UserRow } from '../modules/users/user.model.js';

/**
 * Postgres-backed user repository. The interface is unchanged from the Sprint 1
 * in-memory store, so callers did not have to move when the data did.
 */

const COLUMNS = `
  id, email, password_hash, full_name, primary_role, skills, bio, avatar_url,
  verified, experience_level, availability, hours_per_week, timezone_offset,
  personality, looking_for_team, github_url, linkedin_url, portfolio_url,
  account_role, created_at, updated_at
`;

/** Columns a profile update is allowed to touch, keyed by their API name. */
const UPDATABLE_COLUMNS = {
  fullName: 'full_name',
  primaryRole: 'primary_role',
  skills: 'skills',
  bio: 'bio',
  avatarUrl: 'avatar_url',
  experienceLevel: 'experience_level',
  availability: 'availability',
  hoursPerWeek: 'hours_per_week',
  timezoneOffset: 'timezone_offset',
  personality: 'personality',
  lookingForTeam: 'looking_for_team',
  githubUrl: 'github_url',
  linkedinUrl: 'linkedin_url',
  portfolioUrl: 'portfolio_url',
} as const;

export type UpdatableUserField = keyof typeof UPDATABLE_COLUMNS;
export type UserUpdate = Partial<Record<UpdatableUserField, unknown>>;

export interface ListUsersFilter {
  search?: string;
  primaryRole?: string;
  skills?: string[];
  experienceLevel?: string;
  availability?: string[];
  lookingForTeam?: boolean;
  verified?: boolean;
  /** Admin console only — the public directory never filters on authority. */
  accountRole?: string;
  /** Admin console only — moderators and admins, excluding ordinary users. */
  staffOnly?: boolean;
  excludeUserIds?: string[];
  limit: number;
  offset: number;
}

export interface ListUsersResult {
  items: UserRecord[];
  total: number;
}

/** Raised when a change would leave the platform with no admin at all. */
export class LastAdminError extends Error {
  constructor() {
    super('This is the last admin account — promote someone else first.');
    this.name = 'LastAdminError';
  }
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  fullName: string;
  primaryRole: string;
  skills?: string[];
}

class UserStore {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const row = await queryOne<UserRow>(
      `select ${COLUMNS} from users where email = $1`,
      [normaliseEmail(email)],
    );
    return row ? mapUserRow(row) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const row = await queryOne<UserRow>(`select ${COLUMNS} from users where id = $1`, [id]);
    return row ? mapUserRow(row) : null;
  }

  async findManyByIds(ids: readonly string[]): Promise<UserRecord[]> {
    if (ids.length === 0) return [];
    const rows = await query<UserRow>(`select ${COLUMNS} from users where id = any($1::uuid[])`, [
      ids,
    ]);
    return rows.map(mapUserRow);
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const row = await queryOne<UserRow>(
      `insert into users (email, password_hash, full_name, primary_role, skills)
       values ($1, $2, $3, $4, $5)
       returning ${COLUMNS}`,
      [
        normaliseEmail(input.email),
        input.passwordHash,
        input.fullName,
        input.primaryRole,
        input.skills ?? [],
      ],
    );
    if (!row) throw new Error('Insert returned no user row.');
    return mapUserRow(row);
  }

  /**
   * Applies a partial update. Returns `null` when the id does not exist so the
   * caller can decide between 404 and 401 rather than having that choice made
   * for it here.
   *
   * When the patch touches `primaryRole`, the change is carried onto every team
   * the person sits on, in the same transaction. That sync lives here rather
   * than in a caller because *any* path that changes a profession needs it —
   * without it a roster keeps showing the role someone held when they joined,
   * and each team's `lookingFor` gaps get computed against stale data.
   */
  async update(id: string, patch: UserUpdate): Promise<UserRecord | null> {
    const entries = Object.entries(patch).filter(([key]) => key in UPDATABLE_COLUMNS);

    if (entries.length === 0) {
      return this.findById(id);
    }

    const assignments: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of entries) {
      const column = UPDATABLE_COLUMNS[key as UpdatableUserField];
      values.push(key === 'personality' ? JSON.stringify(value ?? {}) : value);
      // `personality` is jsonb; the driver would otherwise send the stringified
      // object as plain text and Postgres would reject the assignment.
      assignments.push(`${column} = $${values.length}${key === 'personality' ? '::jsonb' : ''}`);
    }

    values.push(id);

    return withTransaction(async (client) => {
      const updated = await client.query<UserRow>(
        `update users set ${assignments.join(', ')} where id = $${values.length} returning ${COLUMNS}`,
        values,
      );
      const row = updated.rows[0];
      if (!row) return null;

      if (patch.primaryRole !== undefined) {
        await client.query('update team_members set role = $2 where user_id = $1', [
          id,
          patch.primaryRole,
        ]);
      }

      return mapUserRow(row);
    });
  }

  /**
   * Sets a site role unconditionally. Kept off `update()` on purpose: that
   * method is driven by request bodies, and authority must never be reachable
   * from one.
   *
   * This is the CLI's path — `admin:grant` / `admin:revoke` is the escape hatch
   * and has to be able to empty the admin list, since it can also refill it.
   * Requests coming from the console go through `setAccountRoleGuarded`.
   */
  async setAccountRole(id: string, accountRole: string): Promise<UserRecord | null> {
    const row = await queryOne<UserRow>(
      `update users set account_role = $2 where id = $1 returning ${COLUMNS}`,
      [id, accountRole],
    );
    return row ? mapUserRow(row) : null;
  }

  /**
   * Sets a site role, refusing any change that would leave nobody holding
   * `admin`.
   *
   * The count and the update run in one transaction that first locks every
   * admin row. Without that lock two admins demoting each other at the same
   * moment would both read "2 admins remain", both pass, and both commit —
   * leaving a console nobody can open. The lock makes the second write wait and
   * then see the true count of 1.
   */
  async setAccountRoleGuarded(id: string, accountRole: string): Promise<UserRecord | null> {
    return withTransaction(async (client) => {
      const locked = await client.query<{ id: string }>(
        `select id from users where account_role = 'admin' for update`,
      );

      const wasAdmin = locked.rows.some((row) => row.id === id);
      if (wasAdmin && accountRole !== 'admin' && locked.rows.length <= 1) {
        throw new LastAdminError();
      }

      const updated = await client.query<UserRow>(
        `update users set account_role = $2 where id = $1 returning ${COLUMNS}`,
        [id, accountRole],
      );
      const row = updated.rows[0];
      return row ? mapUserRow(row) : null;
    });
  }

  async countByRole(): Promise<Record<string, number>> {
    const rows = await query<{ account_role: string; count: string }>(
      'select account_role, count(*)::text as count from users group by account_role',
    );
    return Object.fromEntries(rows.map((row) => [row.account_role, Number(row.count)]));
  }

  async countAdmins(): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `select count(*)::text as count from users where account_role = 'admin'`,
    );
    return Number(row?.count ?? 0);
  }

  /** Flips the "Verified" badge. Driven by the certificate pipeline. */
  async setVerified(id: string, verified: boolean): Promise<UserRecord | null> {
    const row = await queryOne<UserRow>(
      `update users set verified = $2 where id = $1 returning ${COLUMNS}`,
      [id, verified],
    );
    return row ? mapUserRow(row) : null;
  }

  async list(filter: ListUsersFilter): Promise<ListUsersResult> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filter.search) {
      values.push(`%${filter.search}%`);
      conditions.push(
        `(full_name ilike $${values.length} or bio ilike $${values.length}
          or exists (select 1 from unnest(skills) s where s ilike $${values.length}))`,
      );
    }
    if (filter.primaryRole) {
      values.push(filter.primaryRole);
      conditions.push(`primary_role = $${values.length}`);
    }
    if (filter.skills?.length) {
      // Overlap, not containment: a candidate matching any requested skill is
      // still a useful result for a team that needs one of several.
      values.push(filter.skills);
      conditions.push(`skills && $${values.length}::text[]`);
    }
    if (filter.experienceLevel) {
      values.push(filter.experienceLevel);
      conditions.push(`experience_level = $${values.length}`);
    }
    if (filter.availability?.length) {
      values.push(filter.availability);
      conditions.push(`availability && $${values.length}::text[]`);
    }
    if (filter.lookingForTeam !== undefined) {
      values.push(filter.lookingForTeam);
      conditions.push(`looking_for_team = $${values.length}`);
    }
    if (filter.verified !== undefined) {
      values.push(filter.verified);
      conditions.push(`verified = $${values.length}`);
    }
    if (filter.accountRole) {
      values.push(filter.accountRole);
      conditions.push(`account_role = $${values.length}`);
    }
    if (filter.staffOnly) {
      conditions.push(`account_role <> 'user'`);
    }
    if (filter.excludeUserIds?.length) {
      values.push(filter.excludeUserIds);
      conditions.push(`id <> all($${values.length}::uuid[])`);
    }

    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';

    const totalRow = await queryOne<{ count: string }>(
      `select count(*)::text as count from users ${where}`,
      values,
    );

    values.push(filter.limit, filter.offset);
    const rows = await query<UserRow>(
      `select ${COLUMNS} from users ${where}
       order by created_at desc
       limit $${values.length - 1} offset $${values.length}`,
      values,
    );

    return {
      items: rows.map(mapUserRow),
      total: Number(totalRow?.count ?? 0),
    };
  }

  async count(): Promise<number> {
    const row = await queryOne<{ count: string }>('select count(*)::text as count from users');
    return Number(row?.count ?? 0);
  }

  async countVerified(): Promise<number> {
    const row = await queryOne<{ count: string }>(
      'select count(*)::text as count from users where verified',
    );
    return Number(row?.count ?? 0);
  }
}

export const userStore = new UserStore();

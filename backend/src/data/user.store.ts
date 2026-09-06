import { query, queryOne, withTransaction } from '../db/pool.js';
import { mapUserRow, type UserRecord, type UserRow } from '../modules/users/user.model.js';

/**
 * Postgres-backed user repository. The interface is unchanged from the Sprint 1
 * in-memory store, so callers did not have to move when the data did.
 */

const COLUMNS = `
  id, email, password_hash, full_name, first_name, last_name, roles,
  skills, bio, avatar_url, avatar_path, verified, experience_level, availability,
  hours_per_week, timezone_offset, personality, skill_levels, looking_for_team,
  github_url, linkedin_url, portfolio_url, account_role, date_of_birth, pronouns,
  location_city, location_country, languages, interest_domains, goals,
  hackathons_attended, preferred_team_size, discord_handle, email_verified,
  onboarding_completed, banned_until, banned_reason, banned_at, banned_by,
  availability_confirmed_at, created_at, updated_at
`;

/**
 * Columns a profile update is allowed to touch, keyed by their API name.
 *
 * `email`, `password_hash`, `account_role`, `verified` and `email_verified` are
 * all deliberately absent: identity, authority and earned badges are never
 * settable from a request body.
 */
const UPDATABLE_COLUMNS = {
  firstName: 'first_name',
  lastName: 'last_name',
  roles: 'roles',
  skills: 'skills',
  bio: 'bio',
  avatarUrl: 'avatar_url',
  experienceLevel: 'experience_level',
  availability: 'availability',
  hoursPerWeek: 'hours_per_week',
  timezoneOffset: 'timezone_offset',
  personality: 'personality',
  skillLevels: 'skill_levels',
  lookingForTeam: 'looking_for_team',
  githubUrl: 'github_url',
  linkedinUrl: 'linkedin_url',
  portfolioUrl: 'portfolio_url',
  dateOfBirth: 'date_of_birth',
  pronouns: 'pronouns',
  locationCity: 'location_city',
  locationCountry: 'location_country',
  languages: 'languages',
  interestDomains: 'interest_domains',
  goals: 'goals',
  hackathonsAttended: 'hackathons_attended',
  preferredTeamSize: 'preferred_team_size',
  discordHandle: 'discord_handle',
  onboardingCompleted: 'onboarding_completed',
  availabilityConfirmedAt: 'availability_confirmed_at',
} as const;

export type UpdatableUserField = keyof typeof UPDATABLE_COLUMNS;
export type UserUpdate = Partial<Record<UpdatableUserField, unknown>>;

export interface ListUsersFilter {
  search?: string;
  /** Anyone who can play *any* of these roles. */
  roles?: string[];
  skills?: string[];
  experienceLevel?: string;
  availability?: string[];
  lookingForTeam?: boolean;
  verified?: boolean;
  /** Admin console only — the public directory never filters on authority. */
  accountRole?: string;
  /**
   * Admin console only — also match `search` against the email address.
   *
   * Off for the public directory on purpose: letting anyone search by address
   * turns the directory into a way to test whether someone has an account here,
   * which is the same leak `check-email` and `resend-verification` are careful
   * to avoid. Staff already see every address in the results.
   */
  searchEmail?: boolean;
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

/**
 * `full_name` is derived, never supplied. Every existing query and every list
 * view already reads it, so keeping it in sync on write is cheaper than
 * teaching all of them to concatenate.
 */
function displayName(firstName: string, lastName: string | null): string {
  return [firstName.trim(), lastName?.trim()].filter(Boolean).join(' ');
}

export interface CreateUserInput {
  email: string;
  /** Null when the account is being created from an OAuth identity. */
  passwordHash: string | null;
  firstName: string;
  lastName?: string | null;
  roles: string[];
  skills?: string[];
  /** OAuth providers vouch for the address, so those accounts skip confirmation. */
  emailVerified?: boolean;
  avatarUrl?: string | null;
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
    const lastName = input.lastName?.trim() || null;
    const row = await queryOne<UserRow>(
      `insert into users (
         email, password_hash, full_name, first_name, last_name, roles,
         skills, email_verified, avatar_url
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning ${COLUMNS}`,
      [
        normaliseEmail(input.email),
        input.passwordHash,
        displayName(input.firstName, lastName),
        input.firstName.trim(),
        lastName,
        input.roles,
        input.skills ?? [],
        input.emailVerified ?? false,
        input.avatarUrl ?? null,
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
   * When the patch touches `roles`, the seat they hold on every team they sit
   * on is refreshed in the same transaction. That sync lives here rather than
   * in a caller because *any* path that changes someone's roles needs it —
   * without it a roster keeps showing the role somebody held when they joined,
   * and each team's `lookingFor` gaps get computed against stale data.
   *
   * A roster seat stays singular even though a profile is not, so the first
   * listed role is what lands there.
   */
  async update(id: string, patch: UserUpdate): Promise<UserRecord | null> {
    const entries = Object.entries(patch).filter(([key]) => key in UPDATABLE_COLUMNS);

    if (entries.length === 0) {
      return this.findById(id);
    }

    const assignments: string[] = [];
    const values: unknown[] = [];

    // Remembered while building so the derived `full_name` below can refer to
    // the same placeholders instead of re-deriving which one it got.
    let firstNameParam: string | null = null;
    let lastNameParam: string | null = null;

    for (const [key, value] of entries) {
      const column = UPDATABLE_COLUMNS[key as UpdatableUserField];
      const isJsonb = key === 'personality' || key === 'skillLevels';
      values.push(isJsonb ? JSON.stringify(value ?? {}) : value);
      const placeholder = `$${values.length}`;

      if (key === 'firstName') firstNameParam = placeholder;
      if (key === 'lastName') lastNameParam = placeholder;

      // jsonb columns need the cast; without it the driver sends the
      // stringified object as plain text and Postgres rejects the assignment.
      assignments.push(`${column} = ${placeholder}${isJsonb ? '::jsonb' : ''}`);
    }

    // `full_name` is derived, so a patch moving either half has to rebuild it.
    // Computed in SQL against the values being written rather than in JS: the
    // other half may not be in this patch, and reading it first would open a
    // window where a concurrent write is lost.
    if (firstNameParam || lastNameParam) {
      const first = firstNameParam ?? 'first_name';
      const last = lastNameParam ?? 'last_name';
      assignments.push(`full_name = btrim(coalesce(${first}, '') || ' ' || coalesce(${last}, ''))`);
    }

    values.push(id);

    return withTransaction(async (client) => {
      const updated = await client.query<UserRow>(
        `update users set ${assignments.join(', ')} where id = $${values.length} returning ${COLUMNS}`,
        values,
      );
      const row = updated.rows[0];
      if (!row) return null;

      if (patch.roles !== undefined) {
        const nextRoles = patch.roles as string[];
        // Only when there is one to carry across. An empty array cannot happen
        // — a check constraint forbids it — but reading `[0]` blindly would put
        // a null into a not-null column if it ever did.
        if (nextRoles.length > 0) {
          await client.query('update team_members set role = $2 where user_id = $1', [
            id,
            nextRoles[0],
          ]);
        }
      }

      // `skill_levels` is only meaningful for skills someone still lists, so a
      // write that changes `skills` prunes the map to match. Doing it here, in
      // the same transaction, is what keeps the invariant true no matter which
      // caller did the update or what order the two fields arrived in.
      if (patch.skills !== undefined) {
        const pruned = await client.query<UserRow>(
          `update users
              set skill_levels = coalesce(
                (select jsonb_object_agg(key, value)
                   from jsonb_each(skill_levels)
                  where key = any(skills)),
                '{}'::jsonb
              )
            where id = $1
            returning ${COLUMNS}`,
          [id],
        );
        return pruned.rows[0] ? mapUserRow(pruned.rows[0]) : mapUserRow(row);
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

  /**
   * Marks the address confirmed. Not reachable from `update()` — a request body
   * must never be able to claim its own email is verified.
   */
  async setEmailVerified(id: string, verified: boolean): Promise<UserRecord | null> {
    const row = await queryOne<UserRow>(
      `update users set email_verified = $2 where id = $1 returning ${COLUMNS}`,
      [id, verified],
    );
    return row ? mapUserRow(row) : null;
  }

  /**
   * Points the profile at a newly uploaded avatar and hands back the object
   * path of the one it replaced, so the caller can delete it from storage.
   * Returning it rather than deleting here keeps the store free of network I/O.
   */
  async setAvatar(
    id: string,
    avatarUrl: string | null,
    avatarPath: string | null,
  ): Promise<{ user: UserRecord; previousPath: string | null } | null> {
    return withTransaction(async (client) => {
      const before = await client.query<{ avatar_path: string | null }>(
        'select avatar_path from users where id = $1 for update',
        [id],
      );
      if (before.rows.length === 0) return null;

      const updated = await client.query<UserRow>(
        `update users set avatar_url = $2, avatar_path = $3 where id = $1 returning ${COLUMNS}`,
        [id, avatarUrl, avatarPath],
      );
      const row = updated.rows[0];
      if (!row) return null;

      const previousPath = before.rows[0].avatar_path;
      return {
        user: mapUserRow(row),
        // Only worth deleting if it is actually a different object.
        previousPath: previousPath && previousPath !== avatarPath ? previousPath : null,
      };
    });
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<UserRecord | null> {
    const row = await queryOne<UserRow>(
      `update users set password_hash = $2 where id = $1 returning ${COLUMNS}`,
      [id, passwordHash],
    );
    return row ? mapUserRow(row) : null;
  }

  /**
   * Suspends an account. `until` is a timestamp, or `'infinity'` for permanent.
   *
   * Not on `update()` for the same reason as role and verification: moderation
   * state must never be reachable from a request body someone controls.
   */
  async banUser(
    id: string,
    until: string,
    reason: string | null,
    bannedBy: string,
  ): Promise<UserRecord | null> {
    const row = await queryOne<UserRow>(
      `update users
          set banned_until = $2::timestamptz, banned_reason = $3,
              banned_at = now(), banned_by = $4
        where id = $1
        returning ${COLUMNS}`,
      [id, until, reason, bannedBy],
    );
    return row ? mapUserRow(row) : null;
  }

  /** Lifts a suspension, clearing the whole record of it. */
  async unbanUser(id: string): Promise<UserRecord | null> {
    const row = await queryOne<UserRow>(
      `update users
          set banned_until = null, banned_reason = null, banned_at = null, banned_by = null
        where id = $1
        returning ${COLUMNS}`,
      [id],
    );
    return row ? mapUserRow(row) : null;
  }

  /**
   * Erases an account and everything attached to it.
   *
   * The cascade is declared on the foreign keys rather than performed here:
   * certificates, experiences, OAuth identities, confirmation tokens, team
   * memberships and requests, and any team this person owned all carry
   * `on delete cascade`, so one delete takes the lot atomically. Events they
   * organised survive with `created_by` nulled — deleting an event would take
   * other people's teams with it.
   *
   * Returns the avatar path so the caller can remove the stored file, which is
   * the one piece of this person's data that does not live in Postgres.
   */
  async deleteUser(id: string): Promise<{ email: string; avatarPath: string | null } | null> {
    const row = await queryOne<{ email: string; avatar_path: string | null }>(
      'delete from users where id = $1 returning email, avatar_path',
      [id],
    );
    return row ? { email: row.email, avatarPath: row.avatar_path } : null;
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
          or exists (select 1 from unnest(skills) s where s ilike $${values.length})
          ${filter.searchEmail ? `or email ilike $${values.length}` : ''})`,
      );
    }
    if (filter.roles?.length) {
      // Overlap: someone who can present *and* write backend should be found by
      // a search for either. Uses the GIN index from `010_team_roles.sql`.
      values.push(filter.roles);
      conditions.push(`roles && $${values.length}::text[]`);
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

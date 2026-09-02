import { query, queryOne } from '../db/pool.js';
import type { ExperienceKind } from '../modules/users/profile-options.js';
import { toIso } from '../utils/dates.js';

export interface ExperienceRecord {
  id: string;
  userId: string;
  kind: ExperienceKind;
  title: string;
  organisation: string | null;
  /** Calendar days (`YYYY-MM-DD`), not timestamps. */
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
  url: string | null;
  skills: string[];
  createdAt: string;
  updatedAt: string;
}

interface ExperienceRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  organisation: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  url: string | null;
  skills: string[];
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `
  id, user_id, kind, title, organisation, start_date, end_date, is_current,
  description, url, skills, created_at, updated_at
`;

function mapRow(row: ExperienceRow): ExperienceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind as ExperienceKind,
    title: row.title,
    organisation: row.organisation,
    startDate: row.start_date,
    endDate: row.end_date,
    isCurrent: row.is_current,
    description: row.description,
    url: row.url,
    skills: row.skills ?? [],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export interface ExperienceInput {
  kind: string;
  title: string;
  organisation: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
  url: string | null;
  skills: string[];
}

const UPDATABLE_COLUMNS = {
  kind: 'kind',
  title: 'title',
  organisation: 'organisation',
  startDate: 'start_date',
  endDate: 'end_date',
  isCurrent: 'is_current',
  description: 'description',
  url: 'url',
  skills: 'skills',
} as const;

export type ExperienceUpdate = Partial<Record<keyof typeof UPDATABLE_COLUMNS, unknown>>;

class ExperienceStore {
  /**
   * Newest first, with undated entries last — a timeline reads backwards from
   * now, and `nulls last` keeps a half-filled entry from jumping to the top.
   */
  async listByUser(userId: string): Promise<ExperienceRecord[]> {
    const rows = await query<ExperienceRow>(
      `select ${COLUMNS} from experiences where user_id = $1
       order by is_current desc, start_date desc nulls last, created_at desc`,
      [userId],
    );
    return rows.map(mapRow);
  }

  /** Timeline entries for several people at once, for profile cards. */
  async listByUsers(userIds: readonly string[]): Promise<Map<string, ExperienceRecord[]>> {
    if (userIds.length === 0) return new Map();

    const rows = await query<ExperienceRow>(
      `select ${COLUMNS} from experiences where user_id = any($1::uuid[])
       order by is_current desc, start_date desc nulls last, created_at desc`,
      [userIds],
    );

    const grouped = new Map<string, ExperienceRecord[]>();
    for (const row of rows) {
      const entry = mapRow(row);
      const existing = grouped.get(entry.userId);
      if (existing) existing.push(entry);
      else grouped.set(entry.userId, [entry]);
    }
    return grouped;
  }

  async findById(id: string): Promise<ExperienceRecord | null> {
    const row = await queryOne<ExperienceRow>(`select ${COLUMNS} from experiences where id = $1`, [
      id,
    ]);
    return row ? mapRow(row) : null;
  }

  async create(userId: string, input: ExperienceInput): Promise<ExperienceRecord> {
    const row = await queryOne<ExperienceRow>(
      `insert into experiences (
         user_id, kind, title, organisation, start_date, end_date, is_current,
         description, url, skills
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning ${COLUMNS}`,
      [
        userId,
        input.kind,
        input.title,
        input.organisation,
        input.startDate,
        // An ongoing role has no end date; the table's check constraint enforces
        // this too, but normalising here gives a clearer error than a 23514.
        input.isCurrent ? null : input.endDate,
        input.isCurrent,
        input.description,
        input.url,
        input.skills,
      ],
    );
    if (!row) throw new Error('Insert returned no experience row.');
    return mapRow(row);
  }

  async update(id: string, patch: ExperienceUpdate): Promise<ExperienceRecord | null> {
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

    // Marking something current clears its end date in the same statement, so
    // the pair can never disagree.
    if (patch.isCurrent === true) assignments.push('end_date = null');

    values.push(id);
    const row = await queryOne<ExperienceRow>(
      `update experiences set ${assignments.join(', ')} where id = $${values.length}
       returning ${COLUMNS}`,
      values,
    );
    return row ? mapRow(row) : null;
  }

  async remove(id: string): Promise<boolean> {
    const rows = await query<{ id: string }>('delete from experiences where id = $1 returning id', [
      id,
    ]);
    return rows.length > 0;
  }

  async countFor(userId: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      'select count(*)::text as count from experiences where user_id = $1',
      [userId],
    );
    return Number(row?.count ?? 0);
  }
}

export const experienceStore = new ExperienceStore();

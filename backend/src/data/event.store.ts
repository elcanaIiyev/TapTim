import { randomBytes } from 'node:crypto';
import { query, queryOne } from '../db/pool.js';
import { mapEventRow, type EventItem, type EventRow } from '../modules/events/event.model.js';

const COLUMNS = `
  id, name, description, format, domains, tags, start_date, end_date, location, mode,
  team_size_min, team_size_max, prize_pool, registration_deadline, participants,
  featured, cover_image_url, stat_profile, created_by, created_at, updated_at
`;

export interface ListEventsFilter {
  format?: string;
  /** Matches any of these — an event tagged Web or Design satisfies both. */
  domains?: string[];
  search?: string;
  featured?: boolean;
  mode?: string;
  createdBy?: string;
  limit: number;
  offset: number;
}

export interface EventWriteInput {
  name: string;
  description: string;
  format: string;
  domains: string[];
  tags: string[];
  startDate: string;
  endDate: string;
  location: string;
  mode: string;
  teamSize: { min: number; max: number };
  prizePool: string | null;
  registrationDeadline: string;
  participants: number;
  featured: boolean;
  coverImageUrl?: string | null;
}

/** Columns an update may touch, keyed by their API name. */
const UPDATABLE_COLUMNS = {
  name: 'name',
  description: 'description',
  format: 'format',
  domains: 'domains',
  tags: 'tags',
  startDate: 'start_date',
  endDate: 'end_date',
  location: 'location',
  mode: 'mode',
  prizePool: 'prize_pool',
  registrationDeadline: 'registration_deadline',
  participants: 'participants',
  featured: 'featured',
  teamSizeMin: 'team_size_min',
  teamSizeMax: 'team_size_max',
  coverImageUrl: 'cover_image_url',
} as const;

export type EventUpdate = Partial<Record<keyof typeof UPDATABLE_COLUMNS, unknown>>;

/**
 * The seeded catalogue uses readable `evt-001` ids that the frontend already
 * links to, so new events keep the same prefix rather than switching to UUIDs
 * half-way through the table.
 */
function newEventId(): string {
  return `evt-${randomBytes(6).toString('hex')}`;
}

class EventStore {
  async list(filter: ListEventsFilter): Promise<{ items: EventItem[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filter.format && filter.format !== 'All') {
      values.push(filter.format);
      conditions.push(`format = $${values.length}`);
    }
    if (filter.domains?.length) {
      // Overlap, not containment: someone filtering for Design wants every
      // event that touches design, not only the ones that are *purely* design.
      values.push(filter.domains);
      conditions.push(`domains && $${values.length}::text[]`);
    }
    if (filter.search) {
      values.push(`%${filter.search}%`);
      const p = `$${values.length}`;
      conditions.push(
        `(name ilike ${p} or description ilike ${p} or location ilike ${p}
          or exists (select 1 from unnest(tags) t where t ilike ${p}))`,
      );
    }
    if (filter.featured !== undefined) {
      values.push(filter.featured);
      conditions.push(`featured = $${values.length}`);
    }
    if (filter.mode) {
      values.push(filter.mode);
      conditions.push(`mode = $${values.length}`);
    }
    if (filter.createdBy) {
      values.push(filter.createdBy);
      conditions.push(`created_by = $${values.length}`);
    }

    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';

    const totalRow = await queryOne<{ count: string }>(
      `select count(*)::text as count from events ${where}`,
      values,
    );

    values.push(filter.limit, filter.offset);
    const rows = await query<EventRow>(
      `select ${COLUMNS} from events ${where}
       order by start_date asc
       limit $${values.length - 1} offset $${values.length}`,
      values,
    );

    return { items: rows.map(mapEventRow), total: Number(totalRow?.count ?? 0) };
  }

  async findById(id: string): Promise<EventItem | null> {
    const row = await queryOne<EventRow>(`select ${COLUMNS} from events where id = $1`, [id]);
    return row ? mapEventRow(row) : null;
  }

  async create(input: EventWriteInput, createdBy: string | null): Promise<EventItem> {
    const row = await queryOne<EventRow>(
      `insert into events (
         id, name, description, format, domains, tags, start_date, end_date,
         location, mode, team_size_min, team_size_max, prize_pool,
         registration_deadline, participants, featured, cover_image_url, created_by
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       returning ${COLUMNS}`,
      [
        newEventId(),
        input.name,
        input.description,
        input.format,
        input.domains,
        input.tags,
        input.startDate,
        input.endDate,
        input.location,
        input.mode,
        input.teamSize.min,
        input.teamSize.max,
        input.prizePool,
        input.registrationDeadline,
        input.participants,
        input.featured,
        input.coverImageUrl ?? null,
        createdBy,
      ],
    );
    if (!row) throw new Error('Insert returned no event row.');
    return mapEventRow(row);
  }

  async update(id: string, patch: EventUpdate): Promise<EventItem | null> {
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
    const row = await queryOne<EventRow>(
      `update events set ${assignments.join(', ')} where id = $${values.length} returning ${COLUMNS}`,
      values,
    );
    return row ? mapEventRow(row) : null;
  }

  async remove(id: string): Promise<boolean> {
    const rows = await query<{ id: string }>('delete from events where id = $1 returning id', [id]);
    return rows.length > 0;
  }

  /**
   * Every category with its live count, including the ones sitting at zero —
   * the frontend filter bar renders the full set, not just what is populated.
   */
  async formatCounts(): Promise<Array<{ name: string; count: number }>> {
    const rows = await query<{ format: string; count: string }>(
      'select format, count(*)::text as count from events group by format',
    );
    return rows.map((row) => ({ name: row.format, count: Number(row.count) }));
  }

  /**
   * Events per domain.
   *
   * `unnest` rather than `group by domains`: grouping on the array would count
   * each *combination* — "Web + Design" as its own bucket — which is not what
   * the filter bar asks. An event with two domains is counted under both, so
   * these deliberately sum to more than the number of events.
   */
  async domainCounts(): Promise<Array<{ name: string; count: number }>> {
    const rows = await query<{ domain: string; count: string }>(
      `select domain, count(*)::text as count
         from events, unnest(domains) as domain
        group by domain`,
    );
    return rows.map((row) => ({ name: row.domain, count: Number(row.count) }));
  }

  async count(): Promise<number> {
    const row = await queryOne<{ count: string }>('select count(*)::text as count from events');
    return Number(row?.count ?? 0);
  }
}

export const eventStore = new EventStore();

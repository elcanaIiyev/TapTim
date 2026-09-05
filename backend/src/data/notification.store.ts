import { query, queryOne } from '../db/pool.js';

export const NOTIFICATION_KINDS = [
  'team-invitation',
  'team-application',
  'request-accepted',
  'request-declined',
  'team-member-joined',
  'removed-from-team',
  'connection-request',
  'connection-accepted',
  'skill-endorsed',
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface NotificationRecord {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  actorId: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  actor_id: string | null;
  read_at: Date | null;
  created_at: Date;
}

function mapRow(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    kind: row.kind as NotificationKind,
    title: row.title,
    body: row.body,
    link: row.link,
    actorId: row.actor_id,
    readAt: row.read_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export interface EmitInput {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
  actorId?: string | null;
}

const COLUMNS = 'id, kind, title, body, link, actor_id, read_at, created_at';

/** Enough to fill the panel; the feed is not an archive anyone pages through. */
const FEED_LIMIT = 50;

class NotificationStore {
  async emit(input: EmitInput): Promise<NotificationRecord | null> {
    const row = await queryOne<NotificationRow>(
      `insert into notifications (user_id, kind, title, body, link, actor_id)
       values ($1, $2, $3, $4, $5, $6)
       returning ${COLUMNS}`,
      [
        input.userId,
        input.kind,
        input.title,
        input.body ?? null,
        input.link ?? null,
        input.actorId ?? null,
      ],
    );
    return row ? mapRow(row) : null;
  }

  async listFor(userId: string): Promise<NotificationRecord[]> {
    const rows = await query<NotificationRow>(
      `select ${COLUMNS} from notifications
        where user_id = $1
        order by created_at desc
        limit ${FEED_LIMIT}`,
      [userId],
    );
    return rows.map(mapRow);
  }

  async unreadCount(userId: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      'select count(*)::text as count from notifications where user_id = $1 and read_at is null',
      [userId],
    );
    return Number(row?.count ?? 0);
  }

  /** Marks one row read, scoped by owner so an id alone is not enough. */
  async markRead(userId: string, id: string): Promise<NotificationRecord | null> {
    const row = await queryOne<NotificationRow>(
      `update notifications set read_at = now()
        where id = $1 and user_id = $2 and read_at is null
        returning ${COLUMNS}`,
      [id, userId],
    );
    return row ? mapRow(row) : null;
  }

  async markAllRead(userId: string): Promise<number> {
    const rows = await query<{ id: string }>(
      'update notifications set read_at = now() where user_id = $1 and read_at is null returning id',
      [userId],
    );
    return rows.length;
  }
}

export const notificationStore = new NotificationStore();

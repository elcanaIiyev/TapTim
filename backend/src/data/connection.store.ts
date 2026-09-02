import { query, queryOne } from '../db/pool.js';
import { toIso, toIsoOrNull } from '../utils/dates.js';

/**
 * Connections and direct messages.
 *
 * Both tables store the pair canonically — `user_a` is always the smaller uuid
 * — so one row covers a relationship regardless of who started it. `pair()`
 * below is the only place that ordering is applied; every query goes through
 * it, so no caller has to remember which way round to write the ids.
 */

export type ConnectionStatus = 'pending' | 'accepted' | 'declined';

export interface ConnectionRecord {
  id: string;
  userA: string;
  userB: string;
  requestedBy: string;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

interface ConnectionRow {
  id: string;
  user_a: string;
  user_b: string;
  requested_by: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

function mapConnection(row: ConnectionRow): ConnectionRecord {
  return {
    id: row.id,
    userA: row.user_a,
    userB: row.user_b,
    requestedBy: row.requested_by,
    status: row.status as ConnectionStatus,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/** The canonical ordering the table's check constraint requires. */
function pair(one: string, two: string): [string, string] {
  return one < two ? [one, two] : [two, one];
}

export interface MessageRecord {
  id: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

interface MessageRow {
  id: string;
  sender_id: string;
  body: string;
  read_at: Date | null;
  created_at: Date;
}

function mapMessage(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    senderId: row.sender_id,
    body: row.body,
    readAt: toIsoOrNull(row.read_at),
    createdAt: toIso(row.created_at),
  };
}

const CONNECTION_COLUMNS = 'id, user_a, user_b, requested_by, status, created_at, updated_at';

class ConnectionStore {
  async between(one: string, two: string): Promise<ConnectionRecord | null> {
    const [a, b] = pair(one, two);
    const row = await queryOne<ConnectionRow>(
      `select ${CONNECTION_COLUMNS} from connections where user_a = $1 and user_b = $2`,
      [a, b],
    );
    return row ? mapConnection(row) : null;
  }

  async findById(id: string): Promise<ConnectionRecord | null> {
    const row = await queryOne<ConnectionRow>(
      `select ${CONNECTION_COLUMNS} from connections where id = $1`,
      [id],
    );
    return row ? mapConnection(row) : null;
  }

  /** Every connection this person is on either side of, any status. */
  async listFor(userId: string): Promise<ConnectionRecord[]> {
    const rows = await query<ConnectionRow>(
      `select ${CONNECTION_COLUMNS} from connections
        where user_a = $1 or user_b = $1
        order by updated_at desc`,
      [userId],
    );
    return rows.map(mapConnection);
  }

  /**
   * Raises a request, or revives one that was previously declined.
   *
   * A declined connection is not a permanent block — people change their minds
   * — so asking again reopens the same row rather than being rejected by the
   * unique index. An already-accepted one is left exactly as it is.
   */
  async request(requesterId: string, addresseeId: string): Promise<ConnectionRecord> {
    const [a, b] = pair(requesterId, addresseeId);
    const row = await queryOne<ConnectionRow>(
      `insert into connections (user_a, user_b, requested_by, status)
       values ($1, $2, $3, 'pending')
       on conflict (user_a, user_b) do update
         set status = case
               when connections.status = 'declined' then 'pending'
               else connections.status
             end,
             requested_by = case
               when connections.status = 'declined' then excluded.requested_by
               else connections.requested_by
             end
       returning ${CONNECTION_COLUMNS}`,
      [a, b, requesterId],
    );
    if (!row) throw new Error('Insert returned no connection row.');
    return mapConnection(row);
  }

  async setStatus(id: string, status: ConnectionStatus): Promise<ConnectionRecord | null> {
    const row = await queryOne<ConnectionRow>(
      `update connections set status = $2 where id = $1 returning ${CONNECTION_COLUMNS}`,
      [id, status],
    );
    return row ? mapConnection(row) : null;
  }

  async remove(id: string): Promise<boolean> {
    const rows = await query<{ id: string }>('delete from connections where id = $1 returning id', [
      id,
    ]);
    return rows.length > 0;
  }

  // -- messages -------------------------------------------------------------

  /**
   * A conversation, oldest last.
   *
   * Fetched newest-first so the index is used and the limit takes the *recent*
   * messages, then reversed for display — a chat reads top-down.
   */
  async messages(one: string, two: string, limit = 100): Promise<MessageRecord[]> {
    const [a, b] = pair(one, two);
    const rows = await query<MessageRow>(
      `select id, sender_id, body, read_at, created_at from messages
        where pair_a = $1 and pair_b = $2
        order by created_at desc
        limit $3`,
      [a, b, limit],
    );
    return rows.map(mapMessage).reverse();
  }

  async send(senderId: string, recipientId: string, body: string): Promise<MessageRecord> {
    const [a, b] = pair(senderId, recipientId);
    const row = await queryOne<MessageRow>(
      `insert into messages (pair_a, pair_b, sender_id, body)
       values ($1, $2, $3, $4)
       returning id, sender_id, body, read_at, created_at`,
      [a, b, senderId, body],
    );
    if (!row) throw new Error('Insert returned no message row.');
    return mapMessage(row);
  }

  /** Marks everything the *other* person sent as read. */
  async markRead(readerId: string, otherId: string): Promise<number> {
    const [a, b] = pair(readerId, otherId);
    const rows = await query<{ id: string }>(
      `update messages set read_at = now()
        where pair_a = $1 and pair_b = $2 and sender_id = $3 and read_at is null
        returning id`,
      [a, b, otherId],
    );
    return rows.length;
  }

  /** Unread counts per conversation partner, for the inbox and the nav badge. */
  async unreadCounts(userId: string): Promise<Map<string, number>> {
    const rows = await query<{ sender_id: string; count: string }>(
      `select sender_id, count(*)::text as count from messages
        where (pair_a = $1 or pair_b = $1) and sender_id <> $1 and read_at is null
        group by sender_id`,
      [userId],
    );
    return new Map(rows.map((row) => [row.sender_id, Number(row.count)]));
  }

  /** The most recent message with each partner, for the conversation list. */
  async latestPerPartner(userId: string): Promise<Map<string, MessageRecord>> {
    const rows = await query<MessageRow & { partner_id: string }>(
      `select distinct on (partner) m.id, m.sender_id, m.body, m.read_at, m.created_at,
              partner as partner_id
         from messages m,
              lateral (select case when m.pair_a = $1 then m.pair_b else m.pair_a end) as p(partner)
        where m.pair_a = $1 or m.pair_b = $1
        order by partner, m.created_at desc`,
      [userId],
    );

    return new Map(rows.map((row) => [row.partner_id, mapMessage(row)]));
  }
}

export const connectionStore = new ConnectionStore();

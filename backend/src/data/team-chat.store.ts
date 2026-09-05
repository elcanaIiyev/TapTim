import { query, queryOne } from '../db/pool.js';

/**
 * Team channels.
 *
 * Deliberately separate from `connection.store`, which owns direct messages
 * between a canonical pair. The two look alike from the UI and are nothing
 * alike underneath: a DM has one recipient and carries `read_at` on the message
 * itself, while a channel has as many recipients as the roster and tracks a
 * high-water mark per member.
 */

export interface TeamMessageRecord {
  id: string;
  teamId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

interface TeamMessageRow {
  id: string;
  team_id: string;
  sender_id: string;
  body: string;
  created_at: Date;
}

function mapRow(row: TeamMessageRow): TeamMessageRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at.toISOString(),
  };
}

/** Newest-last, so the UI can append without reversing. */
const HISTORY_LIMIT = 200;

class TeamChatStore {
  async messages(teamId: string): Promise<TeamMessageRecord[]> {
    // Ordered newest-first to use the index, then flipped: the alternative is
    // an ascending scan of the whole channel to find its tail.
    const rows = await query<TeamMessageRow>(
      `select id, team_id, sender_id, body, created_at
         from team_messages
        where team_id = $1
        order by created_at desc
        limit ${HISTORY_LIMIT}`,
      [teamId],
    );
    return rows.reverse().map(mapRow);
  }

  async send(teamId: string, senderId: string, body: string): Promise<TeamMessageRecord> {
    const row = await queryOne<TeamMessageRow>(
      `insert into team_messages (team_id, sender_id, body)
       values ($1, $2, $3)
       returning id, team_id, sender_id, body, created_at`,
      [teamId, senderId, body],
    );
    if (!row) throw new Error('Insert returned no message row.');
    return mapRow(row);
  }

  /** Moves this member's high-water mark to now. */
  async markRead(teamId: string, userId: string): Promise<void> {
    await query(
      `insert into team_message_reads (team_id, user_id, last_read_at)
       values ($1, $2, now())
       on conflict (team_id, user_id) do update set last_read_at = now()`,
      [teamId, userId],
    );
  }

  /**
   * Unread count per team for one person, across every team they are on.
   *
   * Read on every page load for the nav badge, so it is one query rather than
   * one per team. A member who has never opened a channel falls back to when
   * they joined the team — not the epoch, which would greet somebody joining an
   * established team with the entire backlog marked unread.
   *
   * Own messages never count, which is why `sender_id` is excluded rather than
   * the mark being bumped on send.
   */
  async unreadCounts(userId: string): Promise<Map<string, number>> {
    const rows = await query<{ team_id: string; unread: string }>(
      `select m.team_id, count(*)::text as unread
         from team_members tm
         join team_messages m on m.team_id = tm.team_id
         left join team_message_reads r
                on r.team_id = tm.team_id and r.user_id = tm.user_id
        where tm.user_id = $1
          and m.sender_id <> $1
          and m.created_at > greatest(tm.joined_at, coalesce(r.last_read_at, tm.joined_at))
        group by m.team_id`,
      [userId],
    );

    return new Map(rows.map((row) => [row.team_id, Number(row.unread)]));
  }

  /** The most recent message in each of this person's channels, for previews. */
  async latestPerTeam(userId: string): Promise<Map<string, TeamMessageRecord>> {
    const rows = await query<TeamMessageRow>(
      `select distinct on (m.team_id)
              m.id, m.team_id, m.sender_id, m.body, m.created_at
         from team_messages m
         join team_members tm on tm.team_id = m.team_id and tm.user_id = $1
        order by m.team_id, m.created_at desc`,
      [userId],
    );
    return new Map(rows.map((row) => [row.team_id, mapRow(row)]));
  }
}

export const teamChatStore = new TeamChatStore();

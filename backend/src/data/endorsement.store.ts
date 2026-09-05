import { query, queryOne } from '../db/pool.js';

/**
 * Endorsements on skills.
 *
 * Reads are shaped around the two questions anyone asks: "how endorsed is each
 * of this person's skills" (the profile, and every coverage calculation) and
 * "what have I already endorsed for them" (which buttons to light up).
 */

export interface EndorsementRecord {
  userId: string;
  endorserId: string;
  skill: string;
  teamId: string | null;
  createdAt: string;
}

interface EndorsementRow {
  user_id: string;
  endorser_id: string;
  skill: string;
  team_id: string | null;
  created_at: Date;
}

function mapRow(row: EndorsementRow): EndorsementRecord {
  return {
    userId: row.user_id,
    endorserId: row.endorser_id,
    skill: row.skill,
    teamId: row.team_id,
    createdAt: row.created_at.toISOString(),
  };
}

class EndorsementStore {
  /**
   * Endorsement counts per skill for one person.
   *
   * `on conflict do nothing` upstream means this is also the answer to "did it
   * work" — a repeat endorsement leaves the count unchanged rather than
   * erroring, which is what a double-click should do.
   */
  async countsFor(userId: string): Promise<Map<string, number>> {
    const rows = await query<{ skill: string; count: string }>(
      `select skill, count(*)::text as count
         from skill_endorsements
        where user_id = $1
        group by skill`,
      [userId],
    );
    return new Map(rows.map((row) => [row.skill, Number(row.count)]));
  }

  /**
   * Counts for several people at once.
   *
   * The suggestion ranking scores every candidate, and one query per candidate
   * is how a page that felt instant starts taking a second.
   */
  async countsForMany(userIds: readonly string[]): Promise<Map<string, Map<string, number>>> {
    if (userIds.length === 0) return new Map();

    const rows = await query<{ user_id: string; skill: string; count: string }>(
      `select user_id, skill, count(*)::text as count
         from skill_endorsements
        where user_id = any($1::uuid[])
        group by user_id, skill`,
      [userIds],
    );

    const byUser = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const forUser = byUser.get(row.user_id) ?? new Map<string, number>();
      forUser.set(row.skill, Number(row.count));
      byUser.set(row.user_id, forUser);
    }
    return byUser;
  }

  /** Which of this person's skills the viewer has already endorsed. */
  async byEndorser(endorserId: string, userId: string): Promise<Set<string>> {
    const rows = await query<{ skill: string }>(
      'select skill from skill_endorsements where endorser_id = $1 and user_id = $2',
      [endorserId, userId],
    );
    return new Set(rows.map((row) => row.skill));
  }

  /** Idempotent: endorsing twice is a no-op, not an error. */
  async add(
    userId: string,
    endorserId: string,
    skill: string,
    teamId: string | null,
  ): Promise<EndorsementRecord | null> {
    const row = await queryOne<EndorsementRow>(
      `insert into skill_endorsements (user_id, endorser_id, skill, team_id)
       values ($1, $2, $3, $4)
       on conflict (user_id, endorser_id, skill) do nothing
       returning user_id, endorser_id, skill, team_id, created_at`,
      [userId, endorserId, skill, teamId],
    );
    return row ? mapRow(row) : null;
  }

  async remove(userId: string, endorserId: string, skill: string): Promise<boolean> {
    const rows = await query<{ skill: string }>(
      `delete from skill_endorsements
        where user_id = $1 and endorser_id = $2 and skill = $3
        returning skill`,
      [userId, endorserId, skill],
    );
    return rows.length > 0;
  }

  /**
   * Have these two ever been on a team together?
   *
   * The gate on endorsing. Deliberately includes teams they are both on *now*
   * as well as ones they have left — "we worked together" does not stop being
   * true when the event ends, and requiring a finished event would mean nobody
   * could endorse until long after the moment they would want to.
   */
  async haveSharedATeam(a: string, b: string): Promise<string | null> {
    const row = await queryOne<{ team_id: string }>(
      `select mine.team_id
         from team_members mine
         join team_members theirs on theirs.team_id = mine.team_id
        where mine.user_id = $1 and theirs.user_id = $2
        limit 1`,
      [a, b],
    );
    return row?.team_id ?? null;
  }
}

export const endorsementStore = new EndorsementStore();

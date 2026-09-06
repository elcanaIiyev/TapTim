import { query, queryOne } from '../db/pool.js';
import { tally } from '../modules/users/endorsement-weight.js';
import type { EndorsementFact, SkillTally } from '../modules/users/endorsement-weight.js';

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
  eventId: string | null;
  createdAt: string;
}

interface EndorsementRow {
  user_id: string;
  endorser_id: string;
  skill: string;
  team_id: string | null;
  event_id: string | null;
  created_at: Date;
}

function toFact(row: { skill: string; event_id: string | null; at: Date }): EndorsementFact {
  return { skill: row.skill, eventId: row.event_id, at: row.at };
}

function mapRow(row: EndorsementRow): EndorsementRecord {
  return {
    userId: row.user_id,
    endorserId: row.endorser_id,
    skill: row.skill,
    teamId: row.team_id,
    eventId: row.event_id,
    createdAt: row.created_at.toISOString(),
  };
}

class EndorsementStore {
  /**
   * Endorsement tallies per skill for one person.
   *
   * Rows rather than a `count(*)`, because what an endorsement is worth now
   * depends on when the collaboration happened and whether the event it came
   * from is still on record -- see `endorsement-weight`. It is a handful of
   * rows per person, so that arithmetic belongs in the domain layer where it is
   * legible and testable rather than spread across a SQL expression.
   *
   * `on conflict do nothing` upstream means a repeat endorsement leaves the
   * tally unchanged rather than erroring, which is what a double-click should
   * do.
   */
  async talliesFor(userId: string): Promise<Map<string, SkillTally>> {
    const rows = await query<{ skill: string; event_id: string | null; at: Date }>(
      `select se.skill,
              se.event_id,
              coalesce(ev.end_date, se.created_at) as at
         from skill_endorsements se
         left join events ev on ev.id = se.event_id
        where se.user_id = $1`,
      [userId],
    );
    return tally(rows.map(toFact));
  }

  /**
   * Tallies for several people at once.
   *
   * The suggestion ranking scores every candidate, and one query per candidate
   * is how a page that felt instant starts taking a second.
   */
  async talliesForMany(
    userIds: readonly string[],
  ): Promise<Map<string, Map<string, SkillTally>>> {
    if (userIds.length === 0) return new Map();

    const rows = await query<{
      user_id: string;
      skill: string;
      event_id: string | null;
      at: Date;
    }>(
      `select se.user_id,
              se.skill,
              se.event_id,
              coalesce(ev.end_date, se.created_at) as at
         from skill_endorsements se
         left join events ev on ev.id = se.event_id
        where se.user_id = any($1::uuid[])`,
      [userIds],
    );

    const factsByUser = new Map<string, EndorsementFact[]>();
    for (const row of rows) {
      const facts = factsByUser.get(row.user_id) ?? [];
      facts.push(toFact(row));
      factsByUser.set(row.user_id, facts);
    }

    // One clock for the whole batch: two candidates scored microseconds apart
    // must not decay differently.
    const now = new Date();
    return new Map([...factsByUser].map(([id, facts]) => [id, tally(facts, now)]));
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
    context: { teamId: string | null; eventId: string | null },
  ): Promise<EndorsementRecord | null> {
    const row = await queryOne<EndorsementRow>(
      `insert into skill_endorsements (user_id, endorser_id, skill, team_id, event_id)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id, endorser_id, skill) do nothing
       returning user_id, endorser_id, skill, team_id, event_id, created_at`,
      [userId, endorserId, skill, context.teamId, context.eventId],
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
   * The most recent team these two have shared, and the event it was for.
   *
   * The gate on endorsing, and now also its context. Deliberately includes
   * teams they are both on *now* as well as ones they have left -- "we worked
   * together" does not stop being true when the event ends, and requiring a
   * finished event would mean nobody could endorse until long after the moment
   * they would want to.
   *
   * Most recent rather than any: an endorsement is dated by the collaboration
   * behind it, so it should be dated by the latest one and not by whichever row
   * the planner happened to return first.
   */
  async lastSharedTeam(
    a: string,
    b: string,
  ): Promise<{ teamId: string; eventId: string } | null> {
    const row = await queryOne<{ team_id: string; event_id: string }>(
      `select t.id as team_id, t.event_id
         from team_members mine
         join team_members theirs on theirs.team_id = mine.team_id
         join teams t on t.id = mine.team_id
         left join events ev on ev.id = t.event_id
        where mine.user_id = $1 and theirs.user_id = $2
        order by coalesce(ev.end_date, t.created_at) desc
        limit 1`,
      [a, b],
    );
    return row ? { teamId: row.team_id, eventId: row.event_id } : null;
  }
}

export const endorsementStore = new EndorsementStore();

/**
 * What an endorsement is worth.
 *
 * The count was the whole model: three endorsements were three endorsements
 * whether they arrived last weekend or in 2023, and whether they came from
 * somebody who had genuinely built alongside you at a named event or from a
 * friend who happened to have shared a team once. Both are the same failure —
 * the coverage engine treated a number as evidence without asking what the
 * number was made of.
 *
 * Two multipliers, both deliberately gentle. The point is not to punish old
 * endorsements; it is to stop them out-shouting recent ones.
 *
 * **Context.** An endorsement carrying the event it came from is a claim two
 * people's team membership can confirm. One without is not false — every
 * endorsement has always required a shared team — but the row no longer knows
 * which, so it is worth less than one that does. This is the same instinct as
 * the confidence model's split between "unrated" and "rated average": the
 * absence of evidence is not evidence, and it should not be scored as if it
 * were.
 *
 * **Age.** Skills move. Somebody vouched for at a hackathon three years ago may
 * still be excellent and may have not written a line since; the endorsement
 * cannot tell us which, and its claim to currency weakens either way. It never
 * decays to nothing, because it did happen.
 *
 * The clock is the *event's* end date where there is one, which is the honest
 * answer to "when did this collaboration happen". `created_at` only records
 * when somebody got round to clicking.
 */

/** Below this, an endorsement is simply current. */
const FULL_WEIGHT_MONTHS = 6;

/** Past that, the surplus above the floor halves every this-many months. */
const HALF_LIFE_MONTHS = 18;

/** However old it gets, it still happened. */
const FLOOR = 0.3;

/** An endorsement whose event is unknown, and so unverifiable. */
const UNVERIFIED_FACTOR = 0.5;

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export interface EndorsementFact {
  skill: string;
  /** The event it came from, or null for one recorded before events were kept. */
  eventId: string | null;
  /** The event's end date where known, else when the endorsement was recorded. */
  at: Date;
}

export interface SkillTally {
  /** How many people endorsed it. What the badge shows. */
  count: number;
  /** How many of those carry a verifiable event. */
  verified: number;
  /** What the coverage engine reads: count, discounted for age and context. */
  weight: number;
}

/** How much one endorsement counts for, in [0, 1]. */
export function weightOf(fact: EndorsementFact, now: Date): number {
  const months = Math.max(0, (now.getTime() - fact.at.getTime()) / MONTH_MS);
  const aged = Math.max(0, months - FULL_WEIGHT_MONTHS);
  const recency = FLOOR + (1 - FLOOR) * 2 ** (-aged / HALF_LIFE_MONTHS);

  return recency * (fact.eventId ? 1 : UNVERIFIED_FACTOR);
}

/** Rolls a person's endorsement rows up per skill. */
export function tally(facts: readonly EndorsementFact[], now = new Date()): Map<string, SkillTally> {
  const out = new Map<string, SkillTally>();

  for (const fact of facts) {
    const current = out.get(fact.skill) ?? { count: 0, verified: 0, weight: 0 };
    current.count += 1;
    if (fact.eventId) current.verified += 1;
    current.weight += weightOf(fact, now);
    out.set(fact.skill, current);
  }

  return out;
}

/**
 * The projection the coverage engine takes.
 *
 * `coverageFor` asks "how endorsed is this skill" and feeds the answer through
 * `1 - exp(-endorsed)`, which is continuous — so handing it a weight instead of
 * a count needs no change there at all. A skill with two fresh event-backed
 * endorsements now reads as 2.0 where two four-year-old context-free ones read
 * as roughly 0.4, which is the whole point.
 */
export function weightsOf(tallies: ReadonlyMap<string, SkillTally>): Map<string, number> {
  return new Map([...tallies].map(([skill, entry]) => [skill, entry.weight]));
}

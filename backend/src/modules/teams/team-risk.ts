import {
  AVAILABILITY_SLOTS,
  type AvailabilitySlot,
  type Personality,
  type TeamRole,
} from '../users/user.model.js';

/**
 * What could go wrong on this team.
 *
 * The gap report says which skills are missing. That is not what people
 * describe when a weekend goes badly. They say nobody was ever online at the
 * same time, or that everyone wanted to lead and nobody wanted to plan, or that
 * the whole thing rested on one person who then disappeared. Every one of those
 * is computable from data already stored — availability slots are discrete and
 * intersectable, working style is ten 1–5 answers, the roster is right there —
 * and none of it was being read.
 *
 * Two rules keep this from becoming noise:
 *
 * - **Every risk names its evidence.** A warning you cannot check is a warning
 *   people learn to ignore.
 * - **Nothing fires on absent data.** A team that has not filled in working
 *   style is not a team with a working-style problem, and saying so would be
 *   the same dishonesty the confidence work exists to prevent.
 */

export type RiskSeverity = 'high' | 'medium' | 'low';

export interface TeamRisk {
  id: string;
  severity: RiskSeverity;
  /** The finding, as a person would say it. */
  title: string;
  /** Why it is being raised — the numbers behind the claim. */
  detail: string;
  /** What to do about it. Omitted when there is nothing honest to suggest. */
  suggestion: string | null;
}

export interface RiskMember {
  id: string;
  fullName: string;
  availability: AvailabilitySlot[];
  hoursPerWeek: number | null;
  timezoneOffset: number | null;
  personality: Personality;
  roles: readonly TeamRole[];
  skills: string[];
}

const SLOT_LABEL: Record<AvailabilitySlot, string> = {
  'weekday-mornings': 'weekday mornings',
  'weekday-afternoons': 'weekday afternoons',
  'weekday-evenings': 'weekday evenings',
  'weekend-mornings': 'weekend mornings',
  'weekend-afternoons': 'weekend afternoons',
  'weekend-evenings': 'weekend evenings',
};

/** Slots every member has in common. */
export function sharedSlots(members: readonly RiskMember[]): AvailabilitySlot[] {
  const stated = members.filter((member) => member.availability.length > 0);
  if (stated.length === 0) return [];

  return AVAILABILITY_SLOTS.filter((slot) =>
    stated.every((member) => member.availability.includes(slot)),
  );
}

/** One slot in the week grid. */
export interface SlotCoverage {
  slot: AvailabilitySlot;
  label: string;
  count: number;
  who: string[];
}

/**
 * How many of the team can make each slot.
 *
 * The grid the UI draws. Availability was already stored as discrete slots and
 * already intersected for scoring, so this turns a number nobody could act on
 * into a picture somebody can schedule around.
 */
export function slotCoverage(members: readonly RiskMember[]): SlotCoverage[] {
  return AVAILABILITY_SLOTS.map((slot) => {
    const who = members.filter((member) => member.availability.includes(slot));
    return {
      slot,
      label: SLOT_LABEL[slot],
      count: who.length,
      who: who.map((member) => member.fullName),
    };
  });
}

/** Mean of a trait across everyone who answered it. Null when nobody did. */
function traitAverage(members: readonly RiskMember[], trait: keyof Personality): number | null {
  const answered = members
    .map((member) => member.personality[trait])
    .filter((value): value is number => typeof value === 'number');

  if (answered.length === 0) return null;
  return answered.reduce((sum, value) => sum + value, 0) / answered.length;
}

/** How many answered a trait at all — the guard against firing on absent data. */
function answeredCount(members: readonly RiskMember[], trait: keyof Personality): number {
  return members.filter((member) => typeof member.personality[trait] === 'number').length;
}

function names(members: readonly RiskMember[]): string {
  if (members.length === 0) return 'nobody';
  if (members.length === 1) return members[0].fullName;
  const shown = members.slice(0, 3).map((member) => member.fullName);
  const extra = members.length - shown.length;
  return extra > 0 ? `${shown.join(', ')} and ${extra} more` : shown.join(' and ');
}

export function assessTeamRisks(
  members: readonly RiskMember[],
  team: { maxSize: number; requiredSkills: readonly string[] },
): TeamRisk[] {
  const risks: TeamRisk[] = [];
  if (members.length === 0) return risks;

  // -- when can this team actually work together ----------------------------
  const stated = members.filter((member) => member.availability.length > 0);

  if (stated.length < members.length) {
    const missing = members.filter((member) => member.availability.length === 0);
    risks.push({
      id: 'availability-unknown',
      severity: 'low',
      title: 'Some of the team have not said when they are free',
      detail: `${names(missing)} left availability blank, so any overlap below is only across the rest.`,
      suggestion: 'Ask them to fill it in — it is two clicks and it changes the answer.',
    });
  }

  if (stated.length >= 2) {
    const shared = sharedSlots(members);

    if (shared.length === 0) {
      risks.push({
        id: 'no-shared-time',
        severity: 'high',
        title: 'There is no time when everyone is free',
        detail: `No slot works for all ${stated.length} of you. Teams that never overlap end up as ${stated.length} people doing ${stated.length} separate things.`,
        suggestion: 'Agree one slot everyone will make an exception for, before the event starts.',
      });
    } else if (shared.length === 1) {
      risks.push({
        id: 'thin-shared-time',
        severity: 'medium',
        title: 'Only one slot works for the whole team',
        detail: `${SLOT_LABEL[shared[0]]} is the single window you all share. One dropped session and there is no fallback.`,
        suggestion: 'Protect that slot, or find a second one somebody can stretch to.',
      });
    }
  }

  // -- spread of hours -------------------------------------------------------
  const withHours = members.filter((member) => member.hoursPerWeek !== null);
  if (withHours.length >= 2) {
    const hours = withHours.map((member) => member.hoursPerWeek as number);
    const min = Math.min(...hours);
    const max = Math.max(...hours);

    // Not a warning about anyone being lazy — a mismatch in expectation is what
    // causes the argument, and it is worth having before rather than after.
    if (max >= min * 2.5 && max - min >= 12) {
      const most = withHours.find((member) => member.hoursPerWeek === max);
      const least = withHours.find((member) => member.hoursPerWeek === min);
      risks.push({
        id: 'mismatched-commitment',
        severity: 'medium',
        title: 'People are planning very different amounts of time',
        detail: `${most?.fullName} expects ${max}h a week, ${least?.fullName} expects ${min}h. That gap usually surfaces as resentment on the last day.`,
        suggestion: 'Say out loud what each person is actually signing up for.',
      });
    }
  }

  // -- timezones -------------------------------------------------------------
  const withZones = members.filter((member) => member.timezoneOffset !== null);
  if (withZones.length >= 2) {
    const offsets = withZones.map((member) => member.timezoneOffset as number);
    const spread = Math.max(...offsets) - Math.min(...offsets);
    if (spread >= 5) {
      risks.push({
        id: 'timezone-spread',
        severity: spread >= 8 ? 'high' : 'medium',
        title: `${spread} hours of timezone between you`,
        detail: 'A shared slot on a calendar is not a shared slot in practice when it is 3am for somebody.',
        suggestion: 'Decide now which hours are meeting hours and which are async.',
      });
    }
  }

  // -- working style ---------------------------------------------------------
  // Each of these needs at least three answers: two people agreeing is not a
  // pattern, and one person cannot clash with themselves.
  const leadership = traitAverage(members, 'leadership');
  const structure = traitAverage(members, 'structure');

  if (leadership !== null && structure !== null && answeredCount(members, 'leadership') >= 3) {
    if (leadership >= 4 && structure <= 2.5) {
      risks.push({
        id: 'all-chiefs',
        severity: 'medium',
        title: 'Everyone wants to lead and nobody wants to plan',
        detail: `Leadership averages ${leadership.toFixed(1)}/5 across the team while structure sits at ${structure.toFixed(1)}/5.`,
        suggestion: 'Pick who owns the plan before you pick who owns the code.',
      });
    }
    if (leadership <= 2 && members.length >= 3) {
      risks.push({
        id: 'no-lead',
        severity: 'medium',
        title: 'Nobody on this team is inclined to take the lead',
        detail: `Leadership averages ${leadership.toFixed(1)}/5. Decisions tend to stall in teams like this rather than being made badly.`,
        suggestion: 'Agree who breaks ties, even if nobody wants the title.',
      });
    }
  }

  const pace = members.map((member) => member.personality.pace).filter((v): v is number => typeof v === 'number');
  if (pace.length >= 3 && Math.max(...pace) - Math.min(...pace) >= 3) {
    risks.push({
      id: 'pace-clash',
      severity: 'low',
      title: 'Very different ideas about pace',
      detail: `Answers range from ${Math.min(...pace)} to ${Math.max(...pace)} out of 5 — some of you want to ship early and iterate, others want it right first.`,
      suggestion: 'Agree what "done" means for the first checkpoint.',
    });
  }

  const conflict = traitAverage(members, 'conflict');
  if (conflict !== null && answeredCount(members, 'conflict') >= 3 && conflict <= 2) {
    risks.push({
      id: 'conflict-avoidant',
      severity: 'low',
      title: 'This team is likely to avoid disagreement',
      detail: `Comfort with conflict averages ${conflict.toFixed(1)}/5. Problems in teams like this tend to be noticed late, not never.`,
      suggestion: 'Build in one deliberate "what is not working" check halfway through.',
    });
  }

  // -- concentration ---------------------------------------------------------
  if (members.length >= 3 && team.requiredSkills.length > 0) {
    for (const skill of team.requiredSkills) {
      const holders = members.filter((member) => member.skills.includes(skill));
      if (holders.length === 1) {
        risks.push({
          id: `single-point-${skill.toLowerCase().replace(/\s+/g, '-')}`,
          severity: 'medium',
          title: `Only one person covers ${skill}`,
          detail: `${holders[0].fullName} is the whole team's ${skill}. If they are ill or pulled away, that part stops.`,
          suggestion: `Have somebody second on ${skill}, even shallowly.`,
        });
      }
    }
  }

  // -- size ------------------------------------------------------------------
  if (members.length === 1) {
    risks.push({
      id: 'solo',
      severity: 'high',
      title: 'You are on your own so far',
      detail: 'Every risk above is about how a team works together, and there is not a team yet.',
      suggestion: 'The brief below says who to look for.',
    });
  } else if (members.length >= team.maxSize && team.maxSize >= 5) {
    risks.push({
      id: 'coordination-load',
      severity: 'low',
      title: 'A full team of this size spends real time coordinating',
      detail: `${members.length} people means most of the value comes from splitting work cleanly rather than from more hands.`,
      suggestion: 'Decide the split on day one, not when somebody is blocked.',
    });
  }

  // Highest severity first, so the panel opens with the thing that matters.
  const order: Record<RiskSeverity, number> = { high: 0, medium: 1, low: 2 };
  return risks.sort((a, b) => order[a.severity] - order[b.severity]);
}

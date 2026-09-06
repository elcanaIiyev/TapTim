import type { EventItem } from './types';

/**
 * Where an event is in its own life.
 *
 * Every date this needs has been stored since the first migration and none of
 * it did anything: registration deadlines, start dates and end dates were
 * displayed and then ignored, so the site looked identical on the Tuesday
 * before a hackathon, the Friday it started, and the week after it ended. A
 * product about a thing that happens on a weekend should know which weekend it
 * is.
 *
 * Derived rather than stored. A phase is a function of the clock, so a column
 * holding one would be wrong for most of every day unless something kept
 * writing to it, and the dates are already on every payload the site fetches.
 */

export type EventPhase =
  /** Plenty of time. Matching is the whole point of the page. */
  | 'open'
  /** Registration closes within the week — the last call to find a team. */
  | 'closing'
  /** Registration is shut but it has not started. Rosters are settled. */
  | 'locked'
  /** It is happening right now. */
  | 'running'
  /** It is over. */
  | 'finished';

/** How close to the registration deadline counts as the last call. */
const CLOSING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function eventPhase(
  event: Pick<EventItem, 'startDate' | 'endDate' | 'registrationDeadline'>,
  now: Date = new Date(),
): EventPhase {
  const at = now.getTime();
  const start = Date.parse(event.startDate);
  const end = Date.parse(event.endDate);
  const deadline = Date.parse(event.registrationDeadline);

  // End first, then start: an event whose dates are inconsistent should read as
  // over rather than as perpetually running.
  if (Number.isFinite(end) && at > end) return 'finished';
  if (Number.isFinite(start) && at >= start) return 'running';
  if (Number.isFinite(deadline) && at >= deadline) return 'locked';
  if (Number.isFinite(deadline) && deadline - at <= CLOSING_WINDOW_MS) return 'closing';
  return 'open';
}

/** Whether somebody can still join or start a team here. */
export function acceptsTeams(phase: EventPhase): boolean {
  return phase === 'open' || phase === 'closing';
}

/**
 * Whether matching is still the point of the page.
 *
 * Once it is running, "here is your fit for this event and what you would want
 * a teammate for" is advice about a decision that has already been made.
 */
export function matchingMatters(phase: EventPhase): boolean {
  return phase !== 'running' && phase !== 'finished';
}

interface PhaseCopy {
  /** Two or three words, for a badge. */
  label: string;
  /** One sentence, for a banner. */
  line: string;
  tone: 'neutral' | 'accent' | 'warning' | 'success';
}

function days(ms: number): number {
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
}

function countdown(ms: number): string {
  const hours = ms / (60 * 60 * 1000);
  if (hours < 1) return 'in under an hour';
  if (hours < 36) return `in ${Math.round(hours)} hours`;
  return `in ${days(ms)} days`;
}

export function phaseCopy(
  event: Pick<EventItem, 'startDate' | 'endDate' | 'registrationDeadline'>,
  now: Date = new Date(),
): PhaseCopy {
  const phase = eventPhase(event, now);
  const at = now.getTime();

  switch (phase) {
    case 'running':
      return {
        label: 'Happening now',
        line: `This event is running — it ends ${countdown(Date.parse(event.endDate) - at)}.`,
        tone: 'success',
      };
    case 'finished':
      return {
        label: 'Finished',
        line: `This event finished ${days(at - Date.parse(event.endDate))} days ago.`,
        tone: 'neutral',
      };
    case 'locked':
      return {
        label: 'Registration closed',
        line: `Registration has closed. It starts ${countdown(Date.parse(event.startDate) - at)}.`,
        tone: 'warning',
      };
    case 'closing':
      return {
        label: 'Closing soon',
        line: `Registration closes ${countdown(Date.parse(event.registrationDeadline) - at)} — this is the week to find a team.`,
        tone: 'warning',
      };
    default:
      return {
        label: `In ${days(Date.parse(event.startDate) - at)} days`,
        line: `Registration is open until ${new Date(event.registrationDeadline).toLocaleDateString([], { day: 'numeric', month: 'short' })}.`,
        tone: 'accent',
      };
  }
}

/**
 * How a person's profile fields read out loud.
 *
 * Shared by the page where you edit your profile and the page where other
 * people read it. These used to live inside the editor alone, and the moment a
 * second page needed them the choice was a copy or this file — and a slider
 * labelled one way while you set it and another way when someone reads it is
 * worse than no label at all.
 */

export const AVAILABILITY_LABELS: Record<string, string> = {
  'weekday-mornings': 'Weekday mornings',
  'weekday-afternoons': 'Weekday afternoons',
  'weekday-evenings': 'Weekday evenings',
  'weekend-mornings': 'Weekend mornings',
  'weekend-afternoons': 'Weekend afternoons',
  'weekend-evenings': 'Weekend evenings',
};

export function availabilityLabel(slot: string): string {
  return AVAILABILITY_LABELS[slot] ?? slot.replace(/-/g, ' ');
}

/**
 * Every slider is phrased as two ends of a real working preference, not as
 * good-versus-bad. Nobody should be able to work out which answer "wins",
 * because the engine matches complementary styles rather than high scores.
 */
export const TRAIT_COPY: Record<string, { label: string; low: string; high: string }> = {
  leadership: { label: 'Leading', low: 'Happy to follow', high: 'Likes to steer' },
  communication: { label: 'Syncing', low: 'Heads-down', high: 'Constant contact' },
  structure: { label: 'Planning', low: 'Improvise', high: 'Plan it out' },
  pace: { label: 'Pace', low: 'Steady', high: 'Sprint' },
  risk: { label: 'Ideas', low: 'Proven ground', high: 'Try the wild one' },
  autonomy: { label: 'Autonomy', low: 'Check in often', high: 'Leave me to it' },
  feedback: { label: 'Feedback', low: 'Soften it', high: 'Say it straight' },
  decisions: { label: 'Decisions', low: 'Agree together', high: 'Someone calls it' },
  deadlines: { label: 'Deadlines', low: 'Finish early', high: 'Thrive near the wire' },
  conflict: { label: 'Disagreement', low: 'Smooth it over', high: 'Hash it out' },
};

export const EXPERIENCE_LEVEL_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

/** "UTC+4", "UTC−3:30", "UTC" — the offset the way someone would say it. */
export function utcOffsetLabel(offset: number | null | undefined): string | null {
  if (offset === null || offset === undefined) return null;
  if (offset === 0) return 'UTC';
  const sign = offset > 0 ? '+' : '−';
  const abs = Math.abs(offset);
  const hours = Math.floor(abs);
  const minutes = Math.round((abs - hours) * 60);
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}

/** Text colour for a 0–100 score, on the same bands the engine names. */
export function scoreTone(score: number): string {
  if (score >= 80) return 'text-success-text';
  if (score >= 65) return 'text-accent-text';
  if (score >= 45) return 'text-signal-warn';
  return 'text-signal-bad';
}

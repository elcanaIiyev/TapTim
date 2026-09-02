/**
 * The fixed vocabularies the profile builder offers as toggle chips.
 *
 * These are closed sets rather than free text on purpose: the matching engine
 * intersects them, and "JS", "js" and "JavaScript" as three different strings
 * make every overlap calculation wrong. Skills stay free-text because the long
 * tail there is genuinely open-ended; these four are not.
 */

/** Spoken languages. Ordered by how often they appear in this region's events. */
export const LANGUAGES = [
  'Azerbaijani',
  'English',
  'Turkish',
  'Russian',
  'German',
  'French',
  'Spanish',
  'Arabic',
  'Persian',
  'Georgian',
  'Ukrainian',
  'Italian',
  'Portuguese',
  'Hindi',
  'Urdu',
  'Chinese',
  'Japanese',
  'Korean',
] as const;
export type Language = (typeof LANGUAGES)[number];

/**
 * Problem domains someone wants to build in.
 *
 * Added after looking at how teammate-finding actually works on Devpost and
 * HackBud: both let people filter by project domain, because two strong
 * engineers who want to build in different spaces still make a bad team.
 */
export const INTEREST_DOMAINS = [
  'AI & Machine Learning',
  'Fintech',
  'Health & Biotech',
  'Climate & Sustainability',
  'Education',
  'Gaming',
  'Developer Tools',
  'Web3 & Blockchain',
  'Cybersecurity',
  'Social Impact',
  'E-commerce & Retail',
  'Robotics & Hardware',
  'AR / VR',
  'Mobility & Logistics',
  'Media & Creative',
  'Productivity',
] as const;
export type InterestDomain = (typeof INTEREST_DOMAINS)[number];

/**
 * Why someone turned up.
 *
 * This is the field most likely to prevent a bad team and the one no signup
 * form asks for. Somebody there to win at all costs and somebody there to
 * learn will both be competent and still make each other miserable, and no
 * amount of skill overlap detects that.
 */
export const EVENT_GOALS = [
  'Win the hackathon',
  'Learn something new',
  'Meet people & network',
  'Build a portfolio piece',
  'Find a co-founder',
  'Ship something real',
  'Have fun, low pressure',
] as const;
export type EventGoal = (typeof EVENT_GOALS)[number];

/** Optional, self-described, and free of any inference from a name. */
export const PRONOUN_OPTIONS = [
  'she/her',
  'he/him',
  'they/them',
  'she/they',
  'he/they',
  'prefer not to say',
] as const;

export const EXPERIENCE_KINDS = [
  'work',
  'internship',
  'project',
  'hackathon',
  'education',
  'volunteering',
] as const;
export type ExperienceKind = (typeof EXPERIENCE_KINDS)[number];

/** Whole years from a `YYYY-MM-DD` birth date, or null when unset. */
export function ageFromDateOfBirth(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;

  const born = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(born.getTime())) return null;

  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();

  // Subtract a year when this year's birthday has not happened yet.
  const monthDelta = now.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

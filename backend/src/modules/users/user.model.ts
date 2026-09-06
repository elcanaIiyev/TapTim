import type { AccountRole } from './account-role.js';
import {
  ageFromDateOfBirth,
  type EventGoal,
  type InterestDomain,
  type Language,
} from './profile-options.js';
import { toIso, toIsoOrNull } from '../../utils/dates.js';

/**
 * Positions someone can take on a team — not job titles.
 *
 * The distinction matters, and getting it wrong is why this used to be a single
 * `primaryRole`. What a team needs filled over a weekend is not a set of
 * professions: somebody has to present on Sunday, somebody has to keep the
 * scope honest, somebody has to write the backend. Those are often the same
 * person wearing three hats, so this is a set, and it includes the positions
 * that have nothing to do with writing code — a team with no presenter loses
 * for reasons unrelated to its build.
 *
 * Ordered engineering-first only because that is what most people pick first;
 * nothing in the scoring reads the order.
 */
export const TEAM_ROLES = [
  // Build
  'Frontend Developer',
  'Backend Developer',
  'Full-Stack Developer',
  'Mobile Developer',
  'Game Developer',
  'AI / ML Engineer',
  'Data Scientist',
  'DevOps Engineer',
  'Cybersecurity',
  'QA / Tester',
  'Hardware / IoT',
  // Shape
  'UI/UX Designer',
  'Graphic Artist',
  'Product Manager',
  'Business Analyst',
  'Researcher',
  // Tell
  'Presenter',
  'Pitch Writer',
  'Demo Builder',
  'Documentation Lead',
] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

/**
 * How many roles one person may claim.
 *
 * A cap is load-bearing rather than cosmetic: without one, selecting every role
 * strictly dominates choosing honestly, because every role-based filter and
 * every "fills a missing seat" bonus would match. Five is more than anyone
 * genuinely covers in a weekend. Mirrored by a check constraint in
 * `010_team_roles.sql`, because the database is where an invariant belongs.
 */
export const MAX_TEAM_ROLES = 5;

/**
 * The single role to show where only one fits — a card, a chat header.
 *
 * First-listed rather than "most important": people order a list meaningfully
 * without being asked to, and inventing a separate "primary" flag would put us
 * back where this started.
 */
export function displayRole(roles: readonly TeamRole[]): TeamRole | null {
  return roles[0] ?? null;
}

export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/**
 * Availability is modelled as discrete slots rather than free text so two
 * profiles can be intersected directly when scoring compatibility.
 */
export const AVAILABILITY_SLOTS = [
  'weekday-mornings',
  'weekday-afternoons',
  'weekday-evenings',
  'weekend-mornings',
  'weekend-afternoons',
  'weekend-evenings',
] as const;
export type AvailabilitySlot = (typeof AVAILABILITY_SLOTS)[number];

/**
 * Working-style traits, each scored 1–5. They are deliberately about *how*
 * someone works rather than personality typing, so the score stays explainable.
 */
export const PERSONALITY_TRAITS = [
  'leadership',
  'communication',
  'structure',
  'pace',
  'risk',
  // Added after the first five proved too coarse to separate people. Each of
  // these is a real source of team friction that skills and roles miss
  // entirely, and each is a thing someone can answer about themselves in a
  // second without having to introspect.
  'autonomy',
  'feedback',
  'decisions',
  'deadlines',
  'conflict',
] as const;
export type PersonalityTrait = (typeof PERSONALITY_TRAITS)[number];

export type Personality = Partial<Record<PersonalityTrait, number>>;

/** Internal shape kept in the store. Never serialised to a client as-is. */
export interface UserRecord {
  id: string;
  email: string;
  /** Null for accounts created through Google or LinkedIn. */
  passwordHash: string | null;
  /** Derived from first + last on every write; the single display name. */
  fullName: string;
  firstName: string;
  lastName: string | null;
  roles: TeamRole[];
  skills: string[];
  bio: string | null;
  avatarUrl: string | null;
  verified: boolean;
  experienceLevel: ExperienceLevel;
  availability: AvailabilitySlot[];
  hoursPerWeek: number | null;
  timezoneOffset: number | null;
  personality: Personality;
  /** Skill -> proficiency 0..100. Keys are always a subset of `skills`. */
  skillLevels: Record<string, number>;
  lookingForTeam: boolean;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  /**
   * Site role — authority on TapTim, unrelated to the team roles above.
   * Settable only by an admin through the console or by the `admin:grant`
   * script; never through profile editing.
   */
  accountRole: AccountRole;

  // -- profile builder -------------------------------------------------------
  dateOfBirth: string | null;
  pronouns: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  languages: Language[];
  interestDomains: InterestDomain[];
  goals: EventGoal[];
  hackathonsAttended: number;
  preferredTeamSize: number | null;
  discordHandle: string | null;

  // -- lifecycle -------------------------------------------------------------
  emailVerified: boolean;
  onboardingCompleted: boolean;
  /** Storage object path, kept so a replaced avatar can be deleted. */
  avatarPath: string | null;

  /**
   * Null when active. A timestamp means suspended until then; `Infinity`
   * (stored as Postgres `'infinity'`) means permanently.
   */
  bannedUntil: string | null;
  bannedReason: string | null;
  bannedAt: string | null;
  bannedBy: string | null;

  /**
   * When availability was last confirmed as still true.
   *
   * Separate from `updatedAt`, which moves whenever any field changes -- so
   * somebody who edited their bio this morning would otherwise look like they
   * had just re-checked their Saturday availability too. Availability is the
   * heaviest component the engine weighs, so knowing how old it is matters more
   * than it does for anything else on the profile.
   */
  availabilityConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Normalises what Postgres hands back for `banned_until`.
 *
 * `pg` parses a `'infinity'` timestamptz into the JavaScript *number*
 * `Infinity`, not the string — so a naive `toIso` on it calls
 * `new Date(Infinity).toISOString()` and throws "Invalid time value", turning a
 * permanent ban into a 500. Everything downstream wants one sentinel, so the
 * numeric form is folded into the string one here, at the only boundary where
 * the driver's representation is visible.
 */
function normaliseBannedUntil(value: Date | string | number | null): string | null {
  if (value === null || value === undefined) return null;
  if (value === Infinity || value === 'infinity') return 'infinity';
  if (value === -Infinity || value === '-infinity') return null;
  return toIso(value as Date);
}

/** True while a suspension is in force. Expiry needs no job — it just lapses. */
export function isBanned(user: Pick<UserRecord, 'bannedUntil'>): boolean {
  if (!user.bannedUntil) return false;
  if (user.bannedUntil === 'infinity') return true;
  const until = Date.parse(user.bannedUntil);
  return Number.isNaN(until) ? false : until > Date.now();
}

export function isPermanentBan(user: Pick<UserRecord, 'bannedUntil'>): boolean {
  return user.bannedUntil === 'infinity';
}

/** Projection returned to the account's own owner — includes the email. */
export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  firstName: string;
  lastName: string | null;
  roles: TeamRole[];
  skills: string[];
  bio: string | null;
  avatarUrl: string | null;
  verified: boolean;
  experienceLevel: ExperienceLevel;
  availability: AvailabilitySlot[];
  hoursPerWeek: number | null;
  timezoneOffset: number | null;
  personality: Personality;
  skillLevels: Record<string, number>;
  lookingForTeam: boolean;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  accountRole: AccountRole;
  dateOfBirth: string | null;
  /** Derived from `dateOfBirth`, so it cannot go stale the way a stored age would. */
  age: number | null;
  pronouns: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  languages: Language[];
  interestDomains: InterestDomain[];
  goals: EventGoal[];
  hackathonsAttended: number;
  preferredTeamSize: number | null;
  discordHandle: string | null;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
}

/**
 * Projection returned when *other* people look at a profile. Drops the email
 * and the site role — who holds authority is not public information.
 */
export type DirectoryUser = Omit<
  PublicUser,
  'email' | 'accountRole' | 'dateOfBirth' | 'emailVerified' | 'onboardingCompleted'
>;

export function toPublicUser(user: UserRecord): PublicUser {
  const { passwordHash, updatedAt, avatarPath, ...rest } = user;
  void passwordHash;
  void updatedAt;
  void avatarPath;
  return { ...rest, age: ageFromDateOfBirth(user.dateOfBirth) };
}

/**
 * Email addresses are private: they identify a person off-platform and nothing
 * in the matching UI needs one, so they are stripped from every profile except
 * the viewer's own. The site role goes with them — advertising which accounts
 * hold authority just tells an attacker which ones are worth attacking.
 */
export function toDirectoryUser(user: UserRecord): DirectoryUser {
  // Age survives, the birth date does not: "24" is what a teammate needs to
  // see, while the exact day is an identity detail nobody on the site requires.
  const { email, accountRole, dateOfBirth, emailVerified, onboardingCompleted, ...rest } =
    toPublicUser(user);
  void email;
  void accountRole;
  void dateOfBirth;
  void emailVerified;
  void onboardingCompleted;
  return rest;
}

/** Row shape as it comes back from Postgres (snake_case columns). */
export interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  roles: string[];
  skills: string[];
  bio: string | null;
  avatar_url: string | null;
  verified: boolean;
  experience_level: string;
  availability: string[];
  hours_per_week: number | null;
  timezone_offset: number | null;
  personality: Personality | null;
  skill_levels: Record<string, number> | null;
  looking_for_team: boolean;
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  account_role: string;
  date_of_birth: string | null;
  pronouns: string | null;
  location_city: string | null;
  location_country: string | null;
  languages: string[];
  interest_domains: string[];
  goals: string[];
  hackathons_attended: number;
  preferred_team_size: number | null;
  discord_handle: string | null;
  email_verified: boolean;
  onboarding_completed: boolean;
  avatar_path: string | null;
  /** `pg` yields the number `Infinity` for a Postgres `'infinity'` timestamp. */
  banned_until: Date | string | number | null;
  banned_reason: string | null;
  banned_at: Date | null;
  banned_by: string | null;
  created_at: Date;
  availability_confirmed_at: Date | null;
  updated_at: Date;
}

export function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    firstName: row.first_name ?? row.full_name,
    lastName: row.last_name,
    roles: (row.roles ?? []) as TeamRole[],
    skills: row.skills ?? [],
    bio: row.bio,
    avatarUrl: row.avatar_url,
    verified: row.verified,
    experienceLevel: row.experience_level as ExperienceLevel,
    availability: (row.availability ?? []) as AvailabilitySlot[],
    hoursPerWeek: row.hours_per_week,
    timezoneOffset: row.timezone_offset,
    personality: row.personality ?? {},
    skillLevels: row.skill_levels ?? {},
    lookingForTeam: row.looking_for_team,
    githubUrl: row.github_url,
    linkedinUrl: row.linkedin_url,
    portfolioUrl: row.portfolio_url,
    accountRole: row.account_role as AccountRole,
    dateOfBirth: row.date_of_birth,
    pronouns: row.pronouns,
    locationCity: row.location_city,
    locationCountry: row.location_country,
    languages: (row.languages ?? []) as Language[],
    interestDomains: (row.interest_domains ?? []) as InterestDomain[],
    goals: (row.goals ?? []) as EventGoal[],
    hackathonsAttended: row.hackathons_attended,
    preferredTeamSize: row.preferred_team_size,
    discordHandle: row.discord_handle,
    emailVerified: row.email_verified,
    onboardingCompleted: row.onboarding_completed,
    avatarPath: row.avatar_path,
    bannedUntil: normaliseBannedUntil(row.banned_until),
    bannedReason: row.banned_reason,
    bannedAt: toIsoOrNull(row.banned_at),
    bannedBy: row.banned_by,
    availabilityConfirmedAt: row.availability_confirmed_at
      ? toIso(row.availability_confirmed_at)
      : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

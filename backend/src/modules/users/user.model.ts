import type { AccountRole } from './account-role.js';
import { toIso } from '../../utils/dates.js';

/** Primary roles a participant can pick when they join a team. */
export const PRIMARY_ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'Full-Stack Developer',
  'Mobile Developer',
  'AI / ML Engineer',
  'Data Scientist',
  'UI/UX Designer',
  'Product Manager',
  'DevOps Engineer',
  'Cybersecurity',
] as const;

export type PrimaryRole = (typeof PRIMARY_ROLES)[number];

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
] as const;
export type PersonalityTrait = (typeof PERSONALITY_TRAITS)[number];

export type Personality = Partial<Record<PersonalityTrait, number>>;

/** Internal shape kept in the store. Never serialised to a client as-is. */
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  primaryRole: PrimaryRole;
  skills: string[];
  bio: string | null;
  avatarUrl: string | null;
  verified: boolean;
  experienceLevel: ExperienceLevel;
  availability: AvailabilitySlot[];
  hoursPerWeek: number | null;
  timezoneOffset: number | null;
  personality: Personality;
  lookingForTeam: boolean;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  /**
   * Site role — authority on TapTim, not the profession in `primaryRole`.
   * Settable only by an admin through the console or by the `admin:grant`
   * script; never through profile editing.
   */
  accountRole: AccountRole;
  createdAt: string;
  updatedAt: string;
}

/** Projection returned to the account's own owner — includes the email. */
export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  primaryRole: PrimaryRole;
  skills: string[];
  bio: string | null;
  avatarUrl: string | null;
  verified: boolean;
  experienceLevel: ExperienceLevel;
  availability: AvailabilitySlot[];
  hoursPerWeek: number | null;
  timezoneOffset: number | null;
  personality: Personality;
  lookingForTeam: boolean;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  accountRole: AccountRole;
  createdAt: string;
}

/**
 * Projection returned when *other* people look at a profile. Drops the email
 * and the site role — who holds authority is not public information.
 */
export type DirectoryUser = Omit<PublicUser, 'email' | 'accountRole'>;

export function toPublicUser(user: UserRecord): PublicUser {
  const { passwordHash, updatedAt, ...pub } = user;
  void passwordHash;
  void updatedAt;
  return pub;
}

/**
 * Email addresses are private: they identify a person off-platform and nothing
 * in the matching UI needs one, so they are stripped from every profile except
 * the viewer's own. The site role goes with them — advertising which accounts
 * hold authority just tells an attacker which ones are worth attacking.
 */
export function toDirectoryUser(user: UserRecord): DirectoryUser {
  const { email, accountRole, ...rest } = toPublicUser(user);
  void email;
  void accountRole;
  return rest;
}

/** Row shape as it comes back from Postgres (snake_case columns). */
export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  primary_role: string;
  skills: string[];
  bio: string | null;
  avatar_url: string | null;
  verified: boolean;
  experience_level: string;
  availability: string[];
  hours_per_week: number | null;
  timezone_offset: number | null;
  personality: Personality | null;
  looking_for_team: boolean;
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  account_role: string;
  created_at: Date;
  updated_at: Date;
}

export function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    primaryRole: row.primary_role as PrimaryRole,
    skills: row.skills ?? [],
    bio: row.bio,
    avatarUrl: row.avatar_url,
    verified: row.verified,
    experienceLevel: row.experience_level as ExperienceLevel,
    availability: (row.availability ?? []) as AvailabilitySlot[],
    hoursPerWeek: row.hours_per_week,
    timezoneOffset: row.timezone_offset,
    personality: row.personality ?? {},
    lookingForTeam: row.looking_for_team,
    githubUrl: row.github_url,
    linkedinUrl: row.linkedin_url,
    portfolioUrl: row.portfolio_url,
    accountRole: row.account_role as AccountRole,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

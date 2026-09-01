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

export interface User {
  id: string;
  email: string;
  fullName: string;
  primaryRole: PrimaryRole;
  skills: string[];
  bio: string | null;
  avatarUrl: string | null;
  verified: boolean;
  /**
   * Site role — authority on TapTim, distinct from `primaryRole` (profession).
   * Only ever present on the signed-in user's own record; it is stripped from
   * every other profile the API returns.
   */
  accountRole: AccountRole;
  createdAt: string;
}

export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/** Site roles, ordered least to most authority. Mirrors the backend enum. */
export const ACCOUNT_ROLES = ['user', 'moderator', 'admin'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

const ROLE_RANK: Record<AccountRole, number> = { user: 0, moderator: 1, admin: 2 };

export function atLeastRole(role: AccountRole | undefined, minimum: AccountRole): boolean {
  return role !== undefined && ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** What each tier can do, shown in the console so it describes itself honestly. */
export const ROLE_SUMMARY: Record<AccountRole, string> = {
  user: 'Builds a profile, joins and runs teams.',
  moderator: 'Sees every account; can delete any team or organiser event.',
  admin: 'Everything a moderator can do, plus changing site roles.',
};

/**
 * One row in the admin console. Carries the email, which no public view does.
 *
 * Deliberately holds no profile data — profession, skills, and bio are the
 * participant's own description of themselves and belong on their profile, not
 * in a moderation tool.
 */
export interface AdminAccount {
  id: string;
  email: string;
  fullName: string;
  /** Authority on the site — the only thing the console can change. */
  accountRole: AccountRole;
  verified: boolean;
  lookingForTeam: boolean;
  verifiedCertificates: number;
  teamCount: number;
  createdAt: string;
}

export interface AdminSummary {
  accounts: number;
  verified: number;
  byRole: Record<AccountRole, number>;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface EventItem {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  startDate: string;
  endDate: string;
  location: string;
  mode: 'onsite' | 'online' | 'hybrid';
  teamSize: { min: number; max: number };
  prizePool: string | null;
  registrationDeadline: string;
  participants: number;
  featured: boolean;
}

export interface CategoryCount {
  name: string;
  count: number;
}

export interface SignupPayload {
  email: string;
  password: string;
  fullName: string;
  primaryRole: PrimaryRole;
  skills?: string[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface FieldIssue {
  field: string;
  message: string;
}

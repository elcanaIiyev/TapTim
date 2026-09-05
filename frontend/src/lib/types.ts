/**
 * Positions someone can take on a team, grouped the way the picker shows them.
 *
 * Mirrors `TEAM_ROLES` in the backend. Kept as a literal rather than fetched so
 * the picker renders before `/api/users/profile-options` resolves; the server
 * still validates, so a drift here is a rejected write, not bad data.
 */
export const ROLE_GROUPS = [
  {
    label: 'Build',
    roles: [
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
    ],
  },
  {
    label: 'Shape',
    roles: [
      'UI/UX Designer',
      'Graphic Artist',
      'Product Manager',
      'Business Analyst',
      'Researcher',
    ],
  },
  {
    label: 'Tell',
    roles: ['Presenter', 'Pitch Writer', 'Demo Builder', 'Documentation Lead'],
  },
] as const;

export const TEAM_ROLES = ROLE_GROUPS.flatMap((group) => group.roles);

export type TeamRole = (typeof ROLE_GROUPS)[number]['roles'][number];

/** Mirrors `MAX_TEAM_ROLES`; the server enforces it, this keeps the UI honest. */
export const MAX_TEAM_ROLES = 5;

/**
 * Proficiency bands over the 0–100 slider. Mirrors `SKILL_LEVELS` in the
 * backend: the number is what gets scored, the label is what gets read.
 */
export const SKILL_BANDS = [
  { min: 0, max: 19, label: 'Learning', blurb: 'Just started' },
  { min: 20, max: 39, label: 'Familiar', blurb: 'Can follow a tutorial' },
  { min: 40, max: 59, label: 'Comfortable', blurb: 'Can build with it' },
  { min: 60, max: 79, label: 'Strong', blurb: 'Could teach it' },
  { min: 80, max: 100, label: 'Expert', blurb: 'People ask me' },
] as const;

export const DEFAULT_SKILL_LEVEL = 50;

export function skillBand(level: number) {
  const clamped = Math.min(100, Math.max(0, level));
  return SKILL_BANDS.find((band) => clamped <= band.max) ?? SKILL_BANDS[SKILL_BANDS.length - 1];
}

/** "Strong" — shown next to the slider instead of a bare number. */
export function skillLabel(level: number): string {
  return skillBand(level).label;
}

/**
 * Roles as one line, for the places that have room for exactly one.
 *
 * Names the first and counts the rest rather than truncating mid-list: a card
 * reading "Backend Developer +2" is honest about there being more, where a
 * clipped "Backend Developer, Docum…" just looks broken.
 */
export function rolesSummary(roles: readonly string[]): string {
  if (roles.length === 0) return 'No role set';
  if (roles.length === 1) return roles[0];
  return `${roles[0]} +${roles.length - 1}`;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  firstName: string;
  lastName: string | null;
  /** Positions this person can play, 1–5 of them. Never empty. */
  roles: TeamRole[];
  skills: string[];
  bio: string | null;
  avatarUrl: string | null;
  verified: boolean;
  /**
   * Site role — authority on TapTim, unrelated to the team roles above. Only
   * ever present on the signed-in user's own record; it is stripped from every
   * other profile the API returns.
   */
  accountRole: AccountRole;

  // -- profile builder -------------------------------------------------------
  dateOfBirth: string | null;
  /** Derived server-side from `dateOfBirth`, so it never goes stale. */
  age: number | null;
  pronouns: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  languages: string[];
  interestDomains: string[];
  goals: string[];
  hackathonsAttended: number;
  preferredTeamSize: number | null;
  discordHandle: string | null;
  /** Skill -> 0..100. Keys are always a subset of `skills`. */
  skillLevels: Record<string, number>;
  /**
   * Whether this person appears in team suggestions and the directory.
   *
   * The API has always returned this on `/api/auth/me`; the type simply never
   * declared it, so anything reading it was a compile error for a field that
   * was right there on the wire.
   */
  lookingForTeam: boolean;

  // -- lifecycle -------------------------------------------------------------
  emailVerified: boolean;
  onboardingCompleted: boolean;
  /**
   * Where the server says this account should go. Read this rather than
   * deriving it from the two flags above — the rules behind it change (email
   * confirmation can be switched off entirely) and the server owns them.
   */
  next: NextStep;

  createdAt: string;
}

/** Where the server says this account should go next. */
export type NextStep = 'verify-email' | 'onboarding' | 'dashboard';

export interface ProviderConnection {
  provider: 'google' | 'linkedin';
  email: string | null;
  connectedAt: string;
}

/** `GET /api/auth/me` — the profile plus how this person can sign in. */
export interface MeResponse extends User {
  connections: ProviderConnection[];
  hasPassword: boolean;
  profileCompleteness?: number;
}

export interface ProviderStatus {
  provider: 'google' | 'linkedin';
  label: string;
  configured: boolean;
}

/** A proficiency band, as the API serves it. */
export interface SkillLevelOption {
  min: number;
  max: number;
  label: string;
  blurb: string;
}

export interface SkillCatalogue {
  /** The starter set shown before anyone searches. */
  popular: string[];
  categories: Array<{ name: string; skills: string[] }>;
  /** Everything, for local search — a few kB, so no search endpoint is needed. */
  all: string[];
  levels: SkillLevelOption[];
  /** Most skills someone may list. */
  max: number;
}

/** Every closed vocabulary the profile builder offers, served by the API. */
export interface ProfileOptions {
  teamRoles: string[];
  maxTeamRoles: number;
  experienceLevels: string[];
  availabilitySlots: string[];
  personalityTraits: string[];
  languages: string[];
  interestDomains: string[];
  goals: string[];
  pronouns: string[];
  experienceKinds: string[];
  skills: SkillCatalogue;
  avatarUploadEnabled: boolean;
}

export type ExperienceKind =
  | 'work'
  | 'internship'
  | 'project'
  | 'hackathon'
  | 'education'
  | 'volunteering';

export interface Experience {
  id: string;
  userId: string;
  kind: ExperienceKind;
  title: string;
  organisation: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
  url: string | null;
  skills: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExperiencePayload {
  kind: ExperienceKind;
  title: string;
  organisation?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
  description?: string | null;
  url?: string | null;
  skills?: string[];
}

/** Everything the profile builder can write. All optional; send what changed. */
export interface ProfilePayload {
  firstName?: string;
  lastName?: string | null;
  roles?: string[];
  skills?: string[];
  bio?: string | null;
  experienceLevel?: string;
  availability?: string[];
  hoursPerWeek?: number | null;
  timezoneOffset?: number | null;
  personality?: Record<string, number | undefined>;
  lookingForTeam?: boolean;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  dateOfBirth?: string | null;
  pronouns?: string | null;
  locationCity?: string | null;
  locationCountry?: string | null;
  languages?: string[];
  interestDomains?: string[];
  goals?: string[];
  hackathonsAttended?: number;
  preferredTeamSize?: number | null;
  discordHandle?: string | null;
  skillLevels?: Record<string, number>;
  onboardingCompleted?: boolean;
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

  // -- moderation ------------------------------------------------------------
  /** True only while a suspension is actually in force. */
  suspended: boolean;
  /** ISO timestamp, or the literal `'infinity'` for a permanent ban. */
  bannedUntil: string | null;
  bannedReason: string | null;
  permanentBan: boolean;
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
  next: NextStep;
}

export interface SignupResult extends AuthResult {
  verificationEmailSent: boolean;
  verificationEmailError: string | null;
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
  /** Cover image. Null falls back to a generated cover keyed on the category. */
  coverImageUrl: string | null;
}

export interface CategoryCount {
  name: string;
  count: number;
}

export interface SignupPayload {
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
  roles?: TeamRole[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface FieldIssue {
  field: string;
  message: string;
}


// -- per-event stats ----------------------------------------------------------

/** The five engine components, re-weighted per event. Sums to 100. */
export interface ComponentWeights {
  skills: number;
  roles: number;
  availability: number;
  workingStyle: number;
  credibility: number;
}

/** What one event rewards: which skill areas, which roles, which weights. */
export interface EventStatProfile {
  summary: string;
  weights: ComponentWeights;
  /** Skill-catalogue areas, most important first. */
  focusAreas: string[];
  keyRoles: string[];
}

export interface FocusCoverage {
  area: string;
  matched: string[];
  /** The strongest skill anyone has here, 0–100. */
  depth: number;
  /** Which skill that is, so the UI can say what carries the area. */
  deepest: string | null;
  score: number;
}

export type FitBand = 'excellent' | 'strong' | 'moderate' | 'weak';

export interface EventStats {
  eventId: string;
  profile: EventStatProfile;
  participantsOnTeams: number;
  teamCount: number;
  openTeams: number;
}

/** One person's stat sheet for one event. */
export interface MyEventFit {
  eventId: string;
  profile: EventStatProfile;
  score: number;
  band: FitBand;
  coverage: FocusCoverage[];
  gaps: string[];
  fillsKeyRole: boolean;
  summary: string;
  /** The team this person is already on for this event, if any. */
  myTeamId: string | null;
}

/** What a team is missing for the event it belongs to. */
/** One area a team wants somebody for, and how strong that somebody must be. */
export interface SkillNeed {
  area: string;
  /** What the team has here now, 0–100. */
  current: number;
  /** The proficiency a recruit should bring, 0–100. */
  target: number;
  examples: string[];
  priority: 'critical' | 'important' | 'nice to have';
}

/** Who a team should go and look for — a description, not a search result. */
export interface RecruitBrief {
  roles: string[];
  skills: SkillNeed[];
  emphasis: 'roles' | 'skills' | 'both' | 'none';
  headline: string;
  reasons: string[];
}

export interface TeamEventReport {
  teamId: string;
  teamName: string;
  eventId: string;
  eventName: string;
  profile: EventStatProfile;
  coverage: FocusCoverage[];
  missingAreas: string[];
  missingRoles: string[];
  readiness: number;
  summary: string;
  size: { current: number; max: number };
  brief: RecruitBrief;
}

export interface EventCandidate {
  user: DirectoryUser;
  /** The headline number, and what the list is ordered by. */
  score: number;
  teamFit: number;
  band: FitBand;
  eventFit: number;
  closesGaps: string[];
  fillsMissingRole: boolean;
  summary: string;
}

/** Another participant, as everyone but they themselves see them. */
export interface DirectoryUser {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string | null;
  roles: TeamRole[];
  skills: string[];
  skillLevels: Record<string, number>;
  bio: string | null;
  avatarUrl: string | null;
  verified: boolean;
  experienceLevel: string;
  availability: string[];
  age: number | null;
  pronouns: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  languages: string[];
  interestDomains: string[];
  goals: string[];
  hackathonsAttended: number;
  preferredTeamSize: number | null;
  discordHandle: string | null;
  lookingForTeam: boolean;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  createdAt: string;
  verifiedCertificates?: number;
  profileCompleteness?: number;
}

export interface TeamMember {
  userId: string;
  role: string;
  isOwner: boolean;
  joinedAt: string;
  user: DirectoryUser;
}

export interface Team {
  id: string;
  eventId: string;
  ownerId: string;
  name: string;
  description: string | null;
  lookingFor: string[];
  requiredSkills: string[];
  maxSize: number;
  status: 'recruiting' | 'full' | 'locked' | 'disbanded';
  /** Null falls back to a generated monogram. */
  logoUrl: string | null;
  memberCount: number;
  openSeats: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamDetail extends Team {
  members: TeamMember[];
}

export interface TeamRequest {
  id: string;
  teamId: string;
  userId: string;
  kind: 'invite' | 'application';
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  message: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}


// -- connections & chat -------------------------------------------------------

export type ConnectionState =
  | 'none'
  | 'pending-sent'
  | 'pending-received'
  | 'connected'
  | 'declined';

export interface ConnectionView {
  /** Null when the two have never interacted. */
  id: string | null;
  state: ConnectionState;
  person: DirectoryUser;
  unread: number;
  lastMessage: { body: string; sentByMe: boolean; at: string } | null;
  connectedAt: string | null;
}

export interface ConnectionsOverview {
  connected: ConnectionView[];
  incoming: ConnectionView[];
  outgoing: ConnectionView[];
  totalUnread: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface Conversation {
  partner: DirectoryUser;
  state: ConnectionState;
  /** False when the two are not connected — the composer is disabled. */
  canSend: boolean;
  messages: ChatMessage[];
}

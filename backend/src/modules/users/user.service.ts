import { certificateStore } from '../../data/certificate.store.js';
import { userStore } from '../../data/user.store.js';
import { HttpError } from '../../utils/http-error.js';
import {
  toDirectoryUser,
  toPublicUser,
  type DirectoryUser,
  type PublicUser,
  type UserRecord,
} from './user.model.js';
import type { ListUsersQuery, UpdateProfileInput } from './user.schema.js';

export interface UserProfileView extends DirectoryUser {
  verifiedCertificates: number;
  /** How complete the matching inputs are, 0–100. */
  profileCompleteness: number;
}

/**
 * Matching quality depends on how much of a profile is filled in, so the API
 * reports completeness rather than leaving the UI to guess which prompt to show.
 */
/**
 * Weighted rather than a flat count: the fields the matching engine actually
 * reads are worth more than the decorative ones. A profile with skills,
 * availability and working style filled in scores well even with no avatar,
 * because that profile genuinely matches well — and the number is shown to the
 * person as a completeness meter, so it has to reward the things that help them.
 */
const COMPLETENESS_WEIGHTS: ReadonlyArray<{
  weight: number;
  filled: (user: UserRecord) => boolean;
}> = [
  { weight: 3, filled: (u) => u.skills.length > 0 },
  // Rating them is separate from listing them, and now worth its own credit:
  // per-event coverage is computed from proficiency, so an unrated skill list
  // is scored at the default and tells a team nothing about depth.
  {
    weight: 2,
    filled: (u) => u.skills.length > 0 && u.skills.every((s) => u.skillLevels[s] !== undefined),
  },
  { weight: 3, filled: (u) => u.availability.length > 0 },
  { weight: 3, filled: (u) => Object.keys(u.personality).length > 0 },
  { weight: 2, filled: (u) => u.interestDomains.length > 0 },
  { weight: 2, filled: (u) => u.goals.length > 0 },
  { weight: 2, filled: (u) => u.bio !== null && u.bio.trim().length > 0 },
  { weight: 1, filled: (u) => u.languages.length > 0 },
  { weight: 1, filled: (u) => u.hoursPerWeek !== null },
  { weight: 1, filled: (u) => u.timezoneOffset !== null },
  { weight: 1, filled: (u) => u.dateOfBirth !== null },
  { weight: 1, filled: (u) => u.avatarUrl !== null },
  { weight: 1, filled: (u) => u.locationCity !== null || u.locationCountry !== null },
  {
    weight: 1,
    filled: (u) => u.githubUrl !== null || u.linkedinUrl !== null || u.portfolioUrl !== null,
  },
];

const COMPLETENESS_TOTAL = COMPLETENESS_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);

export function profileCompleteness(user: UserRecord): number {
  const earned = COMPLETENESS_WEIGHTS.reduce(
    (sum, entry) => sum + (entry.filled(user) ? entry.weight : 0),
    0,
  );
  return Math.round((earned / COMPLETENESS_TOTAL) * 100);
}

export async function getProfile(id: string): Promise<UserProfileView> {
  const user = await userStore.findById(id);
  if (!user) {
    throw HttpError.notFound(`No participant found with id "${id}".`);
  }

  return {
    ...toDirectoryUser(user),
    verifiedCertificates: await certificateStore.countVerified(id),
    profileCompleteness: profileCompleteness(user),
  };
}

export async function updateProfile(
  id: string,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  const updated = await userStore.update(id, input);
  if (!updated) {
    throw HttpError.notFound('The account for this token no longer exists.');
  }
  return toPublicUser(updated);
}

export interface ListUsersResult {
  items: UserProfileView[];
  total: number;
  limit: number;
  offset: number;
}

export async function listUsers(
  query: ListUsersQuery,
  viewerId?: string,
): Promise<ListUsersResult> {
  const { items, total } = await userStore.list({
    search: query.search,
    roles: query.roles,
    skills: query.skills,
    experienceLevel: query.experienceLevel,
    availability: query.availability,
    lookingForTeam: query.lookingForTeam,
    verified: query.verified,
    // The directory is for finding other people; the viewer is never a result.
    excludeUserIds: viewerId ? [viewerId] : undefined,
    limit: query.limit,
    offset: query.offset,
  });

  const certificateCounts = await certificateStore.verifiedCountsFor(
    items.map((user) => user.id),
  );

  return {
    items: items.map((user) => ({
      ...toDirectoryUser(user),
      verifiedCertificates: certificateCounts.get(user.id) ?? 0,
      profileCompleteness: profileCompleteness(user),
    })),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

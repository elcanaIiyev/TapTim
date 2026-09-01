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
export function profileCompleteness(user: UserRecord): number {
  const checks = [
    user.skills.length > 0,
    user.bio !== null && user.bio.trim().length > 0,
    user.availability.length > 0,
    user.hoursPerWeek !== null,
    user.timezoneOffset !== null,
    Object.keys(user.personality).length > 0,
    user.avatarUrl !== null,
    user.githubUrl !== null || user.linkedinUrl !== null || user.portfolioUrl !== null,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
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
    primaryRole: query.primaryRole,
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

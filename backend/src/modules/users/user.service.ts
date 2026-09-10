import { certificateStore } from '../../data/certificate.store.js';
import { eventStore } from '../../data/event.store.js';
import { experienceStore, type ExperienceRecord } from '../../data/experience.store.js';
import { teamStore } from '../../data/team.store.js';
import { userStore } from '../../data/user.store.js';
import { deleteImage } from '../../services/storage.js';
import { HttpError } from '../../utils/http-error.js';
import {
  toDirectoryUser,
  toPublicUser,
  type DirectoryUser,
  type PublicUser,
  type UserRecord,
} from './user.model.js';
import type { ListUsersQuery, UpdateProfileInput } from './user.schema.js';

/** A team someone is on, as their profile lists it. */
export interface ProfileTeam {
  id: string;
  name: string;
  logoUrl: string | null;
  eventId: string;
  eventName: string | null;
  isOwner: boolean;
  memberCount: number;
  maxSize: number;
}

/** A directory row: the person, plus the two numbers a list can afford to compute. */
export interface DirectoryEntry extends DirectoryUser {
  verifiedCertificates: number;
  /** How complete the matching inputs are, 0–100. */
  profileCompleteness: number;
}

/** One profile opened on its own: the row, plus what only a full page shows. */
export interface UserProfileView extends DirectoryEntry {
  /** Teams they are on now. Public, as the teams themselves already are. */
  teams: ProfileTeam[];
  /** What they have actually done — the evidence behind the skill numbers. */
  experiences: ExperienceRecord[];
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

  const [verifiedCertificates, experiences, { items: teams }] = await Promise.all([
    certificateStore.countVerified(id),
    experienceStore.listByUser(id),
    teamStore.list({ memberId: id, limit: 20, offset: 0 }),
  ]);

  // Teams name only their event's id; one read per distinct event, not per team.
  const eventIds = [...new Set(teams.map((team) => team.eventId))];
  const events = await Promise.all(eventIds.map((eventId) => eventStore.findById(eventId)));
  const eventName = new Map(events.flatMap((event) => (event ? [[event.id, event.name] as const] : [])));

  return {
    ...toDirectoryUser(user),
    verifiedCertificates,
    profileCompleteness: profileCompleteness(user),
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      logoUrl: team.logoUrl,
      eventId: team.eventId,
      eventName: eventName.get(team.eventId) ?? null,
      isOwner: team.ownerId === id,
      memberCount: team.memberCount,
      maxSize: team.maxSize,
    })),
    experiences,
  };
}

/**
 * Deleting your own account.
 *
 * Two refusals, both about other people. The last admin cannot leave, or the
 * console would have nobody left who can open it. And someone who owns a team
 * with other people on it has to hand it over first: the cascade would
 * otherwise delete that team out from under everyone else on it, which is not
 * a side effect anybody deleting *their own* account means to cause.
 */
export async function deleteOwnAccount(user: UserRecord, confirmEmail: string): Promise<void> {
  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw HttpError.badRequest('That email does not match this account. Nothing was deleted.', [
      { field: 'confirmEmail', message: `Type ${user.email} exactly to confirm.` },
    ]);
  }

  if (user.accountRole === 'admin' && (await userStore.countAdmins()) <= 1) {
    throw HttpError.conflict(
      'You are the only admin. Make someone else an admin first, or nobody will be able to open the console.',
    );
  }

  const { items: owned } = await teamStore.list({ ownerId: user.id, limit: 50, offset: 0 });
  const shared = owned.filter((team) => team.memberCount > 1);
  if (shared.length > 0) {
    const names = shared.map((team) => `"${team.name}"`).join(', ');
    throw HttpError.conflict(
      `Hand over ${names} to someone else on ${shared.length === 1 ? 'it' : 'them'} first — ` +
        `deleting your account would delete ${shared.length === 1 ? 'that team' : 'those teams'} ` +
        'for everyone on it.',
    );
  }

  // Solo teams go with the account; their logos are the part the cascade misses.
  const logoPaths = await Promise.all(owned.map((team) => teamStore.logoPathOf(team.id)));

  const removed = await userStore.deleteUser(user.id);
  if (!removed) throw HttpError.notFound('The account for this token no longer exists.');

  // Storage is outside the transaction. A failure here leaves an orphaned file,
  // never a half-deleted account.
  for (const path of [removed.avatarPath, ...logoPaths]) {
    if (path) void deleteImage(path);
  }
}

/**
 * Fields whose edit also means "and this is current as of now".
 *
 * Saving any of them is a stronger statement than pressing a confirm button, so
 * it stamps the same clock -- otherwise somebody who had just rewritten their
 * whole schedule would be asked, days later, whether it was still accurate.
 */
const AVAILABILITY_FIELDS = ['availability', 'hoursPerWeek', 'timezoneOffset'] as const;

export async function updateProfile(
  id: string,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  const touchesAvailability = AVAILABILITY_FIELDS.some(
    (field) => (input as Record<string, unknown>)[field] !== undefined,
  );

  const updated = await userStore.update(
    id,
    touchesAvailability
      ? { ...input, availabilityConfirmedAt: new Date().toISOString() }
      : input,
  );
  if (!updated) {
    throw HttpError.notFound('The account for this token no longer exists.');
  }
  return toPublicUser(updated);
}

/**
 * "Yes, that is still right."
 *
 * Its own endpoint rather than an empty profile PATCH, because confirming
 * without changing anything is a distinct act and the only one that can keep a
 * correct-but-old answer alive. Availability carries up to 28 of the 100 points
 * a hackathon is scored on; stale availability is worse than none, because the
 * engine trusts it.
 */
export async function confirmAvailability(id: string): Promise<PublicUser> {
  const updated = await userStore.update(id, {
    availabilityConfirmedAt: new Date().toISOString(),
  });
  if (!updated) {
    throw HttpError.notFound('The account for this token no longer exists.');
  }
  return toPublicUser(updated);
}

export interface ListUsersResult {
  items: DirectoryEntry[];
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

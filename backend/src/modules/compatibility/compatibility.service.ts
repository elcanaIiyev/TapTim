import { certificateStore } from '../../data/certificate.store.js';
import { teamStore } from '../../data/team.store.js';
import { userStore } from '../../data/user.store.js';
import { HttpError } from '../../utils/http-error.js';
import { toDirectoryUser, type DirectoryUser, type UserRecord } from '../users/user.model.js';
import { scorePair } from './compatibility.engine.js';
import type { CompatibilityResult } from './compatibility.model.js';
import type { CompatibilityInput, MatchesQuery } from './compatibility.schema.js';

export interface PairResult extends CompatibilityResult {
  participants: DirectoryUser[];
}

export async function comparePair(
  input: CompatibilityInput,
  viewer: UserRecord,
): Promise<PairResult> {
  // One id means "them and me"; two means an explicit pair.
  const ids = input.userIds.length === 1 ? [viewer.id, input.userIds[0]] : input.userIds;

  if (ids[0] === ids[1]) {
    throw HttpError.badRequest('Pick two different participants to compare.');
  }

  const users = await userStore.findManyByIds(ids);
  const byId = new Map(users.map((user) => [user.id, user]));

  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw HttpError.notFound(`No participant found with id "${missing[0]}".`);
  }

  const [a, b] = ids.map((id) => byId.get(id) as UserRecord);
  const certificateCounts = await certificateStore.verifiedCountsFor(ids);

  return {
    ...scorePair(a, b, certificateCounts),
    participants: [toDirectoryUser(a), toDirectoryUser(b)],
  };
}

export interface MatchResult extends CompatibilityResult {
  user: DirectoryUser;
}

/**
 * Ranked candidates for the signed-in participant. Scoring happens in the
 * application rather than in SQL, so the query fetches a bounded candidate pool
 * and the ordering is applied here.
 */
export async function findMatches(
  query: MatchesQuery,
  viewer: UserRecord,
): Promise<MatchResult[]> {
  const excludeUserIds = [viewer.id];

  if (query.eventId) {
    // Someone already on a team for this event cannot be matched into another,
    // so they are dropped before scoring rather than shown and then rejected.
    excludeUserIds.push(...(await teamStore.findEventMemberIds(query.eventId)));
  }

  const { items: candidates } = await userStore.list({
    primaryRole: query.primaryRole,
    lookingForTeam: true,
    excludeUserIds,
    limit: 50,
    offset: 0,
  });

  if (candidates.length === 0) return [];

  const certificateCounts = await certificateStore.verifiedCountsFor([
    viewer.id,
    ...candidates.map((candidate) => candidate.id),
  ]);

  return candidates
    .map((candidate) => ({
      user: toDirectoryUser(candidate),
      ...scorePair(viewer, candidate, certificateCounts),
    }))
    .filter((match) => match.score >= query.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, query.limit);
}

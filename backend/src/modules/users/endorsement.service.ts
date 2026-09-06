import { endorsementStore } from '../../data/endorsement.store.js';
import { userStore } from '../../data/user.store.js';
import { HttpError } from '../../utils/http-error.js';
import { notify } from '../notifications/notification.service.js';
import { canonicaliseSkill } from './skill-catalogue.js';

/**
 * Endorsing somebody's skill.
 *
 * The rule that makes an endorsement worth anything: you must have been on a
 * team with them. Without it this is a "like" button and the coverage engine
 * would be trusting popularity rather than evidence — which is worse than
 * trusting nothing, because it would look like evidence.
 */

export interface SkillEndorsement {
  skill: string;
  count: number;
  /**
   * How many of those carry the event they came from.
   *
   * Surfaced rather than folded silently into the weight because it is the
   * difference between "three people vouched for this" and "three people
   * vouched for this, and we can name where". A reader deciding whether to
   * trust the badge deserves to see which.
   */
  verified: number;
  /** Whether the person asking has endorsed this one. */
  byViewer: boolean;
}

/** Endorsement state for one profile, from one viewer's perspective. */
export async function forProfile(
  userId: string,
  viewerId: string | null,
): Promise<{ skills: SkillEndorsement[]; canEndorse: boolean }> {
  const user = await userStore.findById(userId);
  if (!user) throw HttpError.notFound(`No participant found with id "${userId}".`);

  const [tallies, mine, shared] = await Promise.all([
    endorsementStore.talliesFor(userId),
    viewerId ? endorsementStore.byEndorser(viewerId, userId) : Promise.resolve(new Set<string>()),
    viewerId && viewerId !== userId
      ? endorsementStore.lastSharedTeam(viewerId, userId)
      : Promise.resolve(null),
  ]);

  return {
    // Driven off the profile's own skill list rather than off the endorsement
    // rows, so a skill someone has since removed stops being shown even if
    // endorsements for it still exist.
    skills: user.skills.map((skill) => ({
      skill,
      count: tallies.get(skill)?.count ?? 0,
      verified: tallies.get(skill)?.verified ?? 0,
      byViewer: mine.has(skill),
    })),
    canEndorse: shared !== null,
  };
}

export async function endorse(
  userId: string,
  endorserId: string,
  rawSkill: string,
): Promise<SkillEndorsement> {
  if (userId === endorserId) {
    throw HttpError.badRequest('You cannot endorse your own skills.');
  }

  const user = await userStore.findById(userId);
  if (!user) throw HttpError.notFound(`No participant found with id "${userId}".`);

  const skill = canonicaliseSkill(rawSkill);
  if (!skill) throw HttpError.badRequest(`"${rawSkill}" is not in the skill list.`);

  // Only skills they actually claim. Endorsing something absent from the
  // profile would create a row nothing renders and nothing scores.
  if (!user.skills.includes(skill)) {
    throw HttpError.badRequest(`${user.firstName} does not list ${skill}.`);
  }

  const shared = await endorsementStore.lastSharedTeam(endorserId, userId);
  if (!shared) {
    throw HttpError.forbidden(
      'You can only endorse someone you have been on a team with — that is what makes an ' +
        'endorsement mean anything.',
    );
  }

  // The event is what dates the endorsement and what makes it auditable, so it
  // is recorded alongside the team rather than left to be re-derived later --
  // a disbanded team would take the context with it.
  const added = await endorsementStore.add(userId, endorserId, skill, {
    teamId: shared.teamId,
    eventId: shared.eventId,
  });

  // Only on a genuinely new one: a double-click should not send a second
  // notification for the same endorsement.
  if (added) {
    const endorser = await userStore.findById(endorserId);
    await notify({
      userId,
      actorId: endorserId,
      kind: 'skill-endorsed',
      title: `${endorser?.fullName ?? 'A teammate'} endorsed your ${skill}`,
      link: '/profile',
    });
  }

  const tallies = await endorsementStore.talliesFor(userId);
  const entry = tallies.get(skill);
  return { skill, count: entry?.count ?? 0, verified: entry?.verified ?? 0, byViewer: true };
}

export async function withdraw(
  userId: string,
  endorserId: string,
  rawSkill: string,
): Promise<SkillEndorsement> {
  const skill = canonicaliseSkill(rawSkill);
  if (!skill) throw HttpError.badRequest(`"${rawSkill}" is not in the skill list.`);

  const removed = await endorsementStore.remove(userId, endorserId, skill);
  if (!removed) throw HttpError.notFound('You have not endorsed that skill.');

  const tallies = await endorsementStore.talliesFor(userId);
  const entry = tallies.get(skill);
  return { skill, count: entry?.count ?? 0, verified: entry?.verified ?? 0, byViewer: false };
}

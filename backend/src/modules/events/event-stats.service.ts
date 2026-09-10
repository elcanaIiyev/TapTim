import { certificateStore } from '../../data/certificate.store.js';
import { endorsementStore } from '../../data/endorsement.store.js';
import { weightsOf } from '../users/endorsement-weight.js';
import { eventStore } from '../../data/event.store.js';
import { teamStore } from '../../data/team.store.js';
import { userStore } from '../../data/user.store.js';
import { HttpError } from '../../utils/http-error.js';
import {
  assessTeamRisks,
  slotCoverage,
  type SlotCoverage,
  type TeamRisk,
} from '../teams/team-risk.js';
import { scoreAgainstTeam, scorePair } from '../compatibility/compatibility.engine.js';
import type { CompatibilityResult } from '../compatibility/compatibility.model.js';
import {
  toDirectoryUser,
  type DirectoryUser,
  type TeamRole,
  type UserRecord,
} from '../users/user.model.js';
import {
  fitForEvent,
  recruitBriefFor,
  resolveStatProfile,
  teamGapsForEvent,
  type EventFit,
  type EventStatProfile,
  type RecruitBrief,
  type TeamEventGaps,
} from './event-stats.js';
import type { EventItem } from './event.model.js';

/**
 * Everything the event page needs about *fit*, as opposed to the event itself.
 *
 * Kept apart from `event.service` because that one is CRUD over a catalogue and
 * this one is matching logic that happens to be scoped to an event.
 */

async function requireEvent(eventId: string): Promise<EventItem> {
  const event = await eventStore.findById(eventId);
  if (!event) throw HttpError.notFound(`No event found with id "${eventId}".`);
  return event;
}

export function profileFor(event: EventItem): EventStatProfile {
  return resolveStatProfile(event.format, event.domains, event.statProfile);
}

export interface EventStatsView {
  eventId: string;
  profile: EventStatProfile;
  /** How many people are already on a team here, and how many teams exist. */
  participantsOnTeams: number;
  teamCount: number;
  openTeams: number;
}

export async function eventStats(eventId: string): Promise<EventStatsView> {
  const event = await requireEvent(eventId);

  const [taken, teams] = await Promise.all([
    teamStore.findEventMemberIds(eventId),
    teamStore.list({ eventId, limit: 50, offset: 0 }),
  ]);

  return {
    eventId,
    profile: profileFor(event),
    participantsOnTeams: taken.length,
    teamCount: teams.total,
    openTeams: teams.items.filter((team) => team.openSeats > 0 && team.status === 'recruiting')
      .length,
  };
}

export interface MyEventFit extends EventFit {
  eventId: string;
  profile: EventStatProfile;
  /** The team this person is already on here, if any. */
  myTeamId: string | null;
}

/** One person's stat sheet for one event — the per-event version of a profile. */
export async function fitForUser(eventId: string, user: UserRecord): Promise<MyEventFit> {
  const event = await requireEvent(eventId);
  const profile = profileFor(event);

  return {
    ...fitForEvent(user, profile, weightsOf(await endorsementStore.talliesFor(user.id))),
    eventId,
    profile,
    myTeamId: await teamStore.findEventMembership(user.id, eventId),
  };
}

export interface TeamEventReport extends TeamEventGaps {
  teamId: string;
  teamName: string;
  eventId: string;
  eventName: string;
  profile: EventStatProfile;
  /** How many people are on the roster now, and how many it can hold. */
  size: { current: number; max: number };
  /** Who the team should go and find. */
  brief: RecruitBrief;
  /**
   * What could go wrong here, beyond missing skills.
   *
   * Ships with the gap report because it is read at the same moment and needs
   * the same roster — asking for it separately would fetch every member twice
   * to answer two halves of one question.
   */
  risks: TeamRisk[];
  /** When the team can actually work together, per slot. */
  availability: SlotCoverage[];
}

/**
 * What a team is missing for the event it belongs to, and who to look for.
 *
 * The brief ships with the gaps rather than behind a second endpoint because
 * one is derived entirely from the other — splitting them would mean computing
 * the same coverage twice to answer one question.
 */
/** Each member's endorsements, as the weights the coverage engine reads. */
async function endorsementWeightsFor(
  members: readonly UserRecord[],
): Promise<Map<string, Map<string, number>>> {
  const tallies = await endorsementStore.talliesForMany(members.map((member) => member.id));
  return new Map([...tallies].map(([id, entry]) => [id, weightsOf(entry)]));
}

/**
 * Everything about a roster that depends only on who is on it and what the
 * event rewards.
 *
 * Shared by the real team report and the lab. A team that exists and a group
 * that is only being tried out are scored by the same engine for the same
 * event — which is the lab's whole claim to be worth reading.
 */
function analyseRoster(
  members: readonly UserRecord[],
  profile: EventStatProfile,
  weights: ReadonlyMap<string, ReadonlyMap<string, number>>,
  team: { maxSize: number; requiredSkills: readonly string[]; lookingFor: readonly string[] },
) {
  const gaps = teamGapsForEvent(members, profile, weights);
  return {
    ...gaps,
    profile,
    brief: recruitBriefFor(gaps, profile, team.lookingFor as TeamRole[]),
    risks: assessTeamRisks(members, { maxSize: team.maxSize, requiredSkills: team.requiredSkills }),
    availability: slotCoverage(members),
  };
}

export async function teamReport(teamId: string): Promise<TeamEventReport> {
  const team = await teamStore.findDetail(teamId);
  if (!team) throw HttpError.notFound(`No team found with id "${teamId}".`);

  const event = await requireEvent(team.eventId);
  const members = await userStore.findManyByIds(team.members.map((member) => member.userId));

  return {
    ...analyseRoster(members, profileFor(event), await endorsementWeightsFor(members), team),
    teamId,
    teamName: team.name,
    eventId: team.eventId,
    eventName: event.name,
    size: { current: team.members.length, max: team.maxSize },
  };
}

// -- the lab --------------------------------------------------------------------

export interface LabMember {
  user: DirectoryUser;
  /** Their own fit for the event, before anyone else is considered. */
  eventFit: number;
  /** A team they are already on for this event — which would stop them joining another. */
  existingTeam: { id: string; name: string } | null;
}

export interface LabPair {
  userIds: [string, string];
  score: number;
  band: CompatibilityResult['band'];
  summary: string;
}

export interface LabReport extends TeamEventGaps {
  eventId: string;
  eventName: string;
  profile: EventStatProfile;
  size: { current: number; max: number };
  members: LabMember[];
  /** Every pair on the roster, scored under this event's weights. */
  pairs: LabPair[];
  /** The mean of every pair: how well the group gets on, apart from what it can do. */
  cohesion: number;
  brief: RecruitBrief;
  risks: TeamRisk[];
  availability: SlotCoverage[];
}

/**
 * A roster that does not exist yet, scored as if it did.
 *
 * Every other surface answers a question about one person or one team that is
 * already formed. This answers the one people ask before either: "if these
 * specific people teamed up for this event, would it work — and where would it
 * break?" Nothing is written; nobody is asked anything.
 */
export async function labReport(eventId: string, userIds: readonly string[]): Promise<LabReport> {
  const event = await requireEvent(eventId);
  const profile = profileFor(event);

  const ids = [...new Set(userIds)];
  const found = await userStore.findManyByIds(ids);
  const byId = new Map(found.map((user) => [user.id, user]));
  const missing = ids.find((id) => !byId.has(id));
  if (missing) throw HttpError.notFound(`No participant found with id "${missing}".`);

  // Kept in the caller's order, so the matrix reads in the order people were added.
  const roster = ids.map((id) => byId.get(id) as UserRecord);
  const maxSize = Math.max(event.teamSize.max, roster.length);

  const [weights, certificateCounts, memberships] = await Promise.all([
    endorsementWeightsFor(roster),
    certificateStore.verifiedCountsFor(ids),
    Promise.all(roster.map((member) => teamStore.findEventMembership(member.id, eventId))),
  ]);

  const analysis = analyseRoster(roster, profile, weights, {
    maxSize,
    requiredSkills: [],
    lookingFor: [],
  });

  const pairs: LabPair[] = [];
  for (let i = 0; i < roster.length; i += 1) {
    for (let j = i + 1; j < roster.length; j += 1) {
      const result = scorePair(roster[i], roster[j], certificateCounts, profile.weights);
      pairs.push({
        userIds: [roster[i].id, roster[j].id],
        score: result.score,
        band: result.band,
        summary: result.summary,
      });
    }
  }

  const teamIds = [...new Set(memberships.filter((id): id is string => id !== null))];
  const teams = await Promise.all(teamIds.map((id) => teamStore.findById(id)));
  const teamName = new Map(teams.flatMap((team) => (team ? [[team.id, team.name] as const] : [])));

  return {
    ...analysis,
    eventId,
    eventName: event.name,
    size: { current: roster.length, max: maxSize },
    members: roster.map((member, index) => {
      const teamId = memberships[index];
      return {
        user: toDirectoryUser(member),
        eventFit: fitForEvent(member, profile, weights.get(member.id) ?? new Map()).score,
        existingTeam: teamId ? { id: teamId, name: teamName.get(teamId) ?? 'another team' } : null,
      };
    }),
    pairs,
    cohesion: pairs.length
      ? Math.round(pairs.reduce((sum, pair) => sum + pair.score, 0) / pairs.length)
      : 0,
  };
}

/** "covers Design" -> "Covers Design", so a summary reads as a sentence. */
function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface EventCandidate {
  user: DirectoryUser;
  /**
   * The headline number, and the one the list is ordered by.
   *
   * Returned rather than computed and discarded: it used to be stripped after
   * sorting, which left the UI showing `teamFit` beside a list ranked by this —
   * so the scores appeared out of order for a reason nobody could see.
   */
  score: number;
  /** Compatibility with the team, scored under this event's weights. */
  teamFit: number;
  band: 'excellent' | 'strong' | 'moderate' | 'weak';
  /** How well they cover what the event asks for, independent of the team. */
  eventFit: number;
  /** Which of the team's missing areas this person would close. */
  closesGaps: string[];
  fillsMissingRole: boolean;
  summary: string;
}

/**
 * Who should join this team, for this event.
 *
 * Two things are combined and kept separate in the result: how well someone
 * gels with the current members (the compatibility engine, run under the
 * event's weights) and how much of what the team is *missing* they would
 * actually close. Someone who gels beautifully and covers nothing the team
 * lacks is not the right answer, and neither is the reverse.
 */
export async function suggestForTeam(
  teamId: string,
  actorId: string,
  limit: number,
): Promise<EventCandidate[]> {
  const team = await teamStore.findDetail(teamId);
  if (!team) throw HttpError.notFound(`No team found with id "${teamId}".`);
  if (team.ownerId !== actorId) {
    throw HttpError.forbidden('Only the team owner can see suggestions.');
  }
  if (team.openSeats === 0) return [];

  const event = await requireEvent(team.eventId);
  const profile = profileFor(event);

  const members = await userStore.findManyByIds(team.members.map((member) => member.userId));
  const gaps = teamGapsForEvent(members, profile);

  // Anyone already on a team for this event is unavailable, so they are dropped
  // before scoring rather than shown and then refused.
  const taken = await teamStore.findEventMemberIds(team.eventId);
  const { items: candidates } = await userStore.list({
    lookingForTeam: true,
    excludeUserIds: taken.length > 0 ? taken : undefined,
    limit: 60,
    offset: 0,
  });
  if (candidates.length === 0) return [];

  const certificateCounts = await certificateStore.verifiedCountsFor([
    ...candidates.map((c) => c.id),
    ...members.map((m) => m.id),
  ]);

  return candidates
    .map((candidate) => {
      const teamFit = scoreAgainstTeam(
        candidate,
        members,
        { lookingFor: team.lookingFor, requiredSkills: team.requiredSkills },
        certificateCounts,
        profile.weights,
      );
      const personal = fitForEvent(candidate, profile);

      const closesGaps = gaps.missingAreas.filter((area) => {
        const cover = personal.coverage.find((entry) => entry.area === area);
        return (cover?.score ?? 0) >= 40;
      });
      const filledRoles = candidate.roles.filter((role) => gaps.missingRoles.includes(role));
      const fillsMissingRole = filledRoles.length > 0;

      // Closing a gap is the whole point of a suggestion, so it outweighs raw
      // rapport: someone who plugs two holes should rank above someone who
      // merely gets on well with everyone.
      const bonus = closesGaps.length * 9 + (fillsMissingRole ? 12 : 0);
      const combined = Math.min(100, Math.round(teamFit.score * 0.6 + personal.score * 0.4) + bonus);

      const reasons = [
        closesGaps.length ? `covers ${closesGaps.join(' and ')}` : null,
        fillsMissingRole ? `plays the missing ${filledRoles[0]} role` : null,
      ].filter((reason): reason is string => reason !== null);

      return {
        user: toDirectoryUser(candidate),
        teamFit: teamFit.score,
        band: teamFit.band,
        eventFit: personal.score,
        closesGaps,
        fillsMissingRole,
        // The score is shown beside this, so repeating it here would just be
        // the same number twice on one row.
        summary: reasons.length
          ? `${capitalise(reasons.join(', and '))}.`
          : 'A good fit with the current team.',
        score: combined,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

import { eventStore } from '../../data/event.store.js';
import { endorsementStore } from '../../data/endorsement.store.js';
import { teamStore } from '../../data/team.store.js';
import { userStore } from '../../data/user.store.js';
import { HttpError } from '../../utils/http-error.js';
import { coverageFor, resolveStatProfile } from '../events/event-stats.js';
import type { TeamRole } from '../users/user.model.js';

/**
 * A team's public recruiting page.
 *
 * Not a shareable copy of the team page. The internal view answers "how are we
 * doing"; this answers "why should you join us", and those want different
 * things on screen. What a team has built and what it is short of is a far
 * better pitch than "join our team" — and every part of it is already computed.
 *
 * Two deliberate limits:
 *
 * - **It exists only while the team is recruiting.** A team that is full or
 *   locked returns 404 rather than publishing its gaps to anyone with the link.
 *   The page is for recruiting, so it lives exactly as long as the recruiting
 *   does.
 * - **It carries no internal assessment.** The risk panel, the readiness score
 *   and the confidence caveats are for the team, not for the person deciding
 *   whether to apply. Publishing "this team may fail because nobody wants to
 *   lead" would be a strange way to recruit and is not the team's to broadcast
 *   about its members.
 */

export interface PublicTeamMember {
  fullName: string;
  firstName: string;
  avatarUrl: string | null;
  roles: TeamRole[];
  /** Their strongest few, so a reader can see what the team already covers. */
  topSkills: Array<{ name: string; endorsements: number }>;
  verified: boolean;
}

export interface PublicTeamPage {
  teamId: string;
  name: string;
  description: string | null;
  logoUrl: string | null;

  event: {
    id: string;
    name: string;
    format: string;
    domains: string[];
    startDate: string;
    location: string;
    mode: string;
  };

  members: PublicTeamMember[];
  openSeats: number;
  maxSize: number;

  /** What they already cover, strongest first — the "here's what we've built". */
  strengths: Array<{ area: string; score: number; skills: string[] }>;
  /** Roles nobody plays, and areas nobody covers — the honest ask. */
  lookingFor: TeamRole[];
  needs: string[];
  /** One line, written to be read by somebody who has never heard of the team. */
  pitch: string;
}

/** How many skills to show per member. Enough to be concrete, few enough to scan. */
const SKILLS_SHOWN = 4;

export async function publicPage(teamId: string): Promise<PublicTeamPage> {
  const team = await teamStore.findDetail(teamId);
  if (!team) throw HttpError.notFound('No such team.');

  const openSeats = Math.max(0, team.maxSize - team.members.length);
  if (team.status !== 'recruiting' || openSeats === 0) {
    // Deliberately a 404 and not a 403: a team that is not recruiting should not
    // confirm that its page ever existed.
    throw HttpError.notFound('This team is not recruiting.');
  }

  const event = await eventStore.findById(team.eventId);
  if (!event) throw HttpError.notFound('The event for this team no longer exists.');

  const members = await userStore.findManyByIds(team.members.map((member) => member.userId));
  const profile = resolveStatProfile(event.format, event.domains, event.statProfile);
  const endorsements = await endorsementStore.countsForMany(members.map((member) => member.id));

  // Team coverage: each area as well as the best person on it covers it.
  const perMember = members.map((member) =>
    coverageFor(member, profile.focusAreas, endorsements.get(member.id) ?? new Map()),
  );

  const coverage = profile.focusAreas.map((area, index) => {
    const contributions = perMember.map((entry) => entry[index]);
    const best = contributions.reduce(
      (top, entry) => (entry.score > top.score ? entry : top),
      contributions[0],
    );
    return {
      area,
      score: best?.score ?? 0,
      skills: [...new Set(contributions.flatMap((entry) => entry.matched))].slice(0, 5),
    };
  });

  const strengths = coverage
    .filter((entry) => entry.score >= 40)
    .sort((a, b) => b.score - a.score);

  const needs = coverage.filter((entry) => entry.score < 25).map((entry) => entry.area);

  const held = new Set(members.flatMap((member) => member.roles));
  const missingKeyRoles = profile.keyRoles.filter((role) => !held.has(role));

  // What the team advertised comes first — the owner knows something the
  // archetype does not — then anything the event needs that nobody plays.
  const lookingFor = [...new Set([...(team.lookingFor as TeamRole[]), ...missingKeyRoles])].slice(0, 4);

  const publicMembers: PublicTeamMember[] = members.map((member) => {
    const counts = endorsements.get(member.id) ?? new Map<string, number>();
    return {
      fullName: member.fullName,
      firstName: member.firstName,
      avatarUrl: member.avatarUrl,
      roles: member.roles,
      // Ordered by endorsements first, then self-rating: what somebody *else*
      // vouched for is the more useful thing to lead with on a public page.
      topSkills: [...member.skills]
        .sort((a, b) => {
          const byEndorsement = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
          if (byEndorsement !== 0) return byEndorsement;
          return (member.skillLevels[b] ?? 0) - (member.skillLevels[a] ?? 0);
        })
        .slice(0, SKILLS_SHOWN)
        .map((name) => ({ name, endorsements: counts.get(name) ?? 0 })),
      verified: member.verified,
    };
  });

  const size = members.length;
  const covered = strengths.slice(0, 2).map((entry) => entry.area);

  const pitch = [
    `${size} ${size === 1 ? 'person' : 'people'} building at ${event.name}`,
    covered.length > 0 ? `strong on ${covered.join(' and ')}` : null,
    lookingFor.length > 0
      ? `looking for ${lookingFor.slice(0, 2).join(' or ')}`
      : `with ${openSeats} ${openSeats === 1 ? 'seat' : 'seats'} open`,
  ]
    .filter(Boolean)
    .join(', ') + '.';

  return {
    teamId,
    name: team.name,
    description: team.description,
    logoUrl: team.logoUrl,
    event: {
      id: event.id,
      name: event.name,
      format: event.format,
      domains: event.domains,
      startDate: event.startDate,
      location: event.location,
      mode: event.mode,
    },
    members: publicMembers,
    openSeats,
    maxSize: team.maxSize,
    strengths,
    lookingFor,
    needs,
    pitch,
  };
}

import {
  PERSONALITY_TRAITS,
  type Personality,
  type TeamRole,
  type UserRecord,
} from '../users/user.model.js';
import {
  axesOf,
  bandFor,
  type CompatibilityResult,
  type ScoreComponent,
} from './compatibility.model.js';

/**
 * The scoring engine. It is deliberately pure and synchronous: everything it
 * needs arrives as arguments, so a score can be recomputed in a test without a
 * database and the same function serves pair matching, ranked suggestions, and
 * team fit.
 *
 * Each component returns 0–1 and is combined by the weights below. Unknown
 * inputs score a neutral 0.5 rather than 0 — an unfilled profile should read as
 * "we don't know yet", not as a bad match.
 */

/**
 * The platform default. An event can override these — a game jam should barely
 * weight verified security credentials, a CTF should weight them heavily — by
 * passing its own set to `scorePair`.
 */
const WEIGHTS: ComponentWeights = {
  skills: 25,
  roles: 25,
  availability: 20,
  workingStyle: 20,
  credibility: 10,
};

/** The five weights, as a shape callers can supply. Should sum to 100. */
export interface ComponentWeights {
  skills: number;
  roles: number;
  availability: number;
  workingStyle: number;
  credibility: number;
}

const NEUTRAL = 0.5;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normaliseSkill(skill: string): string {
  return skill.trim().toLowerCase();
}

function pct(value: number): number {
  return Math.round(clamp01(value) * 100);
}

/**
 * The single highest or lowest entry by `of`, in one pass.
 *
 * Sorting a copy just to read `[0]` is the obvious way to write this and does
 * O(n log n) work plus an allocation to answer an O(n) question. Ties keep the
 * earliest entry, which matches what a stable sort would have returned, so the
 * summaries this feeds are unchanged.
 */
function pickExtreme<T>(items: readonly T[], of: (item: T) => number, want: 'max' | 'min'): T {
  let best = items[0];
  let bestValue = of(best);

  for (let index = 1; index < items.length; index += 1) {
    const value = of(items[index]);
    if (want === 'max' ? value > bestValue : value < bestValue) {
      best = items[index];
      bestValue = value;
    }
  }

  return best;
}

// -- skills -------------------------------------------------------------------

interface SkillOutcome {
  score: number;
  shared: string[];
  complementary: string[];
  explanation: string;
}

function scoreSkills(a: UserRecord, b: UserRecord): SkillOutcome {
  const setA = new Map(a.skills.map((skill) => [normaliseSkill(skill), skill]));
  const setB = new Map(b.skills.map((skill) => [normaliseSkill(skill), skill]));

  if (setA.size === 0 && setB.size === 0) {
    return {
      score: NEUTRAL,
      shared: [],
      complementary: [],
      explanation: 'Neither profile lists skills yet, so this is scored as unknown.',
    };
  }

  const shared: string[] = [];
  for (const [key, label] of setA) {
    if (setB.has(key)) shared.push(label);
  }

  const complementary: string[] = [];
  for (const [key, label] of setA) if (!setB.has(key)) complementary.push(label);
  for (const [key, label] of setB) if (!setA.has(key)) complementary.push(label);

  const unionSize = shared.length + complementary.length;

  // Combined coverage, saturating: six distinct skills between two people is a
  // reasonable working team, twelve is comfortably broad.
  const breadth = unionSize / (unionSize + 6);

  // Some shared vocabulary helps two people communicate; too much means they
  // duplicate each other. Around 30% overlap is the target.
  const jaccard = unionSize === 0 ? 0 : shared.length / unionSize;
  const overlapFit = 1 - Math.min(1, Math.abs(jaccard - 0.3) / 0.7);

  const score = 0.55 * breadth + 0.45 * overlapFit;

  const explanation =
    shared.length > 0
      ? `${shared.length} shared skill${shared.length === 1 ? '' : 's'} and ${complementary.length} that only one of you brings.`
      : `No overlapping skills — ${complementary.length} distinct skills between you, which is broad but leaves less common ground.`;

  return { score, shared, complementary, explanation };
}

// -- roles --------------------------------------------------------------------

function listRoles(roles: readonly TeamRole[]): string {
  if (roles.length === 0) return 'no role';
  if (roles.length === 1) return roles[0];
  return `${roles.slice(0, -1).join(', ')} and ${roles[roles.length - 1]}`;
}

/**
 * How well two people's roles complement each other.
 *
 * Compared as axis *sets*, not as two labels. Once someone can claim several
 * roles, "are these the same role?" stops being answerable — a Backend
 * Developer who also presents and a Presenter who also writes backend overlap
 * partly, and the axes are what express that.
 *
 * Nothing here rewards claiming more roles for its own sake. The score is the
 * share of the combined axes that only one of the two covers, so adding a role
 * the other person already has moves it *down*, not up. That is the property
 * that keeps a five-role profile from beating an honest one.
 */
function scoreRoles(
  rolesA: readonly TeamRole[],
  rolesB: readonly TeamRole[],
): { score: number; explanation: string } {
  const axesA = axesOf(rolesA);
  const axesB = axesOf(rolesB);

  if (axesA.size === 0 && axesB.size === 0) {
    return { score: NEUTRAL, explanation: 'Neither profile lists a role yet.' };
  }

  const union = new Set([...axesA, ...axesB]);
  const intersection = [...axesA].filter((axis) => axesB.has(axis));

  const complement = union.size === 0 ? 0 : (union.size - intersection.length) / union.size;

  // Two people covering the same ground are not a bad team, just a narrower
  // one, so the component floors at 0.25 rather than bottoming out.
  const overlapScore = 0.25 + 0.75 * complement;

  // Breadth counts a little on its own: a pair covering seven axes between them
  // has more of the event handled than a pair covering two, even if neither
  // pair overlaps at all. Capped low so it cannot carry the component.
  const breadth = Math.min(1, union.size / 6);
  const score = 0.85 * overlapScore + 0.15 * breadth;

  const shared = intersection.length
    ? ` with ${intersection.join(', ')} in common`
    : ' with no overlap';

  const explanation =
    complement === 0
      ? `You both cover exactly ${listRoles(rolesA)} ground — strong depth, but the same ground.`
      : `${listRoles(rolesA)} and ${listRoles(rolesB)} cover ${union.size} area${
          union.size === 1 ? '' : 's'
        } between you${shared}.`;

  return { score, explanation };
}

// -- availability -------------------------------------------------------------

interface AvailabilityOutcome {
  score: number;
  shared: string[];
  explanation: string;
}

function scoreAvailability(a: UserRecord, b: UserRecord): AvailabilityOutcome {
  const setA = new Set(a.availability);
  const setB = new Set(b.availability);
  const shared = [...setA].filter((slot) => setB.has(slot));

  // Coverage of the *smaller* schedule: someone free two evenings a week who
  // shares both of them is fully available to their partner.
  const slotFit =
    setA.size === 0 || setB.size === 0 ? NEUTRAL : shared.length / Math.min(setA.size, setB.size);

  const hoursFit =
    a.hoursPerWeek === null || b.hoursPerWeek === null
      ? NEUTRAL
      : clamp01(1 - Math.abs(a.hoursPerWeek - b.hoursPerWeek) / 40);

  const timezoneFit =
    a.timezoneOffset === null || b.timezoneOffset === null
      ? NEUTRAL
      : clamp01(1 - Math.abs(a.timezoneOffset - b.timezoneOffset) / 12);

  const score = 0.5 * slotFit + 0.25 * hoursFit + 0.25 * timezoneFit;

  const explanation =
    setA.size === 0 || setB.size === 0
      ? 'One of you has not set an availability schedule yet.'
      : shared.length > 0
        ? `${shared.length} overlapping time slot${shared.length === 1 ? '' : 's'}.`
        : 'No overlapping time slots — you would be working at different hours.';

  return { score, shared, explanation };
}

// -- working style ------------------------------------------------------------

function traitFit(trait: string, a: number | undefined, b: number | undefined): number {
  if (a === undefined || b === undefined) return NEUTRAL;

  const difference = Math.abs(a - b) / 4;

  switch (trait) {
    // One person leaning into the lead is better than two who both want it or
    // neither of whom does, so difference is rewarded — but only if at least
    // one of them is actually willing.
    case 'leadership':
      return clamp01(0.5 * difference + 0.5 * ((Math.max(a, b) - 1) / 4));

    // Communication is not complementary: a team is limited by whoever syncs
    // least, so the lower of the two scores drives the fit.
    case 'communication':
      return clamp01((Math.min(a, b) - 1) / 4);

    // Structure, pace and appetite for risk are friction points — the closer
    // two people sit, the less they argue about how to work.
    default:
      return clamp01(1 - difference);
  }
}

function scoreWorkingStyle(
  a: Personality,
  b: Personality,
): { score: number; explanation: string } {
  const fits = PERSONALITY_TRAITS.map((trait) => ({
    trait,
    fit: traitFit(trait, a[trait], b[trait]),
  }));

  const known = fits.filter(({ trait }) => a[trait] !== undefined && b[trait] !== undefined);
  const score = fits.reduce((total, entry) => total + entry.fit, 0) / fits.length;

  if (known.length === 0) {
    return {
      score: NEUTRAL,
      explanation: 'Neither profile has answered the working-style questions yet.',
    };
  }

  const best = pickExtreme(known, (entry) => entry.fit, 'max');
  const worst = pickExtreme(known, (entry) => entry.fit, 'min');

  const explanation =
    best.trait === worst.trait
      ? `Scored on ${known.length} working-style trait${known.length === 1 ? '' : 's'}.`
      : `Strongest on ${best.trait}, weakest on ${worst.trait}.`;

  return { score, explanation };
}

// -- credibility --------------------------------------------------------------

function credibilityFor(user: UserRecord, verifiedCertificates: number): number {
  const badge = user.verified ? 1 : 0;
  const certificates = Math.min(1, verifiedCertificates / 3);
  return 0.4 * badge + 0.6 * certificates;
}

function scoreCredibility(
  a: UserRecord,
  b: UserRecord,
  certificateCounts: Map<string, number>,
): { score: number; explanation: string } {
  const certsA = certificateCounts.get(a.id) ?? 0;
  const certsB = certificateCounts.get(b.id) ?? 0;

  const score = (credibilityFor(a, certsA) + credibilityFor(b, certsB)) / 2;

  const verifiedCount = [a.verified, b.verified].filter(Boolean).length;
  const explanation = `${verifiedCount} of 2 profiles verified, ${certsA + certsB} verified certificate${
    certsA + certsB === 1 ? '' : 's'
  } between you.`;

  return { score, explanation };
}

// -- public API ---------------------------------------------------------------

export function scorePair(
  a: UserRecord,
  b: UserRecord,
  certificateCounts: Map<string, number> = new Map(),
  /**
   * Per-event weights. Omitted means the platform default — the same score the
   * engine has always produced, so nothing changes for callers that do not
   * care which event they are scoring for.
   */
  weights: ComponentWeights = WEIGHTS,
): CompatibilityResult {
  const skills = scoreSkills(a, b);
  const roles = scoreRoles(a.roles, b.roles);
  const availability = scoreAvailability(a, b);
  const workingStyle = scoreWorkingStyle(a.personality, b.personality);
  const credibility = scoreCredibility(a, b, certificateCounts);

  // One row per component, in the order the UI shows them. Previously this was
  // five near-identical object literals; driving it from the outcomes means a
  // new component is one entry here plus one weight, and the label and weight
  // for a component can no longer drift apart across edits.
  const components: ScoreComponent[] = (
    [
      ['skills', 'Skill complementarity', skills],
      ['roles', 'Role synergy', roles],
      ['availability', 'Availability overlap', availability],
      ['workingStyle', 'Working style', workingStyle],
      ['credibility', 'Verified credentials', credibility],
    ] as const
  ).map(([key, label, outcome]) => ({
    key,
    label,
    score: pct(outcome.score),
    weight: weights[key],
    explanation: outcome.explanation,
  }));

  const totalWeight = components.reduce((total, component) => total + component.weight, 0);
  const weighted = components.reduce(
    (total, component) => total + component.score * component.weight,
    0,
  );
  const score = Math.round(weighted / totalWeight);
  const band = bandFor(score);

  const strongest = pickExtreme(components, (component) => component.score, 'max');
  const weakest = pickExtreme(components, (component) => component.score, 'min');

  return {
    score,
    band,
    summary: `${score}/100 — a ${band} match. Strongest on ${strongest.label.toLowerCase()}, weakest on ${weakest.label.toLowerCase()}.`,
    components,
    sharedSkills: skills.shared,
    complementarySkills: skills.complementary,
    sharedAvailability: availability.shared,
  };
}

/** How a candidate scores against one team's current roster and stated gaps. */
export interface TeamFitResult {
  /** 0–100, pair fit plus the bonus for filling a stated gap. */
  score: number;
  band: CompatibilityResult['band'];
  /** Mean compatibility with the current members, before any bonus. */
  averagePairScore: number;
  fillsNeededRole: boolean;
  matchedRequiredSkills: string[];
  summary: string;
}

/**
 * How well a candidate fits an existing team: the average of their pair scores
 * against each member, adjusted by whether they fill a role or skill the team
 * says it is missing.
 */
export function scoreAgainstTeam(
  candidate: UserRecord,
  members: readonly UserRecord[],
  team: { lookingFor: readonly string[]; requiredSkills: readonly string[] },
  certificateCounts: Map<string, number> = new Map(),
  /** The event's weights, so a suggestion is scored for the event it is for. */
  weights: ComponentWeights = WEIGHTS,
): TeamFitResult {
  const pairScores = members.map(
    (member) => scorePair(candidate, member, certificateCounts, weights).score,
  );
  const averagePairScore =
    pairScores.length === 0
      ? 50
      : Math.round(pairScores.reduce((total, value) => total + value, 0) / pairScores.length);

  // Any one of the candidate's roles filling an open seat counts. Only the
  // first match is credited — someone who claims three of the seats a team is
  // short does not get the bonus three times.
  const filledRoles = candidate.roles.filter((role) => team.lookingFor.includes(role));
  const fillsNeededRole = filledRoles.length > 0;

  const candidateSkills = new Set(candidate.skills.map(normaliseSkill));
  const matchedRequiredSkills = team.requiredSkills.filter((skill) =>
    candidateSkills.has(normaliseSkill(skill)),
  );
  const skillCoverage =
    team.requiredSkills.length === 0
      ? 0
      : matchedRequiredSkills.length / team.requiredSkills.length;

  // The team's stated gap is worth up to 20 points on top of raw pair fit:
  // someone who gels well *and* plays the missing position should outrank
  // someone who only gels well.
  const bonus = (fillsNeededRole ? 12 : 0) + Math.round(skillCoverage * 8);
  const score = Math.min(100, averagePairScore + bonus);

  const reasons = [
    fillsNeededRole ? `fills the open ${filledRoles[0]} seat` : null,
    matchedRequiredSkills.length > 0
      ? `covers ${matchedRequiredSkills.join(', ')}`
      : null,
  ].filter((reason): reason is string => reason !== null);

  return {
    score,
    band: bandFor(score),
    averagePairScore,
    fillsNeededRole,
    matchedRequiredSkills,
    summary: reasons.length
      ? `${score}/100 — ${reasons.join(' and ')}.`
      : `${score}/100 based on fit with the ${members.length} current member${members.length === 1 ? '' : 's'}.`,
  };
}

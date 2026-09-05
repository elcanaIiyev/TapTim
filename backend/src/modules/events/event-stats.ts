import { DEFAULT_SKILL_LEVEL, SKILL_CATEGORIES } from '../users/skill-catalogue.js';
import type { TeamRole } from '../users/user.model.js';
import { EVENT_CATEGORIES, type EventCategory } from './event.model.js';

/**
 * What a given event actually cares about.
 *
 * The compatibility engine scores two people in the abstract, which is the
 * right default and the wrong answer for a specific event: cybersecurity depth
 * is decisive at a CTF and almost irrelevant at a game jam, and a 48-hour
 * hackathon lives or dies on overlapping hours in a way a month-long build
 * does not. So each event carries a profile saying which skill areas matter,
 * which roles it needs, and how to re-weight the five scoring components.
 *
 * Profiles are derived from the event's category by default and can be
 * overridden per event (`events.stat_profile`), so an organiser can say "this
 * one is unusual" without a schema change.
 */

/** The five engine components, as weights that sum to 100. */
export interface ComponentWeights {
  skills: number;
  roles: number;
  availability: number;
  workingStyle: number;
  credibility: number;
}

export interface EventStatProfile {
  /** One-line explanation of what this event rewards, shown on its page. */
  summary: string;
  weights: ComponentWeights;
  /** Skill-catalogue category names this event draws on, most important first. */
  focusAreas: string[];
  /** Roles a team here usually needs covered. */
  keyRoles: TeamRole[];
}

/** The engine's own defaults, used where an event says nothing special. */
export const DEFAULT_WEIGHTS: ComponentWeights = {
  skills: 25,
  roles: 25,
  availability: 20,
  workingStyle: 20,
  credibility: 10,
};

/**
 * One archetype per event category.
 *
 * The weights are deliberately not all-different: most events want a broadly
 * balanced team, and pretending otherwise would produce confident-looking
 * numbers with nothing behind them. Only where a category genuinely changes
 * what matters does its profile diverge.
 */
const ARCHETYPES: Record<EventCategory, EventStatProfile> = {
  Hackathons: {
    summary:
      'A short, broad build. Overlapping hours and a team that covers every layer matter more than any single deep specialism.',
    weights: { skills: 22, roles: 28, availability: 28, workingStyle: 17, credibility: 5 },
    focusAreas: ['Frontend', 'Backend', 'Design', 'Product & craft'],
    keyRoles: ['Full-Stack Developer', 'Frontend Developer', 'Backend Developer', 'UI/UX Designer'],
  },
  AI: {
    summary:
      'Depth beats breadth. Someone who has actually trained and evaluated a model is worth more here than a fourth generalist.',
    weights: { skills: 38, roles: 22, availability: 15, workingStyle: 15, credibility: 10 },
    focusAreas: ['AI', 'Data & ML', 'Languages', 'Backend'],
    keyRoles: ['AI / ML Engineer', 'Data Scientist', 'Backend Developer'],
  },
  Programming: {
    summary: 'Raw implementation. Language and framework depth carry the most weight.',
    weights: { skills: 36, roles: 20, availability: 20, workingStyle: 18, credibility: 6 },
    focusAreas: ['Languages', 'Backend', 'Frontend', 'Databases'],
    keyRoles: ['Backend Developer', 'Frontend Developer', 'Full-Stack Developer'],
  },
  Design: {
    summary:
      'Craft and taste lead. A designer who can hand off cleanly to one engineer beats three engineers with no designer.',
    weights: { skills: 30, roles: 30, availability: 18, workingStyle: 18, credibility: 4 },
    focusAreas: ['Design', 'Frontend', 'Product & craft'],
    keyRoles: ['UI/UX Designer', 'Frontend Developer', 'Product Manager'],
  },
  Gaming: {
    summary:
      'Engine skill and art carry it. Security and data depth are close to irrelevant here — do not weight them.',
    weights: { skills: 34, roles: 26, availability: 22, workingStyle: 15, credibility: 3 },
    focusAreas: ['Game development', 'Design', 'Languages', 'Hardware & IoT'],
    keyRoles: ['Mobile Developer', 'Frontend Developer', 'UI/UX Designer', 'Full-Stack Developer'],
  },
  Web3: {
    summary: 'Contract work plus the interface on top of it. Security awareness counts.',
    weights: { skills: 34, roles: 24, availability: 18, workingStyle: 14, credibility: 10 },
    focusAreas: ['Web3', 'Backend', 'Security', 'Frontend'],
    keyRoles: ['Backend Developer', 'Full-Stack Developer', 'Cybersecurity'],
  },
  Cybersecurity: {
    summary:
      'Proven depth matters most, and verified credentials genuinely mean something in this field.',
    weights: { skills: 36, roles: 20, availability: 14, workingStyle: 12, credibility: 18 },
    focusAreas: ['Security', 'Languages', 'DevOps & Cloud', 'Backend'],
    keyRoles: ['Cybersecurity', 'DevOps Engineer', 'Backend Developer'],
  },
  Startup: {
    summary:
      'Half the work is not code. Someone who can shape the idea and pitch it is a real position on the team.',
    weights: { skills: 20, roles: 30, availability: 20, workingStyle: 24, credibility: 6 },
    focusAreas: ['Product & craft', 'Design', 'Frontend', 'Backend'],
    keyRoles: ['Product Manager', 'Full-Stack Developer', 'UI/UX Designer'],
  },
  'Data Science': {
    summary: 'Analysis and the ability to make the result legible to a judge.',
    weights: { skills: 36, roles: 22, availability: 16, workingStyle: 16, credibility: 10 },
    focusAreas: ['Data & ML', 'Databases', 'Languages', 'AI'],
    keyRoles: ['Data Scientist', 'AI / ML Engineer', 'Backend Developer'],
  },
};

/** A per-event override. Every field optional; anything absent falls back. */
export interface EventStatProfileOverride {
  summary?: string;
  weights?: Partial<ComponentWeights>;
  focusAreas?: string[];
  keyRoles?: TeamRole[];
}

/**
 * The profile actually in force for an event: its category archetype, with any
 * per-event override merged on top.
 */
export function resolveStatProfile(
  category: string,
  override: EventStatProfileOverride | null,
): EventStatProfile {
  const base = ARCHETYPES[category as EventCategory] ?? {
    summary: 'A general event. Scored on the platform defaults.',
    weights: DEFAULT_WEIGHTS,
    focusAreas: ['Frontend', 'Backend', 'Design'],
    keyRoles: ['Full-Stack Developer'],
  };

  if (!override) return base;

  return {
    summary: override.summary ?? base.summary,
    weights: { ...base.weights, ...override.weights },
    focusAreas: override.focusAreas ?? base.focusAreas,
    keyRoles: override.keyRoles ?? base.keyRoles,
  };
}

/** Every skill belonging to one catalogue category, lower-cased for lookup. */
const SKILLS_BY_CATEGORY = new Map(
  SKILL_CATEGORIES.map((category) => [
    category.name,
    new Set(category.skills.map((skill) => skill.toLowerCase())),
  ]),
);

export interface FocusCoverage {
  area: string;
  /** The person's skills that fall in this area. */
  matched: string[];
  /** The strongest skill they have here, 0–100. */
  depth: number;
  /** The strongest skill's name, so the UI can say *what* carries the area. */
  deepest: string | null;
  /** 0–100: how well this area is covered. */
  score: number;
  /**
   * 0–100: how much the score above is worth believing.
   *
   * Every number here comes from somebody describing themselves. With eight
   * demo users who filled everything in, that is invisible; with five hundred
   * real ones whose sliders are all sitting at the default, a confident 70 is
   * a guess wearing a number's clothes. This says which it is, so the UI can
   * hedge instead of asserting.
   */
  confidence: number;
  /** Skills here the person never actually rated. */
  unrated: string[];
  /** How many endorsements back the skills in this area. */
  endorsements: number;
}

/**
 * How well one person covers an event's focus areas.
 *
 * Depth leads and breadth adjusts it — which is the opposite of how this was
 * first written, and the earlier version was wrong in a way people noticed.
 * It multiplied a saturating breadth term by mean proficiency:
 *
 *     breadth = min(1, matched / 3);  score = breadth * (depth / 5) * 100
 *
 * With that, listing a single backend skill capped the area at 33 no matter how
 * good you were at it, so "Backend, and I am an expert at Node" scored 20. That
 * is not what the number is supposed to mean. One person who genuinely knows
 * Node covers an event's backend need; three people who have each opened a
 * tutorial do not, and the old formula ranked the latter higher.
 *
 * Two further properties are deliberate:
 *
 * - **The anchor is the strongest skill, not the mean.** Under a mean, adding a
 *   skill you are honest about being new at *lowers* your score, which teaches
 *   people to hide things. Listing more can only help here, and only a little.
 * - **Breadth saturates fast.** The second and third skill in an area add real
 *   coverage; the sixth says more about how somebody writes lists than about
 *   what they can do.
 */
export function coverageFor(
  user: { skills: string[]; skillLevels?: Record<string, number> },
  focusAreas: string[],
  /**
   * Endorsements per skill. Optional, so every existing caller keeps working —
   * an absent map simply means nothing is corroborated, which is the honest
   * reading of "we do not know".
   */
  endorsements: ReadonlyMap<string, number> = new Map(),
): FocusCoverage[] {
  const owned = user.skills.map((skill) => ({ name: skill, key: skill.toLowerCase() }));

  return focusAreas.map((area) => {
    const inArea = SKILLS_BY_CATEGORY.get(area) ?? new Set<string>();
    const matched = owned.filter((skill) => inArea.has(skill.key));

    if (matched.length === 0) {
      return {
        area,
        matched: [],
        depth: 0,
        deepest: null,
        score: 0,
        // Nothing claimed is not the same as something claimed and unverified.
        // "They have no backend skills" is a fact about the profile, so it is
        // known with certainty even though the score is zero.
        confidence: 100,
        unrated: [],
        endorsements: 0,
      };
    }

    const rated = matched.map((skill) => ({
      name: skill.name,
      // An absent entry means the slider was never touched. That is why the
      // default lives here rather than being written into the profile on save:
      // once it is stored, "I am average at this" and "I never said" become
      // the same row and this distinction is gone for good.
      level: user.skillLevels?.[skill.name] ?? DEFAULT_SKILL_LEVEL,
      selfRated: user.skillLevels?.[skill.name] !== undefined,
      endorsed: endorsements.get(skill.name) ?? 0,
    }));

    const best = rated.reduce((top, entry) => (entry.level > top.level ? entry : top));

    // Full breadth at three skills in an area; one skill still keeps most of
    // the score, because one deep skill is genuine coverage.
    const breadth = Math.min(1, (matched.length - 1) / 2);
    const score = Math.round(best.level * (DEPTH_SHARE + (1 - DEPTH_SHARE) * breadth));

    const unrated = rated.filter((entry) => !entry.selfRated);
    const endorsementTotal = rated.reduce((sum, entry) => sum + entry.endorsed, 0);

    return {
      area,
      matched: rated.map((entry) => entry.name),
      depth: best.level,
      deepest: best.name,
      score: Math.min(100, score),
      confidence: confidenceFor(rated),
      unrated: unrated.map((entry) => entry.name),
      endorsements: endorsementTotal,
    };
  });
}

/**
 * How much to believe a coverage score.
 *
 * Two things move it, and they are different in kind:
 *
 * - **Rating.** A skill somebody explicitly put a number on is a claim. One
 *   they added and never rated is scored at the default, which is the engine
 *   guessing on their behalf — so it starts low and the claim only lifts it to
 *   the ceiling for unverified self-assessment.
 * - **Endorsement.** Somebody who has worked with them saying the claim holds.
 *   This is the only thing that takes confidence past that ceiling, and it
 *   saturates fast: the second person to confirm a skill adds far less than the
 *   first, because the thing being established — "somebody other than them
 *   says so" — is established by one.
 *
 * Weighted by the skill carrying the area, not averaged flat: if the deep skill
 * is corroborated it barely matters that a minor one is not.
 */
const SELF_REPORTED_CEILING = 60;

function confidenceFor(
  rated: ReadonlyArray<{ level: number; selfRated: boolean; endorsed: number }>,
): number {
  if (rated.length === 0) return 100;

  const totalWeight = rated.reduce((sum, entry) => sum + Math.max(1, entry.level), 0);

  const weighted = rated.reduce((sum, entry) => {
    const base = entry.selfRated ? SELF_REPORTED_CEILING : 25;
    // Saturating: one endorsement is most of the value, three is all of it.
    const lift = (100 - base) * (1 - Math.exp(-entry.endorsed));
    return sum + (base + lift) * Math.max(1, entry.level);
  }, 0);

  return Math.round(weighted / totalWeight);
}

/**
 * How much of an area's score one deep skill can earn on its own.
 *
 * At 0.78, an expert (90) alone in an area scores 70 and the same expert with
 * two more skills scores 90 — breadth is worth having without being the thing
 * that decides it.
 */
const DEPTH_SHARE = 0.78;

export interface EventFit {
  /** 0–100 across the event's focus areas. */
  score: number;
  /** 0–100: how much evidence the score rests on. See `FocusCoverage`. */
  confidence: number;
  band: 'excellent' | 'strong' | 'moderate' | 'weak';
  coverage: FocusCoverage[];
  /** Focus areas the person barely covers — what they would rely on others for. */
  gaps: string[];
  /** True when their role is one this event usually needs. */
  fillsKeyRole: boolean;
  summary: string;
}

function bandFor(score: number): EventFit['band'] {
  if (score >= 75) return 'excellent';
  if (score >= 55) return 'strong';
  if (score >= 30) return 'moderate';
  return 'weak';
}

/**
 * One person's stat sheet for one event.
 *
 * Earlier focus areas count for more — an event lists them most-important
 * first, so a linear taper means covering the first area matters more than
 * covering the last.
 */
export function fitForEvent(
  user: { skills: string[]; skillLevels?: Record<string, number>; roles: readonly TeamRole[] },
  profile: EventStatProfile,
  endorsements: ReadonlyMap<string, number> = new Map(),
): EventFit {
  const coverage = coverageFor(user, profile.focusAreas, endorsements);

  const weights = coverage.map((_, index) => profile.focusAreas.length - index);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weighted = coverage.reduce((sum, entry, index) => sum + entry.score * weights[index], 0);

  // Any one of their roles being a role this event needs counts once. Claiming
  // more roles cannot earn the bonus more than once.
  const matchedKeyRoles = user.roles.filter((role) => profile.keyRoles.includes(role));
  const fillsKeyRole = matchedKeyRoles.length > 0;

  // Playing a position the event needs is worth a real bump, but it cannot
  // manufacture a good score on its own.
  const base = totalWeight === 0 ? 0 : weighted / totalWeight;
  const score = Math.min(100, Math.round(base + (fillsKeyRole ? 10 : 0)));

  const gaps = coverage.filter((entry) => entry.score < 25).map((entry) => entry.area);
  const strongest = [...coverage].sort((a, b) => b.score - a.score)[0];

  const summary =
    strongest && strongest.score > 0
      ? `Strongest in ${strongest.area}${strongest.deepest ? ` (${strongest.deepest})` : ''}${
          fillsKeyRole ? `, and ${matchedKeyRoles[0]} is a role this event needs` : ''
        }.`
      : 'None of this event’s focus areas are covered by the listed skills yet.';

  // Weighted the same way the score is: being unsure about the area that
  // matters most should move this more than being unsure about the last one.
  const confidence =
    totalWeight === 0
      ? 100
      : Math.round(
          coverage.reduce((sum, entry, index) => sum + entry.confidence * weights[index], 0) /
            totalWeight,
        );

  return { score, confidence, band: bandFor(score), coverage, gaps, fillsKeyRole, summary };
}

export interface TeamEventGaps {
  /** Coverage of each focus area by the team as a whole. */
  coverage: FocusCoverage[];
  /** Focus areas nobody on the team covers — what a new member should bring. */
  missingAreas: string[];
  /** Key roles nobody on the team currently plays. */
  missingRoles: TeamRole[];
  /** 0–100 readiness for this specific event. */
  readiness: number;
  summary: string;
}

/**
 * What a team is missing *for this event*.
 *
 * The team is treated as one combined person — the best coverage anyone brings
 * to an area is the team's coverage of it, because a team only needs one person
 * who can do a thing.
 */
export function teamGapsForEvent(
  members: ReadonlyArray<{
    id?: string;
    skills: string[];
    skillLevels?: Record<string, number>;
    roles: readonly TeamRole[];
  }>,
  profile: EventStatProfile,
  /** Endorsements per member id, so a team's coverage is as trusted as its members'. */
  endorsements: ReadonlyMap<string, ReadonlyMap<string, number>> = new Map(),
): TeamEventGaps {
  const perMember = members.map((member) =>
    coverageFor(
      member,
      profile.focusAreas,
      (member.id ? endorsements.get(member.id) : undefined) ?? new Map(),
    ),
  );

  const coverage: FocusCoverage[] = profile.focusAreas.map((area, index) => {
    const contributions = perMember.map((entry) => entry[index]);

    // An area is covered as well as the *best* person on it covers it. Averaging
    // would mean adding a teammate who does not do backend makes the team worse
    // at backend, which is not how a team works.
    const best = contributions.reduce<FocusCoverage>(
      (top, entry) => (entry.score > top.score ? entry : top),
      {
        area,
        matched: [],
        depth: 0,
        deepest: null,
        score: 0,
        confidence: 100,
        unrated: [],
        endorsements: 0,
      },
    );

    return {
      area,
      // Union of everyone's matching skills, so the UI can show who covers what.
      matched: [...new Set(contributions.flatMap((entry) => entry.matched))],
      depth: best.depth,
      deepest: best.deepest,
      score: best.score,
      // The confidence of whoever is actually carrying the area, not the team's
      // average: the number being qualified is *their* score, so it is their
      // evidence that matters.
      confidence: best.confidence,
      unrated: best.unrated,
      endorsements: contributions.reduce((sum, entry) => sum + entry.endorsements, 0),
    };
  });

  const missingAreas = coverage.filter((entry) => entry.score < 25).map((entry) => entry.area);

  const held = new Set(members.flatMap((member) => member.roles));
  const missingRoles = profile.keyRoles.filter((role) => !held.has(role));

  const weights = coverage.map((_, index) => profile.focusAreas.length - index);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const readiness =
    totalWeight === 0
      ? 0
      : Math.round(coverage.reduce((sum, e, i) => sum + e.score * weights[i], 0) / totalWeight);

  const summary =
    missingAreas.length === 0 && missingRoles.length === 0
      ? 'This team covers everything the event calls for.'
      : [
          missingAreas.length ? `No cover for ${missingAreas.join(', ')}` : null,
          missingRoles.length ? `no ${missingRoles.join(' or ')}` : null,
        ]
          .filter(Boolean)
          .join(', and ') + '.';

  return { coverage, missingAreas, missingRoles, readiness, summary };
}

// -- who the team should be looking for ---------------------------------------

/** One area the team wants somebody for, and how good that somebody needs to be. */
export interface SkillNeed {
  area: string;
  /** What the team has here now, 0–100. */
  current: number;
  /** The proficiency a recruit should bring, 0–100. */
  target: number;
  /** Named skills in this area, so the brief is concrete rather than abstract. */
  examples: string[];
  /** How badly this is needed relative to the other areas. */
  priority: 'critical' | 'important' | 'nice to have';
}

/**
 * What kind of person a team should be looking for.
 *
 * This answers the question directly rather than making somebody infer it from
 * a ranked list of candidates: which positions are unfilled, which areas are
 * thin, and how strong a recruit has to be in them to actually change anything.
 *
 * It is a description, not a search result — it is true whether or not anybody
 * matching it has signed up, which is exactly why it is worth showing. A team
 * that learns "you need someone strong in Security" can go and find that person
 * anywhere; a team shown only an empty candidate list learns nothing.
 */
export interface RecruitBrief {
  /** Positions nobody on the team plays, most important first. */
  roles: TeamRole[];
  /**
   * 0–100: how much evidence this brief rests on.
   *
   * A brief is only as good as the profiles under it. When the roster is mostly
   * unrated skills, the gaps it names may be real or may be an artefact of
   * nobody having filled anything in — and saying so is more useful than
   * confidently recommending a Presenter because three people left their
   * sliders alone.
   */
  confidence: number;
  /** Set when confidence is low enough that the brief should be read as provisional. */
  caveat: string | null;
  /** Areas worth recruiting for, worst-covered and most-weighted first. */
  skills: SkillNeed[];
  /** Whether the team's real problem is a missing position or thin skills. */
  emphasis: 'roles' | 'skills' | 'both' | 'none';
  /** One sentence, written to be read aloud. */
  headline: string;
  /** The reasoning, in the order it was applied. */
  reasons: string[];
}

/**
 * The proficiency a recruit needs to bring to an area.
 *
 * Pitched above what the team already has, because someone who matches the
 * current level adds breadth but does not fix a gap. Floored at "Comfortable"
 * (40) — recruiting someone who is also learning does not close anything — and
 * capped at 85 so the brief stays a realistic ask rather than demanding an
 * expert for an area the team is merely thin in.
 */
function targetFor(current: number): number {
  return Math.max(40, Math.min(85, current + 30));
}

export function recruitBriefFor(
  gaps: TeamEventGaps,
  profile: EventStatProfile,
  /** Open seats the team itself declared, which outrank anything inferred. */
  declaredRoles: readonly TeamRole[] = [],
): RecruitBrief {
  // What the team asked for comes first: the owner knows something the archetype
  // does not. Inferred key roles follow, in the event's own priority order.
  const roles = [...new Set([...declaredRoles, ...gaps.missingRoles])];

  const byArea = new Map(gaps.coverage.map((entry) => [entry.area, entry]));

  const skills: SkillNeed[] = profile.focusAreas
    .map((area, index) => {
      const entry = byArea.get(area);
      const current = entry?.score ?? 0;

      // Focus areas are listed most-important-first, so an early area that is
      // thin matters more than a late one that is missing outright.
      const importance = profile.focusAreas.length - index;
      const shortfall = (100 - current) * importance;

      return { area, current, importance, shortfall };
    })
    .filter((entry) => entry.current < 70)
    .sort((a, b) => b.shortfall - a.shortfall)
    .slice(0, 3)
    .map(({ area, current }) => ({
      area,
      current,
      target: targetFor(current),
      examples: (SKILL_CATEGORIES.find((category) => category.name === area)?.skills ?? []).slice(0, 4),
      priority:
        current < 25 ? ('critical' as const)
        : current < 50 ? ('important' as const)
        : ('nice to have' as const),
    }));

  /*
   * Confidence is judged over what the team is believed to *have*, not over
   * what the brief is recruiting for.
   *
   * The first version had this backwards: it averaged confidence across the
   * areas being recruited for, which are precisely the empty ones — and an
   * empty area is known with certainty, so a team of entirely unrated profiles
   * came out looking well-evidenced. The risk runs the other way. An area that
   * *looks* covered because somebody's untouched slider was scored at the
   * default never becomes a gap, so nobody is ever sent to fill it. Those are
   * the beliefs worth qualifying.
   *
   * Weighted by score for the same reason: an area held at 80 on no evidence is
   * a bigger problem than one held at 10 on no evidence.
   */
  const believed = gaps.coverage.filter((entry) => entry.score > 0);
  const beliefWeight = believed.reduce((sum, entry) => sum + entry.score, 0);
  const confidence =
    beliefWeight === 0
      ? 100
      : Math.round(
          believed.reduce((sum, entry) => sum + entry.confidence * entry.score, 0) / beliefWeight,
        );

  const unratedCount = new Set(gaps.coverage.flatMap((entry) => entry.unrated)).size;

  const caveat =
    confidence >= 65
      ? null
      : unratedCount > 0
        ? `Provisional — ${unratedCount} skill${unratedCount === 1 ? '' : 's'} on this team ` +
          'have never been rated, so some of these gaps may just be blanks. Ask the team to ' +
          'finish their profiles before recruiting against this.'
        : 'Provisional — these scores are self-reported and nobody has endorsed them yet.';

  const emphasis: RecruitBrief['emphasis'] =
    roles.length > 0 && skills.length > 0 ? 'both'
    : roles.length > 0 ? 'roles'
    : skills.length > 0 ? 'skills'
    : 'none';

  const critical = skills.filter((need) => need.priority === 'critical');
  const lead = critical[0] ?? skills[0];

  const headline =
    emphasis === 'none'
      ? 'This team is covered — recruit for depth, not for gaps.'
      : [
          roles.length ? `Looking for a ${roles.slice(0, 2).join(' or ')}` : 'Looking for someone',
          lead
            ? `strong in ${lead.area}${lead.examples.length ? ` — ${lead.examples.slice(0, 2).join(' or ')}` : ''}`
            : null,
        ]
          .filter(Boolean)
          .join(' ') + '.';

  const reasons = [
    declaredRoles.length ? `The team is advertising for ${declaredRoles.join(', ')}.` : null,
    gaps.missingRoles.length
      ? `Nobody currently plays ${gaps.missingRoles.join(' or ')}, which this event usually needs.`
      : null,
    critical.length
      ? `${critical.map((need) => need.area).join(' and ')} ${critical.length === 1 ? 'is' : 'are'} effectively uncovered.`
      : null,
    skills.length && !critical.length
      ? `${skills[0].area} is covered but thin — ${skills[0].current}/100 today.`
      : null,
    emphasis === 'none'
      ? `Every focus area is at ${Math.min(...gaps.coverage.map((entry) => entry.score))}/100 or better.`
      : null,
  ].filter((reason): reason is string => reason !== null);

  return { roles, skills, emphasis, confidence, caveat, headline, reasons };
}

export { EVENT_CATEGORIES };

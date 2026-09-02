import type { TeamRole } from '../users/user.model.js';

/**
 * Capability axes each role covers. Scoring role synergy from these rather than
 * from a hand-written matrix keeps the rule explainable ("you two cover client
 * and server") and means adding a role is one line rather than one row and one
 * column.
 *
 * The non-engineering roles are here for the same reason they exist at all: a
 * team where nobody covers `pitch` loses points it did not have to lose, and
 * the axis is what makes that visible instead of implicit.
 */
export const ROLE_AXES: Record<TeamRole, readonly string[]> = {
  // Build
  'Frontend Developer': ['client'],
  'Backend Developer': ['server'],
  'Full-Stack Developer': ['client', 'server'],
  'Mobile Developer': ['client', 'mobile'],
  'Game Developer': ['client', 'game'],
  'AI / ML Engineer': ['ml', 'data'],
  'Data Scientist': ['data'],
  'DevOps Engineer': ['infra', 'server'],
  Cybersecurity: ['security'],
  'QA / Tester': ['quality'],
  'Hardware / IoT': ['hardware'],
  // Shape
  'UI/UX Designer': ['design'],
  'Graphic Artist': ['design', 'art'],
  'Product Manager': ['product'],
  'Business Analyst': ['product', 'research'],
  Researcher: ['research'],
  // Tell
  Presenter: ['pitch'],
  'Pitch Writer': ['pitch', 'writing'],
  'Demo Builder': ['pitch', 'client'],
  'Documentation Lead': ['writing'],
};

/** Every axis any role covers — the denominator for "how much is covered". */
export const ALL_ROLE_AXES: readonly string[] = Object.freeze([
  ...new Set(Object.values(ROLE_AXES).flat()),
]);

/** The union of axes a set of roles covers. */
export function axesOf(roles: readonly TeamRole[]): Set<string> {
  const axes = new Set<string>();
  for (const role of roles) {
    for (const axis of ROLE_AXES[role] ?? []) axes.add(axis);
  }
  return axes;
}

/** One weighted component of a compatibility score. */
export interface ScoreComponent {
  key: 'skills' | 'roles' | 'availability' | 'workingStyle' | 'credibility';
  label: string;
  /** 0–100, before weighting. */
  score: number;
  /** Share of the final score this component can contribute. */
  weight: number;
  explanation: string;
}

export interface CompatibilityResult {
  /** 0–100. */
  score: number;
  /** Plain-language banding used by the UI badge. */
  band: 'excellent' | 'strong' | 'moderate' | 'weak';
  summary: string;
  components: ScoreComponent[];
  sharedSkills: string[];
  complementarySkills: string[];
  sharedAvailability: string[];
}

export interface PairCompatibility extends CompatibilityResult {
  userIds: [string, string];
}

export function bandFor(score: number): CompatibilityResult['band'] {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'strong';
  if (score >= 45) return 'moderate';
  return 'weak';
}

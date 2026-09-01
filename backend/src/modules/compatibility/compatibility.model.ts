import type { PrimaryRole } from '../users/user.model.js';

/**
 * Capability axes each primary role covers. Scoring role synergy from these
 * rather than from a hand-written 10×10 matrix keeps the rule explainable
 * ("you two cover client and server") and means adding a role is one line.
 */
export const ROLE_AXES: Record<PrimaryRole, readonly string[]> = {
  'Frontend Developer': ['client'],
  'Backend Developer': ['server'],
  'Full-Stack Developer': ['client', 'server'],
  'Mobile Developer': ['client', 'mobile'],
  'AI / ML Engineer': ['ml', 'data'],
  'Data Scientist': ['data'],
  'UI/UX Designer': ['design'],
  'Product Manager': ['product'],
  'DevOps Engineer': ['infra', 'server'],
  Cybersecurity: ['security'],
};

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

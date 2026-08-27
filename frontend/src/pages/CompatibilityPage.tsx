import { useMemo, useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Container } from '../components/ui/Container';
import { Select } from '../components/ui/Input';
import { PRIMARY_ROLES } from '../lib/types';
import type { PrimaryRole } from '../lib/types';

/**
 * Sprint 1 preview of the compatibility feature. The real engine lands in
 * Sprint 2; this uses a transparent placeholder heuristic so the UI, the
 * score breakdown, and the copy can all be reviewed now.
 */
const ROLE_SYNERGY: Partial<Record<PrimaryRole, PrimaryRole[]>> = {
  'Frontend Developer': ['Backend Developer', 'UI/UX Designer', 'Product Manager'],
  'Backend Developer': ['Frontend Developer', 'DevOps Engineer', 'Mobile Developer'],
  'Full-Stack Developer': ['UI/UX Designer', 'Product Manager', 'AI / ML Engineer'],
  'Mobile Developer': ['Backend Developer', 'UI/UX Designer'],
  'AI / ML Engineer': ['Data Scientist', 'Backend Developer', 'Product Manager'],
  'Data Scientist': ['AI / ML Engineer', 'Backend Developer'],
  'UI/UX Designer': ['Frontend Developer', 'Product Manager', 'Full-Stack Developer'],
  'Product Manager': ['Full-Stack Developer', 'UI/UX Designer', 'AI / ML Engineer'],
  'DevOps Engineer': ['Backend Developer', 'Cybersecurity'],
  Cybersecurity: ['Backend Developer', 'DevOps Engineer'],
};

function scoreFor(a: PrimaryRole, b: PrimaryRole) {
  if (a === b) return 58;
  // ROLE_SYNERGY is hand-authored and not symmetric: it lists Product Manager
  // under Frontend Developer but not the reverse. Compatibility between two
  // people cannot depend on which dropdown each of them used, so treat a
  // synergy declared in either direction as declared for the pair.
  const complementary = ROLE_SYNERGY[a]?.includes(b) || ROLE_SYNERGY[b]?.includes(a);
  return complementary ? 92 : 74;
}

export function CompatibilityPage() {
  const [roleA, setRoleA] = useState<PrimaryRole>('Frontend Developer');
  const [roleB, setRoleB] = useState<PrimaryRole>('Backend Developer');

  const score = useMemo(() => scoreFor(roleA, roleB), [roleA, roleB]);

  const verdict =
    score >= 90
      ? { tone: 'success' as const, label: 'Strong complement' }
      : score >= 70
        ? { tone: 'brand' as const, label: 'Workable pairing' }
        : { tone: 'warning' as const, label: 'Overlapping strengths' };

  return (
    <Container className="py-14 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-ink-200 pb-8 dark:border-ink-700">
        <div>
          <Badge tone="accent" className="mb-5">
            Preview · Engine ships in Sprint 2
          </Badge>
          <h1 className="type-display text-ink-900 dark:text-white">
            Compatibility
            <br />
            calculator
          </h1>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          Pick two roles to see how TapTim will present a match. The final score will also weigh
          skills, availability, and working style.
        </p>
      </div>

      <Card className="mx-auto mt-12 max-w-3xl">
        <div className="grid gap-6 sm:grid-cols-2">
          <Select
            label="Your primary role"
            value={roleA}
            onChange={(event) => setRoleA(event.target.value as PrimaryRole)}
          >
            {PRIMARY_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
          <Select
            label="Teammate's primary role"
            value={roleB}
            onChange={(event) => setRoleB(event.target.value as PrimaryRole)}
          >
            {PRIMARY_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-10 border-t border-ink-200 pt-10 dark:border-ink-700">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="font-mono text-[clamp(3.5rem,12vw,6rem)] font-bold leading-none tracking-tighter text-success-text">
              {score}
              <span className="text-3xl">%</span>
            </p>
            <div className="pb-2">
              <Badge tone={verdict.tone}>{verdict.label}</Badge>
            </div>
          </div>

          {/*
            A 20-segment meter instead of a donut. It reads the score at a
            glance without introducing the only round shape in the system, and
            the filled-segment count is legible even at small sizes.
          */}
          <div
            className="mt-6 flex gap-1 rounded-full border border-ink-200 p-1.5 dark:border-ink-700"
            role="img"
            aria-label={`Compatibility score ${score} out of 100`}
          >
            {Array.from({ length: 20 }, (_, i) => (
              <span
                key={i}
                className={
                  'h-6 flex-1 rounded-full ' +
                  (i < Math.round(score / 5)
                    ? 'bg-fern-500'
                    : 'bg-ink-200 dark:bg-ink-800')
                }
              />
            ))}
          </div>

          <p className="mt-6 max-w-md text-sm leading-relaxed text-ink-600 dark:text-ink-300">
            {score >= 90
              ? `A ${roleA} and a ${roleB} cover different parts of the build, which is exactly what a 48-hour team needs.`
              : score >= 70
                ? `A ${roleA} and a ${roleB} can ship together, though you may still want a third role to round the team out.`
                : `Two ${roleA} profiles will duplicate effort. Consider recruiting a different role to fill the gap.`}
          </p>
        </div>
      </Card>
    </Container>
  );
}

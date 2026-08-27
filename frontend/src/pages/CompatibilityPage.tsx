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
      <div className="mx-auto max-w-2xl text-center">
        <Badge tone="accent" className="mb-5">
          Preview · Full engine ships in Sprint 2
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl dark:text-white">
          Compatibility <span className="text-gradient">Calculator</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-600 sm:text-lg dark:text-ink-400">
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

        <div className="mt-10 flex flex-col items-center gap-4 border-t border-ink-200 pt-10 dark:border-ink-800">
          <div
            className="grid h-40 w-40 place-items-center rounded-full"
            style={{
              background: `conic-gradient(var(--color-brand-500) ${score * 3.6}deg, var(--color-ink-200) 0deg)`,
            }}
          >
            <div className="grid h-32 w-32 place-items-center rounded-full bg-white dark:bg-ink-900">
              <div className="text-center">
                <p className="text-4xl font-extrabold tracking-tight text-ink-900 dark:text-white">
                  {score}%
                </p>
                <p className="text-xs text-ink-500 dark:text-ink-400">match</p>
              </div>
            </div>
          </div>

          <Badge tone={verdict.tone}>{verdict.label}</Badge>

          <p className="max-w-md text-center text-sm leading-relaxed text-ink-600 dark:text-ink-400">
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

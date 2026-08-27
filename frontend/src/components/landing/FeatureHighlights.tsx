import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';

const MATCH_FACTORS = [
  { label: 'Complementary skills', score: 96 },
  { label: 'Availability overlap', score: 88 },
  { label: 'Working style', score: 91 },
];

const ROSTER = [
  { role: 'Frontend', name: 'Ada L.', filled: true },
  { role: 'Backend', name: 'Kenji T.', filled: true },
  { role: 'ML Engineer', name: 'Sara M.', filled: true },
  { role: 'Designer', name: 'Open seat', filled: false },
];

/** Compatibility Calculator teaser — the "92% Match" moment. */
function CompatibilityCard() {
  return (
    <Card className="flex h-full flex-col">
      <Badge tone="brand">Compatibility Calculator</Badge>

      <div className="mt-6 flex items-baseline gap-2">
        <span className="text-5xl font-extrabold tracking-tight text-gradient">92%</span>
        <span className="text-sm font-medium text-ink-500 dark:text-ink-400">Match</span>
      </div>
      <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">
        Your fit with <span className="font-medium text-ink-900 dark:text-white">Team Nebula</span>
      </p>

      <div className="mt-6 space-y-4">
        {MATCH_FACTORS.map((factor) => (
          <div key={factor.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-600 dark:text-ink-400">{factor.label}</span>
              <span className="font-mono font-medium text-ink-900 dark:text-white">
                {factor.score}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-400"
                style={{ width: `${factor.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-auto pt-6 text-xs text-ink-500 dark:text-ink-400">
        Scores are illustrative in Sprint 1; the scoring engine ships in Sprint 2.
      </p>
    </Card>
  );
}

/** Team Builder teaser — a roster with one visible gap. */
function TeamBuilderCard() {
  return (
    <Card className="flex h-full flex-col">
      <Badge tone="accent">Team Builder</Badge>

      <h3 className="mt-6 text-lg font-semibold text-ink-900 dark:text-white">Team Nebula</h3>
      <p className="mt-1.5 text-sm text-ink-600 dark:text-ink-400">
        3 of 4 seats filled · TapTim Global Hack 2026
      </p>

      <ul className="mt-6 space-y-2.5">
        {ROSTER.map((member) => (
          <li
            key={member.role}
            className={
              member.filled
                ? 'flex items-center gap-3 rounded-xl border border-ink-200 px-3 py-2.5 dark:border-ink-800'
                : 'flex items-center gap-3 rounded-xl border border-dashed border-brand-400/70 bg-brand-500/5 px-3 py-2.5'
            }
          >
            <span
              className={
                member.filled
                  ? 'grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-semibold text-white'
                  : 'grid h-8 w-8 place-items-center rounded-full border border-dashed border-brand-400 text-brand-500'
              }
            >
              {member.filled ? member.name.charAt(0) : '+'}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-900 dark:text-white">
                {member.name}
              </p>
              <p className="text-xs text-ink-500 dark:text-ink-400">{member.role}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-auto pt-6 text-xs text-ink-500 dark:text-ink-400">
        TapTim suggests candidates for the open seat based on what the roster is missing.
      </p>
    </Card>
  );
}

/** Verified Badges teaser — AI certificate verification. */
function VerifiedBadgeCard() {
  return (
    <Card className="flex h-full flex-col">
      <Badge tone="success">Verified Badges</Badge>

      <div className="mt-6 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-base font-bold text-white">
          SM
        </span>
        <div>
          <p className="flex items-center gap-1.5 font-semibold text-ink-900 dark:text-white">
            Sara M.
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
              <path d="M12 2 4 6v6c0 5 3.4 9.2 8 10 4.6-.8 8-5 8-10V6l-8-4Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </p>
          <p className="text-xs text-ink-500 dark:text-ink-400">AI / ML Engineer</p>
        </div>
      </div>

      <ul className="mt-6 space-y-2.5">
        {['TensorFlow Developer', 'AWS Solutions Architect', 'Kaggle Expert'].map((cert) => (
          <li
            key={cert}
            className="flex items-center justify-between rounded-xl bg-ink-100/70 px-3 py-2.5 text-sm dark:bg-ink-800/50"
          >
            <span className="text-ink-700 dark:text-ink-300">{cert}</span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Verified
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-auto pt-6 text-xs text-ink-500 dark:text-ink-400">
        Certificates are checked automatically, so claims on a profile carry weight.
      </p>
    </Card>
  );
}

export function FeatureHighlights() {
  return (
    <section className="border-y border-ink-200 bg-white py-20 sm:py-24 dark:border-ink-800 dark:bg-ink-900/30">
      <Container>
        <SectionHeading
          overline="Feature Highlights"
          title="What you get once your profile is live"
          description="Three pieces work together: a score that explains itself, a roster that shows its gaps, and credentials you can trust."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          <div className="reveal h-full">
            <CompatibilityCard />
          </div>
          <div className="reveal reveal-delay-1 h-full">
            <TeamBuilderCard />
          </div>
          <div className="reveal reveal-delay-2 h-full">
            <VerifiedBadgeCard />
          </div>
        </div>

        <div className="mt-10 text-center">
          <Button variant="outline" to="/compatibility">
            Try the compatibility preview
          </Button>
        </div>
      </Container>
    </section>
  );
}

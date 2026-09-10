import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';

// An example, and labelled as one. These are three of the five components every
// real score on the site is broken into, with the names the product uses.
const MATCH_FACTORS = [
  { label: 'Skills', score: 96 },
  { label: 'Availability', score: 88 },
  { label: 'Working style', score: 91 },
];

const ROSTER = [
  { role: 'Frontend', name: 'Ada L.', filled: true },
  { role: 'Backend', name: 'Kenji T.', filled: true },
  { role: 'ML Engineer', name: 'Sara M.', filled: true },
  { role: 'Designer', name: 'Open seat', filled: false },
];

const CERTS = ['TensorFlow Developer', 'AWS Solutions Architect', 'Kaggle Expert'];

/** Compatibility Calculator teaser — the "92% Match" moment. */
function CompatibilityCard() {
  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2">
        <Badge tone="success">Compatibility</Badge>
        <span className="type-label text-[0.7rem] text-ink-500 dark:text-ink-400">Example</span>
      </div>

      <div className="mt-7 flex items-baseline gap-2">
        <span className="font-mono text-6xl font-bold tracking-tighter text-success-text">92%</span>
      </div>
      <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
        Your fit with <span className="font-bold text-ink-900 dark:text-white">Team Nebula</span>
      </p>

      <div className="mt-7 space-y-5">
        {MATCH_FACTORS.map((factor) => (
          <div key={factor.label}>
            <div className="type-label flex items-center justify-between">
              <span className="text-ink-600 dark:text-ink-400">{factor.label}</span>
              <span className="font-bold text-ink-900 dark:text-white">{factor.score}%</span>
            </div>
            {/* Stepped bar in a hard frame — no rounded gradient track. */}
            <div className="mt-2 h-3 border border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-950">
              <div className="h-full rounded-full bg-fern-500" style={{ width: `${factor.score}%` }} />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-auto pt-7 text-xs leading-relaxed text-ink-600 dark:text-ink-400">
        Every real score on TapTim comes broken down like this — five components, each with a
        sentence saying why.
      </p>
    </Card>
  );
}

/** Team Builder teaser — a roster with one visible gap. */
function TeamBuilderCard() {
  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2">
        <Badge tone="accent">Team Builder</Badge>
        <span className="type-label text-[0.7rem] text-ink-500 dark:text-ink-400">Example</span>
      </div>

      <h3 className="mt-7 text-xl font-bold tracking-tight text-ink-900 dark:text-white">
        Team Nebula
      </h3>
      <p className="type-label mt-2 text-ink-600 dark:text-ink-400">
        3 of 4 seats · TapTim Global Hack 2026
      </p>

      <ul className="mt-7 overflow-hidden rounded-[var(--radius-soft)] border border-ink-200 divide-y divide-ink-200 dark:border-ink-700 dark:divide-ink-800">
        {ROSTER.map((member) => (
          <li
            key={member.role}
            className={
              member.filled
                ? 'flex items-center gap-3 px-3 py-2.5'
                : 'flex items-center gap-3 bg-iris-50 px-3 py-2.5 dark:bg-iris-900/25'
            }
          >
            <span
              className={
                member.filled
                  ? 'grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink-200 bg-ink-900 font-mono text-xs font-bold text-ink-50 dark:border-ink-700'
                  : 'grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-iris-400 font-mono text-xs font-bold text-iris-700 dark:text-iris-400'
              }
              aria-hidden="true"
            >
              {member.filled ? member.name.charAt(0) : '+'}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink-900 dark:text-white">
                {member.name}
              </p>
              <p className="type-label text-ink-600 dark:text-ink-400">{member.role}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-auto pt-7 text-xs leading-relaxed text-ink-600 dark:text-ink-400">
        TapTim suggests candidates for the open seat based on what the roster is missing.
      </p>
    </Card>
  );
}

/** Verified Badges teaser — AI certificate verification. */
function VerifiedBadgeCard() {
  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2">
        <Badge tone="success">Verified</Badge>
        <span className="type-label text-[0.7rem] text-ink-500 dark:text-ink-400">Example</span>
      </div>

      <div className="mt-7 flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-ink-200 bg-ink-900 font-mono text-sm font-bold text-ink-50 dark:border-ink-700">
          SM
        </span>
        <div>
          <p className="flex items-center gap-1.5 font-bold tracking-tight text-ink-900 dark:text-white">
            Sara M.
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-signal-ok dark:text-signal-ok-bright"
            >
              <path d="M12 2 4 6v6c0 5 3.4 9.2 8 10 4.6-.8 8-5 8-10V6l-8-4Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </p>
          <p className="type-label text-ink-600 dark:text-ink-400">AI / ML Engineer</p>
        </div>
      </div>

      <ul className="mt-7 overflow-hidden rounded-[var(--radius-soft)] border border-ink-200 divide-y divide-ink-200 dark:border-ink-700 dark:divide-ink-800">
        {CERTS.map((cert) => (
          <li key={cert} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-sm text-ink-800 dark:text-ink-200">{cert}</span>
            <span className="type-label shrink-0 text-signal-ok dark:text-signal-ok-bright">Verified</span>
          </li>
        ))}
      </ul>

      <p className="mt-auto pt-7 text-xs leading-relaxed text-ink-600 dark:text-ink-400">
        Certificates are checked automatically, so claims on a profile carry weight.
      </p>
    </Card>
  );
}

export function FeatureHighlights() {
  return (
    <section className="border-b border-ink-200 bg-ink-50 py-20 sm:py-24 dark:border-ink-700 dark:bg-ink-900/40">
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

        <div className="mt-12">
          <Button variant="outline" to="/compatibility">
            Try the Team Lab
          </Button>
        </div>
      </Container>
    </section>
  );
}

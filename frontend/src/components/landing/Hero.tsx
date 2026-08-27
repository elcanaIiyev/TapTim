import { Button } from '../ui/Button';
import { Container } from '../ui/Container';

const STATS = [
  { value: '12K+', label: 'Builders matched' },
  { value: '480', label: 'Teams formed' },
  { value: '92%', label: 'Avg. match score' },
];

// The hero visual: a team roster mid-assembly, with the open seat called out.
// It shows the product's actual output instead of an abstract illustration.
const ROSTER = [
  { initials: 'AL', name: 'Ada L.', role: 'Frontend', filled: true },
  { initials: 'KT', name: 'Kenji T.', role: 'Backend', filled: true },
  { initials: 'SM', name: 'Sara M.', role: 'ML Engineer', filled: true },
  { initials: '??', name: 'Open seat', role: 'Designer', filled: false },
];

interface HeroProps {
  onGetStarted: () => void;
}

export function Hero({ onGetStarted }: HeroProps) {
  return (
    <section className="relative overflow-hidden border-b-2 border-ink-950 dark:border-ink-100">
      <div
        className="grid-rule pointer-events-none absolute inset-0 opacity-60"
        aria-hidden="true"
      />

      <Container className="relative py-16 sm:py-20 lg:py-24">
        {/* Asymmetric split: type gets 7 columns, the roster 5. */}
        <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <div className="reveal flex items-center gap-3">
              <span className="inline-flex h-2.5 w-2.5 bg-flame-600" aria-hidden="true" />
              <span className="type-label text-ink-600 dark:text-ink-400">
                Sprint 1 MVP / Built for hackathon season
              </span>
            </div>

            <h1 className="reveal reveal-delay-1 type-hero mt-7 text-ink-950 dark:text-white">
              Stop forming
              <br />
              teams by
              <br />
              {/*
                The one place colour carries meaning rather than decoration.
                The fill is the span's own background rather than a positioned
                sibling, so the text can never end up sitting on bare paper if
                the stacking context changes.
              */}
              <span className="inline-block bg-flame-600 px-2 text-white">accident.</span>
            </h1>

            <div className="reveal reveal-delay-2 mt-9 border-l-4 border-flame-600 pl-5">
              <p className="type-quote text-ink-800 dark:text-ink-200">
                “The best teams are built, not bumped into.”
              </p>
            </div>

            <p className="reveal reveal-delay-2 mt-7 max-w-xl text-base leading-relaxed text-ink-700 sm:text-lg dark:text-ink-300">
              TapTim reads your skills, role, and working style, then pairs you with teammates
              who genuinely complete your team — instead of whoever answered the Discord thread
              first.
            </p>

            <div className="reveal reveal-delay-3 mt-9 flex flex-col gap-4 sm:flex-row">
              <Button size="lg" onClick={onGetStarted} className="group w-full sm:w-auto">
                Find my team
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-transform duration-150 group-hover/btn:translate-x-1"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Button>
              <Button size="lg" variant="outline" to="/events" className="w-full sm:w-auto">
                Browse events
              </Button>
            </div>

            <p className="type-label reveal reveal-delay-3 mt-5 text-ink-600 dark:text-ink-400">
              Free to join · No credit card
            </p>
          </div>

          <div className="reveal reveal-delay-2 lg:col-span-5">
            <div className="brut-box brut-shadow">
              <div className="flex items-center justify-between border-b-2 border-ink-950 bg-ink-950 px-4 py-2.5 dark:border-ink-100">
                <span className="type-label text-ink-50">Team Nebula</span>
                <span className="type-label text-flame-500">3 / 4 seats</span>
              </div>

              <ul className="divide-y-2 divide-ink-950 dark:divide-ink-100">
                {ROSTER.map((member) => (
                  <li
                    key={member.name}
                    className={
                      member.filled
                        ? 'flex items-center gap-3.5 px-4 py-3.5'
                        : 'flex items-center gap-3.5 bg-flame-50 px-4 py-3.5 dark:bg-flame-900/25'
                    }
                  >
                    <span
                      className={
                        member.filled
                          ? 'grid h-10 w-10 shrink-0 place-items-center border-2 border-ink-950 bg-ink-950 font-mono text-xs font-bold text-ink-50 dark:border-ink-100'
                          : 'grid h-10 w-10 shrink-0 place-items-center border-2 border-dashed border-flame-600 font-mono text-xs font-bold text-flame-700 dark:text-flame-400'
                      }
                      aria-hidden="true"
                    >
                      {member.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink-950 dark:text-white">
                        {member.name}
                      </span>
                      <span className="type-label block text-ink-600 dark:text-ink-400">
                        {member.role}
                      </span>
                    </span>
                    {!member.filled && (
                      <span className="type-label shrink-0 border-2 border-ink-950 bg-flame-600 px-2 py-0.5 text-ink-950 dark:border-ink-100">
                        Gap
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              <p className="border-t-2 border-ink-950 px-4 py-3 text-xs leading-relaxed text-ink-600 dark:border-ink-100 dark:text-ink-400">
                TapTim suggests candidates for the open seat based on what the team is missing.
              </p>
            </div>
          </div>
        </div>

        {/* Stats rail: mono figures on a hard rule, not soft dividers. */}
        <dl className="reveal reveal-delay-3 mt-16 grid grid-cols-1 border-2 border-ink-950 sm:grid-cols-3 dark:border-ink-100">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={
                'bg-white px-5 py-6 dark:bg-ink-900' +
                (i < STATS.length - 1
                  ? ' border-b-2 border-ink-950 sm:border-b-0 sm:border-r-2 dark:border-ink-100'
                  : '')
              }
            >
              <dt className="sr-only">{stat.label}</dt>
              <dd className="font-mono text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl dark:text-white">
                {stat.value}
              </dd>
              <p className="type-label mt-2 text-ink-600 dark:text-ink-400">{stat.label}</p>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Container } from '../ui/Container';

const STATS = [
  { value: '12k+', label: 'Builders matched' },
  { value: '480', label: 'Teams formed' },
  { value: '92%', label: 'Avg. match score' },
];

interface HeroProps {
  onGetStarted: () => void;
}

export function Hero({ onGetStarted }: HeroProps) {
  return (
    <section className="relative overflow-hidden">
      <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
      {/* Two offset glows read as depth rather than a single flat wash. */}
      <div
        className="glow-drift pointer-events-none absolute left-1/2 top-[-14rem] h-[28rem] w-[48rem] -translate-x-1/2 rounded-full bg-brand-500/25 blur-[130px] dark:bg-brand-600/30"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-[62%] top-[-6rem] h-[20rem] w-[28rem] -translate-x-1/2 rounded-full bg-accent-400/15 blur-[110px] dark:bg-accent-500/20"
        aria-hidden="true"
      />

      <Container className="relative py-20 sm:py-28 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="reveal">
            <Badge tone="brand" className="mb-6">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
              </span>
              Sprint 1 MVP · Built for hackathon season
            </Badge>
          </div>

          <h1 className="reveal reveal-delay-1 text-4xl font-extrabold leading-[1.08] tracking-tight text-balance text-ink-900 sm:text-5xl lg:text-6xl dark:text-white">
            Find Your Perfect <span className="text-gradient">Hackathon Team</span>
          </h1>

          <p className="reveal reveal-delay-2 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-ink-600 sm:text-xl dark:text-ink-400">
            Stop scrolling through chaotic Discord threads. TapTim reads your skills, role, and
            working style, then pairs you with teammates who genuinely complete your team.
          </p>

          <div className="reveal reveal-delay-3 mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={onGetStarted} className="group w-full sm:w-auto">
              Get Started
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-200 group-hover:translate-x-1"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Button>
            <Button size="lg" variant="outline" to="/events" className="w-full sm:w-auto">
              Explore Events
            </Button>
          </div>

          <p className="reveal reveal-delay-3 mt-5 text-xs text-ink-500 dark:text-ink-500">
            Free to join · No credit card required
          </p>

          <dl className="reveal reveal-delay-3 mx-auto mt-16 grid max-w-lg grid-cols-3 divide-x divide-ink-200 border-t border-ink-200 pt-8 dark:divide-ink-800 dark:border-ink-800">
            {STATS.map((stat) => (
              <div key={stat.label} className="px-2">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl dark:text-white">
                  {stat.value}
                </dd>
                <p className="mt-1 text-xs text-ink-500 sm:text-sm dark:text-ink-400">
                  {stat.label}
                </p>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </section>
  );
}

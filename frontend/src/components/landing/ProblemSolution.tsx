import { Card } from '../ui/Card';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';

const PROBLEMS = [
  'Teams form by who shouted first, not who fits.',
  'Three backend devs, nobody who can design or pitch.',
  'Skills on a profile are claims — nothing verifies them.',
];

const SOLUTIONS = [
  {
    title: 'Role-aware team matching',
    description:
      'We model the roles a project actually needs and flag the gap before you commit, so no team starts three frontend devs deep.',
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    title: 'Compatibility calculation',
    description:
      'A score built from complementary skills, overlapping availability, and working style — not just a shared tech tag.',
    icon: (
      <>
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
      </>
    ),
  },
  {
    title: 'AI certificate verification',
    description:
      'Upload a certificate and our checks confirm it is genuine, so a Verified badge means something to the people reading it.',
    icon: (
      <>
        <path d="M12 2 4 6v6c0 5 3.4 9.2 8 10 4.6-.8 8-5 8-10V6l-8-4Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
];

export function ProblemSolution() {
  return (
    <section className="border-y border-ink-200 bg-white py-20 sm:py-24 dark:border-ink-800 dark:bg-ink-900/30">
      <Container>
        <SectionHeading
          overline="Problem & Solution"
          title="Great hackathon ideas die on mismatched teams"
          description="Most participants pick teammates in the first ten minutes, with almost no information. TapTim replaces that scramble with a structured match."
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-5 lg:gap-10">
          <Card className="lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-500 dark:text-red-400">
              The problem
            </p>
            <h3 className="mt-3 text-xl font-semibold text-ink-900 dark:text-white">
              Team formation is guesswork
            </h3>
            <ul className="mt-6 space-y-4">
              {PROBLEMS.map((problem) => (
                <li key={problem} className="flex gap-3 text-sm leading-relaxed text-ink-600 dark:text-ink-400">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-500/12 text-red-500">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </span>
                  {problem}
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid gap-5 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-1">
            {SOLUTIONS.map((solution) => (
              <Card key={solution.title} className="flex gap-4 sm:items-start">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/15 to-accent-500/15 text-brand-600 ring-1 ring-inset ring-brand-500/20 dark:text-brand-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {solution.icon}
                  </svg>
                </span>
                <div>
                  <h3 className="font-semibold text-ink-900 dark:text-white">{solution.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-600 dark:text-ink-400">
                    {solution.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

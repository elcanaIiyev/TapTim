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
    <section className="border-b-2 border-ink-950 bg-ink-50 py-20 sm:py-24 dark:border-ink-100 dark:bg-ink-900/40">
      <Container>
        <SectionHeading
          index="01"
          overline="Problem & Solution"
          title="Great hackathon ideas die on mismatched teams"
          description="Most participants pick teammates in the first ten minutes, with almost no information. TapTim replaces that scramble with a structured match."
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-5 lg:gap-10">
          {/* The problem panel is inverted — a black block against the paper. */}
          <div className="surface-dark brut-shadow border-2 border-ink-950 bg-ink-950 p-6 lg:col-span-2 dark:border-ink-100">
            <p className="type-label text-flame-500">The problem</p>
            <h3 className="mt-4 text-xl font-bold uppercase tracking-tight text-white">
              Team formation is guesswork
            </h3>
            <ul className="mt-7 divide-y-2 divide-ink-800">
              {PROBLEMS.map((problem, i) => (
                <li key={problem} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <span className="font-mono text-xs font-bold text-flame-500" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm leading-relaxed text-ink-300">{problem}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-1">
            {SOLUTIONS.map((solution) => (
              <Card key={solution.title} className="flex gap-4 sm:items-start">
                <span className="grid h-11 w-11 shrink-0 place-items-center border-2 border-ink-950 bg-flame-600 text-white dark:border-ink-100">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {solution.icon}
                  </svg>
                </span>
                <div>
                  <h3 className="font-bold uppercase tracking-tight text-ink-950 dark:text-white">
                    {solution.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
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

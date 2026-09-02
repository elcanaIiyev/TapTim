import { cn } from '../../lib/cn';
import type { ComponentWeights, FitBand, FocusCoverage } from '../../lib/types';

const BAND_TONE: Record<FitBand, string> = {
  excellent: 'text-success-text',
  strong: 'text-success-text',
  moderate: 'text-signal-warn',
  weak: 'text-signal-bad',
};

/** A labelled bar for one focus area, coloured by how well it is covered. */
export function CoverageBar({
  entry,
  showMatched = true,
}: {
  entry: FocusCoverage;
  showMatched?: boolean;
}) {
  // Three bands rather than a gradient: the point is "covered / thin / not at
  // all", and a continuous colour ramp makes 38 and 44 look meaningfully
  // different when they are not.
  const tone =
    entry.score >= 60
      ? 'bg-fern-500'
      : entry.score >= 25
        ? 'bg-signal-warn-bright'
        : 'bg-signal-bad';

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink-900 dark:text-white">{entry.area}</span>
        <span className="readout text-xs text-ink-600 dark:text-ink-400">
          {entry.score === 0 ? 'not covered' : `${entry.score}%`}
        </span>
      </div>

      <div className="meter-track mt-1.5">
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', tone)}
          style={{ width: `${Math.max(entry.score, entry.score === 0 ? 0 : 4)}%` }}
        />
      </div>

      {showMatched && entry.matched.length > 0 && (
        <p className="mt-1.5 text-xs text-ink-600 dark:text-ink-400">
          {entry.matched.slice(0, 6).join(', ')}
          {entry.matched.length > 6 ? ` +${entry.matched.length - 6}` : ''}
        </p>
      )}
    </div>
  );
}

/** The big headline number for an event fit or team readiness. */
export function FitScore({
  score,
  band,
  label,
}: {
  score: number;
  band: FitBand;
  label: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-iris-500/60"
        style={{ boxShadow: '0 0 20px -4px rgb(124 58 237 / 0.45)' }}
      >
        <span className="readout text-xl font-bold text-ink-900 dark:text-white">{score}</span>
      </div>
      <div className="min-w-0">
        <p className="type-label text-ink-600 dark:text-ink-400">{label}</p>
        <p className={cn('mt-1 text-sm font-bold capitalize', BAND_TONE[band])}>{band} fit</p>
      </div>
    </div>
  );
}

/** How this event re-weights the five scoring components. */
export function WeightBreakdown({ weights }: { weights: ComponentWeights }) {
  const LABELS: Record<string, string> = {
    skills: 'Skills',
    roles: 'Role mix',
    availability: 'Availability',
    workingStyle: 'Working style',
    credibility: 'Credentials',
  };

  const entries = (Object.entries(weights) as Array<[string, number]>).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <p className="type-label text-ink-700 dark:text-ink-300">What this event weights</p>
      <div className="mt-3 space-y-2">
        {entries.map(([key, weight]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs text-ink-600 dark:text-ink-400">
              {LABELS[key] ?? key}
            </span>
            <div className="meter-track">
              {/* Scaled against the largest weight, not against 100 — the bars
                  are there to compare components with each other. */}
              <div
                className="h-full rounded-full bg-iris-500"
                style={{ width: `${(weight / entries[0][1]) * 100}%` }}
              />
            </div>
            <span className="readout w-8 shrink-0 text-right text-xs text-ink-600 dark:text-ink-400">
              {weight}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

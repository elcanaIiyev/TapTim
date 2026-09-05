import { cn } from '../../lib/cn';
import type { SlotCoverage, TeamRisk } from '../../lib/types';

/**
 * What could go wrong here, and when the team can actually meet.
 *
 * The gap report answers "what are we missing". This answers the question
 * people actually ask afterwards, which is never "we needed another backend
 * developer" — it is that nobody was online at the same time, or everyone
 * wanted to lead and nobody wanted to plan, or the whole thing rested on one
 * person who then disappeared.
 *
 * Every risk shows its evidence, because a warning nobody can check is a
 * warning people learn to scroll past.
 */

const SEVERITY: Record<TeamRisk['severity'], { label: string; ring: string; dot: string }> = {
  high: {
    label: 'Worth fixing now',
    ring: 'border-signal-bad/40 bg-signal-bad/5',
    dot: 'bg-signal-bad',
  },
  medium: {
    label: 'Worth agreeing on',
    ring: 'border-signal-warn/40 bg-signal-warn/5',
    dot: 'bg-signal-warn',
  },
  low: {
    label: 'Worth knowing',
    ring: 'border-ink-200 dark:border-ink-700',
    dot: 'bg-ink-400',
  },
};

/**
 * The week as six cells, shaded by how many of the team can make each.
 *
 * Availability was already stored as discrete slots and already intersected for
 * scoring — this just stops it being a number nobody can act on. A team looking
 * at "2/4 on weekday evenings" can schedule around it; a team looking at an
 * availability sub-score cannot.
 */
function WeekGrid({ slots, size }: { slots: SlotCoverage[]; size: number }) {
  const weekday = slots.filter((slot) => slot.slot.startsWith('weekday'));
  const weekend = slots.filter((slot) => slot.slot.startsWith('weekend'));

  const Cell = ({ slot }: { slot: SlotCoverage }) => {
    const everyone = size > 0 && slot.count === size;
    const share = size > 0 ? slot.count / size : 0;

    return (
      <div
        // The names are the useful part and there is no room for them, so they
        // go in the tooltip rather than being dropped.
        title={slot.who.length > 0 ? slot.who.join(', ') : 'Nobody'}
        className={cn(
          'rounded-[var(--radius-soft-sm)] border px-3 py-2.5 text-center',
          everyone
            ? 'border-fern-600 bg-fern-600/15'
            : share >= 0.5
              ? 'border-ink-200 bg-fern-600/[0.06] dark:border-ink-700'
              : 'border-ink-200 dark:border-ink-700',
        )}
      >
        <p className="readout text-sm font-bold tabular-nums text-ink-900 dark:text-white">
          {slot.count}
          <span className="text-ink-500 dark:text-ink-400">/{size}</span>
        </p>
        <p className="mt-0.5 text-[0.65rem] leading-tight text-ink-600 dark:text-ink-400">
          {slot.label.replace('weekday ', '').replace('weekend ', '')}
        </p>
      </div>
    );
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[
        { title: 'Weekdays', cells: weekday },
        { title: 'Weekends', cells: weekend },
      ].map((group) => (
        <div key={group.title}>
          <p className="type-label mb-2 text-[0.7rem] text-ink-500 dark:text-ink-400">
            {group.title}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {group.cells.map((slot) => (
              <Cell key={slot.slot} slot={slot} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TeamRisks({
  risks,
  availability,
  size,
}: {
  risks: TeamRisk[];
  availability: SlotCoverage[];
  size: number;
}) {
  const everyone = availability.filter((slot) => slot.count === size && size > 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="type-label text-ink-700 dark:text-ink-300">What could go wrong here</h3>
        <p className="mt-1.5 text-xs text-ink-600 dark:text-ink-400">
          Read from availability, working style and the roster — not from missing skills, which
          the brief covers. Nothing is raised on data nobody has filled in.
        </p>

        {risks.length === 0 ? (
          <p className="mt-4 rounded-[var(--radius-soft-sm)] border border-fern-600/40 bg-fern-600/5 px-4 py-3 text-sm text-ink-700 dark:text-ink-200">
            Nothing stands out. Overlapping hours, working styles and cover all look workable —
            which is not a promise, just an absence of the usual warning signs.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {risks.map((risk) => {
              const tone = SEVERITY[risk.severity];
              return (
                <li
                  key={risk.id}
                  className={cn('rounded-[var(--radius-soft-sm)] border px-4 py-3', tone.ring)}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', tone.dot)}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900 dark:text-white">{risk.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
                        {risk.detail}
                      </p>
                      {risk.suggestion && (
                        <p className="mt-1.5 text-sm font-medium text-accent-text">
                          {risk.suggestion}
                        </p>
                      )}
                    </div>
                    <span className="type-label ml-auto hidden shrink-0 text-[0.65rem] text-ink-500 sm:block dark:text-ink-400">
                      {tone.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-ink-200 pt-5 dark:border-ink-700">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="type-label text-ink-700 dark:text-ink-300">When you can all meet</h3>
          <p className="text-xs text-ink-600 dark:text-ink-400">
            {everyone.length === 0
              ? 'No slot works for everyone.'
              : `Everyone: ${everyone.map((slot) => slot.label).join(', ')}.`}
          </p>
        </div>
        <WeekGrid slots={availability} size={size} />
      </div>
    </div>
  );
}

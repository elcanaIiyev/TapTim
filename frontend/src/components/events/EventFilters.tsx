import { cn } from '../../lib/cn';
import type { EventFacets } from '../../lib/types';

/**
 * Two filter axes, because events genuinely have two.
 *
 * The old single row mixed them: "Hackathons" is a *format* and "Design" is a
 * *domain*, so a design hackathon had nowhere to sit. Filed under Hackathons it
 * was invisible to every designer browsing Design; filed under Design it lied
 * about what kind of event it was. Splitting the row is the whole fix — the two
 * questions get asked separately and can be combined.
 *
 * Format is single-select (an event runs one way). Domains are multi-select and
 * match on *any*, so picking Design and Web3 asks for everything touching
 * either — which is what someone browsing for work they could do actually
 * means.
 */

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      // An empty facet stays visible but is visibly dead, so the bar keeps its
      // shape as data comes and goes rather than reflowing under the cursor.
      disabled={count === 0 && !active}
      className={cn(
        'type-tag cursor-pointer rounded-full border px-3.5 py-2 transition-colors duration-200',
        active
          ? 'border-ink-950 bg-iris-600 text-white dark:border-ink-700'
          : 'border-ink-950 bg-white text-ink-700 hover:bg-ink-950 hover:text-ink-50 ' +
              'dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-100 dark:hover:text-ink-900',
        count === 0 && !active && 'cursor-not-allowed opacity-40 hover:bg-white hover:text-ink-700',
      )}
    >
      {label}
      {count > 0 && (
        <span className={cn('ml-2 font-bold', active ? 'opacity-60' : 'opacity-50')}>{count}</span>
      )}
    </button>
  );
}

export function EventFilters({
  facets,
  format,
  domains,
  onFormatChange,
  onDomainsChange,
  total,
}: {
  facets: EventFacets | null;
  format: string;
  domains: string[];
  onFormatChange: (next: string) => void;
  onDomainsChange: (next: string[]) => void;
  total: number;
}) {
  const toggleDomain = (domain: string) => {
    onDomainsChange(
      domains.includes(domain) ? domains.filter((d) => d !== domain) : [...domains, domain],
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="type-label mb-2.5 text-[0.7rem] text-ink-500 dark:text-ink-400">
          Format — how it runs
        </p>
        <div role="tablist" aria-label="Event format" className="flex flex-wrap gap-2">
          <Chip
            label="Any format"
            count={total}
            active={format === 'All'}
            onClick={() => onFormatChange('All')}
          />
          {(facets?.formats ?? []).map((entry) => (
            <Chip
              key={entry.name}
              label={entry.name}
              count={entry.count}
              active={format === entry.name}
              onClick={() => onFormatChange(format === entry.name ? 'All' : entry.name)}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
          <p className="type-label text-[0.7rem] text-ink-500 dark:text-ink-400">
            Focus — what it is about
          </p>
          {domains.length > 0 && (
            <button
              type="button"
              onClick={() => onDomainsChange([])}
              className="cursor-pointer font-mono text-xs font-semibold text-accent-text underline-offset-4 hover:underline"
            >
              Clear {domains.length}
            </button>
          )}
        </div>

        <div role="tablist" aria-label="Event focus" className="flex flex-wrap gap-2">
          {(facets?.domains ?? []).map((entry) => (
            <Chip
              key={entry.name}
              label={entry.name}
              count={entry.count}
              active={domains.includes(entry.name)}
              onClick={() => toggleDomain(entry.name)}
            />
          ))}
        </div>

        {domains.length > 1 && (
          // Said out loud because "matches any" is the less obvious reading, and
          // getting it backwards makes the result look broken.
          <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
            Showing events touching <strong>any</strong> of these.
          </p>
        )}
      </div>
    </div>
  );
}

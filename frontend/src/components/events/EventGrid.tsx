import type { EventItem } from '../../lib/types';
import { cn } from '../../lib/cn';
import { fittedGrid } from '../../lib/grid';
import { EventCard } from './EventCard';

interface EventGridProps {
  events: EventItem[];
  loading: boolean;
  error: string | null;
  skeletonCount?: number;
}

function SkeletonCard() {
  return (
    <div className="panel panel-soft animate-pulse space-y-4 p-6">
      <div className="h-5 w-24 rounded bg-ink-200 dark:bg-ink-800" />
      <div className="h-6 w-3/4 rounded bg-ink-200 dark:bg-ink-800" />
      <div className="space-y-2">
        <div className="h-3 rounded bg-ink-200 dark:bg-ink-800" />
        <div className="h-3 w-5/6 rounded bg-ink-200 dark:bg-ink-800" />
      </div>
      <div className="h-20 rounded bg-ink-100 dark:bg-ink-800/60" />
    </div>
  );
}

/** Shared shell for the error and empty states — a framed block on washing. */
function StatePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-soft)] border border-ink-200 dark:border-ink-700">
      <div className="wash pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative px-6 py-14 text-center">
        <p className="type-section text-ink-900 dark:text-white">{title}</p>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          {children}
        </p>
      </div>
    </div>
  );
}

export function EventGrid({ events, loading, error, skeletonCount = 6 }: EventGridProps) {
  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: skeletonCount }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return <StatePanel title="Could not load events">{error}</StatePanel>;
  }

  if (events.length === 0) {
    return (
      <StatePanel title="Nothing matches">
        No events fit these filters. Try a different category or clear your search.
      </StatePanel>
    );
  }

  // The grid narrows to what is in it — a filter that matches one event should
  // not render a card in the corner of two empty columns. See `lib/grid`.
  return (
    <div className={cn('grid gap-6', fittedGrid(events.length))}>
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

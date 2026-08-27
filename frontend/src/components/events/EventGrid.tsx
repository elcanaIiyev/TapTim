import type { EventItem } from '../../lib/types';
import { Card } from '../ui/Card';
import { EventCard } from './EventCard';

interface EventGridProps {
  events: EventItem[];
  loading: boolean;
  error: string | null;
  skeletonCount?: number;
}

function SkeletonCard() {
  return (
    <Card className="animate-pulse space-y-4">
      <div className="h-6 w-24 rounded-full bg-ink-200 dark:bg-ink-800" />
      <div className="h-5 w-3/4 rounded bg-ink-200 dark:bg-ink-800" />
      <div className="space-y-2">
        <div className="h-3 rounded bg-ink-200 dark:bg-ink-800" />
        <div className="h-3 w-5/6 rounded bg-ink-200 dark:bg-ink-800" />
      </div>
      <div className="h-20 rounded bg-ink-100 dark:bg-ink-800/60" />
    </Card>
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
    return (
      <Card className="mx-auto max-w-md text-center">
        <p className="font-semibold text-ink-900 dark:text-white">Could not load events</p>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">{error}</p>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <p className="font-semibold text-ink-900 dark:text-white">No events match your filters</p>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">
          Try a different category or clear your search.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

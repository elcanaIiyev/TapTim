import { cn } from '../../lib/cn';
import { formatDateRange, formatParticipants, formatTeamSize } from '../../lib/format';
import type { EventItem } from '../../lib/types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

const MODE_LABEL: Record<EventItem['mode'], string> = {
  onsite: 'On-site',
  online: 'Online',
  hybrid: 'Hybrid',
};

function MetaRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 font-mono text-xs text-ink-700 dark:text-ink-300">
      <span className="text-accent-text">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

const iconProps = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function EventCard({ event }: { event: EventItem }) {
  return (
    <Card interactive className="group relative flex h-full flex-col overflow-hidden">
      {/* Featured cards get a solid accent rail so they read at a glance. */}
      {event.featured && (
        <span className="absolute inset-x-0 top-0 h-2 bg-iris-600" aria-hidden="true" />
      )}

      <div className={cn('flex items-start justify-between gap-3', event.featured && 'mt-2')}>
        <Badge tone="brand">{event.category}</Badge>
        {event.featured && (
          <Badge tone="accent">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
            </svg>
            Featured
          </Badge>
        )}
      </div>

      <h3 className="mt-5 text-lg font-bold leading-snug tracking-tight text-ink-900 dark:text-white">
        {event.name}
      </h3>
      <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
        {event.description}
      </p>

      <div className="mt-5 space-y-2.5">
        <MetaRow
          icon={
            <svg {...iconProps}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          }
        >
          {formatDateRange(event.startDate, event.endDate)}
        </MetaRow>
        <MetaRow
          icon={
            <svg {...iconProps}>
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          }
        >
          {event.location} · {MODE_LABEL[event.mode]}
        </MetaRow>
        <MetaRow
          icon={
            <svg {...iconProps}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        >
          Team of {formatTeamSize(event.teamSize)}
        </MetaRow>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5 border-t-2 border-ink-200 pt-5 dark:border-ink-800">
        {event.tags.map((tag) => (
          <Badge key={tag} tone="neutral">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-ink-200 pt-5 dark:border-ink-700">
        <div>
          {event.prizePool && (
            <p className="font-mono text-lg font-bold tracking-tight text-ink-900 dark:text-white">
              {event.prizePool}
            </p>
          )}
          <p className="type-label mt-0.5 text-ink-600 dark:text-ink-400">
            {formatParticipants(event.participants)} joined
          </p>
        </div>
        <Button size="sm" variant="outline" to="/events">
          View details
        </Button>
      </div>
    </Card>
  );
}

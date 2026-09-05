import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { formatDateRange, formatParticipants, formatTeamSize } from '../../lib/format';
import type { EventItem } from '../../lib/types';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { EventCover } from './EventCover';

/**
 * One event in the catalogue.
 *
 * Rebuilt around a cover image. The previous card was three stacked text blocks
 * and a tag row, which meant a grid of thirteen was a wall of near-identical
 * rectangles — nothing to catch the eye and nothing to tell two hackathons apart
 * at a glance. The image does the separating; the text below it only has to
 * carry what someone actually decides on.
 *
 * The whole card is one link. Two competing targets (a title link and a "View
 * details" button) doubled the tab stops and made the obvious click — anywhere
 * on the card — do nothing.
 */

const MODE_LABEL: Record<EventItem['mode'], string> = {
  onsite: 'On-site',
  online: 'Online',
  hybrid: 'Hybrid',
};

const iconProps = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function MetaRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 font-mono text-xs text-ink-700 dark:text-ink-300">
      <span className="shrink-0 text-accent-text">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}

export function EventCard({ event }: { event: EventItem }) {
  return (
    <Card
      interactive
      padded={false}
      className="group relative flex h-full flex-col overflow-hidden focus-within:ring-2 focus-within:ring-iris-500"
    >
      <div className="relative">
        <EventCover
          name={event.name}
          category={event.category}
          src={event.coverImageUrl}
          className="h-40 w-full"
        />

        {/* Over the image rather than above it — the badges belong to the photo,
            and putting them here buys the text block below more room. */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <span className="rounded-full bg-black/55 px-2.5 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
            {event.category}
          </span>
          {event.featured && (
            <span className="flex items-center gap-1 rounded-full bg-fern-600 px-2.5 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-white">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
              </svg>
              Featured
            </span>
          )}
        </div>

        {event.prizePool && (
          <p className="absolute bottom-3 right-3 font-mono text-base font-bold tracking-tight text-white drop-shadow">
            {event.prizePool}
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-bold leading-snug tracking-tight text-ink-900 dark:text-white">
          {/* `after:absolute inset-0` stretches this link across the whole card,
              so the card is clickable while the accessible name stays the title
              rather than becoming every word inside it. */}
          <Link
            to={`/events/${event.id}`}
            className="after:absolute after:inset-0 after:content-[''] focus:outline-none"
          >
            {event.name}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          {event.description}
        </p>

        <div className="mt-4 space-y-2">
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

        {event.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {/* Capped at three: the fourth pushed cards to uneven heights and
                added nothing anyone filters on from here. */}
            {event.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} tone="neutral">
                {tag}
              </Badge>
            ))}
            {event.tags.length > 3 && (
              <Badge tone="neutral">+{event.tags.length - 3}</Badge>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-ink-200 pt-4 dark:border-ink-700">
          <p className="type-label text-ink-600 dark:text-ink-400">
            {formatParticipants(event.participants)} joined
          </p>
          <span
            aria-hidden="true"
            className={cn(
              'flex items-center gap-1 font-mono text-xs font-semibold text-iris-700 dark:text-iris-400',
              'transition-transform duration-200 group-hover:translate-x-0.5',
            )}
          >
            Details
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
        </div>
      </div>
    </Card>
  );
}

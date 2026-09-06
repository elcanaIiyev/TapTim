import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TeamLogo } from '../components/teams/TeamLogo';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Spinner } from '../components/ui/Spinner';
import { cn } from '../lib/cn';
import { eventsApi, teamsApi } from '../lib/api';
import { formatDate } from '../lib/format';
import type { EventItem, Team } from '../lib/types';

/**
 * Teams with a seat open, across every event.
 *
 * The public recruiting page has existed since teams could publish one, but the
 * only way to reach it was a link somebody sent you — which meant the feature
 * worked perfectly for teams that already had someone's attention, and not at
 * all for anyone browsing. This is the other half of it.
 *
 * It inverts the events list rather than repeating it. /events answers "what is
 * on"; this answers "who needs me", which is the question somebody without a
 * team is actually asking, and it needs no account to answer.
 *
 * Ordered by how soon the event starts. A team recruiting for something three
 * weeks out has time; one recruiting for this weekend does not, and urgency is
 * the only ranking here that reflects a real constraint rather than a guess.
 */

interface Listing {
  team: Team;
  event: EventItem;
}

export function RecruitingPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [teams, events] = await Promise.all([
          teamsApi.list({ status: 'recruiting', hasOpenSeats: true }),
          eventsApi.list({ limit: 50 }),
        ]);
        if (cancelled) return;

        const byId = new Map(events.data.map((event) => [event.id, event]));
        const now = Date.now();

        const rows = teams.data
          .map((team) => {
            const event = byId.get(team.eventId);
            return event ? { team, event } : null;
          })
          .filter((row): row is Listing => row !== null)
          // A team still marked "recruiting" for an event that has already
          // finished is stale data, not an opportunity. Nobody can join it.
          .filter((row) => Date.parse(row.event.endDate) >= now)
          .sort((a, b) => Date.parse(a.event.startDate) - Date.parse(b.event.startDate));

        setListings(rows);
      } catch {
        if (!cancelled) setError('Could not load the teams that are recruiting.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Only roles and events that some listing actually has — no empty filters. */
  const roles = useMemo(
    () => [...new Set(listings.flatMap((row) => row.team.lookingFor))].sort(),
    [listings],
  );
  const events = useMemo(() => {
    const map = new Map<string, EventItem>();
    for (const row of listings) map.set(row.event.id, row.event);
    return [...map.values()];
  }, [listings]);

  const shown = listings.filter(
    (row) =>
      (!role || row.team.lookingFor.includes(role)) && (!eventId || row.event.id === eventId),
  );

  return (
    <Container className="py-12">
      <SectionHeading
        overline="Open seats"
        index="03"
        title="Teams looking for someone"
        description="Every team here has a seat open and has said what it is short of. Soonest event first — the ones at the top are deciding this week."
      />

      {loading ? (
        <div className="panel panel-soft mt-9 flex items-center gap-3 px-6 py-14">
          <Spinner className="text-iris-600 dark:text-iris-400" />
          <span className="text-sm text-ink-600 dark:text-ink-300">Loading…</span>
        </div>
      ) : error ? (
        <p role="alert" className="mt-9 text-sm font-medium text-signal-bad">
          {error}
        </p>
      ) : listings.length === 0 ? (
        <div className="panel panel-soft mt-9 px-6 py-14 text-center">
          <p className="type-label text-ink-600 dark:text-ink-400">Nobody is recruiting yet</p>
          <p className="mx-auto mt-3 max-w-sm text-sm text-ink-600 dark:text-ink-300">
            Teams appear here the moment one opens a seat. Until then, the fastest route to a
            team is to pick an event and start one.
          </p>
          <Button className="mt-7" to="/events">
            Browse events
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-9 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRole(null);
                setEventId(null);
              }}
              className={cn(
                'type-label cursor-pointer rounded-full border px-4 py-2 transition-colors',
                !role && !eventId
                  ? 'border-iris-600 bg-iris-600 text-white'
                  : 'border-ink-300 text-ink-600 hover:border-iris-500 hover:text-accent-text dark:border-ink-700 dark:text-ink-400',
              )}
            >
              All {listings.length}
            </button>

            {roles.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setRole((current) => (current === entry ? null : entry))}
                className={cn(
                  'type-label cursor-pointer rounded-full border px-4 py-2 transition-colors',
                  role === entry
                    ? 'border-iris-600 bg-iris-600 text-white'
                    : 'border-ink-300 text-ink-600 hover:border-iris-500 hover:text-accent-text dark:border-ink-700 dark:text-ink-400',
                )}
              >
                {entry}
              </button>
            ))}

            {events.length > 1 && (
              <select
                value={eventId ?? ''}
                onChange={(e) => setEventId(e.target.value || null)}
                aria-label="Filter by event"
                className="type-label cursor-pointer rounded-full border border-ink-300 bg-white px-4 py-2 text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300"
              >
                <option value="">Every event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {shown.length === 0 ? (
            <p className="mt-8 text-sm text-ink-600 dark:text-ink-300">
              No team is looking for that right now.
            </p>
          ) : (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map(({ team, event }) => (
                <li key={team.id}>
                  <Link
                    to={`/r/${team.id}`}
                    className="press panel panel-soft flex h-full flex-col p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-iris-500"
                  >
                    <div className="flex items-start gap-3">
                      <TeamLogo name={team.name} src={team.logoUrl} className="h-11 w-11" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink-900 dark:text-white">
                          {team.name}
                        </p>
                        <p className="truncate text-xs text-ink-600 dark:text-ink-400">
                          {event.name}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-600 dark:text-ink-400">
                      <span>
                        <strong className="readout text-accent-text">{team.openSeats}</strong>{' '}
                        {team.openSeats === 1 ? 'seat' : 'seats'} open
                      </span>
                      <span>{formatDate(event.startDate)}</span>
                    </div>

                    {team.description && (
                      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
                        {team.description}
                      </p>
                    )}

                    {team.lookingFor.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {team.lookingFor.slice(0, 3).map((entry) => (
                          <Badge key={entry} tone="warning">
                            {entry}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <span className="type-label mt-auto pt-4 text-accent-text">
                      See the team →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Container>
  );
}

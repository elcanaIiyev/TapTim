import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { PersonAvatar, PersonLink } from '../components/people/PersonLink';
import { TeamLogo } from '../components/teams/TeamLogo';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { ApiError, eventsApi, teamsApi } from '../lib/api';
import { formatDate, formatDateRange } from '../lib/format';
import type { EventItem, Team, TeamRequest } from '../lib/types';

/**
 * The teams you are already on, one per event — and every request still open
 * in either direction.
 *
 * Creating and browsing teams happens on each event's page, because a team
 * belongs to an event. This is the overview: what am I signed up for, what is
 * waiting on me, and what am I waiting on.
 */

function since(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return formatDate(iso);
}

function TeamName({ request }: { request: TeamRequest }) {
  return (
    <Link
      to={`/teams/${request.team.id}`}
      className="font-semibold text-ink-900 underline-offset-4 hover:text-accent-text hover:underline dark:text-white"
    >
      {request.team.name}
    </Link>
  );
}

function RequestRow({
  request,
  children,
  actions,
}: {
  request: TeamRequest;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-soft-sm)] border border-ink-200 px-4 py-3 dark:border-ink-700">
      <div className="flex min-w-0 items-center gap-3">
        <TeamLogo name={request.team.name} src={request.team.logoUrl} className="h-9 w-9" />
        <div className="min-w-0">
          <p className="text-sm text-ink-700 dark:text-ink-200">{children}</p>
          <p className="readout mt-0.5 text-[0.7rem] text-ink-500 dark:text-ink-400">
            {since(request.createdAt)}
          </p>
          {request.message && (
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">“{request.message}”</p>
          )}
        </div>
      </div>
      <div className="flex gap-2">{actions}</div>
    </li>
  );
}

export function TeamsPage() {
  const { user, initialising } = useAuth();

  const [teams, setTeams] = useState<Team[]>([]);
  const [events, setEvents] = useState<Map<string, EventItem>>(new Map());
  const [incoming, setIncoming] = useState<TeamRequest[]>([]);
  const [outgoing, setOutgoing] = useState<TeamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyRequest, setBusyRequest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mine, waitingOnMe, raisedByMe] = await Promise.all([
        teamsApi.list({ mine: true }),
        teamsApi.requests('incoming').catch(() => []),
        teamsApi.requests('outgoing').catch(() => []),
      ]);
      setTeams(mine.data);
      setIncoming(waitingOnMe);
      setOutgoing(raisedByMe);

      // Each team names only its event id, and the page wants the event's name
      // and dates. Fetched once per distinct event rather than per team.
      const ids = [...new Set(mine.data.map((team) => team.eventId))];
      const loaded = await Promise.all(ids.map((id) => eventsApi.byId(id).catch(() => null)));
      setEvents(
        new Map(
          loaded.filter((event): event is EventItem => event !== null).map((e) => [e.id, e]),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  if (initialising) {
    return (
      <Container className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="text-iris-600 dark:text-iris-400" />
      </Container>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const respond = async (id: string, action: 'accept' | 'decline' | 'cancel') => {
    setBusyRequest(id);
    setError(null);
    try {
      await teamsApi.respond(id, action);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not go through.');
    } finally {
      setBusyRequest(null);
    }
  };

  const invitesSent = outgoing.filter((request) => request.kind === 'invite');
  const applicationsSent = outgoing.filter((request) => request.kind === 'application');

  return (
    <Container className="py-12">
      <SectionHeading
        overline="Your teams"
        title="Where you're signed up"
        description="One team per event. Creating and finding teams happens on each event's page, because a team only means something in the context of the event it's for."
      />

      {error && (
        <p role="alert" className="mt-6 text-sm font-medium text-signal-bad">
          {error}
        </p>
      )}

      {/* -- waiting on you -------------------------------------------------- */}
      {incoming.length > 0 && (
        <section className="hud hud-ticks relative mt-9 overflow-hidden p-6">
          <div className="grid-floor pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
          <div className="relative">
            <h2 className="type-label text-accent-text">Waiting on you</h2>
            <ul className="mt-4 space-y-3">
              {incoming.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  actions={
                    <>
                      <Button
                        size="sm"
                        disabled={busyRequest === request.id}
                        onClick={() => void respond(request.id, 'accept')}
                      >
                        {busyRequest === request.id && <Spinner />}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyRequest === request.id}
                        onClick={() => void respond(request.id, 'decline')}
                      >
                        Decline
                      </Button>
                    </>
                  }
                >
                  {request.kind === 'invite' ? (
                    <>
                      <TeamName request={request} /> invited you to join
                    </>
                  ) : request.user ? (
                    <>
                      <PersonLink person={request.user} /> asked to join <TeamName request={request} />
                    </>
                  ) : (
                    <>
                      Someone asked to join <TeamName request={request} />
                    </>
                  )}
                </RequestRow>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* -- the teams ------------------------------------------------------- */}
      <div className="mt-9">
        {loading ? (
          <div className="panel panel-soft flex items-center gap-3 px-6 py-14">
            <Spinner className="text-iris-600 dark:text-iris-400" />
            <span className="text-sm text-ink-600 dark:text-ink-300">Loading your teams…</span>
          </div>
        ) : teams.length === 0 ? (
          <div className="panel panel-soft px-6 py-14 text-center">
            <p className="type-label text-ink-600 dark:text-ink-400">No teams yet</p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600 dark:text-ink-300">
              Teams are formed per event. Pick one you want to enter and either start a team or ask
              to join one that has room.
            </p>
            <Button to="/events" className="mt-7 pulse-cta">
              Browse events
            </Button>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {teams.map((team) => {
              const event = events.get(team.eventId);
              const invitedHere = invitesSent.filter((request) => request.teamId === team.id).length;
              return (
                <li key={team.id} className="hud hud-ticks relative overflow-hidden p-6">
                  <div className="grid-floor pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
                  <div className="relative">
                    {event && (
                      <Link
                        to={`/events/${event.id}`}
                        className="type-label text-accent-text underline decoration-2 underline-offset-4"
                      >
                        {event.name}
                      </Link>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <TeamLogo name={team.name} src={team.logoUrl} className="h-9 w-9" />
                      <Link
                        to={`/teams/${team.id}`}
                        className="text-lg font-bold text-ink-900 underline decoration-2 underline-offset-4 hover:text-accent-text dark:text-white"
                      >
                        {team.name}
                      </Link>
                      {team.ownerId === user.id && <Badge tone="brand">You own this</Badge>}
                      {(team.unread ?? 0) > 0 && (
                        <Badge tone="accent">
                          {team.unread} new {team.unread === 1 ? 'message' : 'messages'}
                        </Badge>
                      )}
                    </div>

                    {event && (
                      <p className="readout mt-2 text-xs text-ink-500 dark:text-ink-400">
                        {formatDateRange(event.startDate, event.endDate)} · {event.location}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">
                        {team.memberCount}/{team.maxSize} members
                      </Badge>
                      {team.openSeats > 0 ? (
                        <Badge tone="success">{team.openSeats} open</Badge>
                      ) : (
                        <Badge tone="neutral">Full</Badge>
                      )}
                      {invitedHere > 0 && (
                        <Badge tone="warning">
                          {invitedHere} invite{invitedHere === 1 ? '' : 's'} pending
                        </Badge>
                      )}
                    </div>

                    <Button size="sm" variant="outline" className="mt-5" to={`/teams/${team.id}`}>
                      {team.ownerId === user.id ? 'Manage team' : 'View team'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* -- sent by you, not yet answered ------------------------------------- */}
      {!loading && (invitesSent.length > 0 || applicationsSent.length > 0) && (
        <section className="mt-9">
          <h2 className="type-label text-ink-700 dark:text-ink-300">Sent by you, waiting for an answer</h2>
          <p className="mt-1.5 text-sm text-ink-600 dark:text-ink-400">
            Nothing here has been answered yet. Withdrawing one lets the other person off the hook
            and frees you to ask someone else.
          </p>

          <ul className="mt-4 space-y-3">
            {invitesSent.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                actions={
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyRequest === request.id}
                    onClick={() => void respond(request.id, 'cancel')}
                  >
                    Withdraw
                  </Button>
                }
              >
                {request.user ? (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    You invited
                    <PersonAvatar person={request.user} size={20} link />
                    <PersonLink person={request.user} /> to <TeamName request={request} />
                  </span>
                ) : (
                  <>
                    You invited someone to <TeamName request={request} />
                  </>
                )}
              </RequestRow>
            ))}

            {applicationsSent.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                actions={
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyRequest === request.id}
                    onClick={() => void respond(request.id, 'cancel')}
                  >
                    Withdraw
                  </Button>
                }
              >
                You asked to join <TeamName request={request} />
              </RequestRow>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}

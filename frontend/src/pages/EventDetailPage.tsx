import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CoverageBar, FitScore, WeightBreakdown } from '../components/events/FitMeter';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { ApiError, eventsApi, teamsApi } from '../lib/api';
import { formatDateRange, formatParticipants, formatTeamSize } from '../lib/format';
import type { EventItem, EventStats, MyEventFit, Team } from '../lib/types';
import { NotFoundPage } from './NotFoundPage';

/**
 * One event, and everything about forming a team for it.
 *
 * Team creation and discovery live here rather than in a global teams area
 * because a team belongs to exactly one event — the database enforces one team
 * per person per event — so "make a team" only means anything once you have
 * said which event you mean.
 */

function Panel({
  title,
  hint,
  children,
  tone = 'plain',
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  tone?: 'plain' | 'accent';
}) {
  return (
    <section className="hud hud-ticks relative overflow-hidden p-6 sm:p-7">
      <div className="grid-floor pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
      <div className="relative">
        <h2 className={tone === 'accent' ? 'type-label text-accent-text' : 'type-label text-ink-700 dark:text-ink-300'}>
          {title}
        </h2>
        {hint && <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{hint}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}

function CreateTeamForm({
  eventId,
  maxSize,
  onCreated,
}: {
  eventId: string;
  maxSize: number;
  /** Receives the new team, so the caller can go straight to it. */
  onCreated: (teamId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [size, setSize] = useState(Math.min(4, maxSize));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="pulse-cta">
        Start a team for this event
      </Button>
    );
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const created = await teamsApi.create({
            eventId,
            name: name.trim(),
            description: description.trim() || null,
            maxSize: size,
          });
          setOpen(false);
          setName('');
          setDescription('');
          onCreated(created.id);
        } catch (caught) {
          setError(caught instanceof ApiError ? caught.message : 'Could not create that team.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <Input
        label="Team name"
        placeholder="Kernel Panic"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        required
      />
      <Input
        label="What are you building?"
        placeholder="A real-time ops dashboard."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        hint="Optional, but teams with one get more applications."
      />
      <Input
        label="Team size"
        type="number"
        min={2}
        max={maxSize}
        value={String(size)}
        onChange={(e) => setSize(Number(e.target.value) || 2)}
        hint={`This event allows up to ${maxSize}.`}
      />

      {error && (
        <p role="alert" className="text-sm font-medium text-signal-bad">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || name.trim().length < 3}>
          {busy && <Spinner />}
          Create team
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function TeamRow({
  team,
  isMine,
  onJoined,
}: {
  team: Team;
  isMine: boolean;
  onJoined: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'idle' | 'applied'>('idle');
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="panel panel-soft-sm p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/teams/${team.id}`}
              className="font-semibold text-ink-900 underline decoration-2 underline-offset-4 hover:text-accent-text dark:text-white"
            >
              {team.name}
            </Link>
            {isMine && <Badge tone="brand">Your team</Badge>}
            {team.openSeats === 0 && <Badge tone="neutral">Full</Badge>}
          </div>
          {team.description && (
            <p className="mt-1.5 text-sm text-ink-600 dark:text-ink-300">{team.description}</p>
          )}
          <p className="readout mt-2 text-xs text-ink-500 dark:text-ink-400">
            {team.memberCount}/{team.maxSize} members · {team.openSeats} open
          </p>
        </div>

        {!isMine && team.openSeats > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || state === 'applied'}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await teamsApi.apply(team.id, null);
                setState('applied');
                onJoined();
              } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : 'Could not apply.');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner />}
            {state === 'applied' ? 'Requested' : 'Ask to join'}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-signal-bad">
          {error}
        </p>
      )}
    </li>
  );
}

export function EventDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [fit, setFit] = useState<MyEventFit | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [detail, statsData, teamList] = await Promise.all([
        eventsApi.byId(id),
        eventsApi.stats(id),
        teamsApi.list({ eventId: id }),
      ]);
      setEvent(detail);
      setStats(statsData);
      setTeams(teamList.data);

      // Only meaningful for a signed-in person, and it is the one call that
      // needs a session — kept separate so a signed-out visitor still gets the
      // whole page rather than an error.
      if (user) setFit(await eventsApi.myFit(id).catch(() => null));
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (missing) return <NotFoundPage />;

  if (loading || !event || !stats) {
    return (
      <Container className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="text-iris-600 dark:text-iris-400" />
      </Container>
    );
  }

  const myTeam = teams.find((team) => team.id === fit?.myTeamId);

  return (
    <Container className="py-12">
      {/* -- the event ------------------------------------------------------ */}
      <div className="hud hud-ticks relative overflow-hidden p-6 sm:p-8">
        <div className="grid-floor pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{event.category}</Badge>
            <Badge tone="neutral">{event.mode}</Badge>
            {event.featured && <Badge tone="accent">Featured</Badge>}
          </div>

          <h1 className="type-display mt-4 text-ink-900 dark:text-white">{event.name}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-600 dark:text-ink-300">
            {event.description}
          </p>

          <dl className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['When', formatDateRange(event.startDate, event.endDate)],
              ['Where', event.location],
              ['Teams', formatTeamSize(event.teamSize)],
              ['Signed up', formatParticipants(event.participants)],
              ['Prize pool', event.prizePool ?? '—'],
              ['Teams formed', String(stats.teamCount)],
              ['Still recruiting', String(stats.openTeams)],
              ['On a team', String(stats.participantsOnTeams)],
            ].map(([label, value]) => (
              <div key={label} className="panel panel-soft-sm px-4 py-3">
                <dt className="type-label text-ink-600 dark:text-ink-400">{label}</dt>
                <dd className="readout mt-1 text-sm font-semibold text-ink-900 dark:text-white">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* -- what the event rewards --------------------------------------- */}
        <Panel title="What this event rewards" hint={stats.profile.summary} tone="accent">
          <div className="space-y-6">
            <div>
              <p className="type-label text-ink-700 dark:text-ink-300">Skill areas that count</p>
              <ol className="mt-3 space-y-1.5">
                {stats.profile.focusAreas.map((area, index) => (
                  <li key={area} className="flex items-center gap-2.5 text-sm">
                    <span className="readout grid h-5 w-5 place-items-center rounded-full border border-iris-500 text-[10px] font-bold text-accent-text">
                      {index + 1}
                    </span>
                    <span className="text-ink-800 dark:text-ink-200">{area}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
                Listed most important first — the first area counts for the most.
              </p>
            </div>

            <div>
              <p className="type-label text-ink-700 dark:text-ink-300">Roles a team here needs</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {stats.profile.keyRoles.map((role) => (
                  <Badge key={role} tone="neutral">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>

            <WeightBreakdown weights={stats.profile.weights} />
          </div>
        </Panel>

        {/* -- my stat sheet for this event ---------------------------------- */}
        <Panel
          title="Your stat sheet for this event"
          hint={
            user
              ? 'Your profile, measured against what this event actually asks for.'
              : undefined
          }
        >
          {!user ? (
            <div className="text-sm text-ink-600 dark:text-ink-300">
              <p>Sign in to see how your profile measures up against this event.</p>
              <Button to="/login" className="mt-5">
                Log in
              </Button>
            </div>
          ) : !fit ? (
            <div className="flex items-center gap-3 text-sm text-ink-600 dark:text-ink-300">
              <Spinner className="text-iris-600 dark:text-iris-400" />
              Working it out…
            </div>
          ) : (
            <div className="space-y-6">
              <FitScore score={fit.score} band={fit.band} label="Your fit for this event" />
              <p className="text-sm leading-relaxed text-ink-600 dark:text-ink-300">{fit.summary}</p>

              <div className="space-y-4">
                {fit.coverage.map((entry) => (
                  <CoverageBar key={entry.area} entry={entry} />
                ))}
              </div>

              {fit.gaps.length > 0 && (
                <div className="rounded-[var(--radius-soft-sm)] border border-signal-warn/40 bg-signal-warn/5 px-4 py-3">
                  <p className="type-label text-signal-warn">What you'd want a teammate for</p>
                  <p className="mt-1.5 text-sm text-ink-700 dark:text-ink-300">
                    {fit.gaps.join(', ')}
                  </p>
                </div>
              )}

              <Button variant="outline" size="sm" to="/profile">
                Improve your profile
              </Button>
            </div>
          )}
        </Panel>
      </div>

      {/* -- teams for this event -------------------------------------------- */}
      <div className="mt-6">
        <Panel
          title="Teams at this event"
          hint={
            myTeam
              ? `You're on ${myTeam.name}. A person can be on one team per event, so leave it before joining another.`
              : 'Start your own, or ask to join one that has room.'
          }
        >
          <div className="space-y-6">
            {user && !fit?.myTeamId && (
              <CreateTeamForm
                eventId={event.id}
                maxSize={event.teamSize.max}
                // Straight to the new team rather than re-reading this page.
                // It is where the person is going next anyway — that is where
                // the gap report and the suggestions are — and it avoids a
                // window where the list has not caught up with the creation.
                onCreated={(teamId) => navigate(`/teams/${teamId}`)}
              />
            )}

            {teams.length === 0 ? (
              <p className="text-sm text-ink-600 dark:text-ink-300">
                No teams here yet. Starting one puts you first in front of everybody browsing.
              </p>
            ) : (
              <ul className="space-y-3">
                {teams.map((team) => (
                  <TeamRow
                    key={team.id}
                    team={team}
                    isMine={team.id === fit?.myTeamId}
                    onJoined={() => void load()}
                  />
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>
    </Container>
  );
}

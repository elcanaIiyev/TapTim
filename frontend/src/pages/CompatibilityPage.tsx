import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CoverageBar, FitScore } from '../components/events/FitMeter';
import { PersonAvatar, PersonLink, type PersonRef } from '../components/people/PersonLink';
import { TeamRisks } from '../components/teams/TeamRisks';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Container } from '../components/ui/Container';
import { Input, Select } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import {
  ApiError,
  compatibilityApi,
  connectionsApi,
  eventsApi,
  profileApi,
  teamsApi,
} from '../lib/api';
import { cn } from '../lib/cn';
import { scoreTone } from '../lib/people';
import { rolesSummary, skillLabel } from '../lib/types';
import type { EventItem, FitBand, LabPair, LabReport, SkillNeed, Team } from '../lib/types';

/**
 * The Team Lab.
 *
 * This tab has now been two different pages that were each answered better
 * somewhere else. First it scored two roles in the abstract; then it read one
 * of your teams — which the team's own page already does, with the same report,
 * the same brief and the same candidates. Once every candidate list on the site
 * carried a compatibility number, there was nothing left here worth a click.
 *
 * What nothing else answers is the question people ask *before* a team exists:
 * "if these particular people teamed up for this event, would it work — and
 * where would it break?" So this puts anyone in the room — you, people you
 * know, people you found, or a team you are already on — and runs the real
 * engine on the roster as if it were a team: every pair under the event's own
 * weights, what the group covers and when it can meet, what it would still be
 * missing, and what could go wrong. Nothing is sent to anybody until you choose
 * to turn it into a team.
 */

type Person = PersonRef & { roles: readonly string[] };

const MAX_PEOPLE = 8;

function bandOf(score: number): FitBand {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'strong';
  if (score >= 45) return 'moderate';
  return 'weak';
}

function readinessBand(score: number): FitBand {
  if (score >= 75) return 'excellent';
  if (score >= 55) return 'strong';
  if (score >= 30) return 'moderate';
  return 'weak';
}

function cellClass(score: number): string {
  if (score >= 80) return 'bg-fern-600 text-white';
  if (score >= 65) return 'bg-fern-500/35 text-ink-900 dark:text-white';
  if (score >= 45) return 'bg-signal-warn/25 text-ink-900 dark:text-white';
  return 'bg-signal-bad/25 text-ink-900 dark:text-white';
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const PRIORITY_TONE: Record<SkillNeed['priority'], string> = {
  critical: 'text-signal-bad',
  important: 'text-signal-warn',
  'nice to have': 'text-ink-500 dark:text-ink-400',
};

function NeedRow({ need }: { need: SkillNeed }) {
  return (
    <li className="rounded-[var(--radius-soft-sm)] border border-ink-200 px-4 py-3 dark:border-ink-700">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-ink-900 dark:text-white">{need.area}</span>
        <span className={cn('type-label text-[0.7rem]', PRIORITY_TONE[need.priority])}>
          {need.priority}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-ink-600 dark:text-ink-300">
        The group is at <strong className="tabular-nums text-ink-900 dark:text-white">{need.current}</strong>{' '}
        here. Someone around{' '}
        <strong className="tabular-nums text-ink-900 dark:text-white">{need.target}</strong> —{' '}
        {skillLabel(need.target).toLowerCase()} or better — would close it.
      </p>
      {need.examples.length > 0 && (
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">For example: {need.examples.join(', ')}</p>
      )}
    </li>
  );
}

/** Every pair, as a grid: who gets on with whom, at a glance. */
function PairMatrix({ report }: { report: LabReport }) {
  const scores = new Map(report.pairs.map((pair) => [pairKey(pair.userIds[0], pair.userIds[1]), pair]));
  const people = report.members.map((member) => member.user);

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              Person
            </th>
            {people.map((person) => (
              <th key={person.id} scope="col" className="p-0 text-center">
                <span className="sr-only">{person.fullName}</span>
                <span className="flex justify-center" aria-hidden="true">
                  <PersonAvatar person={person} size={30} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.map((row) => (
            <tr key={row.id}>
              <th scope="row" className="max-w-[9rem] pr-2 text-left">
                <span className="flex items-center gap-2">
                  <PersonAvatar person={row} size={30} />
                  <span className="truncate text-xs font-semibold text-ink-800 dark:text-ink-100">
                    {row.firstName}
                  </span>
                </span>
              </th>
              {people.map((column) => {
                if (column.id === row.id) {
                  return (
                    <td key={column.id} className="h-10 w-12 rounded-md bg-ink-100 text-center text-xs text-ink-400 dark:bg-ink-800">
                      —
                    </td>
                  );
                }
                const pair = scores.get(pairKey(row.id, column.id));
                return (
                  <td
                    key={column.id}
                    title={pair ? `${row.firstName} & ${column.firstName}: ${pair.summary}` : undefined}
                    className={cn(
                      'readout h-10 w-12 rounded-md text-center text-sm font-bold tabular-nums',
                      pair ? cellClass(pair.score) : 'bg-ink-100 dark:bg-ink-800',
                    )}
                  >
                    {pair?.score ?? ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PairCallout({
  label,
  pair,
  names,
}: {
  label: string;
  pair: LabPair;
  names: Map<string, string>;
}) {
  return (
    <div className="rounded-[var(--radius-soft-sm)] border border-ink-200 px-4 py-3 dark:border-ink-700">
      <p className="type-label text-[0.7rem] text-ink-500 dark:text-ink-400">{label}</p>
      <p className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-ink-900 dark:text-white">
          {names.get(pair.userIds[0])} & {names.get(pair.userIds[1])}
        </span>
        <span className={cn('readout text-lg font-bold tabular-nums', scoreTone(pair.score))}>{pair.score}</span>
      </p>
      <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{pair.summary}</p>
    </div>
  );
}

export function CompatibilityPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventId, setEventId] = useState('');
  const [roster, setRoster] = useState<Person[]>([]);
  const [connections, setConnections] = useState<Person[]>([]);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [report, setReport] = useState<LabReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // -- what the page needs to offer choices ----------------------------------------
  useEffect(() => {
    if (!user) return;
    setRoster((current) =>
      current.length > 0
        ? current
        : [{ id: user.id, fullName: user.fullName, firstName: user.firstName, avatarUrl: user.avatarUrl, roles: user.roles }],
    );

    void Promise.all([
      eventsApi.list({ limit: 50 }).then((response) => response.data).catch(() => [] as EventItem[]),
      teamsApi
        .list({ mine: true })
        .then((response) => response.data)
        .catch(() => [] as Team[]),
      connectionsApi.overview().catch(() => null),
    ]).then(([catalogue, teams, overview]) => {
      const now = Date.now();
      // Upcoming first, soonest first; past events after, most recent first.
      const sorted = [...catalogue].sort((a, b) => {
        const aPast = new Date(a.endDate).getTime() < now;
        const bPast = new Date(b.endDate).getTime() < now;
        if (aPast !== bPast) return aPast ? 1 : -1;
        const byStart = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        return aPast ? -byStart : byStart;
      });
      setEvents(sorted);
      setMyTeams(teams);
      setConnections((overview?.connected ?? []).map((view) => view.person));
      // Start on the event of a team you are already on, if there is one:
      // that is the roster people most often want to question.
      setEventId((current) => current || teams[0]?.eventId || sorted[0]?.id || '');
    });
  }, [user]);

  // -- search, debounced ------------------------------------------------------------
  useEffect(() => {
    const term = search.trim();
    if (!user || term.length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void profileApi
        .directory({ search: term })
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, user]);

  // -- run the lab whenever the room or the event changes ----------------------------
  const rosterKey = roster.map((person) => person.id).join(',');
  useEffect(() => {
    if (!eventId || roster.length < 2) {
      setReport(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      compatibilityApi
        .lab(eventId, rosterKey.split(','))
        .then((next) => {
          if (!cancelled) setReport(next);
        })
        .catch((caught) => {
          if (cancelled) return;
          setReport(null);
          setError(caught instanceof ApiError ? caught.message : 'Could not run the lab.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // `rosterKey` stands in for `roster`: the lab cares who is in the room, not
    // about the array's identity.
  }, [eventId, rosterKey]);

  const inRoom = useMemo(() => new Set(roster.map((person) => person.id)), [roster]);
  const full = roster.length >= MAX_PEOPLE;

  const add = (person: Person) => {
    if (inRoom.has(person.id) || full) return;
    setRoster((current) => [...current, person]);
  };
  const remove = (id: string) => setRoster((current) => current.filter((person) => person.id !== id));

  async function loadTeam(team: Team) {
    setError(null);
    try {
      const detail = await teamsApi.byId(team.id);
      const members: Person[] = detail.members.map((member) => member.user);
      // The team's people, plus whoever you had already added — that is the
      // "what if we brought them in?" question.
      setRoster((current) => {
        const merged = [...members];
        for (const person of current) if (!merged.some((m) => m.id === person.id)) merged.push(person);
        return merged.slice(0, MAX_PEOPLE);
      });
      setEventId(team.eventId);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load that team.');
    }
  }

  const event = events.find((entry) => entry.id === eventId);
  const teamsHere = myTeams.filter((team) => team.eventId === eventId);
  const suggestions = connections.filter((person) => !inRoom.has(person.id));
  const found = results.filter((person) => !inRoom.has(person.id)).slice(0, 6);

  const names = new Map((report?.members ?? []).map((member) => [member.user.id, member.user.firstName]));
  const ranked = [...(report?.pairs ?? [])].sort((a, b) => b.score - a.score);
  const me = report?.members.find((member) => member.user.id === user?.id);
  const inviteable = report?.members.filter((member) => member.user.id !== user?.id && !member.existingTeam) ?? [];
  const canStart = Boolean(report && me && !me.existingTeam && inviteable.length > 0);

  async function startTeam() {
    if (!report || !event) return;
    setCreating(true);
    setCreateError(null);
    try {
      const maxSize = Math.min(12, Math.max(2, report.size.max, report.members.length));
      const created = await teamsApi.create({ eventId: report.eventId, name: teamName.trim(), maxSize });
      const failures: string[] = [];
      for (const member of inviteable) {
        try {
          await teamsApi.invite(created.id, member.user.id, `Tried out in the Team Lab for ${event.name}.`);
        } catch {
          failures.push(member.user.firstName);
        }
      }
      if (failures.length > 0) {
        // The team exists either way; the page it lands on shows who is pending.
        window.sessionStorage.setItem(
          'taptim-lab-notice',
          `Team created. Could not invite ${failures.join(', ')} — try again from the team page.`,
        );
      }
      navigate(`/teams/${created.id}`);
    } catch (caught) {
      setCreateError(caught instanceof ApiError ? caught.message : 'Could not create that team.');
      setCreating(false);
    }
  }

  return (
    <Container className="py-14 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-ink-200 pb-8 dark:border-ink-700">
        <div>
          <Badge tone="accent" className="mb-5">
            Team Lab
          </Badge>
          <h1 className="type-display text-ink-900 dark:text-white">
            Would these people
            <br />
            make a good team?
          </h1>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          Pick an event and put anyone in the room — people you know, people you found, a team you
          are already on. TapTim scores every pair the way that event weighs them, checks what the
          group covers and when it can meet, and shows where it would break. Nobody is told anything
          until you decide to make it real.
        </p>
      </div>

      {!user ? (
        <Card className="mt-12">
          <p className="text-sm text-ink-600 dark:text-ink-300">
            The lab reads real profiles, so it needs you signed in.{' '}
            <Link to="/login" className="font-semibold text-accent-text underline underline-offset-4">
              Sign in
            </Link>{' '}
            or{' '}
            <Link to="/signup" className="font-semibold text-accent-text underline underline-offset-4">
              make a profile
            </Link>
            .
          </p>
        </Card>
      ) : (
        <div className="mt-10 grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          {/* -- the room ----------------------------------------------------------- */}
          <div className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <Select label="For which event?" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                {events.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </Select>
              {event && (
                <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
                  {event.format} · teams of {event.teamSize.min}–{event.teamSize.max}
                </p>
              )}
            </Card>

            <Card>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="type-label text-accent-text">In the room</h2>
                <span className="readout text-xs text-ink-500 dark:text-ink-400">
                  {roster.length}/{MAX_PEOPLE}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {roster.map((person) => (
                  <li key={person.id} className="flex items-center gap-3">
                    <PersonAvatar person={person} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {person.id === user.id ? (
                          <span className="font-semibold text-ink-900 dark:text-white">You</span>
                        ) : (
                          <PersonLink person={person} />
                        )}
                      </p>
                      <p className="truncate text-xs text-ink-500 dark:text-ink-400">{rolesSummary(person.roles)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(person.id)}
                      aria-label={`Take ${person.fullName} out`}
                      className="icon-btn grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full text-ink-500 hover:text-signal-bad"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>

              {teamsHere.length > 0 && (
                <div className="mt-5 border-t border-ink-200 pt-4 dark:border-ink-700">
                  <p className="type-label mb-2 text-[0.7rem] text-ink-500 dark:text-ink-400">
                    Start from a team you are on
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {teamsHere.map((team) => (
                      <Button key={team.id} size="sm" variant="outline" onClick={() => void loadTeam(team)}>
                        {team.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <Card>
              <Input
                label="Add someone"
                placeholder="Name, skill, or bio"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                hint={full ? `The lab compares at most ${MAX_PEOPLE} people at once.` : undefined}
              />
              {found.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {found.map((person) => (
                    <li key={person.id}>
                      <button
                        type="button"
                        disabled={full}
                        onClick={() => {
                          add(person);
                          setSearch('');
                        }}
                        className="flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-soft-sm)] px-2 py-1.5 text-left hover:bg-iris-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-ink-800"
                      >
                        <PersonAvatar person={person} size={28} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink-900 dark:text-white">
                            {person.fullName}
                          </span>
                          <span className="block truncate text-xs text-ink-500 dark:text-ink-400">
                            {rolesSummary(person.roles)}
                          </span>
                        </span>
                        <span className="type-label text-[0.7rem] text-accent-text">Add</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {search.trim().length >= 2 && found.length === 0 && (
                <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">Nobody new matches that.</p>
              )}

              {suggestions.length > 0 && (
                <div className="mt-5">
                  <p className="type-label mb-2 text-[0.7rem] text-ink-500 dark:text-ink-400">Your connections</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.slice(0, 10).map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        disabled={full}
                        onClick={() => add(person)}
                        className="flex cursor-pointer items-center gap-2 rounded-full border border-ink-300 py-1 pl-1 pr-3 text-xs font-semibold text-ink-700 hover:border-iris-500 hover:text-accent-text disabled:cursor-not-allowed disabled:opacity-50 dark:border-ink-600 dark:text-ink-200"
                      >
                        <PersonAvatar person={person} size={22} />+ {person.firstName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* -- the verdict -------------------------------------------------------- */}
          <div className="min-w-0 space-y-6">
            {roster.length < 2 && (
              <Card>
                <p className="type-label text-ink-600 dark:text-ink-400">Add someone to begin</p>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-600 dark:text-ink-300">
                  A team is at least two people. Search for anyone on TapTim, pick from your
                  connections, or start from a team you are already on — then keep adding to see how
                  each person changes the picture.
                </p>
              </Card>
            )}

            {error && (
              <Card>
                <p role="alert" className="text-sm font-medium text-signal-bad">
                  {error}
                </p>
              </Card>
            )}

            {loading && !report && (
              <Card>
                <div className="flex items-center gap-3 text-sm text-ink-600 dark:text-ink-300">
                  <Spinner className="text-iris-600 dark:text-iris-400" />
                  Running the numbers…
                </div>
              </Card>
            )}

            {report && (
              <div className={cn('space-y-6 transition-opacity', loading && 'opacity-60')}>
                <Card className="hud hud-ticks relative overflow-hidden">
                  <div className="grid-floor pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
                  <div className="relative">
                    <p className="type-label text-ink-500 dark:text-ink-400">
                      {report.members.length} people · {report.eventName}
                    </p>
                    <div className="mt-4 grid gap-6 sm:grid-cols-2">
                      <FitScore score={report.readiness} band={readinessBand(report.readiness)} label="Ready for this event" />
                      <FitScore score={report.cohesion} band={bandOf(report.cohesion)} label="How well they get on" />
                    </div>
                    <p className="mt-5 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{report.summary}</p>
                    {report.members.length > report.size.max && (
                      <p className="mt-3 text-sm font-medium text-signal-warn">
                        {report.eventName} allows teams of up to {event?.teamSize.max ?? report.size.max} — this
                        room could not all enter together.
                      </p>
                    )}
                  </div>
                </Card>

                <Card>
                  <h2 className="type-label text-accent-text">Every pair</h2>
                  <p className="mt-1.5 text-xs text-ink-600 dark:text-ink-400">
                    Scored under {report.eventName}’s weighting. Hover a cell for why.
                  </p>
                  <div className="mt-4">
                    <PairMatrix report={report} />
                  </div>
                  {ranked.length > 1 && (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <PairCallout label="Strongest pair" pair={ranked[0]} names={names} />
                      <PairCallout label="Most friction" pair={ranked[ranked.length - 1]} names={names} />
                    </div>
                  )}
                  {ranked.length === 1 && (
                    <div className="mt-5">
                      <PairCallout label="The two of you" pair={ranked[0]} names={names} />
                    </div>
                  )}
                </Card>

                <Card>
                  <h2 className="type-label text-accent-text">Each person, for this event</h2>
                  <ul className="mt-4 space-y-3">
                    {report.members.map((member) => (
                      <li key={member.user.id} className="flex flex-wrap items-center gap-3">
                        <PersonAvatar person={member.user} size={34} link />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            <PersonLink person={member.user} />
                          </p>
                          <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                            {rolesSummary(member.user.roles)}
                          </p>
                          {member.existingTeam && (
                            <p className="mt-0.5 text-xs font-medium text-signal-warn">
                              Already on{' '}
                              <Link to={`/teams/${member.existingTeam.id}`} className="underline underline-offset-2">
                                {member.existingTeam.name}
                              </Link>{' '}
                              for this event — they could not join another.
                            </p>
                          )}
                        </div>
                        <span className="text-right">
                          <span className={cn('readout block text-lg font-bold tabular-nums', scoreTone(member.eventFit))}>
                            {member.eventFit}
                          </span>
                          <span className="type-label text-[0.65rem] text-ink-500 dark:text-ink-400">event fit</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card>
                  <h2 className="type-label text-accent-text">What the group covers</h2>
                  <p className="mt-1.5 text-xs text-ink-600 dark:text-ink-400">
                    Weakest first. Each area is scored by the strongest person on it — one expert covers
                    a need that three beginners do not.
                  </p>
                  <div className="mt-4 space-y-3">
                    {[...report.coverage]
                      .sort((a, b) => a.score - b.score)
                      .map((entry) => (
                        <CoverageBar key={entry.area} entry={entry} />
                      ))}
                  </div>
                  {report.missingRoles.length > 0 && (
                    <div className="mt-5">
                      <p className="type-label mb-2 text-[0.7rem] text-ink-500 dark:text-ink-400">
                        Positions nobody here plays
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {report.missingRoles.map((role) => (
                          <Badge key={role} tone="warning">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>

                {report.brief.skills.length > 0 && (
                  <Card>
                    <h2 className="type-label text-accent-text">Who would complete it</h2>
                    <p className="mt-2 font-semibold text-ink-900 dark:text-white">{report.brief.headline}</p>
                    {report.brief.caveat && (
                      <p className="mt-2 text-sm text-signal-warn">{report.brief.caveat}</p>
                    )}
                    <ul className="mt-4 space-y-3">
                      {report.brief.skills.map((need) => (
                        <NeedRow key={need.area} need={need} />
                      ))}
                    </ul>
                  </Card>
                )}

                <Card>
                  <TeamRisks risks={report.risks} availability={report.availability} size={report.members.length} />
                </Card>

                {/* -- make it real ------------------------------------------------- */}
                <Card className="hud hud-ticks relative overflow-hidden">
                  <div className="grid-floor pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
                  <div className="relative">
                    <h2 className="type-label text-accent-text">Make it real</h2>
                    {!me ? (
                      <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
                        You are not in this room, so there is no team for you to start with it. Share
                        what you found with them instead.
                      </p>
                    ) : me.existingTeam ? (
                      <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
                        You are already on{' '}
                        <Link to={`/teams/${me.existingTeam.id}`} className="font-semibold underline underline-offset-4">
                          {me.existingTeam.name}
                        </Link>{' '}
                        for this event. Invite people from that team’s page.
                      </p>
                    ) : !canStart ? (
                      <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
                        Everyone else here is already on a team for this event, so there is nobody left to
                        invite.
                      </p>
                    ) : (
                      <form
                        className="mt-3 flex flex-wrap items-end gap-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void startTeam();
                        }}
                      >
                        <div className="min-w-[14rem] flex-1">
                          <Input
                            label="Team name"
                            placeholder="Something the others would not mind being called"
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            maxLength={60}
                          />
                        </div>
                        <Button type="submit" disabled={creating || teamName.trim().length < 3}>
                          {creating && <Spinner />}
                          Create team & invite {inviteable.length}
                        </Button>
                        <p className="w-full text-xs text-ink-500 dark:text-ink-400">
                          Creates a team for {report.eventName} with you as its owner and sends each of{' '}
                          {inviteable.map((member) => member.user.firstName).join(', ')} an invitation they can
                          accept or decline.
                        </p>
                        {createError && (
                          <p role="alert" className="w-full text-sm font-medium text-signal-bad">
                            {createError}
                          </p>
                        )}
                      </form>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}
    </Container>
  );
}

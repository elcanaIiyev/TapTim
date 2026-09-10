import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PersonAvatar } from '../components/people/PersonLink';
import { TeamLogo } from '../components/teams/TeamLogo';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Container } from '../components/ui/Container';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { useChatDock } from '../context/ChatDockContext';
import {
  ApiError,
  compatibilityApi,
  connectionsApi,
  endorsementsApi,
  profileApi,
  teamsApi,
} from '../lib/api';
import { cn } from '../lib/cn';
import {
  availabilityLabel,
  EXPERIENCE_LEVEL_LABELS,
  scoreTone,
  TRAIT_COPY,
  utcOffsetLabel,
} from '../lib/people';
import { skillLabel } from '../lib/types';
import type {
  ConnectionState,
  Experience,
  PairCompatibility,
  ParticipantProfile,
  ProfileEndorsements,
  Team,
} from '../lib/types';
import { NotFoundPage } from './NotFoundPage';

/**
 * Somebody else's profile — the page a name opens.
 *
 * It was the thinnest page on the site: a name, roles, a bio, and a skill list,
 * because it existed only so endorsing had somewhere to live. Everything the
 * matching engine reads about a person was already public in the API and
 * simply never shown, so "should I team up with them?" had to be answered from
 * a single number on some other page.
 *
 * It now answers that on its own: what they can do and how far that is
 * trusted, when and how they like to work, what they have done, which teams
 * they are on — and for anyone signed in, how the two of you fit and why, with
 * the actions that follow from it on the same screen.
 */

function monthYear(isoDay: string): string {
  const date = new Date(isoDay.length === 10 ? `${isoDay}T00:00:00` : isoDay);
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

const KIND_LABEL: Record<string, string> = {
  work: 'Work',
  internship: 'Internship',
  project: 'Project',
  hackathon: 'Hackathon',
  education: 'Education',
  volunteering: 'Volunteering',
};

// -- pieces ------------------------------------------------------------------------

function SkillRow({
  skill,
  level,
  endorsement,
  canEndorse,
  busy,
  onToggle,
}: {
  skill: string;
  level: number | undefined;
  endorsement: { count: number; verified: number; byViewer: boolean } | undefined;
  canEndorse: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const count = endorsement?.count ?? 0;
  const verified = endorsement?.verified ?? 0;
  const mine = endorsement?.byViewer ?? false;

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink-900 dark:text-white">{skill}</p>
          <p className="mt-0.5 text-xs text-ink-600 dark:text-ink-400">
            {/* An unrated skill says so rather than showing the default as if it
                were a claim — that distinction is the whole point of confidence. */}
            {level === undefined ? (
              <span className="italic">Not rated yet</span>
            ) : (
              <>
                {skillLabel(level)} · <span className="tabular-nums">{level}</span>
              </>
            )}
            {count > 0 && (
              <>
                {' · '}
                <span
                  className="font-semibold text-success-text"
                  // An endorsement that names the event it came from is one both
                  // people's team membership can confirm, and it counts for more.
                  title={
                    verified === count
                      ? 'Every one of these came from an event you both worked at.'
                      : `${verified} of ${count} came from an event you both worked at; the rest predate that record.`
                  }
                >
                  {count} endorsement{count === 1 ? '' : 's'}
                  {verified > 0 && verified < count ? ` (${verified} from events)` : ''}
                </span>
              </>
            )}
          </p>
        </div>

        {canEndorse && (
          <button
            type="button"
            disabled={busy}
            onClick={onToggle}
            aria-pressed={mine}
            className={cn(
              'shrink-0 cursor-pointer rounded-full border px-3 py-1.5 font-mono text-xs font-semibold transition-colors',
              mine
                ? 'border-fern-700 bg-fern-600 text-white'
                : 'border-ink-300 text-ink-700 hover:border-fern-600 hover:text-fern-700 dark:border-ink-600 dark:text-ink-300',
              busy && 'cursor-not-allowed opacity-60',
            )}
          >
            {mine ? 'Endorsed' : 'Endorse'}
          </button>
        )}
      </div>

      {level !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" aria-hidden="true">
          <div className="h-full rounded-full bg-iris-500" style={{ width: `${level}%` }} />
        </div>
      )}
    </li>
  );
}

function Chips({ items, tone = 'neutral' }: { items: string[]; tone?: 'neutral' | 'brand' | 'success' }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} tone={tone}>
          {item}
        </Badge>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-sm text-ink-600 dark:text-ink-400">{label}</dt>
      <dd className="readout text-right text-sm font-semibold text-ink-900 dark:text-white">{value}</dd>
    </div>
  );
}

/** "You and them", broken into the five things the number is made of. */
function FitCard({ fit, firstName }: { fit: PairCompatibility; firstName: string }) {
  return (
    <Card className="hud hud-ticks relative overflow-hidden">
      <div className="grid-floor pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="type-label text-accent-text">You and {firstName}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-600 dark:text-ink-300">
              {fit.summary}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className={cn('readout text-5xl font-bold tabular-nums leading-none', scoreTone(fit.score))}>
              {fit.score}
            </p>
            <p className="type-label mt-1 text-[0.7rem] text-ink-500 dark:text-ink-400">
              {fit.band} fit
            </p>
          </div>
        </div>

        <ul className="mt-6 space-y-4">
          {fit.components.map((component) => (
            <li key={component.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold text-ink-900 dark:text-white">{component.label}</span>
                <span className="readout shrink-0 text-xs text-ink-500 dark:text-ink-400">
                  <span className={cn('font-bold', scoreTone(component.score))}>{component.score}</span>
                  {' · '}counts for {component.weight}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" aria-hidden="true">
                <div className="h-full rounded-full bg-fern-500" style={{ width: `${component.score}%` }} />
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-600 dark:text-ink-400">
                {component.explanation}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {fit.sharedSkills.length > 0 && (
            <div>
              <p className="type-label mb-2 text-[0.7rem] text-ink-500 dark:text-ink-400">You both have</p>
              <Chips items={fit.sharedSkills.slice(0, 8)} />
            </div>
          )}
          {fit.complementarySkills.length > 0 && (
            <div>
              <p className="type-label mb-2 text-[0.7rem] text-ink-500 dark:text-ink-400">Only one of you has</p>
              <Chips items={fit.complementarySkills.slice(0, 8)} tone="brand" />
            </div>
          )}
          {fit.sharedAvailability.length > 0 && (
            <div>
              <p className="type-label mb-2 text-[0.7rem] text-ink-500 dark:text-ink-400">Both free</p>
              <Chips items={fit.sharedAvailability.map(availabilityLabel)} tone="success" />
            </div>
          )}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
          Scored with the platform’s default weighting. Every event weighs these five differently —{' '}
          <Link to="/compatibility" className="font-semibold text-accent-text underline underline-offset-4">
            the Team Lab
          </Link>{' '}
          shows the two of you, and anyone else, the way a specific event would.
        </p>
      </div>
    </Card>
  );
}

function ExperienceItem({ entry }: { entry: Experience }) {
  const start = entry.startDate ? monthYear(entry.startDate) : null;
  const end = entry.isCurrent ? 'now' : entry.endDate ? monthYear(entry.endDate) : null;
  const when = start && end ? `${start} – ${end}` : start ?? end;

  return (
    <li className="relative border-l-2 border-ink-200 pb-6 pl-5 last:pb-0 dark:border-ink-700">
      <span
        aria-hidden="true"
        className={cn(
          'absolute -left-[5px] top-1.5 h-2 w-2 rounded-full',
          entry.isCurrent ? 'bg-fern-500' : 'bg-ink-300 dark:bg-ink-600',
        )}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={entry.kind === 'hackathon' ? 'brand' : 'neutral'}>{KIND_LABEL[entry.kind] ?? entry.kind}</Badge>
        {when && <span className="readout text-xs text-ink-500 dark:text-ink-400">{when}</span>}
      </div>
      <p className="mt-2 font-semibold text-ink-900 dark:text-white">
        {entry.url ? (
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:text-accent-text hover:underline"
          >
            {entry.title}
          </a>
        ) : (
          entry.title
        )}
      </p>
      {entry.organisation && (
        <p className="text-sm text-ink-600 dark:text-ink-400">{entry.organisation}</p>
      )}
      {entry.description && (
        <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{entry.description}</p>
      )}
      {entry.skills.length > 0 && (
        <div className="mt-2.5">
          <Chips items={entry.skills} />
        </div>
      )}
    </li>
  );
}

/** Where they sit between two ends of each preference — never a grade. */
function WorkingStyle({ personality }: { personality: Record<string, number> }) {
  const traits = Object.entries(personality).filter(([trait, value]) => TRAIT_COPY[trait] && value);
  if (traits.length === 0) return null;

  return (
    <Card>
      <h2 className="type-label text-accent-text">How they like to work</h2>
      <ul className="mt-4 space-y-4">
        {traits.map(([trait, value]) => {
          const copy = TRAIT_COPY[trait];
          return (
            <li key={trait}>
              <p className="text-sm font-semibold text-ink-900 dark:text-white">{copy.label}</p>
              <div className="mt-1.5 flex items-center gap-1" role="img" aria-label={`${value} of 5, from ${copy.low} to ${copy.high}`}>
                {[1, 2, 3, 4, 5].map((step) => (
                  <span
                    key={step}
                    className={cn(
                      'h-2 flex-1 rounded-full',
                      step === value ? 'bg-iris-600' : 'bg-ink-100 dark:bg-ink-800',
                    )}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[0.7rem] text-ink-500 dark:text-ink-400">
                <span>{copy.low}</span>
                <span>{copy.high}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// -- the page ------------------------------------------------------------------------

export function ParticipantPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { openWith } = useChatDock();

  const [person, setPerson] = useState<ParticipantProfile | null>(null);
  const [endorsements, setEndorsements] = useState<ProfileEndorsements | null>(null);
  const [fit, setFit] = useState<PairCompatibility | null>(null);
  const [relation, setRelation] = useState<{ state: ConnectionState; id: string | null }>({
    state: 'none',
    id: null,
  });
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [inviteTeamId, setInviteTeamId] = useState('');
  const [busySkill, setBusySkill] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const isSelf = user?.id === id;

  const load = useCallback(async () => {
    try {
      const [profile, marks] = await Promise.all([
        profileApi.get(id),
        endorsementsApi.forProfile(id),
      ]);
      setPerson(profile);
      setEndorsements(marks);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) setNotFound(true);
      else setError(caught instanceof ApiError ? caught.message : 'Could not load that profile.');
    }
  }, [id]);

  // What only a signed-in viewer who is not this person sees. Each part is
  // optional: a failure here must not take the profile down with it.
  const loadRelationship = useCallback(async () => {
    if (!user || user.id === id) {
      setFit(null);
      return;
    }
    const [pair, overview, teams] = await Promise.all([
      compatibilityApi.withMe(id).catch(() => null),
      connectionsApi.overview().catch(() => null),
      teamsApi
        .list({ mine: true })
        .then((result) => result.data)
        .catch(() => [] as Team[]),
    ]);
    setFit(pair);
    const view = [
      ...(overview?.connected ?? []),
      ...(overview?.incoming ?? []),
      ...(overview?.outgoing ?? []),
    ].find((entry) => entry.person.id === id);
    setRelation(view ? { state: view.state, id: view.id } : { state: 'none', id: null });
    setMyTeams(teams);
  }, [id, user]);

  useEffect(() => {
    setPerson(null);
    setNotFound(false);
    setError(null);
    setNotice(null);
    void load();
  }, [load]);

  useEffect(() => {
    void loadRelationship();
  }, [loadRelationship]);

  /**
   * Teams the viewer could invite them to: owned, recruiting, with a seat, and
   * for an event they are not already on a team for. Filtering here rather than
   * letting the server refuse means the button is only offered when it works.
   */
  const invitable = useMemo(() => {
    if (!person || !user) return [];
    const theirEvents = new Set(person.teams.map((team) => team.eventId));
    return myTeams.filter(
      (team) =>
        team.ownerId === user.id &&
        team.status === 'recruiting' &&
        team.openSeats > 0 &&
        !theirEvents.has(team.eventId),
    );
  }, [myTeams, person, user]);

  useEffect(() => {
    setInviteTeamId((current) =>
      invitable.some((team) => team.id === current) ? current : (invitable[0]?.id ?? ''),
    );
  }, [invitable]);

  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      await loadRelationship();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not go through.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleEndorsement(skill: string, currentlyMine: boolean) {
    setBusySkill(skill);
    setError(null);
    try {
      const updated = currentlyMine
        ? await endorsementsApi.withdraw(id, skill)
        : await endorsementsApi.endorse(id, skill);
      setEndorsements((current) =>
        current
          ? {
              ...current,
              skills: current.skills.map((entry) => (entry.skill === updated.skill ? updated : entry)),
            }
          : current,
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not go through.');
    } finally {
      setBusySkill(null);
    }
  }

  if (notFound) return <NotFoundPage />;

  if (!person) {
    return (
      <Container className="py-20">
        {error ? (
          <p role="alert" className="text-sm font-medium text-signal-bad">
            {error}
          </p>
        ) : (
          <div className="flex items-center gap-3 text-sm text-ink-600 dark:text-ink-300">
            <Spinner className="text-iris-600 dark:text-iris-400" />
            Loading…
          </div>
        )}
      </Container>
    );
  }

  const first = person.firstName || person.fullName.split(' ')[0];
  const byName = new Map((endorsements?.skills ?? []).map((entry) => [entry.skill, entry]));
  const skills = [...person.skills].sort(
    (a, b) => (person.skillLevels?.[b] ?? -1) - (person.skillLevels?.[a] ?? -1),
  );

  const facts = [
    [person.locationCity, person.locationCountry].filter(Boolean).join(', ') || null,
    person.age ? `${person.age} years old` : null,
    utcOffsetLabel(person.timezoneOffset),
    `On TapTim since ${monthYear(person.createdAt)}`,
  ].filter((fact): fact is string => Boolean(fact));

  const links = [
    person.githubUrl && { label: 'GitHub', href: person.githubUrl },
    person.linkedinUrl && { label: 'LinkedIn', href: person.linkedinUrl },
    person.portfolioUrl && { label: 'Portfolio', href: person.portfolioUrl },
  ].filter((link): link is { label: string; href: string } => Boolean(link));

  const inviteTeam = invitable.find((team) => team.id === inviteTeamId);

  return (
    <Container className="py-12 sm:py-16">
      {/* -- who they are ----------------------------------------------------- */}
      <section className="hud hud-ticks relative overflow-hidden p-6 sm:p-8">
        <div className="grid-floor pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 flex-1 flex-wrap items-start gap-5">
            <PersonAvatar person={person} size={88} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="type-title text-ink-900 dark:text-white">{person.fullName}</h1>
                {person.pronouns && (
                  <span className="text-sm text-ink-500 dark:text-ink-400">{person.pronouns}</span>
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {person.roles.map((role) => (
                  <Badge key={role} tone="brand">
                    {role}
                  </Badge>
                ))}
                {person.verified && <Badge tone="success">Verified</Badge>}
                {person.lookingForTeam ? (
                  <Badge tone="success">Looking for a team</Badge>
                ) : (
                  <Badge tone="neutral">Not looking right now</Badge>
                )}
              </div>

              {facts.length > 0 && (
                <p className="readout mt-3 text-xs text-ink-500 dark:text-ink-400">{facts.join(' · ')}</p>
              )}

              {person.bio && (
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-700 dark:text-ink-300">
                  {person.bio}
                </p>
              )}

              {(links.length > 0 || person.discordHandle) && (
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  {links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-accent-text underline decoration-2 underline-offset-4"
                    >
                      {link.label} ↗
                    </a>
                  ))}
                  {person.discordHandle && (
                    <span className="text-ink-600 dark:text-ink-400">
                      Discord <span className="readout text-ink-900 dark:text-white">{person.discordHandle}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* -- what you can do about it --------------------------------------- */}
          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:min-w-[14rem]">
            {isSelf ? (
              <>
                <p className="text-xs text-ink-500 dark:text-ink-400">This is how other people see you.</p>
                <Button to="/profile">Edit your profile</Button>
              </>
            ) : !user ? (
              <Button to="/login">Sign in to connect</Button>
            ) : (
              <>
                {relation.state === 'connected' ? (
                  <Button onClick={() => openWith(person.id)}>Message {first}</Button>
                ) : relation.state === 'pending-sent' ? (
                  <Button variant="outline" disabled>
                    Connection request sent
                  </Button>
                ) : relation.state === 'pending-received' ? (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void act(
                        () => connectionsApi.respond(relation.id as string, 'accept'),
                        `You and ${first} are connected — you can message each other now.`,
                      )
                    }
                  >
                    {busy && <Spinner />}
                    Accept {first}’s request
                  </Button>
                ) : (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void act(() => connectionsApi.request(person.id), `Connection request sent to ${first}.`)
                    }
                  >
                    {busy && <Spinner />}
                    Connect
                  </Button>
                )}

                {invitable.length > 1 && (
                  <select
                    aria-label="Which of your teams"
                    value={inviteTeamId}
                    onChange={(event) => setInviteTeamId(event.target.value)}
                    className="rounded-[var(--radius-soft-sm)] border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 dark:border-ink-600 dark:bg-ink-900 dark:text-white"
                  >
                    {invitable.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                )}
                {inviteTeam && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        () => teamsApi.invite(inviteTeam.id, person.id, null),
                        `Invited ${first} to ${inviteTeam.name}. It stays in the team’s pending list until they answer.`,
                      )
                    }
                  >
                    Invite to {invitable.length > 1 ? 'this team' : inviteTeam.name}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {notice && (
        <p role="status" className="mt-4 text-sm font-medium text-success-text">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-signal-bad">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* -- the evidence ------------------------------------------------------ */}
        <div className="min-w-0 space-y-6">
          {fit && <FitCard fit={fit} firstName={first} />}

          <Card>
            <h2 className="type-label text-accent-text">Skills</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
              {isSelf
                ? 'Endorsements come from people you have been on a team with.'
                : endorsements?.canEndorse
                  ? 'You have been on a team together, so you can vouch for what you actually saw. Endorsements do not change the number — they change how much it is trusted.'
                  : 'Self-rated from 0 to 100. Only people who have been on a team with them can endorse these.'}
            </p>

            {skills.length === 0 ? (
              <p className="mt-4 text-sm text-ink-600 dark:text-ink-400">No skills listed yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-ink-200 dark:divide-ink-700">
                {skills.map((skill) => (
                  <SkillRow
                    key={skill}
                    skill={skill}
                    level={person.skillLevels?.[skill]}
                    endorsement={byName.get(skill)}
                    canEndorse={Boolean(endorsements?.canEndorse)}
                    busy={busySkill === skill}
                    onToggle={() => void toggleEndorsement(skill, byName.get(skill)?.byViewer ?? false)}
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="type-label text-accent-text">Experience</h2>
            {person.experiences.length === 0 ? (
              <p className="mt-3 text-sm text-ink-600 dark:text-ink-400">
                {isSelf ? (
                  <>
                    Nothing listed yet.{' '}
                    <Link to="/profile" className="font-semibold text-accent-text underline underline-offset-4">
                      Add what you have built
                    </Link>{' '}
                    — it is the evidence behind the skill numbers.
                  </>
                ) : (
                  `${first} has not listed any experience yet.`
                )}
              </p>
            ) : (
              <ul className="mt-5">
                {person.experiences.map((entry) => (
                  <ExperienceItem key={entry.id} entry={entry} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* -- at a glance ------------------------------------------------------- */}
        <aside className="min-w-0 space-y-6">
          <Card>
            <h2 className="type-label text-accent-text">At a glance</h2>
            <dl className="mt-2 divide-y divide-ink-200 dark:divide-ink-700">
              <Stat label="Experience" value={EXPERIENCE_LEVEL_LABELS[person.experienceLevel] ?? person.experienceLevel} />
              <Stat label="Hackathons attended" value={person.hackathonsAttended} />
              <Stat label="Verified certificates" value={person.verifiedCertificates} />
              <Stat label="Hours a week" value={person.hoursPerWeek ?? '—'} />
              <Stat
                label="Team size they like"
                value={person.preferredTeamSize ? `${person.preferredTeamSize} people` : 'No preference'}
              />
              <Stat label="Profile filled in" value={`${person.profileCompleteness}%`} />
            </dl>
          </Card>

          <Card>
            <h2 className="type-label text-accent-text">When they can work</h2>
            {person.availability.length === 0 ? (
              <p className="mt-3 text-sm text-ink-600 dark:text-ink-400">No schedule set yet.</p>
            ) : (
              <div className="mt-3">
                <Chips items={person.availability.map(availabilityLabel)} tone="success" />
              </div>
            )}
          </Card>

          <WorkingStyle personality={person.personality ?? {}} />

          {(person.languages.length > 0 || person.interestDomains.length > 0 || person.goals.length > 0) && (
            <Card className="space-y-4">
              {person.languages.length > 0 && (
                <div>
                  <h2 className="type-label mb-2 text-accent-text">Speaks</h2>
                  <Chips items={person.languages} />
                </div>
              )}
              {person.interestDomains.length > 0 && (
                <div>
                  <h2 className="type-label mb-2 text-accent-text">Into</h2>
                  <Chips items={person.interestDomains} tone="brand" />
                </div>
              )}
              {person.goals.length > 0 && (
                <div>
                  <h2 className="type-label mb-2 text-accent-text">Here to</h2>
                  <Chips items={person.goals} />
                </div>
              )}
            </Card>
          )}

          <Card>
            <h2 className="type-label text-accent-text">Teams</h2>
            {person.teams.length === 0 ? (
              <p className="mt-3 text-sm text-ink-600 dark:text-ink-400">Not on a team right now.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {person.teams.map((team) => (
                  <li key={team.id} className="flex items-center gap-3">
                    <TeamLogo name={team.name} src={team.logoUrl} className="h-9 w-9" />
                    <div className="min-w-0">
                      <Link
                        to={`/teams/${team.id}`}
                        className="block truncate text-sm font-semibold text-ink-900 underline-offset-4 hover:text-accent-text hover:underline dark:text-white"
                      >
                        {team.name}
                      </Link>
                      <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                        {team.eventName ?? 'An event'} · {team.memberCount}/{team.maxSize}
                        {team.isOwner ? ' · owner' : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </Container>
  );
}

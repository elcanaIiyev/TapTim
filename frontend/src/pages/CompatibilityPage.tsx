import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CoverageBar, WeightBreakdown } from '../components/events/FitMeter';
import { TeamRisks } from '../components/teams/TeamRisks';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Container } from '../components/ui/Container';
import { Select } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { ApiError, teamsApi } from '../lib/api';
import { cn } from '../lib/cn';
import { rolesSummary, skillLabel } from '../lib/types';
import type { EventCandidate, SkillNeed, Team, TeamEventReport } from '../lib/types';

/**
 * "Who does this team still need?"
 *
 * The page used to ask a different question — pick two roles, see a number —
 * and that question turned out not to be worth answering. Nobody is deciding
 * whether a Frontend Developer and a Backend Developer get along in the
 * abstract; they have a team, they have an event, and they want to know what
 * the roster is short of.
 *
 * So it reads a real team through the real engine: the gap report says what is
 * missing under *this event's* weighting, the brief turns that into a
 * description of a person, and the candidate list is who currently matches it.
 * The brief comes first deliberately — it is true whether or not anybody
 * matching it has signed up, so a team with an empty candidate list still
 * leaves knowing what to go and find.
 */

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
        The team is at{' '}
        <strong className="tabular-nums text-ink-900 dark:text-white">{need.current}</strong> here.
        Look for someone around{' '}
        <strong className="tabular-nums text-ink-900 dark:text-white">{need.target}</strong> —{' '}
        {skillLabel(need.target).toLowerCase()} or better.
      </p>

      {need.examples.length > 0 && (
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
          For example: {need.examples.join(', ')}
        </p>
      )}
    </li>
  );
}

function CandidateRow({ candidate }: { candidate: EventCandidate }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-[var(--radius-soft-sm)] border border-ink-200 px-4 py-3 dark:border-ink-700">
      {candidate.user.avatarUrl ? (
        <img src={candidate.user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-iris-600 text-xs font-bold text-white">
          {candidate.user.firstName?.[0]?.toUpperCase() ?? '?'}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <Link
          to={`/participants/${candidate.user.id}`}
          className="font-semibold text-ink-900 underline-offset-4 hover:underline dark:text-white"
        >
          {candidate.user.fullName}
        </Link>
        <p className="truncate text-xs text-ink-600 dark:text-ink-400">
          {rolesSummary(candidate.user.roles)}
        </p>
        <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{candidate.summary}</p>
      </div>

      <span className="readout shrink-0 text-lg font-bold tabular-nums text-ink-900 dark:text-white">
        {candidate.score}
      </span>
    </li>
  );
}

export function CompatibilityPage() {
  const { user } = useAuth();

  const [teams, setTeams] = useState<Team[] | null>(null);
  const [teamId, setTeamId] = useState<string>('');
  const [report, setReport] = useState<TeamEventReport | null>(null);
  const [candidates, setCandidates] = useState<EventCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The teams this person is actually on. Everything else on the page hangs
  // off the one they pick.
  useEffect(() => {
    if (!user) {
      setTeams([]);
      return;
    }
    teamsApi
      .list({ mine: true })
      .then(({ data }) => {
        setTeams(data);
        setTeamId((current) => current || data[0]?.id || '');
      })
      .catch((caught) =>
        setError(caught instanceof ApiError ? caught.message : 'Could not load your teams.'),
      );
  }, [user]);

  useEffect(() => {
    if (!teamId) {
      setReport(null);
      setCandidates(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Both requests go together: the brief and the people who match it are one
    // answer, and showing the brief a beat before the list makes the page jump.
    Promise.all([teamsApi.gaps(teamId), teamsApi.suggestions(teamId, 6)])
      .then(([nextReport, nextCandidates]) => {
        if (cancelled) return;
        setReport(nextReport);
        setCandidates(nextCandidates);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof ApiError ? caught.message : 'Could not analyse this team.');
        setReport(null);
        setCandidates(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const brief = report?.brief;

  const covered = useMemo(
    () => (report ? [...report.coverage].sort((a, b) => a.score - b.score) : []),
    [report],
  );

  return (
    <Container className="py-14 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-ink-200 pb-8 dark:border-ink-700">
        <div>
          <Badge tone="accent" className="mb-5">
            Team analysis
          </Badge>
          <h1 className="type-display text-ink-900 dark:text-white">
            Who does your
            <br />
            team still need?
          </h1>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          Pick one of your teams. TapTim reads everyone already on it, weighs them against what
          that specific event rewards, and describes the person who would close the gap.
        </p>
      </div>

      {!user && (
        <Card className="mt-12">
          <p className="text-sm text-ink-600 dark:text-ink-300">
            Sign in to analyse a team you are on.
          </p>
        </Card>
      )}

      {user && teams?.length === 0 && (
        <Card className="mt-12">
          <p className="text-sm text-ink-600 dark:text-ink-300">
            You are not on a team yet. Teams are created under the event they are for —{' '}
            <Link to="/events" className="font-semibold underline underline-offset-4">
              browse events
            </Link>{' '}
            to start one.
          </p>
        </Card>
      )}

      {user && teams && teams.length > 0 && (
        <div className="mt-12 space-y-8">
          <Card>
            <Select
              label="Which team?"
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} — {team.memberCount}/{team.maxSize} members
                </option>
              ))}
            </Select>
          </Card>

          {error && (
            <Card>
              <p role="alert" className="text-sm font-medium text-signal-bad">
                {error}
              </p>
            </Card>
          )}

          {loading && (
            <Card>
              <div className="flex items-center gap-3 text-sm text-ink-600 dark:text-ink-300">
                <Spinner className="text-iris-600 dark:text-iris-400" />
                Reading the roster…
              </div>
            </Card>
          )}

          {!loading && report && brief && (
            <>
              {/* -- the answer, before the evidence -------------------------- */}
              <Card className="hud hud-ticks relative overflow-hidden">
                <div className="grid-floor pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
                <div className="relative">
                  <p className="type-label text-ink-500 dark:text-ink-400">
                    {report.teamName} · {report.eventName}
                  </p>

                  <h2 className="type-title mt-2 text-ink-900 dark:text-white">
                    {brief.headline}
                  </h2>

                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-600 dark:text-ink-300">
                    <span>
                      Roster{' '}
                      <strong className="tabular-nums text-ink-900 dark:text-white">
                        {report.size.current}/{report.size.max}
                      </strong>
                    </span>
                    <span>
                      Readiness for this event{' '}
                      <strong className="tabular-nums text-ink-900 dark:text-white">
                        {report.readiness}/100
                      </strong>
                    </span>
                  </div>

                  {brief.roles.length > 0 && (
                    <div className="mt-5">
                      <p className="type-label mb-2 text-[0.7rem] text-ink-500 dark:text-ink-400">
                        Positions nobody covers
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {brief.roles.map((role) => (
                          <Badge key={role} tone="warning">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shown above the reasoning, not buried under it: if the
                      brief is provisional, that changes how everything below it
                      should be read. */}
                  {brief.caveat && (
                    <div className="mt-5 rounded-[var(--radius-soft-sm)] border border-signal-warn/40 bg-signal-warn/10 px-4 py-3">
                      <p className="type-label text-[0.7rem] text-signal-warn">
                        Confidence {brief.confidence}/100
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-700 dark:text-ink-200">
                        {brief.caveat}
                      </p>
                    </div>
                  )}

                  {brief.reasons.length > 0 && (
                    <ul className="mt-5 space-y-1.5 text-sm text-ink-600 dark:text-ink-300">
                      {brief.reasons.map((reason) => (
                        <li key={reason} className="flex gap-2">
                          <span aria-hidden="true" className="text-fern-600 dark:text-fern-400">
                            ·
                          </span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>

              {brief.skills.length > 0 && (
                <Card>
                  <h3 className="type-label text-ink-700 dark:text-ink-300">
                    What they should be good at
                  </h3>
                  <p className="mt-1.5 text-xs text-ink-600 dark:text-ink-400">
                    Targets are pitched above what the team already has — somebody matching your
                    current level adds breadth but does not close the gap.
                  </p>
                  <ul className="mt-4 space-y-3">
                    {brief.skills.map((need) => (
                      <NeedRow key={need.area} need={need} />
                    ))}
                  </ul>
                </Card>
              )}

              {/* Before the coverage bars: a team that cannot find an hour
                  together has a bigger problem than a thin focus area. */}
              <Card>
                <TeamRisks
                  risks={report.risks}
                  availability={report.availability}
                  size={report.size.current}
                />
              </Card>

              {/* -- the evidence -------------------------------------------- */}
              <Card>
                <h3 className="type-label text-ink-700 dark:text-ink-300">
                  What the team covers today
                </h3>
                <p className="mt-1.5 text-xs text-ink-600 dark:text-ink-400">
                  Weakest area first. Each area is scored by the strongest person on it, not the
                  average — one expert covers a need that three beginners do not.
                </p>
                <div className="mt-4 space-y-3">
                  {covered.map((entry) => (
                    <div key={entry.area}>
                      <CoverageBar entry={entry} />
                      {entry.unrated.length > 0 && entry.score > 0 && (
                        <p className="mt-1 text-xs italic text-signal-warn">
                          Rests on {entry.unrated.join(', ')}, never rated — this number is a
                          guess.
                        </p>
                      )}
                      {entry.endorsements > 0 && (
                        <p className="mt-1 text-xs text-success-text">
                          {entry.endorsements} endorsement{entry.endorsements === 1 ? '' : 's'}{' '}
                          behind this.
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-6 border-t border-ink-200 pt-5 dark:border-ink-700">
                  <p className="type-label mb-3 text-[0.7rem] text-ink-500 dark:text-ink-400">
                    How {report.eventName} weighs a teammate
                  </p>
                  <WeightBreakdown weights={report.profile.weights} />
                </div>
              </Card>

              {/* -- who currently matches ------------------------------------ */}
              <Card>
                <h3 className="type-label text-ink-700 dark:text-ink-300">
                  People who fit that description
                </h3>
                {candidates && candidates.length > 0 ? (
                  <ul className="mt-4 space-y-3">
                    {candidates.map((candidate) => (
                      <CandidateRow key={candidate.user.id} candidate={candidate} />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">
                    Nobody available matches this yet. The brief above still holds — it describes
                    who to look for, on TapTim or anywhere else.
                  </p>
                )}

                <p className="mt-4 text-xs text-ink-500 dark:text-ink-400">
                  Invitations are sent from the{' '}
                  <Link
                    to={`/teams/${report.teamId}`}
                    className="font-semibold underline underline-offset-4"
                  >
                    team page
                  </Link>
                  .
                </p>
              </Card>
            </>
          )}
        </div>
      )}
    </Container>
  );
}

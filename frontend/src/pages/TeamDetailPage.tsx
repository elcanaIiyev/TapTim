import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CoverageBar, FitScore } from '../components/events/FitMeter';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { ApiError, eventsApi, teamsApi } from '../lib/api';
import { Card } from '../components/ui/Card';
import { TeamChannel } from '../components/teams/TeamChannel';
import { TeamRisks } from '../components/teams/TeamRisks';
import { TeamLogo } from '../components/teams/TeamLogo';
import { TeamLogoPicker } from '../components/teams/TeamLogoPicker';
import { rolesSummary } from '../lib/types';
import type { EventCandidate, EventItem, TeamDetail, TeamEventReport } from '../lib/types';
import { NotFoundPage } from './NotFoundPage';

/**
 * One team, and what it still needs *for its event*.
 *
 * The gap report and the suggestions are the whole point: a roster on its own
 * says who is here, and the useful question is who is missing.
 */
export function TeamDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [report, setReport] = useState<TeamEventReport | null>(null);
  const [candidates, setCandidates] = useState<EventCandidate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const detail = await teamsApi.byId(id);
      setTeam(detail);
      setEvent(await eventsApi.byId(detail.eventId).catch(() => null));

      // The gap report needs a session; suggestions need ownership. Both are
      // fetched optimistically and simply absent when not permitted, so the
      // page renders the same for a visitor as for the owner minus those parts.
      if (user) setReport(await teamsApi.gaps(id).catch(() => null));
      if (user && detail.ownerId === user.id) {
        setCandidates(await teamsApi.suggestions(id).catch(() => null));
      }
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
  if (loading || !team) {
    return (
      <Container className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="text-iris-600 dark:text-iris-400" />
      </Container>
    );
  }

  const isOwner = team.ownerId === user?.id;
  const isMember = team.members.some((member) => member.userId === user?.id);

  const invite = async (userId: string, name: string) => {
    try {
      await teamsApi.invite(team.id, userId, null);
      setNotice(`Invitation sent to ${name}.`);
      setCandidates((current) => current?.filter((c) => c.user.id !== userId) ?? null);
    } catch (caught) {
      setNotice(caught instanceof ApiError ? caught.message : 'Could not send that invitation.');
    }
  };

  return (
    <Container className="py-12">
      <div className="hud hud-ticks relative overflow-hidden p-6 sm:p-8">
        <div className="grid-floor pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative">
          {event && (
            <Link
              to={`/events/${event.id}`}
              className="type-label text-accent-text underline decoration-2 underline-offset-4"
            >
              ← {event.name}
            </Link>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <TeamLogo
              name={team.name}
              src={team.logoUrl}
              className="h-12 w-12"
              textClassName="text-base"
            />
            <h1 className="type-display text-ink-900 dark:text-white">{team.name}</h1>
            {team.openSeats === 0 ? (
              <Badge tone="neutral">Full</Badge>
            ) : (
              <Badge tone="success">{team.openSeats} open</Badge>
            )}
          </div>

          {team.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-600 dark:text-ink-300">
              {team.description}
            </p>
          )}

          <ul className="mt-7 flex flex-wrap gap-3">
            {team.members.map((member) => (
              <li key={member.userId} className="panel panel-soft-sm flex items-center gap-3 px-4 py-3">
                {member.user.avatarUrl ? (
                  <img src={member.user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-iris-600 text-xs font-bold text-white">
                    {member.user.firstName?.[0]?.toUpperCase() ?? '?'}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900 dark:text-white">
                    {member.user.fullName}
                    {member.isOwner && <span className="type-label ml-2 text-accent-text">owner</span>}
                  </p>
                  <p className="text-xs text-ink-600 dark:text-ink-400">{member.role}</p>
                </div>
              </li>
            ))}
          </ul>

          {isMember && !isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="mt-6"
              onClick={async () => {
                await teamsApi.leave(team.id).catch(() => undefined);
                void load();
              }}
            >
              Leave team
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <p role="status" className="mt-4 text-sm font-medium text-success-text">
          {notice}
        </p>
      )}

      {report && (
        <section className="hud hud-ticks relative mt-6 overflow-hidden p-6 sm:p-7">
          <div className="grid-floor pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
          <div className="relative">
            <h2 className="type-label text-accent-text">Where this team stands for this event</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
              {report.summary}
            </p>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="space-y-5">
                <FitScore
                  score={report.readiness}
                  band={
                    report.readiness >= 75
                      ? 'excellent'
                      : report.readiness >= 55
                        ? 'strong'
                        : report.readiness >= 30
                          ? 'moderate'
                          : 'weak'
                  }
                  label="Readiness for this event"
                />
                {report.missingRoles.length > 0 && (
                  <div>
                    <p className="type-label text-ink-700 dark:text-ink-300">Roles nobody plays</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {report.missingRoles.map((role) => (
                        <Badge key={role} tone="warning">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {report.coverage.map((entry) => (
                  <CoverageBar key={entry.area} entry={entry} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Members only, and above the gap report: once a team exists, talking to
          it is what people came back for. */}
      {report && (
        <Card className="mt-6">
          <TeamRisks
            risks={report.risks}
            availability={report.availability}
            size={report.size.current}
          />
        </Card>
      )}

      {isMember && user && (
        <section className="mt-6">
          <TeamChannel teamId={team.id} viewerId={user.id} />
        </section>
      )}

      {isOwner && (
        <Card className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="type-label text-ink-700 dark:text-ink-300">Recruiting page</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
                A public page anyone can open — no account needed. It shows what you cover and
                what you are short of, which recruits better than "join our team". It is live
                only while you have seats open.
              </p>
            </div>
            <Button size="sm" variant="outline" to={`/r/${team.id}`}>
              View it
            </Button>
          </div>
        </Card>
      )}

      {isOwner && (
        <Card className="mt-6">
          <TeamLogoPicker team={team} onChange={setTeam} />
        </Card>
      )}

      {isOwner && (
        <section className="hud hud-ticks relative mt-6 overflow-hidden p-6 sm:p-7">
          <div className="grid-floor pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
          <div className="relative">
            <h2 className="type-label text-accent-text">Who should join</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
              Ranked by how well they'd fit the people already here <em>and</em> how much of what
              this team is missing they would actually close.
            </p>

            {candidates === null ? (
              <div className="mt-6 flex items-center gap-3 text-sm text-ink-600 dark:text-ink-300">
                <Spinner className="text-iris-600 dark:text-iris-400" />
                Scoring candidates…
              </div>
            ) : candidates.length === 0 ? (
              <p className="mt-6 text-sm text-ink-600 dark:text-ink-300">
                {team.openSeats === 0
                  ? 'This team is full, so there is nothing to suggest.'
                  : 'Nobody is available for this event right now.'}
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {candidates.map((candidate) => (
                  <li key={candidate.user.id} className="panel panel-soft-sm p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink-900 dark:text-white">
                            {candidate.user.fullName}
                          </p>
                          <Badge tone="neutral">{rolesSummary(candidate.user.roles)}</Badge>
                          {candidate.fillsMissingRole && <Badge tone="success">Fills a gap</Badge>}
                        </div>

                        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
                          {candidate.summary}
                        </p>

                        <div className="readout mt-2 flex flex-wrap gap-4 text-xs text-ink-500 dark:text-ink-400">
                          <span>Fit {candidate.score}</span>
                          <span>Team rapport {candidate.teamFit}</span>
                          <span>Event fit {candidate.eventFit}</span>
                          {candidate.closesGaps.length > 0 && (
                            <span className="text-success-text">
                              Closes {candidate.closesGaps.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => void invite(candidate.user.id, candidate.user.firstName)}
                      >
                        Invite
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </Container>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CoverageBar, FitScore } from '../components/events/FitMeter';
import { PersonAvatar, PersonLink } from '../components/people/PersonLink';
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
import { formatDate } from '../lib/format';
import { rolesSummary } from '../lib/types';
import type {
  EventCandidate,
  EventItem,
  TeamDetail,
  TeamEventReport,
  TeamRequest,
} from '../lib/types';
import { NotFoundPage } from './NotFoundPage';

/**
 * One team, and what it still needs *for its event*.
 *
 * The gap report and the suggestions are the whole point: a roster on its own
 * says who is here, and the useful question is who is missing — followed
 * closely by "and who have we already asked?", which this page could not
 * answer until the pending list below existed.
 */

function since(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return formatDate(iso);
}

function PendingRow({
  request,
  verb,
  actions,
}: {
  request: TeamRequest;
  verb: string;
  actions: React.ReactNode;
}) {
  return (
    <li className="panel panel-soft-sm flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {request.user ? (
          <PersonAvatar person={request.user} size={36} link />
        ) : (
          <span className="h-9 w-9 shrink-0 rounded-full bg-ink-200 dark:bg-ink-700" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="text-sm">
            {request.user ? (
              <PersonLink person={request.user} />
            ) : (
              <span className="italic text-ink-500">A participant who has since left</span>
            )}
          </p>
          <p className="truncate text-xs text-ink-600 dark:text-ink-400">
            {request.user ? `${rolesSummary(request.user.roles)} · ` : ''}
            {verb} {since(request.createdAt)}
          </p>
          {request.message && (
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">“{request.message}”</p>
          )}
        </div>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </li>
  );
}

export function TeamDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [report, setReport] = useState<TeamEventReport | null>(null);
  const [candidates, setCandidates] = useState<EventCandidate[] | null>(null);
  const [pending, setPending] = useState<TeamRequest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyRequest, setBusyRequest] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setPending(await teamsApi.pendingFor(id).catch(() => null));
  }, [id]);

  const load = useCallback(async () => {
    try {
      const detail = await teamsApi.byId(id);
      setTeam(detail);
      setEvent(await eventsApi.byId(detail.eventId).catch(() => null));

      // The gap report needs a session; suggestions need ownership; the pending
      // list needs a seat on the roster. Each is fetched optimistically and is
      // simply absent when not permitted, so the page renders the same for a
      // visitor as for the owner, minus those parts.
      if (user) setReport(await teamsApi.gaps(id).catch(() => null));
      if (user && detail.members.some((member) => member.userId === user.id)) await loadPending();
      if (user && detail.ownerId === user.id) {
        setCandidates(await teamsApi.suggestions(id).catch(() => null));
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [id, user, loadPending]);

  useEffect(() => {
    void load();
  }, [load]);

  // The Team Lab lands here after creating a team. Anything it could not finish
  // is said here, where the pending list shows who did get an invitation.
  useEffect(() => {
    try {
      const message = window.sessionStorage.getItem('taptim-lab-notice');
      if (!message) return;
      window.sessionStorage.removeItem('taptim-lab-notice');
      setError(message);
    } catch {
      /* storage unavailable — nothing was left for us */
    }
  }, []);

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
  const invites = pending?.filter((request) => request.kind === 'invite') ?? [];
  const applications = pending?.filter((request) => request.kind === 'application') ?? [];
  const invitedIds = new Set(invites.map((request) => request.userId));

  const invite = async (userId: string, name: string) => {
    setError(null);
    try {
      await teamsApi.invite(team.id, userId, null);
      setNotice(`Invitation sent to ${name}. They are in the pending list until they answer.`);
      await loadPending();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send that invitation.');
    }
  };

  const respond = async (requestId: string, action: 'accept' | 'decline' | 'cancel') => {
    setBusyRequest(requestId);
    setError(null);
    try {
      await teamsApi.respond(requestId, action);
      // Accepting changes the roster, the report, and the suggestions, not just
      // this list — so everything is reloaded rather than patched.
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not go through.');
    } finally {
      setBusyRequest(null);
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
                <PersonAvatar person={member.user} size={36} link />
                <div className="min-w-0">
                  <p className="text-sm">
                    <PersonLink person={member.user} />
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
      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-signal-bad">
          {error}
        </p>
      )}

      {/* -- who has been asked, who is asking --------------------------------- */}
      {isMember && pending && (
        <Card className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="type-label text-accent-text">Waiting for an answer</h2>
            <span className="readout text-xs text-ink-500 dark:text-ink-400">
              {invites.length} invited · {applications.length} asked to join
            </span>
          </div>

          {pending.length === 0 ? (
            <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">
              Nobody is waiting on this team.
              {isOwner && team.openSeats > 0
                ? ' Invite someone from the suggestions below, or from anyone’s profile.'
                : ''}
            </p>
          ) : (
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div>
                <p className="type-label mb-3 text-[0.7rem] text-ink-500 dark:text-ink-400">Invited</p>
                {invites.length === 0 ? (
                  <p className="text-sm text-ink-600 dark:text-ink-400">No open invitations.</p>
                ) : (
                  <ul className="space-y-3">
                    {invites.map((request) => (
                      <PendingRow
                        key={request.id}
                        request={request}
                        verb="invited"
                        actions={
                          isOwner && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busyRequest === request.id}
                              onClick={() => void respond(request.id, 'cancel')}
                            >
                              Withdraw
                            </Button>
                          )
                        }
                      />
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="type-label mb-3 text-[0.7rem] text-ink-500 dark:text-ink-400">
                  Asked to join
                </p>
                {applications.length === 0 ? (
                  <p className="text-sm text-ink-600 dark:text-ink-400">No open applications.</p>
                ) : (
                  <ul className="space-y-3">
                    {applications.map((request) => (
                      <PendingRow
                        key={request.id}
                        request={request}
                        verb="applied"
                        actions={
                          isOwner && (
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
                          )
                        }
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Card>
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

      {report && (
        <Card className="mt-6">
          <TeamRisks
            risks={report.risks}
            availability={report.availability}
            size={report.size.current}
          />
        </Card>
      )}

      {/* Members only: once a team exists, talking to it is what people came
          back for. */}
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
                {candidates.map((candidate) => {
                  const invited = invitedIds.has(candidate.user.id);
                  return (
                    <li key={candidate.user.id} className="panel panel-soft-sm p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-3">
                          <PersonAvatar person={candidate.user} size={40} link />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <PersonLink person={candidate.user} />
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
                        </div>

                        <Button
                          size="sm"
                          variant={invited ? 'outline' : 'primary'}
                          disabled={invited}
                          onClick={() => void invite(candidate.user.id, candidate.user.firstName)}
                        >
                          {invited ? 'Invited' : 'Invite'}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}
    </Container>
  );
}

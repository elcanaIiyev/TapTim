import { useCallback, useEffect, useState } from 'react';
import { PersonLink } from '../components/people/PersonLink';
import { cn } from '../lib/cn';
import { fittedGrid } from '../lib/grid';
import { Link, useParams } from 'react-router-dom';
import { TeamLogo } from '../components/teams/TeamLogo';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Container } from '../components/ui/Container';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { ApiError, teamsApi } from '../lib/api';
import { formatDate } from '../lib/format';
import type { PublicTeamPage } from '../lib/types';

/**
 * A team's public recruiting page.
 *
 * Shareable with somebody who has no account, which is the point: "we're three
 * backend people who need a designer, here's what we've built" is a far better
 * pitch than "join our team", and every part of it is already computed.
 *
 * Deliberately not a copy of the team page. No risk panel, no readiness score,
 * no confidence caveats — those are for the team, and publishing "this team may
 * fail because nobody wants to lead" would be a strange way to recruit. What is
 * here is what the roster covers, what it does not, and who is on it.
 */
export function TeamRecruitPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();

  const [page, setPage] = useState<PublicTeamPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setPage(await teamsApi.publicPage(id));
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) setGone(true);
      else setError(caught instanceof ApiError ? caught.message : 'Could not load that page.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (gone) {
    return (
      <Container className="py-20">
        <h1 className="type-title text-ink-900 dark:text-white">Not recruiting</h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          This team either does not exist or has stopped looking for people. Recruiting pages
          are live only while a team has seats open.
        </p>
        <Button className="mt-6" variant="outline" to="/events">
          Find an event
        </Button>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-20">
        <p role="alert" className="text-sm font-medium text-signal-bad">
          {error}
        </p>
      </Container>
    );
  }

  if (!page) {
    return (
      <Container className="py-20">
        <div className="flex items-center gap-3 text-sm text-ink-600 dark:text-ink-300">
          <Spinner className="text-iris-600 dark:text-iris-400" />
          Loading…
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-14 sm:py-20">
      {/* -- the pitch --------------------------------------------------------- */}
      {/* Their pitch, in their words — a panel, not a readout. */}
      <div className="panel panel-soft relative overflow-hidden p-6 sm:p-8">

        <div className="relative">
          <Link
            to={`/events/${page.event.id}`}
            className="type-label text-accent-text underline decoration-2 underline-offset-4"
          >
            {page.event.name}
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <TeamLogo name={page.name} src={page.logoUrl} className="h-14 w-14" textClassName="text-lg" />
            <h1 className="type-display text-ink-900 dark:text-white">{page.name}</h1>
          </div>

          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-700 dark:text-ink-200">
            {page.pitch}
          </p>

          {page.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-600 dark:text-ink-300">
              {page.description}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-600 dark:text-ink-300">
            <span>
              <strong className="tabular-nums text-ink-900 dark:text-white">
                {page.openSeats}
              </strong>{' '}
              of {page.maxSize} seats open
            </span>
            <span>{formatDate(page.event.startDate)}</span>
            <span>
              {page.event.location} · {page.event.mode}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {/* Signed out, the useful action is to sign up — the team cannot be
                joined without an account, and pretending otherwise wastes a click. */}
            <Button to={user ? `/teams/${page.teamId}` : '/signup'}>
              {user ? 'Open the team' : 'Sign up to apply'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(window.location.href)
                  .then(() => setCopied(true))
                  // Clipboard access can be refused; saying nothing would look
                  // like the button is broken.
                  .catch(() => setError('Could not copy the link — copy it from the address bar.'));
              }}
            >
              {copied ? 'Link copied' : 'Copy link'}
            </Button>
          </div>
        </div>
      </div>

      {/* -- the honest ask ---------------------------------------------------- */}
      {(page.lookingFor.length > 0 || page.needs.length > 0) && (
        <Card className="mt-6">
          <h2 className="type-label text-accent-text">What we still need</h2>

          {page.lookingFor.length > 0 && (
            <div className="mt-4">
              <p className="type-label mb-2 text-[0.7rem] text-ink-500 dark:text-ink-400">
                Positions
              </p>
              <div className="flex flex-wrap gap-2">
                {page.lookingFor.map((role) => (
                  <Badge key={role} tone="warning">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {page.needs.length > 0 && (
            <div className="mt-5">
              <p className="type-label mb-2 text-[0.7rem] text-ink-500 dark:text-ink-400">
                Nobody covers
              </p>
              <div className="flex flex-wrap gap-2">
                {page.needs.map((area) => (
                  <Badge key={area} tone="neutral">
                    {area}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* -- what they've built ------------------------------------------------ */}
      {page.strengths.length > 0 && (
        <Card className="mt-6">
          <h2 className="type-label text-accent-text">What we already cover</h2>
          <ul className="mt-4 space-y-3">
            {page.strengths.map((strength) => (
              <li key={strength.area} className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900 dark:text-white">{strength.area}</p>
                  {strength.skills.length > 0 && (
                    <p className="mt-0.5 text-xs text-ink-600 dark:text-ink-400">
                      {strength.skills.join(', ')}
                    </p>
                  )}
                </div>
                <span className="readout shrink-0 text-sm font-bold tabular-nums text-success-text">
                  {strength.score}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* -- who's on it ------------------------------------------------------- */}
      <Card className="mt-6">
        <h2 className="type-label text-accent-text">
          Who you would be working with
        </h2>
        <ul className={cn('mt-4 grid gap-4', fittedGrid(page.members.length, 2))}>
          {page.members.map((member) => (
            <li
              key={member.id}
              className="flex gap-3 rounded-[var(--radius-soft-sm)] border border-ink-200 p-4 dark:border-ink-700"
            >
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-iris-600 text-sm font-bold text-white"
                >
                  {member.firstName?.[0]?.toUpperCase() ?? '?'}
                </span>
              )}

              <div className="min-w-0">
                <p className="font-semibold text-ink-900 dark:text-white">
                  <PersonLink person={member} />
                  {member.verified && (
                    <Badge tone="success" className="ml-2">
                      Verified
                    </Badge>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-ink-600 dark:text-ink-400">
                  {member.roles.join(' · ')}
                </p>

                {member.topSkills.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {member.topSkills.map((skill) => (
                      <li
                        key={skill.name}
                        className="rounded-full border border-ink-200 px-2 py-0.5 text-[0.7rem] text-ink-700 dark:border-ink-700 dark:text-ink-300"
                      >
                        {skill.name}
                        {skill.endorsements > 0 && (
                          <span className="ml-1 font-semibold text-success-text">
                            ✓{skill.endorsements}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <p className="mt-8 text-xs text-ink-500 dark:text-ink-400">
        Built with TapTim — teams matched on skills, roles, and how people actually like to work.
      </p>
    </Container>
  );
}

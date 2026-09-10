import { useCallback, useEffect, useMemo, useState } from 'react';
import { PersonAvatar, PersonLink } from '../components/people/PersonLink';
import { fittedGrid } from '../lib/grid';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ChatPanel } from '../components/connections/ChatPanel';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { Input } from '../components/ui/Input';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { ApiError, connectionsApi, profileApi } from '../lib/api';
import { cn } from '../lib/cn';
import { rolesSummary, skillLabel } from '../lib/types';
import type { ConnectionsOverview, ConnectionState, DirectoryUser } from '../lib/types';

/**
 * People, requests, and conversations.
 *
 * Messaging is deliberately gated on a connection: an inbox anybody can push
 * into is the failure mode of every open directory, and the server enforces it
 * regardless of what this page offers.
 */

type Tab = 'connections' | 'discover' | 'requests';

function Avatar({ person, size = 44 }: { person: DirectoryUser; size?: number }) {
  return <PersonAvatar person={person} size={size} link />;
}

export function ConnectionsPage() {
  const { user, initialising } = useAuth();

  const [tab, setTab] = useState<Tab>('connections');
  const [overview, setOverview] = useState<ConnectionsOverview | null>(null);
  const [people, setPeople] = useState<DirectoryUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatWith, setChatWith] = useState<string | null>(null);

  // `?with=<id>` opens straight into one thread. The chat dock's "Open full"
  // uses it, so leaving the popup lands on the conversation you were reading
  // rather than on the index with everything closed.
  const [params, setParams] = useSearchParams();
  const requested = params.get('with');
  useEffect(() => {
    if (!requested) return;
    setChatWith(requested);
    // Consumed, so a later close does not get undone by a refresh of this page.
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('with');
      return next;
    }, { replace: true });
  }, [requested, setParams]);

  const loadOverview = useCallback(async () => {
    setOverview(await connectionsApi.overview());
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadOverview().finally(() => setLoading(false));
  }, [user, loadOverview]);

  // The directory is only fetched for the Discover tab, and debounced so
  // typing does not fire a request per keystroke.
  useEffect(() => {
    if (!user || tab !== 'discover') return;
    const timer = window.setTimeout(() => {
      void profileApi.directory({ search: search.trim() || undefined }).then(setPeople);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [user, tab, search]);

  /** What the viewer's relationship with each person already is. */
  const stateByPerson = useMemo(() => {
    const map = new Map<string, { state: ConnectionState; id: string | null }>();
    for (const group of [overview?.connected, overview?.incoming, overview?.outgoing]) {
      for (const view of group ?? []) map.set(view.person.id, { state: view.state, id: view.id });
    }
    return map;
  }, [overview]);

  if (initialising) {
    return (
      <Container className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="text-iris-600 dark:text-iris-400" />
      </Container>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const act = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      await loadOverview();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not go through.');
    } finally {
      setBusy(null);
    }
  };

  const TABS: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'connections', label: 'Connections', count: overview?.connected.length },
    { id: 'discover', label: 'Discover' },
    { id: 'requests', label: 'Requests', count: overview?.incoming.length },
  ];

  return (
    <Container className="py-12">
      <SectionHeading
        overline="Connections"
        title="People you could build with"
        description="Connect first, then message. Open anyone's profile to see how the two of you would fit — and to invite them to one of your teams."
      />

      {/* -- tabs ------------------------------------------------------------ */}
      <div role="tablist" aria-label="Connections" className="mt-9 flex flex-wrap gap-2">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
            className={cn(
              'type-label cursor-pointer rounded-full border px-4 py-2 transition-colors',
              tab === entry.id
                ? 'border-iris-600 bg-iris-600 text-white'
                : 'border-ink-300 text-ink-600 hover:border-iris-500 hover:text-accent-text dark:border-ink-700 dark:text-ink-400',
            )}
          >
            {entry.label}
            {entry.count ? (
              <span className="readout ml-2 rounded-full bg-white/20 px-1.5">{entry.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-signal-bad">
          {error}
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {loading ? (
            <div className="panel panel-soft flex items-center gap-3 px-6 py-14">
              <Spinner className="text-iris-600 dark:text-iris-400" />
              <span className="text-sm text-ink-600 dark:text-ink-300">Loading…</span>
            </div>
          ) : tab === 'connections' ? (
            (overview?.connected.length ?? 0) === 0 ? (
              <div className="panel panel-soft px-6 py-14 text-center">
                <p className="type-label text-ink-600 dark:text-ink-400">No connections yet</p>
                <p className="mx-auto mt-3 max-w-sm text-sm text-ink-600 dark:text-ink-300">
                  Find people in Discover and send a request. Once they accept, you can message
                  each other.
                </p>
                <Button className="mt-7" onClick={() => setTab('discover')}>
                  Discover people
                </Button>
              </div>
            ) : (
              <ul className="space-y-3">
                {overview!.connected.map((view) => (
                  <li key={view.person.id} className="panel panel-soft-sm p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 gap-3">
                        <Avatar person={view.person} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <PersonLink person={view.person} />
                            {view.unread > 0 && <Badge tone="accent">{view.unread} new</Badge>}
                          </div>
                          <p className="text-xs text-ink-600 dark:text-ink-400">
                            {rolesSummary(view.person.roles)}
                          </p>
                          {view.lastMessage && (
                            <p className="mt-1.5 truncate text-sm text-ink-600 dark:text-ink-300">
                              {view.lastMessage.sentByMe ? 'You: ' : ''}
                              {view.lastMessage.body}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button size="sm" onClick={() => setChatWith(view.person.id)}>
                          Message
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy === view.id}
                          onClick={() =>
                            void act(view.id!, () => connectionsApi.disconnect(view.id!))
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : tab === 'requests' ? (
            <div className="space-y-8">
              <div>
                <p className="type-label text-ink-700 dark:text-ink-300">Waiting on you</p>
                {(overview?.incoming.length ?? 0) === 0 ? (
                  <p className="mt-3 text-sm text-ink-600 dark:text-ink-400">
                    Nothing waiting on you.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {overview!.incoming.map((view) => (
                      <li key={view.person.id} className="panel panel-soft-sm flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar person={view.person} size={38} />
                          <div className="min-w-0">
                            <PersonLink person={view.person} />
                            <p className="text-xs text-ink-600 dark:text-ink-400">
                              {rolesSummary(view.person.roles)}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={busy === view.id}
                            onClick={() => void act(view.id!, () => connectionsApi.respond(view.id!, 'accept'))}
                          >
                            {busy === view.id && <Spinner />}
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy === view.id}
                            onClick={() => void act(view.id!, () => connectionsApi.respond(view.id!, 'decline'))}
                          >
                            Decline
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="type-label text-ink-700 dark:text-ink-300">Sent, awaiting a reply</p>
                {(overview?.outgoing.length ?? 0) === 0 ? (
                  <p className="mt-3 text-sm text-ink-600 dark:text-ink-400">Nothing pending.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {overview!.outgoing.map((view) => (
                      <li key={view.person.id} className="panel panel-soft-sm flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar person={view.person} size={38} />
                          <PersonLink person={view.person} />
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy === view.id}
                          onClick={() => void act(view.id!, () => connectionsApi.respond(view.id!, 'cancel'))}
                        >
                          Cancel
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="max-w-md">
                <Input
                  label="Search people"
                  placeholder="Name, bio, or skill"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <ul className={cn('mt-6 grid gap-4', fittedGrid(people.length, 2))}>
                {people.map((person) => {
                  const relation = stateByPerson.get(person.id);
                  const topSkills = [...person.skills]
                    .sort((a, b) => (person.skillLevels?.[b] ?? 0) - (person.skillLevels?.[a] ?? 0))
                    .slice(0, 3);

                  return (
                    <li key={person.id} className="panel panel-soft-sm relative overflow-hidden p-5">
                      <div className="relative">
                        <div className="flex items-start gap-3">
                          <Avatar person={person} />
                          <div className="min-w-0">
                            <PersonLink person={person} />
                            <p className="text-xs text-ink-600 dark:text-ink-400">
                              {rolesSummary(person.roles)}
                              {person.locationCity ? ` · ${person.locationCity}` : ''}
                            </p>
                          </div>
                        </div>

                        {topSkills.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {topSkills.map((skill) => (
                              <Badge key={skill} tone="neutral">
                                {skill}
                                {person.skillLevels?.[skill] !== undefined
                                  ? ` · ${skillLabel(person.skillLevels[skill])}`
                                  : ''}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <div className="mt-4">
                          {relation?.state === 'connected' ? (
                            <Button size="sm" onClick={() => setChatWith(person.id)}>
                              Message
                            </Button>
                          ) : relation?.state === 'pending-sent' ? (
                            <Button size="sm" variant="outline" disabled>
                              Request sent
                            </Button>
                          ) : relation?.state === 'pending-received' ? (
                            <Button
                              size="sm"
                              disabled={busy === relation.id}
                              onClick={() =>
                                void act(relation.id!, () => connectionsApi.respond(relation.id!, 'accept'))
                              }
                            >
                              Accept request
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy === person.id}
                              onClick={() => void act(person.id, () => connectionsApi.request(person.id))}
                            >
                              {busy === person.id && <Spinner />}
                              Connect
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* -- the open conversation ------------------------------------------ */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          {chatWith ? (
            <ChatPanel
              partnerId={chatWith}
              viewerId={user.id}
              onClose={() => setChatWith(null)}
              onRead={() => void loadOverview()}
            />
          ) : (
            <div className="panel panel-soft px-5 py-10 text-center">
              <p className="type-label text-ink-600 dark:text-ink-400">No conversation open</p>
              <p className="mx-auto mt-3 max-w-xs text-sm text-ink-600 dark:text-ink-300">
                Pick someone from your connections to start talking.
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="mt-8 max-w-2xl text-xs leading-relaxed text-ink-500 dark:text-ink-400">
        You can invite someone from their profile, or from your team's page, where suggestions
        are ranked by how much of what your team is missing each person would cover.{' '}
        <Link to="/events" className="text-accent-text underline decoration-2 underline-offset-4">
          Browse events →
        </Link>
      </p>
    </Container>
  );
}

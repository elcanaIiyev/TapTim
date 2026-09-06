import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useChatDock } from '../../context/ChatDockContext';
import type { ChatTab } from '../../context/ChatDockContext';
import { cn } from '../../lib/cn';
import type { ConnectionView, Team } from '../../lib/types';
import { ChatPanel } from '../connections/ChatPanel';
import { TeamChannel } from '../teams/TeamChannel';
import { TeamLogo } from '../teams/TeamLogo';

/**
 * The chat dock.
 *
 * Messaging used to live exactly one place — the right-hand column of
 * /connections — which meant a reply cost a navigation away from whatever you
 * were doing, and there was no way to notice one had arrived without going to
 * look. A dock fixes both: it is anchored to the window rather than to a page,
 * so it survives every route change, and its launcher carries the unread count
 * on every screen.
 *
 * Two tabs, because a hackathon weekend happens in the team channel and not in
 * DMs. A dock reaching only direct messages was missing the half people
 * actually use, and undercounting its own badge by exactly that half.
 *
 * Two levels deep and no further: a list, and one conversation. A dock that
 * grew search, filters and group creation would be a second copy of
 * /connections floating over the site — which is what "Open full" is for, and
 * it lands on the conversation you were in rather than on the index.
 */

/** How much of a message to preview in the list. */
const PREVIEW_CHARS = 58;

function relative(iso: string): string {
  const minutes = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

function truncate(text: string): string {
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text;
}

function UnreadPip({ count }: { count: number }) {
  return (
    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-fern-600 px-1.5 text-[0.65rem] font-bold tabular-nums text-white">
      {count > 9 ? '9+' : count}
    </span>
  );
}

const ROW = [
  'flex w-full cursor-pointer items-center gap-3 border-b border-ink-100 px-4 py-3 text-left transition-colors last:border-b-0',
  'hover:bg-iris-50 dark:border-ink-800 dark:hover:bg-ink-800',
].join(' ');

function DirectRow({ view, onOpen }: { view: ConnectionView; onOpen: () => void }) {
  const preview = view.lastMessage
    ? `${view.lastMessage.sentByMe ? 'You: ' : ''}${view.lastMessage.body}`
    : 'No messages yet';

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(ROW, view.unread > 0 && 'bg-iris-50/60 dark:bg-ink-800/60')}
      >
        {view.person.avatarUrl ? (
          <img src={view.person.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-iris-600 text-xs font-bold text-white"
          >
            {view.person.firstName?.[0]?.toUpperCase() ?? '?'}
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold text-ink-900 dark:text-white">
              {view.person.fullName}
            </span>
            {view.lastMessage && (
              <span className="readout shrink-0 text-[0.65rem] text-ink-500 dark:text-ink-400">
                {relative(view.lastMessage.at)}
              </span>
            )}
          </span>
          <span
            className={cn(
              'mt-0.5 block truncate text-xs',
              view.unread > 0
                ? 'font-semibold text-ink-800 dark:text-ink-100'
                : 'text-ink-600 dark:text-ink-400',
            )}
          >
            {truncate(preview)}
          </span>
        </span>

        {view.unread > 0 && <UnreadPip count={view.unread} />}
      </button>
    </li>
  );
}

function TeamRow({ team, onOpen }: { team: Team; onOpen: () => void }) {
  const unread = team.unread ?? 0;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(ROW, unread > 0 && 'bg-iris-50/60 dark:bg-ink-800/60')}
      >
        <TeamLogo
          name={team.name}
          src={team.logoUrl}
          className="h-9 w-9 shrink-0"
          textClassName="text-[0.65rem]"
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink-900 dark:text-white">
            {team.name}
          </span>
          <span
            className={cn(
              'mt-0.5 block truncate text-xs',
              unread > 0
                ? 'font-semibold text-ink-800 dark:text-ink-100'
                : 'text-ink-600 dark:text-ink-400',
            )}
          >
            {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
            {team.description ? ` · ${truncate(team.description)}` : ''}
          </span>
        </span>

        {unread > 0 && <UnreadPip count={unread} />}
      </button>
    </li>
  );
}

export function ChatDock() {
  const { user } = useAuth();
  const {
    open,
    tab,
    setTab,
    partnerId,
    teamId,
    unread,
    directUnread,
    teamUnread,
    overview,
    teams,
    openWith,
    openTeam,
    close,
    toggle,
    back,
    refresh,
  } = useChatDock();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Escape closes the conversation first, then the dock — the same two-step
  // every nested panel on the site uses, so it never swallows the whole dock
  // when the person only meant to leave the thread.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (partnerId || teamId) back();
      else close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, partnerId, teamId, back, close]);

  // Sorted by recency, with unread first: the dock is small, so its first few
  // rows are effectively all it shows.
  const conversations = useMemo(() => {
    const connected = overview?.connected ?? [];
    return [...connected].sort((a, b) => {
      if ((b.unread > 0 ? 1 : 0) !== (a.unread > 0 ? 1 : 0)) return b.unread - a.unread;
      const at = (view: ConnectionView) => (view.lastMessage ? Date.parse(view.lastMessage.at) : 0);
      return at(b) - at(a);
    });
  }, [overview]);

  const channels = useMemo(
    () => [...teams].sort((a, b) => (b.unread ?? 0) - (a.unread ?? 0)),
    [teams],
  );

  /** Where "Open full" goes — the conversation on screen, not the index. */
  const goFull = (to: string) => {
    close();
    back();
    navigate(to);
  };

  if (!user) return null;

  // Not on /connections: the dock's only job there would be to cover the
  // full-size version of itself.
  if (pathname === '/connections') return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => toggle()}
        aria-label={unread > 0 ? `Chat, ${unread} unread` : 'Chat'}
        className={cn(
          'press fixed bottom-5 right-5 z-40 flex cursor-pointer items-center gap-2.5 rounded-full',
          'border border-iris-700 bg-iris-600 px-4 py-3 font-semibold text-white',
          'shadow-[var(--shadow-soft-iris)] hover:bg-iris-700 dark:border-iris-500',
        )}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
        </svg>
        <span className="hidden text-sm sm:inline">Chat</span>
        {unread > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1.5 text-[0.65rem] font-bold tabular-nums text-iris-700">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    );
  }

  const TABS: Array<{ id: ChatTab; label: string; count: number }> = [
    { id: 'direct', label: 'Chat', count: directUnread },
    { id: 'teams', label: 'Team chat', count: teamUnread },
  ];

  return (
    <div
      className={cn(
        'dock-in panel floating fixed bottom-5 right-5 z-40 flex flex-col overflow-hidden',
        'h-[30rem] max-h-[calc(100vh-6rem)] w-[21rem] max-w-[calc(100vw-2.5rem)]',
      )}
      role="dialog"
      aria-label="Chat"
    >
      {partnerId ? (
        <ChatPanel
          fill
          partnerId={partnerId}
          viewerId={user.id}
          onBack={() => {
            back();
            // Leaving a thread is exactly when the unread count is stale.
            void refresh();
          }}
          onOpenFull={() => goFull(`/connections?with=${partnerId}`)}
          onClose={() => {
            back();
            close();
            void refresh();
          }}
          onRead={() => void refresh()}
        />
      ) : teamId ? (
        <TeamChannel
          fill
          teamId={teamId}
          viewerId={user.id}
          title={teams.find((team) => team.id === teamId)?.name}
          onBack={() => {
            back();
            void refresh();
          }}
          onOpenFull={() => goFull(`/teams/${teamId}`)}
          onRead={() => void refresh()}
        />
      ) : (
        <>
          <header className="border-b border-ink-200 dark:border-ink-700">
            <div className="flex items-center justify-between gap-2 px-4 pt-3">
              <p className="type-label text-ink-700 dark:text-ink-300">Messages</p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => goFull(tab === 'teams' ? '/teams' : '/connections')}
                  className="cursor-pointer font-mono text-xs font-semibold text-accent-text underline-offset-4 hover:underline"
                >
                  Open full
                </button>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close chat"
                  className="icon-btn grid h-7 w-7 cursor-pointer place-items-center rounded-full text-ink-600 transition-colors hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div role="tablist" aria-label="Conversations" className="flex gap-1 px-3 pb-2 pt-2">
              {TABS.map((entry) => (
                <button
                  key={entry.id}
                  role="tab"
                  aria-selected={tab === entry.id}
                  onClick={() => setTab(entry.id)}
                  className={cn(
                    'type-label flex-1 cursor-pointer rounded-full px-3 py-1.5 transition-colors',
                    tab === entry.id
                      ? 'bg-iris-600 text-white'
                      : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-white',
                  )}
                >
                  {entry.label}
                  {entry.count > 0 && (
                    <span
                      className={cn(
                        'readout ml-1.5 rounded-full px-1.5 text-[0.65rem]',
                        tab === entry.id ? 'bg-white/25' : 'bg-fern-600 text-white',
                      )}
                    >
                      {entry.count > 9 ? '9+' : entry.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            {tab === 'direct' ? (
              !overview ? (
                <p className="px-4 py-6 text-sm text-ink-600 dark:text-ink-300">Loading…</p>
              ) : conversations.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-ink-600 dark:text-ink-300">
                    Nobody to message yet. Messaging opens once a connection request is accepted.
                  </p>
                  <button
                    type="button"
                    onClick={() => goFull('/connections')}
                    className="mt-4 cursor-pointer font-mono text-xs font-semibold text-accent-text underline-offset-4 hover:underline"
                  >
                    Find people →
                  </button>
                </div>
              ) : (
                <ul>
                  {conversations.map((view) => (
                    <DirectRow
                      key={view.person.id}
                      view={view}
                      onOpen={() => openWith(view.person.id)}
                    />
                  ))}
                </ul>
              )
            ) : channels.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-ink-600 dark:text-ink-300">
                  You are not on a team yet. Teams are formed per event, so this fills up once you
                  join one.
                </p>
                <button
                  type="button"
                  onClick={() => goFull('/events')}
                  className="mt-4 cursor-pointer font-mono text-xs font-semibold text-accent-text underline-offset-4 hover:underline"
                >
                  Browse events →
                </button>
              </div>
            ) : (
              <ul>
                {channels.map((team) => (
                  <TeamRow key={team.id} team={team} onOpen={() => openTeam(team.id)} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

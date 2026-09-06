import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useChatDock } from '../../context/ChatDockContext';
import { cn } from '../../lib/cn';
import type { ConnectionView } from '../../lib/types';
import { ChatPanel } from '../connections/ChatPanel';

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
 * Two levels deep and no further. The launcher opens a list of the people you
 * are connected to, newest conversation first; picking one swaps the same
 * panel to that thread with a back arrow. A dock that grew tabs, search, and
 * group threads would be a second copy of /connections floating over the site.
 */

/** How much of a message to preview in the list. */
const PREVIEW_CHARS = 60;

function relative(iso: string): string {
  const minutes = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

function ConversationRow({
  view,
  onOpen,
}: {
  view: ConnectionView;
  onOpen: () => void;
}) {
  const preview = view.lastMessage
    ? `${view.lastMessage.sentByMe ? 'You: ' : ''}${view.lastMessage.body}`
    : 'No messages yet';

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full cursor-pointer items-center gap-3 border-b border-ink-100 px-4 py-3 text-left transition-colors last:border-b-0',
          'hover:bg-iris-50 dark:border-ink-800 dark:hover:bg-ink-800',
          view.unread > 0 && 'bg-iris-50/60 dark:bg-ink-800/60',
        )}
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
            {preview.length > PREVIEW_CHARS ? `${preview.slice(0, PREVIEW_CHARS)}…` : preview}
          </span>
        </span>

        {view.unread > 0 && (
          <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-fern-600 px-1.5 text-[0.65rem] font-bold tabular-nums text-white">
            {view.unread > 9 ? '9+' : view.unread}
          </span>
        )}
      </button>
    </li>
  );
}

export function ChatDock() {
  const { user } = useAuth();
  const { open, partnerId, unread, overview, openWith, close, toggle, clearPartner, refresh } =
    useChatDock();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Escape closes the thread first, then the dock — the same two-step every
  // nested panel on the site uses, so it never swallows the whole dock when
  // the person only meant to leave the conversation.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (partnerId) clearPartner();
      else close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, partnerId, clearPartner, close]);

  // Sorted by recency, with unread first: the dock is small, so what it shows
  // in its first few rows is effectively all it shows.
  const conversations = useMemo(() => {
    const connected = overview?.connected ?? [];
    return [...connected].sort((a, b) => {
      if ((b.unread > 0 ? 1 : 0) !== (a.unread > 0 ? 1 : 0)) return b.unread - a.unread;
      const at = (view: ConnectionView) => (view.lastMessage ? Date.parse(view.lastMessage.at) : 0);
      return at(b) - at(a);
    });
  }, [overview]);

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

  return (
    <div
      className={cn(
        'dock-in panel panel-soft-lg fixed bottom-5 right-5 z-40 flex flex-col overflow-hidden p-0',
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
            clearPartner();
            // Coming out of a thread is exactly when the unread count is stale.
            void refresh();
          }}
          onClose={() => {
            clearPartner();
            close();
            void refresh();
          }}
          onRead={() => void refresh()}
        />
      ) : (
        <>
          <header className="flex items-center justify-between gap-2 border-b border-ink-200 px-4 py-3 dark:border-ink-700">
            <p className="type-label text-ink-700 dark:text-ink-300">
              Chat
              {unread > 0 && <span className="ml-2 text-accent-text">{unread} unread</span>}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  close();
                  navigate('/connections');
                }}
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
          </header>

          <div className="flex-1 overflow-y-auto">
            {!overview ? (
              <p className="px-4 py-6 text-sm text-ink-600 dark:text-ink-300">Loading…</p>
            ) : conversations.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-ink-600 dark:text-ink-300">
                  Nobody to message yet. Messaging opens once a connection request is accepted.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    navigate('/connections');
                  }}
                  className="mt-4 cursor-pointer font-mono text-xs font-semibold text-accent-text underline-offset-4 hover:underline"
                >
                  Find people →
                </button>
              </div>
            ) : (
              <ul>
                {conversations.map((view) => (
                  <ConversationRow
                    key={view.person.id}
                    view={view}
                    onOpen={() => openWith(view.person.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

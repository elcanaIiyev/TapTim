import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, notificationsApi } from '../../lib/api';
import { cn } from '../../lib/cn';
import type { NotificationFeed, NotificationItem } from '../../lib/types';

/**
 * The bell.
 *
 * The point of the whole notifications feature is that things stop being
 * discoverable only by navigating somewhere and looking, so this has to be
 * visible from every page — which is why it lives in the navbar rather than on
 * a notifications page nobody would think to open.
 *
 * Polled on the same interval as the chats, paused while the tab is hidden.
 */

const POLL_MS = 30_000;

function relative(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState<NotificationFeed | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setFeed(await notificationsApi.list());
    } catch (caught) {
      // A failing bell must not break the page it sits on, so this is recorded
      // and shown inside the panel rather than thrown.
      setError(caught instanceof ApiError ? caught.message : 'Could not load notifications.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  // Close on an outside click or Escape — a panel that can only be closed by
  // the button that opened it is a trap on a narrow screen.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unread = feed?.unread ?? 0;

  async function openItem(item: NotificationItem) {
    setOpen(false);

    // Marked optimistically: the navigation is the point, and a failed mark
    // should not hold it up or bounce the count back and forth.
    if (!item.readAt) {
      setFeed((current) =>
        current
          ? {
              unread: Math.max(0, current.unread - 1),
              items: current.items.map((entry) =>
                entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
              ),
            }
          : current,
      );
      void notificationsApi.markRead(item.id).catch(() => undefined);
    }

    if (item.link) navigate(item.link);
  }

  async function markAll() {
    setFeed((current) =>
      current
        ? {
            unread: 0,
            items: current.items.map((entry) => ({
              ...entry,
              readAt: entry.readAt ?? new Date().toISOString(),
            })),
          }
        : current,
    );
    await notificationsApi.markAllRead().catch(() => undefined);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'relative grid h-8 w-8 cursor-pointer place-items-center rounded-full border transition-colors',
          open
            ? 'border-iris-600 text-accent-text'
            : 'border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-900 dark:text-ink-300 dark:hover:border-ink-600 dark:hover:text-white',
        )}
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-fern-600 px-1 text-[0.6rem] font-bold tabular-nums text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="panel absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden p-0 shadow-lg">
          <div className="flex items-center justify-between gap-3 border-b border-ink-200 px-4 py-3 dark:border-ink-700">
            <p className="type-label text-ink-700 dark:text-ink-300">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAll()}
                className="cursor-pointer font-mono text-xs font-semibold text-accent-text underline-offset-4 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {error ? (
              <p role="alert" className="px-4 py-6 text-sm text-signal-bad">
                {error}
              </p>
            ) : !feed ? (
              <p className="px-4 py-6 text-sm text-ink-600 dark:text-ink-300">Loading…</p>
            ) : feed.items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-600 dark:text-ink-300">
                Nothing yet. Invitations, applications and replies show up here.
              </p>
            ) : (
              <ul>
                {feed.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void openItem(item)}
                      className={cn(
                        'flex w-full cursor-pointer items-start gap-3 border-b border-ink-100 px-4 py-3 text-left transition-colors last:border-b-0',
                        'hover:bg-iris-50 dark:border-ink-800 dark:hover:bg-ink-800',
                        !item.readAt && 'bg-iris-50/60 dark:bg-ink-800/60',
                      )}
                    >
                      {item.actor?.avatarUrl ? (
                        <img
                          src={item.actor.avatarUrl}
                          alt=""
                          className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-iris-600 text-[0.7rem] font-bold text-white"
                        >
                          {item.actor?.fullName?.[0]?.toUpperCase() ?? '·'}
                        </span>
                      )}

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-snug text-ink-900 dark:text-white">
                          {item.title}
                        </span>
                        {item.body && (
                          <span className="mt-0.5 block truncate text-xs text-ink-600 dark:text-ink-400">
                            {item.body}
                          </span>
                        )}
                        <span className="readout mt-1 block text-[0.65rem] text-ink-500 dark:text-ink-400">
                          {relative(item.createdAt)}
                        </span>
                      </span>

                      {!item.readAt && (
                        <span
                          aria-hidden="true"
                          className="mt-2 h-2 w-2 shrink-0 rounded-full bg-fern-600"
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

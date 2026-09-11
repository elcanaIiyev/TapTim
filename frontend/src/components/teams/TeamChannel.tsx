import { useCallback, useEffect, useRef, useState } from 'react';
import { PersonLink } from '../people/PersonLink';
import { ApiError, teamsApi } from '../../lib/api';
import { cn } from '../../lib/cn';
import type { TeamChannel as Channel } from '../../lib/types';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

/**
 * The team's room.
 *
 * This is the piece that decides whether TapTim is a tool that introduced you
 * or a tool you used all weekend. Everything else about a team already lives on
 * this page, so the channel does too rather than in a separate messages area —
 * the roster, the gap report and the conversation are one thing.
 *
 * Polled on the same five-second interval as direct messages, paused while the
 * tab is hidden. A group channel is a stronger case for a websocket than a DM
 * is, but the tradeoff has not changed: both people are usually on the page,
 * and a poll costs a fraction of the moving parts for the same felt latency.
 *
 * Grouped by sender rather than repeating an avatar and a name on every line —
 * four people talking quickly is otherwise a column of headshots with the
 * conversation squeezed beside it.
 */

const POLL_MS = 5000;

/** Consecutive messages from one person inside this window read as one turn. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dayOf(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) return 'Today';
  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

export function TeamChannel({
  teamId,
  viewerId,
  /** Lets the page clear its unread badge once the channel has been opened. */
  onRead,
  title,
  onBack,
  onOpenFull,
  fill = false,
}: {
  teamId: string;
  viewerId: string;
  onRead?: () => void;
  /** The team's name, in the dock — on the team page the heading above says it. */
  title?: string;
  /** Present in the dock, where going back to the list is not closing. */
  onBack?: () => void;
  /** Present in the dock: leave the popup for this team's own page. */
  onOpenFull?: () => void;
  /**
   * Fill the parent instead of standing at its own fixed height. A boolean
   * rather than a className override: `cn` is a plain join with no conflict
   * resolution, so `h-full` alongside the built-in `h-[30rem]` would leave
   * both in the class list and let source order decide.
   */
  fill?: boolean;
}) {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const readNotified = useRef(false);

  // The latest `onRead`, read through a ref rather than listed as a dependency.
  // Callers pass an inline arrow, so it is a new function on every render of
  // theirs — and calling it re-renders them. As a dependency it rebuilt `load`,
  // which re-ran the reset below: the header blanked to "Loading…", the thread
  // refetched, and `onRead` fired again. Measured on the live site at 19
  // fetches in ten seconds, where the five-second poll alone makes two.
  const onReadRef = useRef(onRead);
  useEffect(() => {
    onReadRef.current = onRead;
  }, [onRead]);

  const load = useCallback(
    async (announce = false) => {
      try {
        setChannel(await teamsApi.channel(teamId));
        if (announce && !readNotified.current) {
          readNotified.current = true;
          onReadRef.current?.();
        }
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Could not load the channel.');
      }
    },
    [teamId],
  );

  // Only when the team changes. See the note on `onReadRef`.
  useEffect(() => {
    readNotified.current = false;
    setChannel(null);
    void load(true);
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [channel?.messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setError(null);
    try {
      const message = await teamsApi.post(teamId, body);
      // Appended locally rather than waiting for the next poll — a channel that
      // takes five seconds to show your own message feels broken.
      setChannel((current) =>
        current ? { ...current, messages: [...current.messages, message] } : current,
      );
      setDraft('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That message did not send.');
    } finally {
      setSending(false);
    }
  }

  const messages = channel?.messages ?? [];

  return (
    <div
      className={cn(
        // People speaking, so: a panel. See the voice rule in index.css.
        'panel relative flex flex-col overflow-hidden',
        fill ? 'h-full' : 'h-[30rem]',
      )}
    >
      <header className="relative flex items-center justify-between gap-3 border-b border-ink-200 px-5 py-4 dark:border-ink-700">
        <div className="flex min-w-0 items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to conversations"
              className="icon-btn -ml-1 grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full text-ink-600 transition-colors hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          )}
          <div className="min-w-0">
            <h2 className="truncate type-label text-accent-text">
              {title ?? channel?.teamName ?? 'Team channel'}
            </h2>
            <p className="readout text-[0.65rem] text-ink-500 dark:text-ink-400">
              {channel
                ? `${channel.members.length} member${channel.members.length === 1 ? '' : 's'}`
                : '…'}
            </p>
          </div>
        </div>

        {onOpenFull && (
          <button
            type="button"
            onClick={onOpenFull}
            aria-label="Open this team full size"
            title="Open full"
            className="icon-btn grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border border-ink-200 text-ink-600 transition-colors hover:border-ink-950 hover:text-ink-900 dark:border-ink-700 dark:text-ink-400 dark:hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M10 14 21 3M21 14v7H3V3h7" />
            </svg>
          </button>
        )}
      </header>

      <div
        className="relative flex-1 space-y-1 overflow-y-auto px-5 py-4"
        role="log"
        aria-live="polite"
        aria-label="Team messages"
      >
        {!channel ? (
          <div className="flex items-center gap-3 text-sm text-ink-600 dark:text-ink-300">
            <Spinner className="text-iris-600 dark:text-iris-400" />
            Loading…
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-ink-600 dark:text-ink-400">
            Nothing here yet. This is the team's room — agree who is doing what before the clock
            starts.
          </p>
        ) : (
          messages.map((message, index) => {
            const previous = messages[index - 1];
            const mine = message.senderId === viewerId;

            const newDay = !previous || dayOf(previous.createdAt) !== dayOf(message.createdAt);
            const grouped =
              !newDay &&
              previous?.senderId === message.senderId &&
              new Date(message.createdAt).getTime() -
                new Date(previous.createdAt).getTime() <
                GROUP_WINDOW_MS;

            return (
              <div key={message.id}>
                {newDay && (
                  <p className="readout my-3 text-center text-[0.65rem] text-ink-500 dark:text-ink-400">
                    {dayOf(message.createdAt)}
                  </p>
                )}

                <div className={cn('flex gap-2.5', grouped ? 'mt-0.5' : 'mt-3')}>
                  {/* The avatar column keeps its width when grouped, so the
                      text stays on one left edge instead of stepping in and out. */}
                  <div className="w-7 shrink-0">
                    {!grouped &&
                      (message.sender.avatarUrl ? (
                        <img
                          src={message.sender.avatarUrl}
                          alt=""
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className={cn(
                            'grid h-7 w-7 place-items-center rounded-full text-[0.65rem] font-bold text-white',
                            mine ? 'bg-fern-600' : 'bg-iris-600',
                          )}
                        >
                          {message.sender.firstName?.[0]?.toUpperCase() ?? '?'}
                        </span>
                      ))}
                  </div>

                  <div className="min-w-0 flex-1">
                    {!grouped && (
                      <p className="flex items-baseline gap-2">
                        {mine ? (
                          <span className="text-sm font-semibold text-ink-900 dark:text-white">You</span>
                        ) : (
                          <PersonLink person={message.sender} className="text-sm" />
                        )}
                        <span className="readout text-[0.65rem] text-ink-500 dark:text-ink-400">
                          {timeOf(message.createdAt)}
                        </span>
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-800 dark:text-ink-100">
                      {message.body}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <footer className="relative border-t border-ink-200 px-5 py-4 dark:border-ink-700">
        {error && (
          <p role="alert" className="mb-2 text-xs font-medium text-signal-bad">
            {error}
          </p>
        )}

        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="team-draft">
            Message your team
          </label>
          <textarea
            id="team-draft"
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder="Message your team…"
            className="max-h-28 min-h-[2.75rem] flex-1 resize-y rounded-[var(--radius-soft-sm)] border border-ink-950 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 dark:border-ink-700 dark:bg-ink-950 dark:text-white"
          />
          <Button type="submit" disabled={sending || draft.trim().length === 0}>
            {sending && <Spinner />}
            Send
          </Button>
        </form>
      </footer>
    </div>
  );
}

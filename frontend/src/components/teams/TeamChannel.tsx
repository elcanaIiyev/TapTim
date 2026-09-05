import { useCallback, useEffect, useRef, useState } from 'react';
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
}: {
  teamId: string;
  viewerId: string;
  onRead?: () => void;
}) {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const readNotified = useRef(false);

  const load = useCallback(
    async (announce = false) => {
      try {
        setChannel(await teamsApi.channel(teamId));
        if (announce && !readNotified.current) {
          readNotified.current = true;
          onRead?.();
        }
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Could not load the channel.');
      }
    },
    [teamId, onRead],
  );

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
    <div className="hud hud-ticks relative flex h-[30rem] flex-col overflow-hidden">
      <div className="grid-floor pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />

      <header className="relative flex items-baseline justify-between gap-3 border-b border-ink-200 px-5 py-4 dark:border-ink-700">
        <h2 className="type-label text-accent-text">Team channel</h2>
        <p className="readout text-xs text-ink-500 dark:text-ink-400">
          {channel ? `${channel.members.length} member${channel.members.length === 1 ? '' : 's'}` : '…'}
        </p>
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
                        <span className="text-sm font-semibold text-ink-900 dark:text-white">
                          {mine ? 'You' : message.sender.fullName}
                        </span>
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

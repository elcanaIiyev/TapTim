import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, connectionsApi } from '../../lib/api';
import { cn } from '../../lib/cn';
import { rolesSummary } from '../../lib/types';
import type { Conversation } from '../../lib/types';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

/**
 * A one-to-one conversation.
 *
 * Polled rather than pushed. A websocket would be the right answer at scale,
 * but it needs connection lifecycle handling, reconnection, and a second
 * transport to keep alive — for a chat where both people are usually looking
 * at the page, a five-second poll is a fraction of the moving parts for the
 * same felt latency. The poll stops while the tab is hidden so a backgrounded
 * tab is not a standing request every five seconds forever.
 */

const POLL_MS = 5000;

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatPanel({
  partnerId,
  viewerId,
  onClose,
  onRead,
  onBack,
  fill = false,
}: {
  partnerId: string;
  viewerId: string;
  onClose: () => void;
  /** Fires once the thread is opened, so the unread badge can clear. */
  onRead: () => void;
  /** Present in the dock, where closing and going back to the list differ. */
  onBack?: () => void;
  /**
   * Fill the parent instead of standing at its own fixed height.
   *
   * A boolean rather than a className override: `cn` is a plain join with no
   * conflict resolution, so passing `h-full` alongside the built-in `h-[32rem]`
   * would leave both in the class list and let source order decide.
   */
  fill?: boolean;
}) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const readNotified = useRef(false);

  const load = useCallback(
    async (announce = false) => {
      try {
        const next = await connectionsApi.conversation(partnerId);
        setConversation(next);
        if (announce && !readNotified.current) {
          readNotified.current = true;
          onRead();
        }
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Could not load the conversation.');
      }
    },
    [partnerId, onRead],
  );

  useEffect(() => {
    readNotified.current = false;
    setConversation(null);
    void load(true);
  }, [load]);

  // Polling, paused while the tab is in the background.
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

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [conversation?.messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setError(null);
    try {
      const message = await connectionsApi.send(partnerId, body);
      // Appended locally rather than waiting for the next poll — a chat that
      // takes five seconds to show your own message feels broken.
      setConversation((current) =>
        current ? { ...current, messages: [...current.messages, message] } : current,
      );
      setDraft('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That message did not send.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className={cn(
        'hud hud-ticks relative flex flex-col overflow-hidden',
        fill ? 'h-full' : 'h-[32rem]',
      )}
    >
      <div className="grid-floor pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />

      <header className="relative flex items-center justify-between gap-3 border-b border-ink-200 px-5 py-4 dark:border-ink-700">
        <div className="flex min-w-0 items-center gap-3">
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
          {conversation?.partner.avatarUrl ? (
            <img src={conversation.partner.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-iris-600 text-xs font-bold text-white">
              {conversation?.partner.firstName?.[0]?.toUpperCase() ?? '?'}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink-900 dark:text-white">
              {conversation?.partner.fullName ?? 'Loading…'}
            </p>
            <p className="truncate text-xs text-ink-600 dark:text-ink-400">
              {conversation ? rolesSummary(conversation.partner.roles) : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close conversation"
          className="icon-btn grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border border-ink-200 text-ink-600 transition-colors hover:border-ink-950 hover:text-ink-900 dark:border-ink-700 dark:text-ink-400 dark:hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div
        className="relative flex-1 space-y-3 overflow-y-auto px-5 py-4"
        role="log"
        aria-live="polite"
        aria-label="Messages"
      >
        {!conversation ? (
          <div className="flex items-center gap-3 text-sm text-ink-600 dark:text-ink-300">
            <Spinner className="text-iris-600 dark:text-iris-400" />
            Loading…
          </div>
        ) : conversation.messages.length === 0 ? (
          <p className="text-sm text-ink-600 dark:text-ink-400">
            Nothing here yet. Say hello — mentioning which event you're entering is a good opener.
          </p>
        ) : (
          conversation.messages.map((message) => {
            const mine = message.senderId === viewerId;
            return (
              <div key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[80%] rounded-[var(--radius-soft)] px-3.5 py-2.5 text-sm leading-relaxed',
                    mine
                      ? 'bg-iris-600 text-white'
                      : 'border border-ink-200 bg-white text-ink-800 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100',
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  <p
                    className={cn(
                      'readout mt-1 text-[0.65rem]',
                      mine ? 'text-iris-100' : 'text-ink-500 dark:text-ink-400',
                    )}
                  >
                    {timeOf(message.createdAt)}
                  </p>
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

        {conversation && !conversation.canSend ? (
          <p className="text-sm text-ink-600 dark:text-ink-400">
            You need to be connected before you can message each other.
          </p>
        ) : (
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label className="sr-only" htmlFor="chat-draft">
              Message
            </label>
            <textarea
              id="chat-draft"
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              // Enter sends, Shift+Enter makes a new line — what every chat
              // does, and what people try first.
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="Write a message…"
              className="max-h-28 min-h-[2.75rem] flex-1 resize-y rounded-[var(--radius-soft-sm)] border border-ink-950 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 dark:border-ink-700 dark:bg-ink-950 dark:text-white"
            />
            <Button type="submit" disabled={sending || draft.trim().length === 0}>
              {sending && <Spinner />}
              Send
            </Button>
          </form>
        )}
      </footer>
    </div>
  );
}

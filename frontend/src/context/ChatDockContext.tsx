import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { connectionsApi } from '../lib/api';
import type { ConnectionsOverview } from '../lib/types';
import { useAuth } from './AuthContext';

/**
 * Who is open in the chat dock, and how many messages are waiting.
 *
 * Shared state rather than dock-local state for two reasons. The dock is not
 * the only way in — the navbar has a chat button, and both it and the dock's
 * own launcher need the same unread count, so a second poller would have meant
 * two counts that disagree with each other for up to twenty seconds. And
 * anything on the site that wants to start a conversation ("Message" on a
 * profile, on a candidate card) can now call `openWith` instead of routing the
 * person to /connections and asking them to find the name again.
 *
 * Polled on the notification bell's interval, paused while the tab is hidden.
 */

interface ChatDockValue {
  open: boolean;
  /** The conversation on screen, or null for the connection list. */
  partnerId: string | null;
  unread: number;
  overview: ConnectionsOverview | null;
  /** Opens the dock, optionally straight into one person's thread. */
  openWith: (partnerId?: string) => void;
  close: () => void;
  toggle: () => void;
  /** Back to the list without closing the dock. */
  clearPartner: () => void;
  refresh: () => Promise<void>;
}

const POLL_MS = 20_000;

const ChatDockContext = createContext<ChatDockValue | null>(null);

export function ChatDockProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [overview, setOverview] = useState<ConnectionsOverview | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setOverview(await connectionsApi.overview());
    } catch {
      // A failing poll must not break the page the dock is floating over. The
      // count simply stays where it was until the next tick succeeds.
    }
  }, [user]);

  // Signing out has to clear this, or the next person to sign in on the same
  // browser inherits the previous account's unread count until the first poll.
  useEffect(() => {
    if (user) {
      void refresh();
      return;
    }
    setOverview(null);
    setOpen(false);
    setPartnerId(null);
  }, [user, refresh]);

  useEffect(() => {
    if (!user) return;
    const tick = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [user, refresh]);

  const value = useMemo<ChatDockValue>(
    () => ({
      open,
      partnerId,
      unread: overview?.totalUnread ?? 0,
      overview,
      openWith: (id?: string) => {
        setOpen(true);
        if (id !== undefined) setPartnerId(id);
      },
      close: () => setOpen(false),
      toggle: () => setOpen((current) => !current),
      clearPartner: () => setPartnerId(null),
      refresh,
    }),
    [open, partnerId, overview, refresh],
  );

  return <ChatDockContext.Provider value={value}>{children}</ChatDockContext.Provider>;
}

export function useChatDock(): ChatDockValue {
  const value = useContext(ChatDockContext);
  if (!value) throw new Error('useChatDock must be used inside a ChatDockProvider.');
  return value;
}

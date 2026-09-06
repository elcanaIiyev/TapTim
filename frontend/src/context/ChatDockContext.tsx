import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { connectionsApi, teamsApi } from '../lib/api';
import type { ConnectionsOverview, Team } from '../lib/types';
import { useAuth } from './AuthContext';

/**
 * What the chat dock is showing, and how much is waiting in it.
 *
 * Shared state rather than dock-local state for two reasons. The dock is not
 * the only way in — the navbar has a chat button, and both it and the dock's
 * own launcher need the same unread count, so a second poller would have meant
 * two counts that disagree with each other for up to twenty seconds. And
 * anything on the site that wants to start a conversation can now call
 * `openWith` instead of routing the person to /connections and asking them to
 * find the name again.
 *
 * It tracks both kinds of conversation. A hackathon team spends the weekend in
 * its own channel, not in DMs, so a dock that could only reach direct messages
 * was missing the half people actually use — and the unread count it showed
 * was wrong by exactly that half.
 *
 * Polled on the notification bell's interval, paused while the tab is hidden.
 */

export type ChatTab = 'direct' | 'teams';

interface ChatDockValue {
  open: boolean;
  tab: ChatTab;
  setTab: (tab: ChatTab) => void;

  /** The direct conversation on screen, if any. */
  partnerId: string | null;
  /** The team channel on screen, if any. Never set at the same time as above. */
  teamId: string | null;

  /** Everything waiting, across both kinds — what the badges show. */
  unread: number;
  directUnread: number;
  teamUnread: number;

  overview: ConnectionsOverview | null;
  teams: Team[];

  openWith: (partnerId?: string) => void;
  openTeam: (teamId: string) => void;
  close: () => void;
  toggle: () => void;
  /** Out of a thread, back to whichever list it came from. */
  back: () => void;
  refresh: () => Promise<void>;
}

const POLL_MS = 20_000;

const ChatDockContext = createContext<ChatDockValue | null>(null);

export function ChatDockProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ChatTab>('direct');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [overview, setOverview] = useState<ConnectionsOverview | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  const refresh = useCallback(async () => {
    if (!user) return;
    // Settled, not all: a failing team list must not also blank the direct
    // conversations, and vice versa.
    const [connections, mine] = await Promise.allSettled([
      connectionsApi.overview(),
      teamsApi.list({ mine: true }),
    ]);
    if (connections.status === 'fulfilled') setOverview(connections.value);
    if (mine.status === 'fulfilled') setTeams(mine.value.data);
  }, [user]);

  // Signing out has to clear this, or the next person to sign in on the same
  // browser inherits the previous account's unread count until the first poll.
  useEffect(() => {
    if (user) {
      void refresh();
      return;
    }
    setOverview(null);
    setTeams([]);
    setOpen(false);
    setPartnerId(null);
    setTeamId(null);
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

  const directUnread = overview?.totalUnread ?? 0;
  const teamUnread = teams.reduce((sum, team) => sum + (team.unread ?? 0), 0);

  const value = useMemo<ChatDockValue>(
    () => ({
      open,
      tab,
      setTab,
      partnerId,
      teamId,
      unread: directUnread + teamUnread,
      directUnread,
      teamUnread,
      overview,
      teams,
      openWith: (id?: string) => {
        setOpen(true);
        setTab('direct');
        setTeamId(null);
        if (id !== undefined) setPartnerId(id);
      },
      openTeam: (id: string) => {
        setOpen(true);
        setTab('teams');
        setPartnerId(null);
        setTeamId(id);
      },
      close: () => setOpen(false),
      toggle: () => setOpen((current) => !current),
      back: () => {
        setPartnerId(null);
        setTeamId(null);
      },
      refresh,
    }),
    [open, tab, partnerId, teamId, directUnread, teamUnread, overview, teams, refresh],
  );

  return <ChatDockContext.Provider value={value}>{children}</ChatDockContext.Provider>;
}

export function useChatDock(): ChatDockValue {
  const value = useContext(ChatDockContext);
  if (!value) throw new Error('useChatDock must be used inside a ChatDockProvider.');
  return value;
}

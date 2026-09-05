import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi, tokenStorage } from '../lib/api';
import type { LoginPayload, MeResponse, NextStep, SignupPayload, User } from '../lib/types';

interface AuthContextValue {
  user: MeResponse | null;
  /** True only while the initial token check is in flight. */
  initialising: boolean;
  /**
   * Where the server said this account should go after its last sign-in.
   * Null once it has been consumed, so a route guard fires exactly once and
   * does not fight the person if they navigate away.
   */
  pendingStep: NextStep | null;
  consumePendingStep: () => void;
  login: (payload: LoginPayload) => Promise<NextStep>;
  signup: (payload: SignupPayload) => Promise<NextStep>;
  /** Adopts a session created elsewhere — the OAuth callback and email confirmation. */
  adoptSession: (token: string, next?: NextStep) => Promise<MeResponse>;
  /** Re-reads the profile after the builder saves, so the header and meters follow. */
  refresh: () => Promise<MeResponse | null>;
  /** Merges a fresh profile in without a round trip. */
  applyUser: (user: User) => void;
  logout: () => void;
  /** True while the sign-out curtain is up, so the shell can render it. */
  loggingOut: boolean;
}

/**
 * How long the sign-out curtain stays up.
 *
 * Long enough to register as a transition, short enough that nobody waits on
 * it. Anything past ~1s stops feeling considered and starts feeling broken.
 */
const LOGOUT_VEIL_MS = 650;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [initialising, setInitialising] = useState(true);
  const [pendingStep, setPendingStep] = useState<NextStep | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Restore the session from a stored token on first mount.
  useEffect(() => {
    let cancelled = false;

    if (!tokenStorage.get()) {
      setInitialising(false);
      return;
    }

    authApi
      .me()
      .then((restored) => {
        if (!cancelled) setUser(restored);
      })
      .catch(() => {
        // Expired or revoked token — drop it rather than retrying.
        tokenStorage.clear();
      })
      .finally(() => {
        if (!cancelled) setInitialising(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * `login` and `signup` return the *server's* opinion of where to go next.
   *
   * The alternative is the SPA inferring it from `emailVerified` and
   * `onboardingCompleted`, which duplicates a rule that already exists on the
   * server and drifts the moment a third state appears.
   */
  const adoptSession = useCallback(async (token: string, next?: NextStep) => {
    tokenStorage.set(token);
    const me = await authApi.me();
    setUser(me);
    if (next) setPendingStep(next);
    return me;
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const result = await authApi.login(payload);
      await adoptSession(result.accessToken, result.next);
      return result.next;
    },
    [adoptSession],
  );

  const signup = useCallback(
    async (payload: SignupPayload) => {
      const result = await authApi.signup(payload);
      await adoptSession(result.accessToken, result.next);
      return result.next;
    },
    [adoptSession],
  );

  const refresh = useCallback(async () => {
    if (!tokenStorage.get()) return null;
    try {
      const me = await authApi.me();
      setUser(me);
      return me;
    } catch {
      return null;
    }
  }, []);

  /**
   * A profile save returns the updated user, so the header can follow without a
   * second request. `connections` and `hasPassword` come only from `/auth/me`,
   * so they are carried over rather than dropped.
   */
  const applyUser = useCallback((updated: User) => {
    setUser((previous) =>
      previous
        ? { ...previous, ...updated }
        : { ...updated, connections: [], hasPassword: true },
    );
  }, []);

  const consumePendingStep = useCallback(() => setPendingStep(null), []);

  /**
   * Sign out, with a short curtain over it.
   *
   * Clearing a token is instantaneous, so without this the screen swapped from
   * a signed-in dashboard to the landing page between two frames — which reads
   * like a crash rather than a confirmation. The pause is deliberate and is
   * declared as such in `TransitionVeil`; it is not disguising work.
   *
   * The session is cleared *after* the veil is up, so nothing renders in a
   * half-signed-out state behind it.
   */
  const logout = useCallback(() => {
    setLoggingOut(true);

    window.setTimeout(() => {
      tokenStorage.clear();
      setUser(null);
      setPendingStep(null);
      setLoggingOut(false);
    }, LOGOUT_VEIL_MS);
  }, []);

  const value = useMemo(
    () => ({
      user,
      initialising,
      pendingStep,
      loggingOut,
      consumePendingStep,
      login,
      signup,
      adoptSession,
      refresh,
      applyUser,
      logout,
    }),
    [
      user,
      initialising,
      pendingStep,
      loggingOut,
      consumePendingStep,
      login,
      signup,
      adoptSession,
      refresh,
      applyUser,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}

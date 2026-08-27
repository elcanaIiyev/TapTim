import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi, tokenStorage } from '../lib/api';
import type { LoginPayload, SignupPayload, User } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  /** True only while the initial token check is in flight. */
  initialising: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  signup: (payload: SignupPayload) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initialising, setInitialising] = useState(true);

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

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await authApi.login(payload);
    tokenStorage.set(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);

  const signup = useCallback(async (payload: SignupPayload) => {
    const result = await authApi.signup(payload);
    tokenStorage.set(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, initialising, login, signup, logout }),
    [user, initialising, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiFetch } from '../services/apiClient';
import { setAuthToken, setUnauthorizedHandler } from '../services/authToken';
import {
  clearStoredSession,
  loadStoredSession,
  saveStoredSession,
} from '../services/authStorage';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

interface AuthResponse {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

interface AuthStore {
  user: AuthUser | null;
  bootstrapping: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthStore | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  const acceptSession = useCallback(async (response: AuthResponse) => {
    setAuthToken(response.token);
    await saveStoredSession(response.token);
    setUser(response.user);
  }, []);

  const clearSession = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await clearStoredSession();
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const token = await loadStoredSession();
      if (!token) {
        if (!cancelled) setBootstrapping(false);
        return;
      }

      setAuthToken(token);
      try {
        const response = await apiFetch<{ user: AuthUser }>('/auth/me', undefined, {
          timeoutMs: 20_000,
        });
        if (!cancelled) setUser(response.user);
      } catch {
        if (!cancelled) await clearSession();
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearSession();
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const response = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await acceptSession(response);
    },
    [acceptSession]
  );

  const register = useCallback(
    async (displayName: string, email: string, password: string) => {
      const response = await apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ displayName, email, password }),
      });
      await acceptSession(response);
    },
    [acceptSession]
  );

  const signOut = useCallback(async () => {
    // The API call captures the current token synchronously. Clear the local
    // session immediately so sign-out never waits on a sleeping free instance;
    // the revoke request finishes in the background when the network allows.
    void apiFetch<void>('/auth/logout', { method: 'POST' }, { timeoutMs: 8_000 }).catch(
      () => undefined
    );
    await clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, bootstrapping, signIn, register, signOut }),
    [user, bootstrapping, signIn, register, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthStore {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

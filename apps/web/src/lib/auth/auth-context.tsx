'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser } from '@erp/contracts';
import { hasPermission as checkHasPermission } from '@erp/auth';
import { apiLogin, apiLogout, apiMe, apiRefresh } from './api-client';

/**
 * Client-side auth state.
 *
 * Design note: the framework-agnostic permission math lives in @erp/auth
 * (shared with the NestJS guard). Only the React session wiring lives here,
 * in the web app, because it is app-specific (cookie bootstrap, in-memory
 * access token). The access token is kept in a ref (memory) — never in
 * localStorage — and re-obtained on load via the httpOnly refresh cookie.
 */
interface AuthContextValue {
  user: AuthUser | null;
  permissions: string[];
  /** True while the initial session bootstrap is in flight. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (key: string) => boolean;
  /**
   * Current in-memory access token (or null when logged out). Read it at
   * call-time to attach a `Bearer` header when calling protected API endpoints
   * (see api-client.ts for the fetch pattern, and lib/inventory/api.ts /
   * lib/sales/api-client.ts for feature-module usage). Kept as a getter over
   * the ref so reading it never triggers a re-render.
   */
  getAccessToken: () => string | null;
  /** Re-run the refresh-cookie bootstrap (e.g. after a 401). */
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const accessTokenRef = useRef<string | null>(null);

  const clearSession = useCallback(() => {
    accessTokenRef.current = null;
    setUser(null);
    setPermissions([]);
  }, []);

  const loadSession = useCallback(async (accessToken: string) => {
    accessTokenRef.current = accessToken;
    const me = await apiMe(accessToken);
    setUser(me.user);
    setPermissions(me.permissions);
  }, []);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    try {
      const refreshed = await apiRefresh();
      if (refreshed?.accessToken) {
        await loadSession(refreshed.accessToken);
      } else {
        clearSession();
      }
    } catch {
      clearSession();
    } finally {
      setIsLoading(false);
    }
  }, [loadSession, clearSession]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiLogin(email, password);
      await loadSession(result.accessToken);
    },
    [loadSession],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const hasPermission = useCallback(
    (key: string) => checkHasPermission(permissions, key),
    [permissions],
  );

  const getAccessToken = useCallback(() => accessTokenRef.current, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      permissions,
      isLoading,
      login,
      logout,
      hasPermission,
      getAccessToken,
      reload: bootstrap,
    }),
    [user, permissions, isLoading, login, logout, hasPermission, getAccessToken, bootstrap],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}

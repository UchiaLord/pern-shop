// apps/web/src/auth/AuthProvider.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../lib/api';
import { AuthContext } from './AuthContext';
import type { AuthState, User } from './types';

type ApiThrownError = Error & {
  code?: string;
  status?: number;
  details?: unknown;
};

function isUnauthenticated(err: unknown): boolean {
  if (err instanceof Error) {
    const e = err as ApiThrownError;

    // Primary: contract from api.ts
    if (e.status === 401) return true;
    if (e.code === 'UNAUTHENTICATED') return true;

    // Fallback: sometimes message may carry it
    if ((e.message ?? '').toLowerCase().includes('unauth')) return true;
  }

  return false;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const mountedRef = useRef(true);

  async function refresh() {
    try {
      const res = await api.auth.me();
      if (mountedRef.current) setUser(res.user);
      return;
    } catch (err: unknown) {
      // Erwartet: nicht eingeloggt -> 401/UNAUTHENTICATED
      if (isUnauthenticated(err)) {
        if (mountedRef.current) setUser(null);
        return;
      }

      // Unerwartet: echte Fehler sichtbar machen (aber nicht crashen)
      console.error('Auth refresh failed:', err);
      if (mountedRef.current) setUser(null);
    }
  }

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      setIsLoading(true);
      try {
        await refresh();
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function login(email: string, password: string) {
    const res = await api.auth.login(email, password);
    setUser(res.user);
  }

  async function register(email: string, password: string) {
    const res = await api.auth.register(email, password);
    setUser(res.user);
  }

  async function logout() {
    await api.auth.logout();
    setUser(null);
  }

  const value = useMemo<AuthState>(
    () => ({ user, isLoading, login, register, logout, refresh }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

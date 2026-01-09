import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { AuthContext } from './AuthContext';
import type { AuthState, User } from './types';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    try {
      const res = await api.auth.me();
      setUser(res.user);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      setIsLoading(true);
      try {
        await refresh();
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
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

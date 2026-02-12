// apps/web/src/auth/types.ts
import type { User as ApiUser } from '../lib/types';

export type User = ApiUser;

export type AuthState = {
  user: User | null;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;

  refresh: () => Promise<void>;
};

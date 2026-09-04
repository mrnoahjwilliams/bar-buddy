import { createContext } from 'react';
import type { AppSession } from '@/features/auth/auth-gateway';

export interface AuthContextValue {
  session: AppSession | null;
  status: 'loading' | 'anonymous' | 'authenticated' | 'recovery';
  notice?: string;
  configurationError?: string;
  clearNotice(): void;
  signIn(email: string, password: string): Promise<void>;
  signUp(
    email: string,
    password: string,
  ): Promise<'signed-in' | 'confirmation'>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

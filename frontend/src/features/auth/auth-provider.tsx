import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setApiAuthBridge } from '@/api/auth';
import {
  AuthContext,
  type AuthContextValue,
} from '@/features/auth/auth-context';
import type {
  AppSession,
  AuthEvent,
  AuthGateway,
} from '@/features/auth/auth-gateway';

interface AuthProviderProps {
  children: React.ReactNode;
  gateway: AuthGateway;
}

export function AuthProvider({ children, gateway }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AppSession | null>(null);
  const sessionRef = useRef<AppSession | null>(null);
  const lastUserId = useRef<string | null | undefined>(undefined);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [notice, setNotice] = useState<string>();

  const applySession = useCallback(
    (event: AuthEvent, nextSession: AppSession | null) => {
      const nextUserId = nextSession?.userId ?? null;
      if (
        lastUserId.current !== undefined &&
        lastUserId.current !== nextUserId
      ) {
        queryClient.clear();
      }
      lastUserId.current = nextUserId;
      sessionRef.current = nextSession;
      setSession(nextSession);
      setStatus(
        event === 'PASSWORD_RECOVERY'
          ? 'recovery'
          : nextSession
            ? 'authenticated'
            : 'anonymous',
      );
    },
    [queryClient],
  );

  const expireSession = useCallback(async () => {
    setNotice('Your session expired. Sign in again to keep using Bar Buddy.');
    try {
      await gateway.signOut();
    } catch {
      // The local session must still be discarded when provider sign-out fails.
    } finally {
      applySession('SIGNED_OUT', null);
    }
  }, [applySession, gateway]);

  useEffect(() => {
    let active = true;
    const unsubscribe = gateway.onAuthStateChange((event, nextSession) => {
      if (active) applySession(event, nextSession);
    });
    void gateway
      .getSession()
      .then((nextSession) => {
        if (active && lastUserId.current === undefined) {
          applySession('INITIAL_SESSION', nextSession);
        }
      })
      .catch(() => {
        if (active) {
          setNotice('We could not restore your session. Please sign in again.');
          applySession('SIGNED_OUT', null);
        }
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [applySession, gateway]);

  useEffect(() => {
    setApiAuthBridge({
      async getAccessToken(forceRefresh) {
        if (!forceRefresh) return sessionRef.current?.accessToken;
        try {
          const refreshed = await gateway.refreshSession();
          if (refreshed) applySession('TOKEN_REFRESHED', refreshed);
          return refreshed?.accessToken;
        } catch {
          return undefined;
        }
      },
      handleUnauthorized: expireSession,
    });
    return () => setApiAuthBridge(undefined);
  }, [applySession, expireSession, gateway]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      status,
      notice,
      configurationError: gateway.configurationError,
      clearNotice: () => setNotice(undefined),
      async signIn(email, password) {
        const nextSession = await gateway.signIn(email, password);
        if (!nextSession) throw new Error('Sign in did not return a session.');
        applySession('SIGNED_IN', nextSession);
        setNotice(undefined);
      },
      async signUp(email, password) {
        const nextSession = await gateway.signUp(email, password);
        if (nextSession) {
          applySession('SIGNED_IN', nextSession);
          setNotice(undefined);
          return 'signed-in';
        }
        return 'confirmation';
      },
      async sendPasswordReset(email) {
        await gateway.sendPasswordReset(
          email,
          `${window.location.origin}/reset-password`,
        );
      },
      async updatePassword(password) {
        await gateway.updatePassword(password);
        setStatus('authenticated');
        setNotice('Your password has been updated.');
      },
      async signOut() {
        await gateway.signOut();
        applySession('SIGNED_OUT', null);
        setNotice('You’re signed out.');
      },
    }),
    [applySession, gateway, notice, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

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
  const sessionEpoch = useRef(0);
  const sessionRef = useRef<AppSession | null>(null);
  const lastUserId = useRef<string | null | undefined>(undefined);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [notice, setNotice] = useState<string>();

  const applySession = useCallback(
    (event: AuthEvent, nextSession: AppSession | null) => {
      const nextUserId = nextSession?.userId ?? null;
      const changed = lastUserId.current !== nextUserId;
      if (changed) sessionEpoch.current += 1;
      sessionRef.current = nextSession;
      if (
        lastUserId.current !== undefined &&
        lastUserId.current !== nextUserId
      ) {
        queryClient.clear();
      }
      lastUserId.current = nextUserId;
      setSession(nextSession);
      setStatus(
        event === 'password-recovery'
          ? 'recovery'
          : nextSession
            ? 'authenticated'
            : 'anonymous',
      );
    },
    [queryClient],
  );

  const expireSession = useCallback(async () => {
    const epoch = sessionEpoch.current;
    setNotice('Your session expired. Sign in again to keep using Bar Buddy.');
    try {
      await gateway.signOut();
    } catch {
      // The local session must still be discarded when provider sign-out fails.
    } finally {
      if (sessionEpoch.current === epoch) applySession('session-changed', null);
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
          applySession('session-changed', nextSession);
        }
      })
      .catch(() => {
        if (active) {
          setNotice('We could not restore your session. Please sign in again.');
          applySession('session-changed', null);
        }
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [applySession, gateway]);

  useEffect(() => {
    setApiAuthBridge({
      sessionKey: () => sessionEpoch.current,
      async getAccessToken(forceRefresh) {
        const epoch = sessionEpoch.current;
        if (!forceRefresh) return sessionRef.current?.accessToken;
        try {
          const refreshed = await gateway.refreshSession();
          if (sessionEpoch.current !== epoch) return undefined;
          if (refreshed) applySession('session-changed', refreshed);
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
        applySession('session-changed', nextSession);
        setNotice(undefined);
      },
      async signUp(email, password) {
        const nextSession = await gateway.signUp(email, password);
        if (nextSession) {
          applySession('session-changed', nextSession);
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
      async finishAccountDeletion() {
        try {
          await gateway.signOut('local');
        } finally {
          applySession('session-changed', null);
          setNotice(
            'Your account data has been deleted. Login removal is being completed.',
          );
        }
      },
      async signOut() {
        await gateway.signOut();
        applySession('session-changed', null);
        setNotice('You’re signed out.');
      },
    }),
    [applySession, gateway, notice, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

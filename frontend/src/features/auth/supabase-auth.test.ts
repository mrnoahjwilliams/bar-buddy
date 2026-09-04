import { describe, expect, it, vi } from 'vitest';
import type { AuthChangeEvent, SupabaseClient } from '@supabase/supabase-js';
import {
  createAuthGateway,
  SupabaseAuthGateway,
} from '@/features/auth/supabase-auth';

describe('Supabase authentication gateway', () => {
  it.each([
    [undefined, undefined],
    ['', ''],
    ['https://YOUR_PROJECT_REF.supabase.co', 'YOUR_SUPABASE_PUBLISHABLE_KEY'],
  ])('treats missing and example settings as unavailable', (url, key) => {
    expect(createAuthGateway(url, key).configurationError).toMatch(
      /not configured/,
    );
  });

  it('rejects malformed and insecure remote URLs before creating a client', () => {
    expect(
      createAuthGateway('not a URL', 'public-key').configurationError,
    ).toMatch(/valid URL/);
    expect(
      createAuthGateway('http://example.com', 'public-key').configurationError,
    ).toMatch(/must use HTTPS/);
    expect(
      createAuthGateway('http://127.0.0.1:54321', 'public-key')
        .configurationError,
    ).toBeUndefined();
  });

  it('maps provider events to application events', () => {
    const listener = vi.fn();
    const unsubscribe = vi.fn();
    const client = {
      auth: {
        onAuthStateChange(
          callback: (event: AuthChangeEvent, session: null) => void,
        ) {
          callback('PASSWORD_RECOVERY', null);
          return { data: { subscription: { unsubscribe } } };
        },
      },
    } as unknown as SupabaseClient;

    const stop = new SupabaseAuthGateway(client).onAuthStateChange(listener);

    expect(listener).toHaveBeenCalledWith('password-recovery', null);
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('replaces provider-specific errors with stable user messages', async () => {
    const client = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: null },
          error: {
            code: 'invalid_credentials',
            message: 'Provider-specific wording',
          },
        }),
      },
    } as unknown as SupabaseClient;

    await expect(
      new SupabaseAuthGateway(client).signIn('person@example.com', 'password'),
    ).rejects.toThrow('Email or password is incorrect.');
  });
});

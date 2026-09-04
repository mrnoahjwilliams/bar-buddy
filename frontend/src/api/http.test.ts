import { afterEach, describe, expect, it, vi } from 'vitest';
import { setApiAuthBridge } from './auth';
import { ApiError, apiFetch } from './http';

afterEach(() => {
  setApiAuthBridge(undefined);
  vi.unstubAllGlobals();
});

describe('generated-client transport', () => {
  it('returns JSON and preserves generated request options and cancellation', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ id: 'example' }));
    vi.stubGlobal('fetch', fetch);
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"label":"example"}',
      signal: new AbortController().signal,
    };
    await expect(apiFetch('/api/v1/example', options)).resolves.toEqual({
      id: 'example',
    });
    expect(fetch).toHaveBeenCalledWith('/api/v1/example', {
      ...options,
      headers: expect.any(Headers),
    });
    expect((fetch.mock.calls[0]?.[1] as RequestInit).headers).toSatisfy(
      (headers: Headers) => headers.get('Content-Type') === 'application/json',
    );
  });

  it('accepts no-content responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    await expect(apiFetch('/api/v1/example')).resolves.toBeUndefined();
  });

  it.each([
    ['application/problem+json', '{"detail":"Denied"}', { detail: 'Denied' }],
    ['text/html', '<h1>Gateway failure</h1>', '<h1>Gateway failure</h1>'],
    ['application/json', 'malformed', 'malformed'],
    ['application/json', '', undefined],
  ])(
    'rejects HTTP errors with %s bodies',
    async (contentType, body, expected) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(body, {
            status: 403,
            headers: { 'Content-Type': contentType },
          }),
        ),
      );
      const request = apiFetch('/api/v1/example');
      await expect(request).rejects.toBeInstanceOf(ApiError);
      await expect(request).rejects.toMatchObject({
        status: 403,
        body: expected,
      });
    },
  );

  it('propagates cancellation and malformed success JSON', async () => {
    const cancelled = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(cancelled));
    await expect(apiFetch('/api/v1/example')).rejects.toBe(cancelled);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('malformed', {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    await expect(apiFetch('/api/v1/example')).rejects.toBeInstanceOf(
      SyntaxError,
    );
  });

  it('attaches a bearer token and retries once after refreshing a 401', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ id: 'current-user' }));
    vi.stubGlobal('fetch', fetch);
    let token = 'expired-token';
    const handleUnauthorized = vi.fn();
    setApiAuthBridge({
      async getAccessToken(forceRefresh) {
        if (forceRefresh) token = 'fresh-token';
        return token;
      },
      handleUnauthorized,
    });

    await expect(apiFetch('/api/v1/me')).resolves.toEqual({
      id: 'current-user',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((fetch.mock.calls[0]?.[1] as RequestInit).headers).toSatisfy(
      (headers: Headers) =>
        headers.get('Authorization') === 'Bearer expired-token',
    );
    expect((fetch.mock.calls[1]?.[1] as RequestInit).headers).toSatisfy(
      (headers: Headers) =>
        headers.get('Authorization') === 'Bearer fresh-token',
    );
    expect(handleUnauthorized).not.toHaveBeenCalled();
  });

  it('shares one refresh across concurrent unauthorized requests', async () => {
    let token = 'expired-token';
    let finishRefresh: (() => void) | undefined;
    const refreshGate = new Promise<void>((resolve) => {
      finishRefresh = resolve;
    });
    const getAccessToken = vi.fn(async (forceRefresh: boolean) => {
      if (forceRefresh) {
        await refreshGate;
        token = 'fresh-token';
      }
      return token;
    });
    setApiAuthBridge({ getAccessToken, handleUnauthorized: vi.fn() });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, options: RequestInit) => {
        const authorization = new Headers(options.headers).get('Authorization');
        return Promise.resolve(
          authorization === 'Bearer fresh-token'
            ? Response.json({ ok: true })
            : new Response(null, { status: 401 }),
        );
      }),
    );

    const requests = Promise.all([
      apiFetch('/api/v1/first'),
      apiFetch('/api/v1/second'),
    ]);
    await vi.waitFor(() => {
      expect(getAccessToken).toHaveBeenCalledWith(true);
    });
    finishRefresh?.();

    await expect(requests).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(
      getAccessToken.mock.calls.filter(([forceRefresh]) => forceRefresh),
    ).toHaveLength(1);
  });

  it('shares the unauthorized transition after a failed refresh', async () => {
    const handleUnauthorized = vi.fn(async () => undefined);
    const getAccessToken = vi.fn(async (forceRefresh: boolean) =>
      forceRefresh ? undefined : 'expired-token',
    );
    setApiAuthBridge({ getAccessToken, handleUnauthorized });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );

    const results = await Promise.allSettled([
      apiFetch('/api/v1/first'),
      apiFetch('/api/v1/second'),
    ]);

    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(handleUnauthorized).toHaveBeenCalledOnce();
  });
});

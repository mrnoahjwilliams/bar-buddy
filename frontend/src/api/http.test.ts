import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './http';

afterEach(() => vi.unstubAllGlobals());

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
    expect(fetch).toHaveBeenCalledWith('/api/v1/example', options);
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
});

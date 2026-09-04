import { getApiAuthBridge } from '@/api/auth';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API request failed (${status})`);
    this.name = 'ApiError';
  }
}

// Orval owns paths, serialization, types and hooks; this adapter handles responses.
export async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const bridge = getApiAuthBridge();
  const request = async (forceRefresh: boolean) => {
    const headers = new Headers(options?.headers);
    const accessToken = await bridge?.getAccessToken(forceRefresh);
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    return fetch(url, { ...options, headers });
  };

  let response = await request(false);
  if (response.status === 401 && bridge) {
    const refreshedToken = await bridge.getAccessToken(true);
    if (refreshedToken) response = await request(false);
    if (response.status === 401) await bridge.handleUnauthorized();
  }
  const text = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  let body: unknown = text || undefined;
  if (
    text &&
    (contentType.includes('/json') || contentType.includes('+json'))
  ) {
    try {
      body = JSON.parse(text);
    } catch (error) {
      if (response.ok) throw error;
      // Preserve the HTTP failure even if an upstream error body is malformed.
    }
  }
  if (!response.ok) throw new ApiError(response.status, body);
  return body as T;
}

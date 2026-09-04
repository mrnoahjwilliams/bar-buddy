import { getApiAuthBridge } from '@/api/auth';
import type { ApiAuthBridge } from '@/api/auth';

interface AuthAttemptState {
  refresh?: Promise<string | undefined>;
  unauthorized?: Promise<void>;
}

const authAttempts = new WeakMap<ApiAuthBridge, AuthAttemptState>();

function attemptState(bridge: ApiAuthBridge) {
  let state = authAttempts.get(bridge);
  if (!state) {
    state = {};
    authAttempts.set(bridge, state);
  }
  return state;
}

function refreshOnce(bridge: ApiAuthBridge) {
  const state = attemptState(bridge);
  if (!state.refresh) {
    const refresh = Promise.resolve().then(() => bridge.getAccessToken(true));
    const shared = refresh.finally(() => {
      if (state.refresh === shared) state.refresh = undefined;
    });
    state.refresh = shared;
  }
  return state.refresh;
}

function handleUnauthorizedOnce(bridge: ApiAuthBridge) {
  const state = attemptState(bridge);
  if (!state.unauthorized) {
    const unauthorized = Promise.resolve().then(() =>
      bridge.handleUnauthorized(),
    );
    const shared = unauthorized.finally(() => {
      if (state.unauthorized === shared) state.unauthorized = undefined;
    });
    state.unauthorized = shared;
  }
  return state.unauthorized;
}

export class ApiError<TBody = unknown> extends Error {
  constructor(
    public readonly status: number,
    public readonly body: TBody,
  ) {
    super(`API request failed (${status})`);
    this.name = 'ApiError';
  }
}

export type ErrorType<TBody> = ApiError<TBody>;

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
    const refreshedToken = await refreshOnce(bridge);
    if (refreshedToken) response = await request(false);
    if (response.status === 401) await handleUnauthorizedOnce(bridge);
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

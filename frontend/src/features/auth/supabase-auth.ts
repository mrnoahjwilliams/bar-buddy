import {
  createClient,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js';
import type {
  AppSession,
  AuthEvent,
  AuthGateway,
} from '@/features/auth/auth-gateway';

function toAppSession(session: Session | null): AppSession | null {
  if (!session) return null;
  return {
    accessToken: session.access_token,
    userId: session.user.id,
    email: session.user.email,
  };
}

function toAuthEvent(event: AuthChangeEvent): AuthEvent {
  switch (event) {
    case 'PASSWORD_RECOVERY':
      return 'password-recovery';
    case 'INITIAL_SESSION':
    case 'MFA_CHALLENGE_VERIFIED':
    case 'SIGNED_IN':
    case 'SIGNED_OUT':
    case 'TOKEN_REFRESHED':
    case 'USER_UPDATED':
      return 'session-changed';
  }
}

function userMessage(error: { code?: string; message: string }) {
  switch (error.code) {
    case 'invalid_credentials':
      return 'Email or password is incorrect.';
    case 'email_not_confirmed':
      return 'Confirm your email before signing in.';
    case 'weak_password':
      return 'Choose a stronger password and try again.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many authentication attempts. Please wait and try again.';
    default:
      return 'Authentication could not be completed. Please try again.';
  }
}

function throwIfError(error: { code?: string; message: string } | null) {
  if (error) throw new Error(userMessage(error), { cause: error });
}

export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly client: SupabaseClient) {}

  async getSession() {
    const { data, error } = await this.client.auth.getSession();
    throwIfError(error);
    return toAppSession(data.session);
  }

  onAuthStateChange(
    listener: (event: AuthEvent, session: AppSession | null) => void,
  ) {
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      listener(toAuthEvent(event), toAppSession(session));
    });
    return () => data.subscription.unsubscribe();
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });
    throwIfError(error);
    return toAppSession(data.session);
  }

  async signUp(email: string, password: string) {
    const { data, error } = await this.client.auth.signUp({ email, password });
    throwIfError(error);
    return toAppSession(data.session);
  }

  async sendPasswordReset(email: string, redirectTo: string) {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    throwIfError(error);
  }

  async updatePassword(password: string) {
    const { error } = await this.client.auth.updateUser({ password });
    throwIfError(error);
  }

  async refreshSession() {
    const { data, error } = await this.client.auth.refreshSession();
    throwIfError(error);
    return toAppSession(data.session);
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    throwIfError(error);
  }
}

class UnavailableAuthGateway implements AuthGateway {
  constructor(
    readonly configurationError = 'Authentication is not configured. Add the Supabase browser settings and restart the frontend.',
  ) {}

  async getSession() {
    return null;
  }

  onAuthStateChange() {
    return () => undefined;
  }

  private unavailable(): never {
    throw new Error(this.configurationError);
  }

  async signIn(): Promise<AppSession | null> {
    return this.unavailable();
  }

  async signUp(): Promise<AppSession | null> {
    return this.unavailable();
  }

  async sendPasswordReset(): Promise<void> {
    return this.unavailable();
  }

  async updatePassword(): Promise<void> {
    return this.unavailable();
  }

  async refreshSession(): Promise<AppSession | null> {
    return this.unavailable();
  }

  async signOut(): Promise<void> {
    return this.unavailable();
  }
}

let defaultGateway: AuthGateway | undefined;

function isLoopback(hostname: string) {
  return (
    hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]'
  );
}

export function createAuthGateway(
  url: string | undefined,
  publishableKey: string | undefined,
): AuthGateway {
  if (
    !url ||
    !publishableKey ||
    url.includes('YOUR_PROJECT_REF') ||
    publishableKey === 'YOUR_SUPABASE_PUBLISHABLE_KEY'
  ) {
    return new UnavailableAuthGateway();
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return new UnavailableAuthGateway(
      'Authentication is misconfigured. VITE_SUPABASE_URL must be a valid URL.',
    );
  }
  if (
    parsedUrl.protocol !== 'https:' &&
    !(parsedUrl.protocol === 'http:' && isLoopback(parsedUrl.hostname))
  ) {
    return new UnavailableAuthGateway(
      'Authentication is misconfigured. Supabase must use HTTPS outside local development.',
    );
  }

  return new SupabaseAuthGateway(
    createClient(url, publishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    }),
  );
}

export function getDefaultAuthGateway(): AuthGateway {
  if (defaultGateway) return defaultGateway;
  defaultGateway = createAuthGateway(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
  return defaultGateway;
}

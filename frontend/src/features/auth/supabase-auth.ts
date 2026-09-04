import {
  createClient,
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

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
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
      listener(event as AuthEvent, toAppSession(session));
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
  readonly configurationError =
    'Authentication is not configured. Add the Supabase browser settings and restart the frontend.';

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

export function getDefaultAuthGateway(): AuthGateway {
  if (defaultGateway) return defaultGateway;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  defaultGateway =
    url && publishableKey
      ? new SupabaseAuthGateway(
          createClient(url, publishableKey, {
            auth: {
              autoRefreshToken: true,
              detectSessionInUrl: true,
              persistSession: true,
            },
          }),
        )
      : new UnavailableAuthGateway();
  return defaultGateway;
}

import type {
  AppSession,
  AuthEvent,
  AuthGateway,
} from '@/features/auth/auth-gateway';

export class FakeAuthGateway implements AuthGateway {
  session: AppSession | null;
  refreshResult: AppSession | null | undefined;
  signupResult: AppSession | null | undefined;
  signInError?: Error;
  resetRequest?: { email: string; redirectTo: string };
  updatedPassword?: string;
  signOutCalls = 0;
  eventOnSubscribe?: { event: AuthEvent; session: AppSession | null };
  private listener?: (event: AuthEvent, session: AppSession | null) => void;

  constructor(session: AppSession | null = null) {
    this.session = session;
  }

  async getSession() {
    return this.session;
  }

  onAuthStateChange(
    listener: (event: AuthEvent, session: AppSession | null) => void,
  ) {
    this.listener = listener;
    if (this.eventOnSubscribe) {
      const initial = this.eventOnSubscribe;
      queueMicrotask(() => listener(initial.event, initial.session));
    }
    return () => {
      this.listener = undefined;
    };
  }

  emit(event: AuthEvent, session: AppSession | null) {
    this.session = session;
    this.listener?.(event, session);
  }

  async signIn(email: string) {
    if (this.signInError) throw this.signInError;
    const session = {
      accessToken: `${email}-token`,
      userId: email,
      email,
    };
    this.emit('SIGNED_IN', session);
    return session;
  }

  async signUp(email: string) {
    if (this.signupResult !== undefined) {
      if (this.signupResult) this.emit('SIGNED_IN', this.signupResult);
      return this.signupResult;
    }
    const session = {
      accessToken: `${email}-token`,
      userId: email,
      email,
    };
    this.emit('SIGNED_IN', session);
    return session;
  }

  async sendPasswordReset(email: string, redirectTo: string) {
    this.resetRequest = { email, redirectTo };
  }

  async updatePassword(password: string) {
    this.updatedPassword = password;
  }

  async refreshSession() {
    return this.refreshResult === undefined ? this.session : this.refreshResult;
  }

  async signOut() {
    this.signOutCalls += 1;
    this.emit('SIGNED_OUT', null);
  }
}

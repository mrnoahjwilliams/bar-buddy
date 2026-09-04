export type AuthEvent = 'session-changed' | 'password-recovery';

export interface AppSession {
  accessToken: string;
  userId: string;
  email?: string;
}

export interface AuthGateway {
  readonly configurationError?: string;
  getSession(): Promise<AppSession | null>;
  onAuthStateChange(
    listener: (event: AuthEvent, session: AppSession | null) => void,
  ): () => void;
  signIn(email: string, password: string): Promise<AppSession | null>;
  signUp(email: string, password: string): Promise<AppSession | null>;
  sendPasswordReset(email: string, redirectTo: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  refreshSession(): Promise<AppSession | null>;
  signOut(): Promise<void>;
}

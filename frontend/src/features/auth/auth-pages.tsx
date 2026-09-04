import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function AuthCard({ children }: { children: React.ReactNode }) {
  return <section className="w-full max-w-md">{children}</section>;
}

function Field({
  id,
  label,
  type,
  autoComplete,
  value,
  onChange,
}: {
  id: string;
  label: string;
  type: 'email' | 'password';
  autoComplete: string;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-medium">
      {label}
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        required
        minLength={type === 'password' ? 8 : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-lg border border-input bg-background px-3 text-base shadow-xs"
      />
    </label>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {message}
    </p>
  );
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await auth.signIn(email, password);
      const requested = (location.state as { from?: string } | null)?.from;
      navigate(requested?.startsWith('/') ? requested : '/', { replace: true });
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard>
      <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        Welcome back
      </p>
      <h1 className="mt-3 font-serif text-4xl">Sign in to your bar</h1>
      <p className="mt-3 text-muted-foreground">
        Pick up exactly where you left off.
      </p>
      <form className="mt-8 grid gap-5" onSubmit={submit}>
        {auth.notice && (
          <p
            role="status"
            className="rounded-lg bg-secondary px-4 py-3 text-sm"
          >
            {auth.notice}
          </p>
        )}
        <FormError message={auth.configurationError ?? error} />
        <Field
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
        />
        <Field
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />
        <div className="flex items-center justify-end">
          <Link
            to="/forgot-password"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={pending || !!auth.configurationError}
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-7 text-center text-sm text-muted-foreground">
        New to Bar Buddy?{' '}
        <Link
          to="/signup"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}

export function SignupPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const result = await auth.signUp(email, password);
      if (result === 'signed-in') navigate('/', { replace: true });
      else setConfirmation(true);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setPending(false);
    }
  }

  if (confirmation) {
    return (
      <AuthCard>
        <CheckCircle2 className="size-10 text-primary" aria-hidden="true" />
        <h1 className="mt-5 font-serif text-4xl">Check your email</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          We sent a confirmation link to{' '}
          <strong className="text-foreground">{email}</strong>. Open it to
          finish creating your account.
        </p>
        <Button asChild variant="outline" className="mt-8">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        Start your bar
      </p>
      <h1 className="mt-3 font-serif text-4xl">Create your account</h1>
      <p className="mt-3 text-muted-foreground">
        Your collection stays private to you.
      </p>
      <form className="mt-8 grid gap-5" onSubmit={submit}>
        <FormError message={auth.configurationError ?? error} />
        <Field
          id="signup-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
        />
        <Field
          id="signup-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
        <p className="-mt-2 text-xs text-muted-foreground">
          Use at least 8 characters.
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={pending || !!auth.configurationError}
        >
          {pending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="mt-7 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await auth.sendPasswordReset(email);
      setSent(true);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard>
      <Button asChild variant="ghost" className="-ml-3 mb-6">
        <Link to="/login">
          <ArrowLeft aria-hidden="true" />
          Back to sign in
        </Link>
      </Button>
      <h1 className="font-serif text-4xl">Reset your password</h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        Enter your email and we’ll send you a secure reset link.
      </p>
      {sent ? (
        <p role="status" className="mt-8 rounded-lg bg-secondary px-4 py-4">
          If an account exists for that email, its reset link is on the way.
        </p>
      ) : (
        <form className="mt-8 grid gap-5" onSubmit={submit}>
          <FormError message={auth.configurationError ?? error} />
          <Field
            id="recovery-email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
          />
          <Button
            type="submit"
            size="lg"
            disabled={pending || !!auth.configurationError}
          >
            {pending ? 'Sending link…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  if (auth.status === 'loading')
    return <p aria-live="polite">Opening your reset link…</p>;
  if (auth.status === 'anonymous') return <Navigate to="/login" replace />;
  if (auth.status === 'authenticated') return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await auth.updatePassword(password);
      navigate('/', { replace: true });
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard>
      <h1 className="font-serif text-4xl">Choose a new password</h1>
      <p className="mt-3 text-muted-foreground">
        Make it at least 8 characters.
      </p>
      <form className="mt-8 grid gap-5" onSubmit={submit}>
        <FormError message={error} />
        <Field
          id="new-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Updating password…' : 'Update password'}
        </Button>
      </form>
    </AuthCard>
  );
}

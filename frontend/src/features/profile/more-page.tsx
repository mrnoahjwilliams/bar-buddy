import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';

export function MorePage() {
  const { session, signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function logout() {
    setPending(true);
    setError(undefined);
    try {
      await signOut();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not sign out.',
      );
      setPending(false);
    }
  }

  return (
    <section className="max-w-2xl">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        More
      </p>
      <h1 className="mt-3 font-serif text-5xl">Your account</h1>
      <div className="mt-8 rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="mt-1 font-medium">
          {session?.email ?? 'Your Bar Buddy account'}
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => void logout()}
          disabled={pending}
        >
          <LogOut aria-hidden="true" />
          {pending ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </section>
  );
}

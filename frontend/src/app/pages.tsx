import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  GlassWater,
  LibraryBig,
  LogOut,
  Martini,
} from 'lucide-react';
import { useGetCurrentUser } from '@/api/generated/bar-buddy';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';

export function HomePage() {
  const { session, notice, clearNotice } = useAuth();
  const identity = useGetCurrentUser({ query: { retry: false } });

  return (
    <section>
      <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        Home
      </p>
      <h1 className="mt-3 max-w-2xl font-serif text-4xl leading-tight sm:text-6xl">
        Good to see you
        {session?.email ? `, ${session.email.split('@')[0]}` : ''}.
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
        Your private home bar is connected and ready to grow.
      </p>
      {notice && (
        <button
          type="button"
          onClick={clearNotice}
          className="mt-6 rounded-lg bg-secondary px-4 py-3 text-left text-sm"
        >
          {notice} <span className="ml-2 font-medium">Dismiss</span>
        </button>
      )}
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          to="/bar"
          className="group rounded-2xl border border-border bg-card p-6 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <GlassWater className="size-7 text-primary" aria-hidden="true" />
          <h2 className="mt-8 font-serif text-3xl">Your bar</h2>
          <p className="mt-2 text-muted-foreground">
            Ingredients and bottles will live here next.
          </p>
        </Link>
        <Link
          to="/drinks"
          className="group rounded-2xl border border-border bg-card p-6 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <LibraryBig className="size-7 text-primary" aria-hidden="true" />
          <h2 className="mt-8 font-serif text-3xl">Drinks</h2>
          <p className="mt-2 text-muted-foreground">
            Soon, see what your bar can make.
          </p>
        </Link>
      </div>
      <div className="mt-6 rounded-xl border border-border bg-card px-5 py-4 text-sm">
        {identity.isPending && (
          <p role="status">Connecting to your private bar…</p>
        )}
        {identity.isSuccess && (
          <p role="status" className="flex items-center gap-2">
            <Martini className="size-4 text-primary" aria-hidden="true" />
            Your account is securely connected.
          </p>
        )}
        {identity.isError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p>We couldn’t reach your bar. Check the API and try again.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void identity.refetch()}
            >
              Try again
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function PlaceholderPage({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="max-w-2xl">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-serif text-5xl">{title}</h1>
      <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
        {description}
      </p>
    </section>
  );
}

export function BarPage() {
  return (
    <PlaceholderPage
      eyebrow="Bar"
      title="Your shelves, at a glance."
      description="Have and Out inventory arrives in the next part of the MVP."
    />
  );
}

export function DrinksPage() {
  return (
    <PlaceholderPage
      eyebrow="Drinks"
      title="Find the right pour."
      description="Cocktail browsing and what-you-can-make results arrive with the catalog."
    />
  );
}

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

export function NotFoundPage() {
  return (
    <main className="grid min-h-svh place-items-center px-6">
      <section className="max-w-xl text-center">
        <p className="text-sm text-muted-foreground">404</p>
        <h1 className="mt-3 font-serif text-5xl">This page isn’t here.</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Let’s take you back to Bar Buddy.
        </p>
        <Button asChild className="mt-8">
          <Link to="/">
            <ArrowLeft aria-hidden="true" />
            Back to Bar Buddy
          </Link>
        </Button>
      </section>
    </main>
  );
}

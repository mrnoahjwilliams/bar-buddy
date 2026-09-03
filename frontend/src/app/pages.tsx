import { Link } from 'react-router-dom';
import { ArrowLeft, Martini } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function WelcomePage() {
  return (
    <section className="max-w-2xl">
      <p className="mb-6 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        A little more possibility
      </p>
      <h1 className="font-serif text-5xl leading-[1.08] tracking-tight sm:text-7xl">
        Your bar.
        <br />
        Your next good drink.
      </h1>
      <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted-foreground">
        A home for what you have, and inspiration for what to make with it.
      </p>
      <div className="mt-10 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 font-medium">
          <Martini aria-hidden="true" className="size-5 text-primary" />
          <p>Something good is taking shape.</p>
        </div>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Bar Buddy is in development. Your personal bar and cocktail collection
          are coming soon.
        </p>
      </div>
    </section>
  );
}

export function NotFoundPage() {
  return (
    <section className="max-w-xl">
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
  );
}

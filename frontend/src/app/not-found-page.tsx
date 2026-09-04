import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

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

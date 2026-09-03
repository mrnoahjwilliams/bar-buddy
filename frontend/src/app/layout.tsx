import { Link, Outlet } from 'react-router-dom';
import { Martini } from 'lucide-react';

export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-7 sm:px-10">
        <Link
          to="/"
          className="flex items-center gap-3 text-lg font-semibold tracking-tight"
          aria-label="Bar Buddy home"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Martini className="size-5" aria-hidden="true" />
          </span>
          Bar Buddy
        </Link>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          In the making
        </span>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-16 sm:px-10 sm:py-24"
      >
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-6xl px-6 py-7 text-sm text-muted-foreground sm:px-10">
        Made for your home bar.
      </footer>
    </div>
  );
}

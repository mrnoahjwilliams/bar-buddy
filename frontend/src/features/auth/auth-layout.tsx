import { Link, Outlet } from 'react-router-dom';
import { Martini } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="grid min-h-svh bg-card lg:grid-cols-[minmax(24rem,0.8fr)_1.2fr]">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link
          to="/login"
          className="flex items-center gap-3 text-xl font-semibold"
        >
          <span className="grid size-11 place-items-center rounded-full bg-white/12">
            <Martini className="size-5" aria-hidden="true" />
          </span>
          Bar Buddy
        </Link>
        <div className="max-w-xl pb-8">
          <p className="font-serif text-5xl leading-tight">
            A better answer to “what should we make?”
          </p>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-white/75">
            Keep your home bar organized and turn what you have into your next
            good drink.
          </p>
        </div>
      </aside>
      <div className="flex min-h-svh flex-col">
        <header className="px-6 py-7 lg:hidden">
          <Link
            to="/login"
            className="flex items-center gap-3 font-semibold"
            aria-label="Bar Buddy sign in"
          >
            <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
              <Martini className="size-5" aria-hidden="true" />
            </span>
            Bar Buddy
          </Link>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="flex flex-1 items-center justify-center px-6 py-12 sm:px-12"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

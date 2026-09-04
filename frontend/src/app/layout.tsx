import { NavLink, Outlet } from 'react-router-dom';
import { GlassWater, Home, LibraryBig, Martini, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

const destinations = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/bar', label: 'Bar', icon: GlassWater },
  { to: '/drinks', label: 'Drinks', icon: LibraryBig },
  { to: '/more', label: 'More', icon: Menu },
] as const;

function PrimaryNavigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav
      aria-label="Primary"
      className={mobile ? 'grid grid-cols-4' : 'flex items-center gap-1'}
    >
      {destinations.map(({ to, label, icon: Icon, ...props }) => (
        <NavLink
          key={to}
          to={to}
          {...props}
          className={({ isActive }) =>
            cn(
              'flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors',
              mobile
                ? 'min-h-16 flex-col gap-1 px-2 py-2 text-xs'
                : 'px-4 py-2',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )
          }
        >
          <Icon className="size-5" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-10 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
          <NavLink
            to="/"
            className="flex items-center gap-3 font-semibold"
            aria-label="Bar Buddy home"
          >
            <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
              <Martini className="size-5" aria-hidden="true" />
            </span>
            <span className="text-lg">Bar Buddy</span>
          </NavLink>
          <div className="hidden sm:block">
            <PrimaryNavigation />
          </div>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 pb-28 sm:px-8 sm:py-12"
      >
        <Outlet />
      </main>
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/98 px-2 pb-[env(safe-area-inset-bottom)] sm:hidden">
        <PrimaryNavigation mobile />
      </div>
    </div>
  );
}

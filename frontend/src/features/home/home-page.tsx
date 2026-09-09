import { ArrowRight, GlassWater, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGetHomeSummary } from '@/api/generated/bar-buddy';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';

export function HomePage() {
  const { session, notice, clearNotice } = useAuth();
  const summary = useGetHomeSummary({ query: { retry: false } });
  const data = summary.isError ? undefined : summary.data;

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Home
        </p>
        <h1 className="mt-3 max-w-2xl font-serif text-4xl leading-tight sm:text-6xl">
          Good to see you
          {session?.email ? (
            <>
              ,{' '}
              <span className="block text-2xl sm:text-4xl">
                {session.email.split('@')[0]}.
              </span>
            </>
          ) : (
            '.'
          )}
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
          A look at your shelves, and what you can pour next.
        </p>
      </div>
      {notice && (
        <button
          type="button"
          onClick={clearNotice}
          className="rounded-lg bg-secondary px-4 py-3 text-left text-sm"
        >
          {notice} <span className="ml-2 font-medium">Dismiss</span>
        </button>
      )}
      {summary.isPending && <p role="status">Loading your bar summary…</p>}
      {summary.isError && (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-border bg-card p-5"
        >
          <p>Your bar summary couldn’t be loaded. Please try again.</p>
          <Button variant="outline" onClick={() => void summary.refetch()}>
            Reload summary
          </Button>
        </div>
      )}
      {data && (
        <>
          <section
            aria-label="Your bar summary"
            className="rounded-2xl border border-border bg-card p-5 sm:p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="flex items-center gap-3 font-serif text-3xl">
                <GlassWater aria-hidden="true" />
                Your bar
              </h2>
              <Link
                to="/bar"
                className="inline-flex min-h-11 items-center gap-2 font-medium underline"
              >
                Manage your bar
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <dl className="mt-6 grid gap-4 min-[380px]:grid-cols-3">
              {[
                ['Have items', data.haveItems],
                ['Out items', data.outItems],
                ['Available ingredients', data.availableIngredients],
              ].map(([label, count]) => (
                <div
                  key={label}
                  className="flex min-w-0 items-center justify-between gap-2 min-[380px]:flex-col min-[380px]:items-start"
                >
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="text-3xl font-semibold tabular-nums min-[380px]:mt-auto">
                    {count}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-sm text-muted-foreground">
              Multiple bottles of the same ingredient count once toward what you
              can make.
            </p>
          </section>
          {data.haveItems === 0 && data.outItems === 0 ? (
            <div className="space-y-3 rounded-xl bg-secondary p-5">
              <h2 className="text-xl font-semibold">
                Start with what you have.
              </h2>
              <p>
                Add spirits, juices and mixers to your bar. We’ll show which
                cocktails you can make and what’s missing.
              </p>
              <Link
                to="/bar/ingredients"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add your first ingredient
              </Link>
            </div>
          ) : (
            data.canMake === 0 && (
              <aside
                className="space-y-2 rounded-xl bg-secondary p-5"
                aria-label="Check your mixers"
              >
                <h2 className="text-xl font-semibold">
                  No makeable cocktails yet.
                </h2>
                <p>
                  Check the juices and mixers you already have at home, or
                  explore drinks to see what’s missing.
                </p>
                <Link
                  to="/bar/ingredients"
                  className="inline-flex min-h-11 items-center underline"
                >
                  Add ingredients to your bar
                </Link>
              </aside>
            )
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                to: '/drinks?availability=can_make',
                label: 'You can make',
                count: data.canMake,
                description: 'Ready with the ingredients marked Have.',
              },
              {
                to: '/drinks?availability=one_away',
                label: 'One ingredient away',
                count: data.oneAway,
                description: 'See the one ingredient each drink is missing.',
              },
              {
                to: '/drinks?favoritesOnly=true',
                label: 'Favorites',
                count: data.favorites,
                description: 'Return to the cocktails you’ve saved.',
              },
            ].map(({ to, label, count, description }) => (
              <Link
                key={to}
                to={to}
                className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-secondary"
              >
                <span className="text-4xl font-semibold tabular-nums">
                  {count}
                </span>
                <h2 className="mt-4 text-lg font-semibold">{label}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {description}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <Link
          to="/drinks"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground"
        >
          Explore drinks
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <Link
          to="/bar/ingredients"
          className="inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-5 py-3 font-medium"
        >
          Add to Bar
        </Link>
      </div>
    </section>
  );
}

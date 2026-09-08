import { Link } from 'react-router-dom';
import { useListInventory } from '@/api/generated/bar-buddy';
import { InventoryItemControls, InventoryState } from './inventory-controls';

export function BarPage() {
  const query = useListInventory({ query: { retry: false } });
  return (
    <section className="space-y-6">
      <p className="text-sm uppercase tracking-widest text-muted-foreground">
        Bar
      </p>
      <h1 className="text-3xl font-semibold">Your shelves, at a glance.</h1>
      <Link
        to="/bar/ingredients"
        className="inline-block rounded-lg bg-primary px-5 py-3 text-primary-foreground"
      >
        Add to Bar
      </Link>
      <InventoryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && !query.isError && (
        <>
          {query.data.length === 0 && (
            <p>Your bar is empty. Add ingredients to see what you can make.</p>
          )}
          {(['Have', 'Out'] as const).map((status) => {
            const items = query.data.filter((item) => item.status === status);
            return (
              <section key={status} aria-label={status} className="space-y-3">
                <h2 className="text-xl font-semibold">
                  {status}{' '}
                  <span className="text-muted-foreground">
                    ({items.length})
                  </span>
                </h2>
                {items.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => (
                      <InventoryItemControls key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    {status === 'Have'
                      ? 'No ingredients marked Have.'
                      : 'No items marked Out.'}
                  </p>
                )}
              </section>
            );
          })}
        </>
      )}
    </section>
  );
}

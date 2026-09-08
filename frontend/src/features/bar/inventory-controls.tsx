import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateInventory,
  useDeleteInventory,
  useListInventory,
  useUpdateInventory,
} from '@/api/generated/bar-buddy';
import type { InventoryResponse } from '@/api/generated/models';
import { Button } from '@/components/ui/button';

const control =
  'min-h-11 w-full min-w-0 rounded-lg border border-border bg-card px-3 py-2';

function useRefreshBar() {
  const client = useQueryClient();
  return () =>
    client.invalidateQueries({
      predicate: ({ queryKey }) => {
        const path = queryKey[0];
        return (
          typeof path === 'string' &&
          [
            '/api/v1/inventory',
            '/api/v1/cocktails',
            '/api/v1/ingredients',
          ].some((prefix) => path.startsWith(prefix))
        );
      },
    });
}

export function InventoryItemControls({ item }: { item: InventoryResponse }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [label, setLabel] = useState(item.bottleLabel ?? '');
  const refresh = useRefreshBar();
  const update = useUpdateInventory({
    mutation: {
      onSuccess: async () => {
        await refresh();
        setEditing(false);
      },
    },
  });
  const remove = useDeleteInventory({ mutation: { onSuccess: refresh } });
  const pending = update.isPending || remove.isPending;
  function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    update.mutate({
      id: item.id!,
      data: { bottleLabel: label, status: item.status! },
    });
  }
  return (
    <article
      className="space-y-3 rounded-xl border border-border bg-card p-4"
      aria-label={`${item.ingredient?.name}${item.bottleLabel ? ` — ${item.bottleLabel}` : ''}`}
    >
      <Link
        className="text-lg font-semibold underline"
        to={`/bar/ingredients/${item.ingredient?.id}`}
        state={{ returnTo: '/bar' }}
      >
        {item.ingredient?.name}
      </Link>
      <p className="break-words text-muted-foreground">
        {item.bottleLabel || 'No bottle label'} · {item.status}
      </p>
      {editing ? (
        <form onSubmit={save} className="space-y-3">
          <label className="grid gap-2">
            Bottle label
            <input
              autoFocus
              disabled={pending}
              className={control}
              maxLength={200}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" disabled={pending} type="submit">
              Save label
            </Button>
            <Button
              className="min-h-11"
              disabled={pending}
              variant="outline"
              type="button"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : confirming ? (
        <div className="space-y-3">
          <p>Remove this item from your bar?</p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11"
              disabled={pending}
              onClick={() => remove.mutate({ id: item.id! })}
            >
              Confirm removal
            </Button>
            <Button
              className="min-h-11"
              disabled={pending}
              variant="outline"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            className="min-h-11"
            disabled={pending}
            variant="outline"
            onClick={() =>
              update.mutate({
                id: item.id!,
                data: {
                  bottleLabel: item.bottleLabel,
                  status: item.status === 'Have' ? 'Out' : 'Have',
                },
              })
            }
          >
            Mark {item.status === 'Have' ? 'Out' : 'Have'}
          </Button>
          <Button
            className="min-h-11"
            disabled={pending}
            variant="outline"
            onClick={() => {
              setLabel(item.bottleLabel ?? '');
              update.reset();
              remove.reset();
              setEditing(true);
            }}
          >
            Edit label
          </Button>
          <Button
            className="min-h-11"
            disabled={pending}
            variant="outline"
            onClick={() => {
              update.reset();
              remove.reset();
              setConfirming(true);
            }}
          >
            Remove
          </Button>
        </div>
      )}
      {pending && <p role="status">Saving your bar…</p>}
      {(update.isError || remove.isError) && (
        <p role="alert">This change could not be saved. Try again.</p>
      )}
    </article>
  );
}

export function InventoryState({
  pending,
  error,
  retry,
}: {
  pending: boolean;
  error: unknown;
  retry: () => void;
}) {
  if (pending) return <p role="status">Loading your bar…</p>;
  if (!error) return null;
  return (
    <div role="alert" className="space-y-3">
      <p>Your bar could not be loaded.</p>
      <Button className="min-h-11" variant="outline" onClick={retry}>
        Reload bar
      </Button>
    </div>
  );
}

export function IngredientInventory({
  ingredientId,
}: {
  ingredientId: string;
}) {
  const query = useListInventory({ query: { retry: false } });
  const [label, setLabel] = useState('');
  const [state, setState] = useState<'Have' | 'Out'>('Have');
  const refresh = useRefreshBar();
  const create = useCreateInventory({
    mutation: {
      onSuccess: async () => {
        await refresh();
        setLabel('');
      },
    },
  });
  const items =
    query.data?.filter((item) => item.ingredient?.id === ingredientId) ?? [];
  function add(event: FormEvent) {
    event.preventDefault();
    if (create.isPending) return;
    create.mutate({
      data: { ingredientId, bottleLabel: label, status: state },
    });
  }
  return (
    <section aria-label="Your inventory" className="space-y-4">
      <h2 className="text-xl font-semibold">In your bar</h2>
      <InventoryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && !query.isError && (
        <>
          {items.length === 0 && <p>You haven’t added this ingredient yet.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <InventoryItemControls key={item.id} item={item} />
            ))}
          </div>
          <form
            onSubmit={add}
            className="space-y-3 rounded-xl bg-secondary p-4"
          >
            <h3 className="font-semibold">
              {items.length ? 'Add another bottle' : 'Add to Bar'}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                Bottle label (optional)
                <input
                  disabled={create.isPending}
                  className={control}
                  maxLength={200}
                  value={label}
                  onChange={(event) => {
                    setLabel(event.target.value);
                    create.reset();
                  }}
                  placeholder="e.g. Buffalo Trace"
                />
              </label>
              <label className="grid gap-2">
                Status
                <select
                  disabled={create.isPending}
                  className={control}
                  value={state}
                  onChange={(event) => {
                    setState(event.target.value as 'Have' | 'Out');
                    create.reset();
                  }}
                >
                  <option value="Have">Have</option>
                  <option value="Out">Out</option>
                </select>
              </label>
            </div>
            <Button
              className="min-h-11"
              disabled={create.isPending}
              type="submit"
            >
              {create.isPending ? 'Adding…' : 'Add to Bar'}
            </Button>
            {create.isSuccess && <p role="status">Added to your bar.</p>}
            {create.isError && (
              <p role="alert">
                The item could not be added. Check your bar before retrying.
              </p>
            )}
          </form>
        </>
      )}
    </section>
  );
}

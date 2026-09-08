import { DetailLink } from './detail-links';
import { IngredientInventory } from '@/features/bar/inventory-controls';
import { measurement } from './measurement';
import { useState, type FormEvent } from 'react';
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  useGetCocktail,
  useGetIngredient,
  useListCocktails,
  useListIngredients,
} from '@/api/generated/bar-buddy';
import type { CocktailSummary } from '@/api/generated/models';
import { ApiError } from '@/api/http';
import { Button } from '@/components/ui/button';

const categories = [
  'spirit',
  'liqueur',
  'fortified_wine',
  'bitters',
  'syrup',
  'juice',
  'mixer',
  'fruit',
  'herb',
  'garnish',
  'other',
];
const control =
  'min-h-11 min-w-0 w-full rounded-lg border border-border bg-card px-3 py-2';
const card =
  'block rounded-xl border border-border bg-card p-5 hover:bg-secondary';
const queryOptions = { query: { retry: false } };
function label(value?: string) {
  return value?.replaceAll('_', ' ') ?? '';
}

function QueryState({
  pending,
  error,
  retry,
}: {
  pending: boolean;
  error: unknown;
  retry: () => void;
}) {
  if (pending) return <p role="status">Loading catalog…</p>;
  if (!error) return null;
  const status = error instanceof ApiError ? error.status : undefined;
  return (
    <div role="alert" className="space-y-3">
      <p>
        {status === 404
          ? 'This catalog item could not be found.'
          : status === 400
            ? 'These catalog options are invalid. Reset the filters or return to the catalog.'
            : 'The catalog could not be loaded. Please try again.'}
      </p>
      {status !== 400 && status !== 404 && (
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

function Filters({
  kind,
  options,
}: {
  kind: 'ingredients' | 'cocktails';
  options: { value: string; name: string }[];
}) {
  const [params, setParams] = useSearchParams();
  const filterKey = kind === 'ingredients' ? 'category' : 'primarySpiritId';
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [availability, setAvailability] = useState(
    params.get('availability') ?? '',
  );
  const [filter, setFilter] = useState(params.get(filterKey) ?? '');
  function apply(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (search.trim()) next.set('search', search.trim());
    if (filter) next.set(filterKey, filter);
    if (kind === 'cocktails' && availability)
      next.set('availability', availability);
    setParams(next);
  }
  return (
    <form
      onSubmit={apply}
      className="grid items-end gap-4 rounded-xl bg-secondary p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <label className="grid gap-2">
        Search {kind}
        <input
          type="search"
          maxLength={200}
          className={control}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <label className="grid gap-2">
        {kind === 'ingredients' ? 'Category' : 'Primary spirit'}
        <select
          className={control}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="">
            All {kind === 'ingredients' ? 'categories' : 'spirits'}
          </option>
          {filter && !options.some((option) => option.value === filter) && (
            <option value={filter}>Unknown filter</option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      {kind === 'cocktails' && (
        <label className="grid gap-2">
          Availability
          <select
            className={control}
            value={availability}
            onChange={(event) => setAvailability(event.target.value)}
          >
            <option value="">All</option>
            <option value="can_make">Can Make</option>
            <option value="one_away">Exactly One Ingredient Away</option>
            {availability &&
              !['can_make', 'one_away'].includes(availability) && (
                <option value={availability}>
                  {availability === 'all' ? 'All' : 'Unknown availability'}
                </option>
              )}
          </select>
        </label>
      )}
      <Button className="min-h-11" type="submit">
        Search
      </Button>
      <Button
        type="button"
        className="min-h-11"
        variant="outline"
        onClick={() => {
          setSearch('');
          setFilter('');
          setAvailability('');
          setParams({});
        }}
      >
        Reset filters
      </Button>
    </form>
  );
}

function CocktailLinks({ cocktails }: { cocktails: CocktailSummary[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cocktails.map((cocktail) => (
        <li key={cocktail.id}>
          <DetailLink
            className={`${card} ${cocktail.availability?.canMake ? 'border-primary bg-secondary' : ''}`}
            kind="cocktail"
            id={cocktail.id!}
          >
            <span className="block text-lg font-semibold">{cocktail.name}</span>
            <span className="text-sm text-muted-foreground">
              {cocktail.primarySpirit?.name}
            </span>
            {cocktail.availability && (
              <span className="mt-3 block text-sm font-medium">
                {cocktail.availability.canMake
                  ? 'You can make this'
                  : `${cocktail.availability.missingCount} ingredient${cocktail.availability.missingCount === 1 ? '' : 's'} away`}
              </span>
            )}
            {!cocktail.availability?.canMake &&
              !!cocktail.availability?.missingIngredients?.length && (
                <span className="mt-1 block text-sm text-muted-foreground">
                  Missing:{' '}
                  {cocktail.availability.missingIngredients
                    .slice(0, 2)
                    .map((i) => i.name)
                    .join(', ')}
                  {cocktail.availability.missingIngredients.length > 2
                    ? ` +${cocktail.availability.missingIngredients.length - 2} more`
                    : ''}
                </span>
              )}
          </DetailLink>
        </li>
      ))}
    </ul>
  );
}

export function IngredientCatalogPage() {
  const [params] = useSearchParams();
  const query = useListIngredients(
    {
      search: params.get('search') ?? undefined,
      category: params.get('category') ?? undefined,
    },
    queryOptions,
  );
  return (
    <section className="space-y-6">
      <Link to="/bar" className="underline">
        Back to Bar
      </Link>
      <h1 className="text-3xl font-semibold">Ingredient catalog</h1>
      <Filters
        key={`${params.get('search')}:${params.get('category')}`}
        kind="ingredients"
        options={categories.map((value) => ({ value, name: label(value) }))}
      />
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && !query.isError && (
        <>
          <p role="status">{query.data.length} ingredients</p>
          {query.data.length === 0 && (
            <p>
              No ingredients match your search. Try another name or reset the
              filters.
            </p>
          )}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {query.data.map((ingredient) => (
              <li key={ingredient.id}>
                <DetailLink
                  className={card}
                  kind="ingredient"
                  id={ingredient.id!}
                >
                  <span className="block text-lg font-semibold">
                    {ingredient.name}
                  </span>
                  <span className="capitalize text-muted-foreground">
                    {label(ingredient.category)}
                  </span>
                  {ingredient.matchedAlias && (
                    <span className="mt-2 block text-sm text-muted-foreground">
                      Matched “{ingredient.matchedAlias}”
                    </span>
                  )}
                </DetailLink>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function CocktailCatalogPage() {
  const [params] = useSearchParams();
  const query = useListCocktails(
    {
      search: params.get('search') ?? undefined,
      primarySpiritId: params.get('primarySpiritId') || undefined,
      availability: params.get('availability') || undefined,
    },
    queryOptions,
  );
  const filtered = !!(
    params.get('search') ||
    params.get('primarySpiritId') ||
    params.get('availability')
  );
  const makeable = useListCocktails(
    { availability: 'can_make' },
    { query: { retry: false, enabled: filtered } },
  );
  const noMakeable = filtered
    ? !!makeable.data && !makeable.isError && makeable.data.length === 0
    : !!query.data &&
      !query.isError &&
      query.data.every((c) => c.availability?.canMake === false);
  const spirits = useListIngredients({ category: 'spirit' }, queryOptions);
  return (
    <section className="space-y-6">
      <p className="text-sm uppercase tracking-widest text-muted-foreground">
        Drinks
      </p>
      <h1 className="text-3xl font-semibold">Find the right pour.</h1>
      {noMakeable && (
        <aside
          className="space-y-2 rounded-xl border border-border bg-secondary p-4"
          aria-label="Check your mixers"
        >
          <h2 className="font-semibold">
            Have a few more ingredients at home?
          </h2>
          <p>
            Already have lemon juice, soda water, or other mixers? Add them to
            your bar to see what you can make.
          </p>
          <Link
            className="inline-block py-2 font-medium underline"
            to="/bar/ingredients"
          >
            Check juices and mixers
          </Link>
        </aside>
      )}
      <Filters
        key={`${params.get('search')}:${params.get('primarySpiritId')}:${params.get('availability')}`}
        kind="cocktails"
        options={(spirits.data ?? []).map((spirit) => ({
          value: spirit.id!,
          name: spirit.name!,
        }))}
      />
      <QueryState
        pending={spirits.isPending}
        error={spirits.error}
        retry={() => void spirits.refetch()}
      />
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && !query.isError && (
        <>
          <p role="status">{query.data.length} cocktails</p>
          {query.data.length === 0 && (
            <p>
              No cocktails match your search. Try another name or reset the
              filters.
            </p>
          )}
          {query.data.some((c) => c.availability?.canMake) && (
            <section className="space-y-3" aria-label="You Can Make">
              <h2 className="text-xl font-semibold">You Can Make</h2>
              <CocktailLinks
                cocktails={query.data.filter((c) => c.availability?.canMake)}
              />
            </section>
          )}
          {query.data.some((c) => !c.availability?.canMake) && (
            <section className="space-y-3" aria-label="Other Drinks">
              <h2 className="text-xl font-semibold">Other Drinks</h2>
              <CocktailLinks
                cocktails={query.data.filter((c) => !c.availability?.canMake)}
              />
            </section>
          )}
        </>
      )}
    </section>
  );
}

function BackLink({ fallback }: { fallback: string }) {
  const { state } = useLocation();
  const requested: unknown = state?.returnTo;
  const returnTo =
    typeof requested === 'string' &&
    /^\/(bar|bar\/ingredients|drinks)(\/[^/?#]+)?(\?[^#]*)?$/.test(requested)
      ? requested
      : fallback;
  return (
    <Link
      className="inline-block py-2 underline"
      to={returnTo}
      state={state?.returnState}
    >
      Back to{' '}
      {returnTo === '/bar'
        ? 'Bar'
        : returnTo.startsWith('/bar')
          ? 'ingredients'
          : 'drinks'}
    </Link>
  );
}

export function IngredientDetailPage({
  detailId,
  overlay = false,
}: { detailId?: string; overlay?: boolean } = {}) {
  const { id: routeId = '' } = useParams();
  const id = detailId ?? routeId;
  const query = useGetIngredient(id, queryOptions);
  return (
    <section className="space-y-6">
      {!overlay && <BackLink fallback="/bar/ingredients" />}
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && !query.isError && (
        <>
          <p className="capitalize text-muted-foreground">
            {label(query.data.category)}
          </p>
          <h1 className="text-3xl font-semibold">{query.data.name}</h1>
          {query.data.name === 'Coconut rum' && (
            <p>
              Unsweetened coconut-flavored rum. For sweetened products such as
              Malibu Original, choose Coconut rum liqueur. This does not count
              as plain rum.
            </p>
          )}
          {query.data.name === 'Coconut rum liqueur' && (
            <p>
              Sweetened coconut rum liqueur, including Malibu Original. This
              does not count as plain rum or unsweetened Coconut rum.
            </p>
          )}
          {query.data.name === 'Spiced rum' && (
            <p>
              Rum with added spice flavors. This is a separate ingredient from
              plain or dark rum.
            </p>
          )}
          <IngredientInventory key={id} ingredientId={id} />
          <h2 className="text-xl font-semibold">
            Used in {query.data.usageCount} cocktails
          </h2>
          {query.data.relatedCocktails?.length ? (
            <CocktailLinks cocktails={query.data.relatedCocktails} />
          ) : (
            <p>No cocktails use this ingredient yet.</p>
          )}
        </>
      )}
    </section>
  );
}

export function CocktailDetailPage({
  detailId,
  overlay = false,
}: { detailId?: string; overlay?: boolean } = {}) {
  const { id: routeId = '' } = useParams();
  const id = detailId ?? routeId;
  const query = useGetCocktail(id, queryOptions);
  const recipe = query.data?.recipe;
  return (
    <section className="max-w-3xl space-y-6">
      {!overlay && <BackLink fallback="/drinks" />}
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && !query.isError && (
        <>
          <p className="text-muted-foreground">
            {query.data.primarySpirit?.name}
          </p>
          <h1 className="text-3xl font-semibold">{query.data.name}</h1>
          <p>{recipe?.name}</p>
          {query.data.availability && (
            <section
              aria-label="Drink availability"
              className="inline-block rounded-lg bg-secondary px-3 py-2"
            >
              <h2 className="text-sm font-semibold">
                {query.data.availability.canMake
                  ? 'You can make this'
                  : `${query.data.availability.missingCount} ingredient${query.data.availability.missingCount === 1 ? '' : 's'} away`}
              </h2>
            </section>
          )}
          <div className="rounded-xl border border-border bg-card p-5 sm:p-7">
            <h2 className="mb-4 text-xl font-semibold">Ingredients</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              US measurements
            </p>
            <ol className="space-y-4">
              {recipe?.ingredients?.map((line) => (
                <li key={line.position} className="border-b border-border pb-3">
                  <span className="mr-2 font-medium">
                    {measurement(line.us)}
                  </span>
                  <DetailLink
                    className="inline-block min-h-11 py-2 underline"
                    kind="ingredient"
                    id={line.ingredient?.id ?? ''}
                  >
                    {line.displayName || line.ingredient?.name}
                  </DetailLink>
                  {line.preparation && <span> · {line.preparation}</span>}
                  <span className="block text-sm font-medium">
                    {line.requirement === 'optional'
                      ? 'Optional'
                      : query.data.availability
                        ? query.data.availability.missingIngredients?.some(
                            (i) => i.id === line.ingredient?.id,
                          )
                          ? 'Missing'
                          : 'Have'
                        : ''}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Glassware</dt>
              <dd>{recipe?.glassware || 'Not specified'}</dd>
            </div>
            <div>
              <dt className="font-semibold">Garnish</dt>
              <dd>{recipe?.garnish || 'None specified'}</dd>
            </div>
          </dl>
          <h2 className="text-xl font-semibold">Instructions</h2>
          <p className="whitespace-pre-line leading-relaxed">
            {recipe?.instructions}
          </p>
        </>
      )}
    </section>
  );
}

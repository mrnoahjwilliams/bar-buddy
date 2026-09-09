import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { appRoutes } from '@/app/routes';
import { FakeAuthGateway } from '@/test/fake-auth';
import { measurement } from './measurement';

const gin = { id: 'gin', name: 'Gin', category: 'spirit' };
const lime = { id: 'lime', name: 'Lime Juice', category: 'juice' };
const gimlet = { id: 'gimlet', name: 'Gimlet', primarySpirit: gin };
const detail = {
  ...gimlet,
  recipe: {
    name: 'Classic',
    glassware: 'Coupe',
    garnish: 'Lime wheel',
    instructions: 'Shake with ice.\nStrain into a chilled glass.',
    ingredients: [
      {
        position: 1,
        ingredient: gin,
        displayName: 'Dry gin',
        requirement: 'required',
        us: { quantity: 2, unit: 'ounce' },
      },
      {
        position: 2,
        ingredient: lime,
        preparation: 'freshly squeezed',
        requirement: 'required',
        us: {
          quantity: 0.5,
          maximumQuantity: 0.75,
          unit: 'ounce',
          modifier: 'scant',
        },
      },
      {
        position: 3,
        ingredient: lime,
        displayName: 'Lime wheel',
        requirement: 'optional',
        us: { quantity: 1, unit: 'wheel' },
      },
    ],
  },
};
function mockCatalog() {
  const fetch = vi.fn(async (input: string) => {
    const url = new URL(input, 'http://localhost');
    if (url.pathname === '/api/v1/ingredients/gin')
      return Response.json({
        ...gin,
        usageCount: 1,
        relatedCocktails: [gimlet],
      });
    if (url.pathname === '/api/v1/cocktails/gimlet')
      return Response.json(detail);
    if (url.pathname === '/api/v1/ingredients') {
      const search = url.searchParams.get('search')?.toLowerCase() ?? '';
      const category = url.searchParams.get('category');
      return Response.json(
        [gin, lime].filter(
          (item) =>
            item.name.toLowerCase().includes(search) &&
            (!category || item.category === category),
        ),
      );
    }
    if (url.pathname === '/api/v1/cocktails')
      return Response.json(
        url.searchParams.get('search') === 'missing' ? [] : [gimlet],
      );
    return Response.json({}, { status: 404 });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
function open(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(
    <AppProviders
      authGateway={
        new FakeAuthGateway({
          accessToken: 'catalog-token',
          userId: 'user',
          email: 'user@example.com',
        })
      }
    >
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}
afterEach(() => vi.unstubAllGlobals());

it('combines ingredient search/category, resets empty results, and restores URL filters on back', async () => {
  mockCatalog();
  const user = userEvent.setup();
  const router = open('/bar/ingredients');
  await screen.findByRole('link', { name: /Lime Juice/ });
  await user.type(screen.getByLabelText('Search ingredients'), 'lime');
  await user.selectOptions(screen.getByLabelText('Category'), 'spirit');
  await user.click(screen.getByRole('button', { name: 'Search' }));
  expect(await screen.findByText(/No ingredients match/)).toBeVisible();
  expect(router.state.location.search).toBe('?search=lime&category=spirit');
  await user.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(await screen.findByRole('link', { name: /Lime Juice/ })).toBeVisible();
  await act(() => router.navigate(-1));
  expect(screen.getByLabelText('Search ingredients')).toHaveValue('lime');
  expect(screen.getByLabelText('Category')).toHaveValue('spirit');
});

it('opens related cocktail detail through authenticated generated requests and returns to the filtered catalog', async () => {
  const fetch = mockCatalog();
  const user = userEvent.setup();
  open('/bar/ingredients?search=gin&category=spirit');
  await user.click(await screen.findByRole('link', { name: /Gin/ }));
  expect(
    await screen.findByRole('heading', { name: 'Used in 1 cocktails' }),
  ).toBeVisible();
  expect(screen.getAllByRole('link', { name: /Gimlet/ })).toHaveLength(1);
  await user.click(screen.getByRole('link', { name: /Gimlet/ }));
  expect(await screen.findByRole('heading', { name: 'Gimlet' })).toBeVisible();
  expect(screen.getByText('2 ounce')).toBeVisible();
  expect(screen.getByText('scant 0.5–0.75 ounce')).toBeVisible();
  expect(screen.getByText('Optional')).toBeVisible();
  expect(screen.getByText('Coupe')).toBeVisible();
  expect(screen.getByText(/Shake with ice/)).toBeVisible();
  const lines = screen.getAllByRole('listitem').map((item) => item.textContent);
  expect(lines).toEqual([
    expect.stringContaining('Dry gin'),
    expect.stringContaining('Lime Juice'),
    expect.stringContaining('Lime wheel'),
  ]);
  expect(
    fetch.mock.calls.some(([url]) => url === '/api/v1/cocktails/gimlet'),
  ).toBe(true);
  for (const call of fetch.mock.calls) {
    expect(
      new Headers((call as unknown as [string, RequestInit])[1].headers).get(
        'Authorization',
      ),
    ).toBe('Bearer catalog-token');
  }
  await user.click(screen.getByRole('button', { name: 'Close details' }));
  expect(await screen.findByRole('heading', { name: 'Gin' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Close details' }));
  expect(await screen.findByLabelText('Search ingredients')).toHaveValue('gin');
  expect(screen.getByLabelText('Category')).toHaveValue('spirit');
});

it('preserves cocktail filter/search on detail return and supports reset after empty results', async () => {
  const fetch = mockCatalog();
  const user = userEvent.setup();
  const router = open('/drinks?search=Gim&primarySpiritId=gin');
  await user.click(await screen.findByRole('link', { name: /Gimlet/ }));
  await screen.findByRole('heading', { name: 'Gimlet' });
  await user.click(screen.getByRole('button', { name: 'Close details' }));
  expect(await screen.findByLabelText('Search cocktails')).toHaveValue('Gim');
  expect(screen.getByLabelText('Primary spirit')).toHaveValue('gin');
  await user.clear(screen.getByLabelText('Search cocktails'));
  await user.type(screen.getByLabelText('Search cocktails'), 'missing');
  await user.click(screen.getByRole('button', { name: 'Search' }));
  expect(await screen.findByText(/No cocktails match/)).toBeVisible();
  expect(
    fetch.mock.calls.some(([url]) =>
      url.includes('search=missing&primarySpiritId=gin'),
    ),
  ).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(await screen.findByRole('link', { name: /Gimlet/ })).toBeVisible();
  expect(router.state.location.search).toBe('');
});

it('shows loading, allows retry on failure, and recovers invalid filters with reset', async () => {
  let resolve!: (response: Response) => void;
  const fetch = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValueOnce(Response.json({}, { status: 503 }))
    .mockResolvedValueOnce(Response.json([gin]));
  vi.stubGlobal('fetch', fetch);
  const user = userEvent.setup();
  const router = open('/bar/ingredients?category=unknown');
  expect(await screen.findByText('Loading catalog…')).toBeVisible();
  await act(async () => resolve(Response.json({}, { status: 400 })));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'These catalog options are invalid',
  );
  await user.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The catalog could not be loaded',
  );
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('link', { name: /Gin/ })).toBeVisible();
  expect(router.state.location.search).toBe('');
});

it('handles missing details with a catalog return route', async () => {
  mockCatalog();
  open('/drinks/missing');
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This catalog item could not be found',
  );
  expect(screen.getByRole('link', { name: 'Back to drinks' })).toHaveAttribute(
    'href',
    '/drinks',
  );
  await waitFor(() =>
    expect(screen.queryByText('Loading catalog…')).not.toBeInTheDocument(),
  );
});

it('keeps qualitative and ranged reviewed measurements without invented conversions', () => {
  expect(measurement({ unit: 'to-taste' })).toBe('to-taste');
  expect(
    measurement({
      quantity: 1,
      maximumQuantity: 2,
      modifier: 'heavy',
      unit: 'dash',
    }),
  ).toBe('heavy 1–2 dash');
});

it('keeps the catalog mounted and restores focus through nested Escape, Back and Forward navigation', async () => {
  mockCatalog();
  const user = userEvent.setup();
  const router = open('/bar/ingredients?search=gin&category=spirit');
  const card = await screen.findByRole('link', { name: /^Gin/ });
  card.focus();
  await user.keyboard('{Enter}');
  expect(
    await screen.findByRole('dialog', { name: 'Ingredient details' }),
  ).toBeVisible();
  expect(router.state.location.pathname).toBe('/bar/ingredients');
  expect(card).toBeInTheDocument();
  const related = await screen.findByRole('link', { name: /Gimlet/ });
  await user.click(related);
  expect(
    await screen.findByRole('dialog', { name: 'Cocktail details' }),
  ).toBeVisible();
  await user.keyboard('{Escape}');
  expect(
    await screen.findByRole('dialog', { name: 'Ingredient details' }),
  ).toBeVisible();
  await waitFor(() => expect(related).toHaveFocus());
  await act(() => router.navigate(-1));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  await waitFor(() => expect(card).toHaveFocus());
  expect(screen.getByLabelText('Search ingredients')).toHaveValue('gin');
  await act(() => router.navigate(1));
  expect(
    await screen.findByRole('dialog', { name: 'Ingredient details' }),
  ).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Close details' }));
  expect(router.state.location.search).toBe('?search=gin&category=spirit');
});

it('opens a direct overlay URL and closes without leaving the app or discarding filters', async () => {
  mockCatalog();
  const user = userEvent.setup();
  const router = open('/drinks?search=Gim&detail=cocktail%3Agimlet');
  expect(await screen.findByRole('heading', { name: 'Gimlet' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Close details' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(router.state.location.pathname).toBe('/drinks');
  expect(router.state.location.search).toBe('?search=Gim');
  expect(screen.getByLabelText('Search cocktails')).toHaveValue('Gim');
  expect(screen.getByRole('main')).toHaveFocus();
});

it('explains alias matches on the canonical ingredient card', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json([
        {
          id: 'orange',
          name: 'Orange liqueur',
          category: 'liqueur',
          matchedAlias: 'Triple sec',
        },
      ]),
    ),
  );
  open('/bar/ingredients?search=triple+sec');
  expect(
    await screen.findByRole('link', {
      name: /Orange liqueur.*Matched “Triple sec”/,
    }),
  ).toBeVisible();
});

it('shows short missing lists on cards and only missing availability tags in the recipe without a duplicate missing section', async () => {
  const base = mockCatalog();
  const missing = [
    lime,
    { id: 'syrup', name: 'Simple syrup' },
    { id: 'lemon', name: 'Lemon juice' },
  ];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, options: RequestInit) => {
      const path = new URL(input, 'http://localhost').pathname;
      const availability = {
        canMake: false,
        missingCount: 3,
        missingIngredients: missing,
      };
      if (path === '/api/v1/cocktails')
        return Response.json([{ ...gimlet, availability }]);
      if (path === '/api/v1/cocktails/gimlet')
        return Response.json({ ...detail, availability });
      return (base as typeof fetch)(input, options);
    }),
  );
  const user = userEvent.setup();
  open('/drinks');
  expect(
    await screen.findByText('Missing: Lime Juice, Simple syrup +1 more'),
  ).toBeVisible();
  await user.click(screen.getByRole('link', { name: /Gimlet/ }));
  expect(await screen.findByText('Missing')).toBeVisible();
  expect(screen.queryByText('Have')).not.toBeInTheDocument();
  expect(screen.getByText('Optional')).toBeVisible();
  expect(screen.queryByText('Missing from your bar:')).not.toBeInTheDocument();
});

it('does not claim nothing is makeable just because the active search has no matches', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(input, 'http://localhost');
      return Response.json(
        url.searchParams.get('availability') === 'can_make'
          ? [
              {
                ...gimlet,
                availability: {
                  canMake: true,
                  missingCount: 0,
                  missingIngredients: [],
                },
              },
            ]
          : [],
      );
    }),
  );
  open('/drinks?search=missing');
  expect(await screen.findByText(/No cocktails match/)).toBeVisible();
  expect(
    screen.queryByRole('complementary', { name: 'Check your mixers' }),
  ).not.toBeInTheDocument();
});

it('keeps focus inside the remaining dialog when closing a directly loaded nested detail', async () => {
  mockCatalog();
  const user = userEvent.setup();
  open('/drinks?detail=cocktail%3Agimlet&detail=ingredient%3Agin');
  expect(await screen.findByRole('heading', { name: 'Gin' })).toBeVisible();
  await user.keyboard('{Escape}');
  const parent = await screen.findByRole('dialog', {
    name: 'Cocktail details',
  });
  await waitFor(() =>
    expect(parent).toContainElement(document.activeElement as HTMLElement),
  );
  expect(screen.queryByRole('main')).not.toBeInTheDocument();
  await user.keyboard('{Tab}');
  expect(parent).toContainElement(document.activeElement as HTMLElement);
});

it('favorites from cards and details, combines the favorites filter, and refreshes affected views', async () => {
  let favorite = false;
  const fetch = vi.fn(async (input: string, options?: RequestInit) => {
    const url = new URL(input, 'http://localhost');
    if (url.pathname === '/api/v1/ingredients') return Response.json([gin]);
    if (
      url.pathname === '/api/v1/cocktails/gimlet/preference' &&
      options?.method === 'PUT'
    ) {
      favorite = JSON.parse(options.body as string).favorite as boolean;
      return Response.json({ cocktailId: 'gimlet', favorite });
    }
    if (url.pathname === '/api/v1/cocktails/gimlet')
      return Response.json({ ...detail, favorite });
    if (url.pathname === '/api/v1/cocktails') {
      const matches =
        (!url.searchParams.has('favoritesOnly') || favorite) &&
        (!url.searchParams.get('search') ||
          'gimlet'.includes(url.searchParams.get('search')!.toLowerCase()));
      return Response.json(
        matches
          ? [
              {
                ...gimlet,
                favorite,
                availability: {
                  canMake: true,
                  missingCount: 0,
                  missingIngredients: [],
                },
              },
            ]
          : [],
      );
    }
    return Response.json({}, { status: 404 });
  });
  vi.stubGlobal('fetch', fetch);
  const user = userEvent.setup();
  const router = open(
    '/drinks?search=Gim&primarySpiritId=gin&availability=can_make',
  );

  await user.click(
    await screen.findByRole('button', { name: 'Add to favorites: Gimlet' }),
  );
  expect(
    await screen.findByRole('button', {
      name: 'Remove from favorites: Gimlet',
    }),
  ).toBePressed();
  const save = fetch.mock.calls.find(
    ([url, options]) =>
      url === '/api/v1/cocktails/gimlet/preference' &&
      (options as RequestInit).method === 'PUT',
  );
  expect(JSON.parse((save?.[1] as RequestInit).body as string)).toEqual({
    favorite: true,
  });

  await user.click(screen.getByRole('link', { name: /Gimlet/ }));
  const dialog = await screen.findByRole('dialog', {
    name: 'Cocktail details',
  });
  expect(
    within(dialog).getByRole('button', { name: 'Favorited' }),
  ).toBePressed();
  await user.click(screen.getByRole('button', { name: 'Close details' }));

  await user.click(screen.getByLabelText('Favorites only'));
  await user.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByRole('link', { name: /Gimlet/ });
  expect(router.state.location.search).toBe(
    '?search=Gim&primarySpiritId=gin&availability=can_make&favoritesOnly=true',
  );
  await user.click(
    screen.getByRole('button', { name: 'Remove from favorites: Gimlet' }),
  );
  expect(
    await screen.findByText(/No favorite cocktails match these filters/),
  ).toBeVisible();
  expect(
    screen.queryByRole('link', { name: /Gimlet/ }),
  ).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(await screen.findByRole('link', { name: /Gimlet/ })).toBeVisible();
  expect(router.state.location.search).toBe('');
});

it('keeps the current favorite state and shows feedback when saving fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, options?: RequestInit) => {
      const url = new URL(input, 'http://localhost');
      if (url.pathname === '/api/v1/ingredients') return Response.json([gin]);
      if (url.pathname.endsWith('/preference') && options?.method === 'PUT')
        return Response.json({}, { status: 503 });
      if (url.pathname === '/api/v1/cocktails')
        return Response.json([{ ...gimlet, favorite: false }]);
      return Response.json({}, { status: 404 });
    }),
  );
  const user = userEvent.setup();
  open('/drinks');
  const add = await screen.findByRole('button', {
    name: 'Add to favorites: Gimlet',
  });
  await user.click(add);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Your favorite could not be saved',
  );
  expect(add).not.toBePressed();
});

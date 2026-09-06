import { act, render, screen, waitFor } from '@testing-library/react';
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
  await user.click(screen.getByRole('link', { name: 'Back to ingredients' }));
  expect(await screen.findByRole('heading', { name: 'Gin' })).toBeVisible();
  await user.click(screen.getByRole('link', { name: 'Back to ingredients' }));
  expect(await screen.findByLabelText('Search ingredients')).toHaveValue('gin');
  expect(screen.getByLabelText('Category')).toHaveValue('spirit');
});

it('preserves cocktail filter/search on detail return and supports reset after empty results', async () => {
  const fetch = mockCatalog();
  const user = userEvent.setup();
  const router = open('/drinks?search=Gim&primarySpiritId=gin');
  await user.click(await screen.findByRole('link', { name: /Gimlet/ }));
  await screen.findByRole('heading', { name: 'Gimlet' });
  await user.click(screen.getByRole('link', { name: 'Back to drinks' }));
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

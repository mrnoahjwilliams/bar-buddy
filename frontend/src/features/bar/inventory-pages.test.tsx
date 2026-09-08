import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { appRoutes } from '@/app/routes';
import { FakeAuthGateway } from '@/test/fake-auth';
import type { InventoryResponse } from '@/api/generated/models';
const gin = { id: 'gin', name: 'Gin', category: 'spirit' };
const lime = { id: 'lime', name: 'Lime Juice', category: 'juice' };
function fixture() {
  const bars: Record<string, InventoryResponse[]> = { one: [], two: [] };
  const failures = { read: false, write: false };
  let serial = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, options: RequestInit) => {
      const url = new URL(input, 'http://localhost');
      const owner =
        new Headers(options.headers)
          .get('Authorization')
          ?.replace('Bearer ', '') ?? '';
      const items = bars[owner] ?? [];
      const method = options.method ?? 'GET';
      const body = options.body ? JSON.parse(options.body as string) : {};
      if (url.pathname.startsWith('/api/v1/inventory')) {
        if (method === 'GET')
          return failures.read
            ? Response.json({}, { status: 503 })
            : Response.json(items);
        if (failures.write) return Response.json({}, { status: 503 });
        if (method === 'POST') {
          const item = {
            id: String(++serial),
            ingredient: body.ingredientId === 'gin' ? gin : lime,
            bottleLabel: body.bottleLabel,
            status: body.status,
          };
          items.push(item);
          return Response.json(item, { status: 201 });
        }
        const index = items.findIndex(
          (item) => item.id === url.pathname.split('/').at(-1),
        );
        if (index < 0) return Response.json({}, { status: 404 });
        if (method === 'PATCH') {
          items[index] = { ...items[index], ...body };
          return Response.json(items[index]);
        }
        items.splice(index, 1);
        return new Response(null, { status: 204 });
      }
      const missing = [gin, lime].filter(
        (ingredient) =>
          !items.some(
            (item) =>
              item.ingredient?.id === ingredient.id && item.status === 'Have',
          ),
      );
      const drink = {
        id: 'gimlet',
        name: 'Gimlet',
        primarySpirit: gin,
        availability: {
          canMake: missing.length === 0,
          missingCount: missing.length,
          missingIngredients: missing,
        },
      };
      if (url.pathname === '/api/v1/ingredients')
        return Response.json(
          url.searchParams.get('category') === 'spirit' ? [gin] : [gin, lime],
        );
      if (url.pathname.startsWith('/api/v1/ingredients/'))
        return Response.json({
          ...(url.pathname.endsWith('gin') ? gin : lime),
          usageCount: 1,
          relatedCocktails: [drink],
        });
      if (url.pathname === '/api/v1/cocktails/gimlet')
        return Response.json({
          ...drink,
          recipe: {
            name: 'Classic',
            instructions: 'Shake and strain.',
            ingredients: [],
          },
        });
      if (url.pathname === '/api/v1/cocktails') {
        const filter = url.searchParams.get('availability');
        return Response.json(
          (filter === 'can_make' && missing.length > 0) ||
            (filter === 'one_away' && missing.length !== 1)
            ? []
            : [drink],
        );
      }
      return Response.json({}, { status: 404 });
    }),
  );
  return { bars, failures };
}
function open(path: string) {
  const gateway = new FakeAuthGateway({
    accessToken: 'one',
    userId: 'one',
    email: 'one@example.com',
  });
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(
    <AppProviders authGateway={gateway}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, gateway };
}
afterEach(() => vi.unstubAllGlobals());
it('adds duplicate bottles, edits labels, persists Have/Out across navigation and removes only the selected item', async () => {
  fixture();
  const user = userEvent.setup();
  const { router } = open('/bar');
  expect(await screen.findByText(/Your bar is empty/)).toBeVisible();
  await user.click(screen.getByRole('link', { name: 'Add to Bar' }));
  await user.click(await screen.findByRole('link', { name: /^Gin/ }));
  await user.type(
    await screen.findByLabelText('Bottle label (optional)'),
    'London dry',
  );
  await user.click(screen.getByRole('button', { name: 'Add to Bar' }));
  expect(await screen.findByText('Added to your bar.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Add to Bar' }));
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  await act(() => router.navigate('/bar'));
  const bottle = await screen.findByRole('article', {
    name: 'Gin — London dry',
  });
  await user.click(within(bottle).getByRole('button', { name: 'Edit label' }));
  await user.clear(within(bottle).getByLabelText('Bottle label'));
  await user.type(
    within(bottle).getByLabelText('Bottle label'),
    'Favorite gin',
  );
  await user.click(within(bottle).getByRole('button', { name: 'Save label' }));
  const renamed = await screen.findByRole('article', {
    name: 'Gin — Favorite gin',
  });
  await user.click(within(renamed).getByRole('button', { name: 'Mark Out' }));
  expect(
    await within(screen.getByRole('region', { name: 'Out' })).findByRole(
      'article',
      { name: 'Gin — Favorite gin' },
    ),
  ).toBeVisible();
  await act(() => router.navigate('/bar/ingredients'));
  await act(() => router.navigate('/bar'));
  const restored = await within(
    screen.getByRole('region', { name: 'Out' }),
  ).findByRole('article', { name: 'Gin — Favorite gin' });
  await user.click(within(restored).getByRole('button', { name: 'Mark Have' }));
  const stocked = await within(
    screen.getByRole('region', { name: 'Have' }),
  ).findByRole('article', { name: 'Gin — Favorite gin' });
  await user.click(within(stocked).getByRole('button', { name: 'Remove' }));
  await user.click(within(stocked).getByRole('button', { name: 'Cancel' }));
  await user.click(within(stocked).getByRole('button', { name: 'Remove' }));
  await user.click(
    within(stocked).getByRole('button', { name: 'Confirm removal' }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('article', { name: 'Gin — Favorite gin' }),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getAllByRole('article')).toHaveLength(1);
});
it('refreshes detail and filtered availability after adding a missing ingredient and preserves navigation', async () => {
  const data = fixture();
  data.bars.one!.push({ id: 'existing', ingredient: gin, status: 'Have' });
  const user = userEvent.setup();
  const { router } = open(
    '/drinks?search=Gim&primarySpiritId=gin&availability=one_away',
  );
  expect(
    await screen.findByRole('heading', { name: 'Other Drinks' }),
  ).toBeVisible();
  await user.click(screen.getByRole('link', { name: /Gimlet/ }));
  expect(await screen.findByText('Missing from your bar:')).toBeVisible();
  await user.click(screen.getByRole('link', { name: 'Lime Juice' }));
  await user.click(await screen.findByRole('button', { name: 'Add to Bar' }));
  expect(await screen.findByText('Added to your bar.')).toBeVisible();
  expect(
    screen.getByRole('link', { name: /Gimlet.*You can make this/ }),
  ).toBeVisible();
  await user.click(screen.getByRole('link', { name: 'Back to drinks' }));
  expect(
    await screen.findByRole('heading', { name: 'You can make this' }),
  ).toBeVisible();
  await user.click(screen.getByRole('link', { name: 'Back to drinks' }));
  expect(await screen.findByText(/No cocktails match/)).toBeVisible();
  expect(screen.getByLabelText('Availability')).toHaveValue('one_away');
  expect(router.state.location.search).toBe(
    '?search=Gim&primarySpiritId=gin&availability=one_away',
  );
  await user.selectOptions(screen.getByLabelText('Availability'), 'can_make');
  await user.click(screen.getByRole('button', { name: 'Search' }));
  expect(
    await screen.findByRole('heading', { name: 'You Can Make' }),
  ).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(router.state.location.search).toBe('');
  expect(screen.getByLabelText('Availability')).toHaveValue('');
});
it('retries failed loads and changes while clearing private inventory and drafts on account switch', async () => {
  const data = fixture();
  data.failures.read = true;
  const user = userEvent.setup();
  const { gateway } = open('/bar/ingredients/gin');
  expect(
    await screen.findByText('Your bar could not be loaded.'),
  ).toBeVisible();
  data.failures.read = false;
  await user.click(screen.getByRole('button', { name: 'Reload bar' }));
  await user.type(
    await screen.findByLabelText('Bottle label (optional)'),
    'Private label',
  );
  data.failures.write = true;
  await user.click(screen.getByRole('button', { name: 'Add to Bar' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The item could not be added',
  );
  expect(screen.getByLabelText('Bottle label (optional)')).toHaveValue(
    'Private label',
  );
  data.failures.write = false;
  await user.click(screen.getByRole('button', { name: 'Add to Bar' }));
  const bottle = await screen.findByRole('article', {
    name: 'Gin — Private label',
  });
  data.failures.write = true;
  await user.click(within(bottle).getByRole('button', { name: 'Mark Out' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This change could not be saved',
  );
  expect(within(bottle).getByText('Private label · Have')).toBeVisible();
  data.failures.write = false;
  await user.click(within(bottle).getByRole('button', { name: 'Mark Out' }));
  expect(await within(bottle).findByText('Private label · Out')).toBeVisible();
  await user.type(
    screen.getByLabelText('Bottle label (optional)'),
    'Private draft',
  );
  await act(async () =>
    gateway.emit('session-changed', {
      accessToken: 'two',
      userId: 'two',
      email: 'two@example.com',
    }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText('Bottle label (optional)')).toHaveValue(''),
  );
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(screen.queryByText(/Private label/)).not.toBeInTheDocument();
  expect(
    screen.getByText('You haven’t added this ingredient yet.'),
  ).toBeVisible();
});

it('keeps a pending add single and preserves its input until the response arrives', async () => {
  const data = fixture();
  const respond = globalThis.fetch;
  let finish!: () => Promise<void>;
  const delayed = vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
    if (options?.method === 'POST')
      return new Promise<Response>((resolve) => {
        finish = async () => resolve(await respond(input, options));
      });
    return respond(input, options);
  });
  vi.stubGlobal('fetch', delayed);
  const user = userEvent.setup();
  open('/bar/ingredients/gin');
  await user.type(
    await screen.findByLabelText('Bottle label (optional)'),
    'One bottle',
  );
  await user.click(screen.getByRole('button', { name: 'Add to Bar' }));
  expect(screen.getByLabelText('Bottle label (optional)')).toBeDisabled();
  expect(screen.getByLabelText('Status')).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Adding…' }));
  expect(
    delayed.mock.calls.filter(([, options]) => options?.method === 'POST'),
  ).toHaveLength(1);
  await act(async () => finish());
  expect(await screen.findByText('Added to your bar.')).toBeVisible();
  expect(data.bars.one).toHaveLength(1);
});

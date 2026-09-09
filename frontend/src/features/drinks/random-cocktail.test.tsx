import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { appRoutes } from '@/app/routes';
import { FakeAuthGateway } from '@/test/fake-auth';

const gin = { id: 'gin', name: 'Gin', category: 'spirit' };
const drink = {
  id: 'drink',
  name: 'Gimlet',
  favorite: true,
  primarySpirit: gin,
  availability: { canMake: true, missingCount: 0, missingIngredients: [] },
};
function mockRandom(random: (options: RequestInit) => Promise<Response>) {
  const fetch = vi.fn(async (input: string, options: RequestInit) => {
    const path = new URL(input, 'http://localhost').pathname;
    if (path === '/api/v1/cocktails/random') return random(options);
    if (path === '/api/v1/cocktails') return Response.json([drink]);
    if (path === '/api/v1/cocktails/drink')
      return Response.json({
        ...drink,
        recipe: { instructions: 'Shake and strain.', ingredients: [] },
      });
    if (path === '/api/v1/ingredients') return Response.json([gin]);
    return Response.json({}, { status: 404 });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
function open() {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [
      '/drinks?search=Gim&primarySpiritId=gin&availability=can_make&favoritesOnly=true',
    ],
  });
  const gateway = new FakeAuthGateway({
    accessToken: 'token',
    userId: 'one',
    email: 'one@example.com',
  });
  render(
    <AppProviders authGateway={gateway}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, gateway };
}
afterEach(() => vi.unstubAllGlobals());

it('picks with every applied filter, opens the overlay and restores filters and focus', async () => {
  const fetch = mockRandom(async () => Response.json(drink));
  const user = userEvent.setup();
  const { router } = open();
  const button = await screen.findByRole('button', { name: 'Random cocktail' });
  await user.type(screen.getByLabelText('Search cocktails'), ' unapplied');
  await user.click(button);
  expect(await screen.findByRole('heading', { name: 'Gimlet' })).toBeVisible();
  expect(
    fetch.mock.calls
      .filter(([url]) => url.includes('/random'))
      .map(([url]) => url),
  ).toEqual([
    '/api/v1/cocktails/random?search=Gim&primarySpiritId=gin&availability=can_make&favoritesOnly=true',
  ]);
  await user.keyboard('{Escape}');
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(router.state.location.search).toBe(
    '?search=Gim&primarySpiritId=gin&availability=can_make&favoritesOnly=true',
  );
  expect(button).toHaveFocus();
  await user.click(button);
  await screen.findByRole('dialog');
  await act(() => router.navigate(-1));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps filters for no candidates and allows retry after server failure', async () => {
  let status = 404;
  mockRandom(async () =>
    status === 200 ? Response.json(drink) : Response.json({}, { status }),
  );
  const user = userEvent.setup();
  const { router } = open();
  await user.click(
    await screen.findByRole('button', { name: 'Random cocktail' }),
  );
  expect(await screen.findByText(/No matching cocktails/)).toBeVisible();
  expect(router.state.location.search).toContain('favoritesOnly=true');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  status = 503;
  await user.click(screen.getByRole('button', { name: 'Random cocktail' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'couldn’t be picked',
  );
  status = 200;
  await user.click(screen.getByRole('button', { name: 'Random cocktail' }));
  expect(await screen.findByRole('dialog')).toBeVisible();
});

it('prevents duplicate picks and discards a pending result when applied filters change', async () => {
  let resolve!: (response: Response) => void;
  let signal: AbortSignal | undefined;
  const fetch = mockRandom((options) => {
    signal = options.signal!;
    return new Promise<Response>((done) => {
      resolve = done;
    });
  });
  const user = userEvent.setup();
  const { router } = open();
  await user.click(
    await screen.findByRole('button', { name: 'Random cocktail' }),
  );
  expect(
    screen.getByRole('button', { name: 'Picking a cocktail…' }),
  ).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(signal?.aborted).toBe(true);
  await act(async () => resolve(Response.json(drink)));
  expect(router.state.location.search).toBe('');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    fetch.mock.calls.filter(([url]) => url.includes('/random')),
  ).toHaveLength(1);
});

it('discards a pending private selection on account change', async () => {
  let resolve!: (response: Response) => void;
  let signal: AbortSignal | undefined;
  mockRandom((options) => {
    signal = options.signal!;
    return new Promise<Response>((done) => {
      resolve = done;
    });
  });
  const { gateway } = open();
  await userEvent.click(
    await screen.findByRole('button', { name: 'Random cocktail' }),
  );
  act(() =>
    gateway.emit('session-changed', {
      accessToken: 'other',
      userId: 'two',
      email: 'two@example.com',
    }),
  );
  await waitFor(() => expect(signal?.aborted).toBe(true));
  await act(async () => resolve(Response.json(drink)));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

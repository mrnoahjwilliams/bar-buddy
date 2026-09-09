import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { appRoutes } from '@/app/routes';
import { FakeAuthGateway } from '@/test/fake-auth';

const empty = {
  haveItems: 0,
  outItems: 0,
  availableIngredients: 0,
  canMake: 0,
  oneAway: 0,
  favorites: 0,
};
function open() {
  const router = createMemoryRouter(appRoutes, { initialEntries: ['/'] });
  const view = render(
    <AppProviders
      authGateway={
        new FakeAuthGateway({
          accessToken: 'token',
          userId: 'user',
          email: 'user@example.com',
        })
      }
    >
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...view, router };
}
afterEach(() => vi.unstubAllGlobals());

it('loads a real summary and links into the existing filtered flows', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json({
        ...empty,
        haveItems: 8,
        outItems: 2,
        availableIngredients: 6,
        canMake: 3,
        oneAway: 4,
        favorites: 5,
      }),
    ),
  );
  open();
  expect(
    await screen.findByRole('region', { name: 'Your bar summary' }),
  ).toHaveTextContent('Have items8Out items2Available ingredients6');
  expect(screen.getByRole('link', { name: /3 You can make/ })).toHaveAttribute(
    'href',
    '/drinks?availability=can_make',
  );
  expect(
    screen.getByRole('link', { name: /4 One ingredient away/ }),
  ).toHaveAttribute('href', '/drinks?availability=one_away');
  expect(screen.getByRole('link', { name: /5 Favorites/ })).toHaveAttribute(
    'href',
    '/drinks?favoritesOnly=true',
  );
});

it('shows loading, recoverable failure and new-bar onboarding without false zero counts', async () => {
  let resolve!: (response: Response) => void;
  const fetch = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    )
    .mockImplementation(() => Promise.resolve(Response.json(empty)));
  vi.stubGlobal('fetch', fetch);
  open();
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Loading your bar summary',
  );
  expect(
    screen.queryByRole('region', { name: 'Your bar summary' }),
  ).not.toBeInTheDocument();
  await act(async () => resolve(Response.json({}, { status: 503 })));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'couldn’t be loaded',
  );
  expect(
    screen.queryByText('Start with what you have.'),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Reload summary' }));
  expect(await screen.findByText('Start with what you have.')).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'Add your first ingredient' }),
  ).toHaveAttribute('href', '/bar/ingredients');
});

it('refreshes the summary after a bar mutation and favorite mutation', async () => {
  let have = true;
  let favorite = false;
  let homeReads = 0;
  const gin = { id: 'gin', name: 'Gin', category: 'spirit' };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit) => {
      const path = new URL(input, 'http://localhost').pathname;
      if (path === '/api/v1/home') {
        homeReads++;
        return Response.json({
          ...empty,
          haveItems: have ? 1 : 0,
          outItems: have ? 0 : 1,
          favorites: favorite ? 1 : 0,
        });
      }
      if (path === '/api/v1/inventory/item') {
        have = false;
        return Response.json({ id: 'item', ingredient: gin, status: 'Out' });
      }
      if (path === '/api/v1/inventory')
        return Response.json([
          { id: 'item', ingredient: gin, status: have ? 'Have' : 'Out' },
        ]);
      if (path.endsWith('/preference') && init.method === 'PUT') {
        favorite = true;
        return Response.json({ cocktailId: 'drink', favorite });
      }
      if (path === '/api/v1/cocktails')
        return Response.json([
          {
            id: 'drink',
            name: 'Gin Drink',
            favorite,
            availability: {
              canMake: false,
              missingCount: 1,
              missingIngredients: [gin],
            },
          },
        ]);
      if (path === '/api/v1/ingredients') return Response.json([gin]);
      return Response.json({}, { status: 404 });
    }),
  );
  const { router } = open();
  const user = userEvent.setup();
  await screen.findByRole('region', { name: 'Your bar summary' });
  await user.click(screen.getByRole('link', { name: /Manage your bar/ }));
  await user.click(await screen.findByRole('button', { name: 'Mark Out' }));
  await screen.findByRole('button', { name: 'Mark Have' });
  await act(() => router.navigate('/'));
  expect(
    await screen.findByRole('region', { name: 'Your bar summary' }),
  ).toHaveTextContent('Have items0Out items1');
  await user.click(screen.getByRole('link', { name: /Explore drinks/ }));
  await user.click(
    await screen.findByRole('button', { name: 'Add to favorites: Gin Drink' }),
  );
  await screen.findByRole('button', {
    name: 'Remove from favorites: Gin Drink',
  });
  await act(() => router.navigate('/'));
  expect(
    await screen.findByRole('link', { name: /1 Favorites/ }),
  ).toBeVisible();
  await waitFor(() => expect(homeReads).toBeGreaterThanOrEqual(3));
});

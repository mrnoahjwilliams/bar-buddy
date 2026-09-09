import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AppProviders } from './providers';
import { appRoutes } from './routes';
import { FakeAuthGateway } from '@/test/fake-auth';

// A persistent fake server lets this journey cross fresh query caches on reload.
it('connects signup, inventory, missing ingredients, favorites, random, reload and logout', async () => {
  const gin = { id: 'gin', name: 'Gin', category: 'spirit' };
  let stocked = false;
  let favorite = false;
  const cocktail = () => ({
    id: 'drink',
    name: 'Test Pour',
    primarySpirit: gin,
    favorite,
    availability: {
      canMake: stocked,
      missingCount: stocked ? 0 : 1,
      missingIngredients: stocked ? [] : [gin],
    },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, options: RequestInit) => {
      const path = new URL(input, 'http://localhost').pathname;
      if (path === '/api/v1/home')
        return Response.json({
          haveItems: stocked ? 1 : 0,
          outItems: 0,
          availableIngredients: stocked ? 1 : 0,
          canMake: stocked ? 1 : 0,
          oneAway: stocked ? 0 : 1,
          favorites: favorite ? 1 : 0,
        });
      if (path === '/api/v1/inventory') {
        if (options.method === 'POST') {
          stocked = true;
          return Response.json({ id: 'item', ingredient: gin, status: 'Have' });
        }
        return Response.json(
          stocked ? [{ id: 'item', ingredient: gin, status: 'Have' }] : [],
        );
      }
      if (path === '/api/v1/ingredients') return Response.json([gin]);
      if (path === '/api/v1/ingredients/gin')
        return Response.json({
          ...gin,
          usageCount: 1,
          relatedCocktails: [cocktail()],
        });
      if (path === '/api/v1/cocktails/drink/preference') {
        favorite = true;
        return Response.json({ cocktailId: 'drink', favorite });
      }
      if (path === '/api/v1/cocktails/drink')
        return Response.json({
          ...cocktail(),
          recipe: {
            instructions: 'Pour over ice.',
            ingredients: [
              {
                ingredient: gin,
                requirement: 'required',
                position: 1,
                us: { quantity: 2, unit: 'ounce' },
              },
            ],
          },
        });
      if (path === '/api/v1/cocktails/random') return Response.json(cocktail());
      if (path === '/api/v1/cocktails') return Response.json([cocktail()]);
      return Response.json({}, { status: 404 });
    }),
  );
  const gateway = new FakeAuthGateway();
  function mount(path: string) {
    const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
    const view = render(
      <AppProviders authGateway={gateway}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    return { ...view, router };
  }
  const user = userEvent.setup();
  const first = mount('/signup');
  await user.type(await screen.findByLabelText('Email'), 'new@example.com');
  await user.type(screen.getByLabelText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  await user.click(await screen.findByRole('link', { name: /Explore drinks/ }));
  await user.click(await screen.findByRole('link', { name: /Test Pour/ }));
  expect(await screen.findByText('Missing')).toBeVisible();
  await user.keyboard('{Escape}');
  await act(() => first.router.navigate('/bar'));
  await user.click(await screen.findByRole('link', { name: 'Add to Bar' }));
  await user.click(await screen.findByRole('link', { name: /Gin/ }));
  await user.click(await screen.findByRole('button', { name: 'Add to Bar' }));
  await screen.findByText('Added to your bar.');
  await user.keyboard('{Escape}');
  await act(() => first.router.navigate('/drinks'));
  expect(
    await screen.findByRole('region', { name: 'You Can Make' }),
  ).toHaveTextContent('Test Pour');
  await user.click(
    screen.getByRole('button', { name: 'Add to favorites: Test Pour' }),
  );
  await screen.findByRole('button', {
    name: 'Remove from favorites: Test Pour',
  });
  await user.click(screen.getByRole('button', { name: 'Random cocktail' }));
  await screen.findByRole('heading', { name: 'Test Pour' });
  const reloadedPath = `${first.router.state.location.pathname}${first.router.state.location.search}`;
  first.unmount();
  const second = mount(reloadedPath);
  expect(
    await screen.findByRole('button', { name: 'Favorited' }),
  ).toBeVisible();
  expect(screen.queryByText('Missing')).not.toBeInTheDocument();
  await user.keyboard('{Escape}');
  await act(() => second.router.navigate('/more'));
  await user.click(await screen.findByRole('button', { name: 'Sign out' }));
  await waitFor(() =>
    expect(
      screen.getByRole('heading', { name: 'Sign in to your bar' }),
    ).toBeVisible(),
  );
});

afterEach(() => vi.unstubAllGlobals());

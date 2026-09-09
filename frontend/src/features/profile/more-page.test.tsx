import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { appRoutes } from '@/app/routes';
import { FakeAuthGateway } from '@/test/fake-auth';

function open() {
  const gateway = new FakeAuthGateway({
    accessToken: 'a-token',
    userId: 'a',
    email: 'avery@example.com',
  });
  const router = createMemoryRouter(appRoutes, { initialEntries: ['/more'] });
  render(
    <AppProviders authGateway={gateway}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { gateway, router };
}
afterEach(() => vi.unstubAllGlobals());

it('saves and clears a name, greets by saved name, and offers password recovery', async () => {
  let displayName: string | null = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options: RequestInit) => {
      if (url === '/api/v1/me') {
        if (options.method === 'PUT')
          displayName = JSON.parse(options.body as string).displayName || null;
        return Response.json({
          id: 'a',
          createdAt: '2026-09-09T00:00:00Z',
          displayName,
        });
      }
      return Response.json({
        haveItems: 0,
        outItems: 0,
        availableIngredients: 0,
        canMake: 0,
        oneAway: 0,
        favorites: 0,
      });
    }),
  );
  const user = userEvent.setup();
  const { gateway, router } = open();
  await user.type(await screen.findByLabelText('Your name'), 'Avery');
  await user.click(screen.getByRole('button', { name: 'Save profile' }));
  expect(await screen.findByText('Profile saved.')).toBeVisible();
  await user.click(
    screen.getByRole('button', { name: 'Send password reset email' }),
  );
  expect(
    await screen.findByText('Check your inbox for the password reset link.'),
  ).toBeVisible();
  expect(gateway.resetRequest?.email).toBe('avery@example.com');
  await act(() => router.navigate('/'));
  expect(
    await screen.findByRole('heading', { name: 'Good to see you, Avery.' }),
  ).toBeVisible();
  await act(() => router.navigate('/more'));
  expect(await screen.findByLabelText('Your name')).toHaveValue('Avery');
  await user.clear(screen.getByLabelText('Your name'));
  await user.click(screen.getByRole('button', { name: 'Save profile' }));
  await waitFor(() => expect(displayName).toBeNull());
});

it('preserves edits after a failed save and reloads a failed profile', async () => {
  let failing = true;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options: RequestInit) => {
      if (failing || options.method === 'PUT')
        return Response.json({}, { status: 500 });
      return Response.json({ id: 'a', displayName: 'Avery' });
    }),
  );
  const user = userEvent.setup();
  open();
  expect(
    await screen.findByText('Your profile couldn’t be loaded.'),
  ).toBeVisible();
  failing = false;
  await user.click(screen.getByRole('button', { name: 'Reload profile' }));
  await user.type(await screen.findByLabelText('Your name'), ' New');
  await user.click(screen.getByRole('button', { name: 'Save profile' }));
  expect(
    await screen.findByText('Your name couldn’t be saved. Please try again.'),
  ).toBeVisible();
  expect(screen.getByLabelText('Your name')).toHaveValue('Avery New');
});

it('discards the previous account draft and ignores a late save after switching accounts', async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options: RequestInit) => {
      if (options.method === 'PUT')
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      const second =
        new Headers(options.headers).get('Authorization') === 'Bearer b-token';
      return Response.json({
        id: second ? 'b' : 'a',
        displayName: second ? 'Blake' : 'Avery',
      });
    }),
  );
  const user = userEvent.setup();
  const { gateway } = open();
  await user.type(await screen.findByLabelText('Your name'), ' Private');
  await user.click(screen.getByRole('button', { name: 'Save profile' }));
  await waitFor(() => expect(finish).toBeDefined());
  act(() =>
    gateway.emit('session-changed', {
      userId: 'b',
      accessToken: 'b-token',
      email: 'blake@example.com',
    }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText('Your name')).toHaveValue('Blake'),
  );
  await act(async () =>
    finish(Response.json({ id: 'a', displayName: 'Avery Private' })),
  );
  expect(screen.getByLabelText('Your name')).toHaveValue('Blake');
  expect(screen.queryByText('Profile saved.')).not.toBeInTheDocument();
});

it('requires exact confirmation, preserves the account after failure, and signs out after accepted deletion', async () => {
  let fail = true;
  const fetch = vi.fn(async (_url: string, options: RequestInit) => {
    if (options.method === 'DELETE')
      return new Response(null, { status: fail ? 503 : 202 });
    return Response.json({ id: 'a', displayName: 'Avery' });
  });
  vi.stubGlobal('fetch', fetch);
  const user = userEvent.setup();
  open();
  await user.click(
    await screen.findByRole('button', { name: 'Delete my account' }),
  );
  const remove = screen.getByRole('button', {
    name: 'Permanently delete account',
  });
  expect(remove).toBeDisabled();
  await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
  await user.click(remove);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Account deletion couldn’t be confirmed',
  );
  expect(screen.getByText('avery@example.com')).toBeVisible();
  fail = false;
  await user.click(remove);
  expect(
    await screen.findByRole('heading', { name: 'Sign in to your bar' }),
  ).toBeVisible();
  expect(screen.queryByText('avery@example.com')).not.toBeInTheDocument();
});

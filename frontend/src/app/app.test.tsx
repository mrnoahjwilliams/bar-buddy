import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { appRoutes } from '@/app/routes';
import type { AppSession } from '@/features/auth/auth-gateway';
import { FakeAuthGateway } from '@/test/fake-auth';

const userA: AppSession = {
  accessToken: 'user-a-token',
  userId: 'user-a',
  email: 'avery@example.com',
};

function renderApp(path: string, authGateway = new FakeAuthGateway()) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(
    <AppProviders authGateway={authGateway}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { authGateway, router };
}

afterEach(() => vi.unstubAllGlobals());

describe('session and navigation', () => {
  it('returns signed-out visitors to their requested page after login', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/bar?view=out#bottles');

    expect(
      await screen.findByRole('heading', { name: 'Sign in to your bar' }),
    ).toBeVisible();
    await user.type(screen.getByLabelText('Email'), 'avery@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', {
        name: 'Your shelves, at a glance.',
      }),
    ).toBeVisible();
    for (const link of screen.getAllByRole('link', { name: 'Bar' })) {
      expect(link).toHaveAttribute('aria-current', 'page');
    }
    expect(router.state.location).toMatchObject({
      pathname: '/bar',
      search: '?view=out',
      hash: '#bottles',
    });
  });

  it('attaches the access token and replaces cached identity on account change', async () => {
    const fetch = vi
      .fn()
      .mockImplementation((_url: string, options: RequestInit) =>
        Promise.resolve(
          Response.json({
            id: new Headers(options.headers)
              .get('Authorization')
              ?.replace('Bearer ', ''),
            createdAt: '2026-09-04T00:00:00Z',
          }),
        ),
      );
    vi.stubGlobal('fetch', fetch);
    const gateway = new FakeAuthGateway(userA);
    renderApp('/', gateway);

    expect(
      await screen.findByText('Your account is securely connected.'),
    ).toBeVisible();
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/v1/me',
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    expect((fetch.mock.calls.at(-1)?.[1] as RequestInit).headers).toSatisfy(
      (headers: Headers) =>
        headers.get('Authorization') === 'Bearer user-a-token',
    );

    act(() => {
      gateway.emit('session-changed', {
        accessToken: 'user-b-token',
        userId: 'user-b',
        email: 'blake@example.com',
      });
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect((fetch.mock.calls.at(-1)?.[1] as RequestInit).headers).toSatisfy(
      (headers: Headers) =>
        headers.get('Authorization') === 'Bearer user-b-token',
    );
    expect(await screen.findByText(/Good to see you, blake/)).toBeVisible();
  });

  it('ends an expired session when refresh fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );
    const gateway = new FakeAuthGateway(userA);
    gateway.refreshResult = null;
    renderApp('/', gateway);

    expect(
      await screen.findByRole('heading', { name: 'Sign in to your bar' }),
    ).toBeVisible();
    expect(screen.getByText(/Your session expired/)).toBeVisible();
    expect(gateway.signOutCalls).toBe(1);
  });

  it('signs out from More and protects the application again', async () => {
    const user = userEvent.setup();
    const gateway = new FakeAuthGateway(userA);
    renderApp('/more', gateway);

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(
      await screen.findByRole('heading', { name: 'Sign in to your bar' }),
    ).toBeVisible();
    expect(screen.getByText('You’re signed out.')).toBeVisible();
  });
});

describe('account creation and recovery', () => {
  it('handles email-confirmation signup without claiming a session', async () => {
    const user = userEvent.setup();
    const gateway = new FakeAuthGateway();
    gateway.signupResult = null;
    renderApp('/signup', gateway);

    await user.type(await screen.findByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByRole('heading', { name: 'Check your email' }),
    ).toBeVisible();
    expect(screen.getByText(/new@example.com/)).toBeVisible();
  });

  it('requests recovery and updates a password from a recovery session', async () => {
    const user = userEvent.setup();
    const gateway = new FakeAuthGateway();
    const first = renderApp('/forgot-password', gateway);

    await user.type(await screen.findByLabelText('Email'), 'avery@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      /reset link is on the way/,
    );
    expect(gateway.resetRequest).toEqual({
      email: 'avery@example.com',
      redirectTo: 'http://localhost:3000/reset-password',
    });

    first.router.navigate('/reset-password');
    act(() => gateway.emit('password-recovery', userA));
    await user.type(
      await screen.findByLabelText('New password'),
      'newpassword123',
    );
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(gateway.updatedPassword).toBe('newpassword123');
    expect(
      await screen.findByRole('heading', { name: /Good to see you, avery/ }),
    ).toBeVisible();
  });

  it('shows provider errors and keeps the visitor on the login form', async () => {
    const user = userEvent.setup();
    const gateway = new FakeAuthGateway();
    gateway.signInError = new Error('Invalid login credentials');
    renderApp('/login', gateway);

    await user.type(await screen.findByLabelText('Email'), 'wrong@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid login credentials',
    );
    expect(
      screen.getByRole('heading', { name: 'Sign in to your bar' }),
    ).toBeVisible();
  });
});

describe('unknown routes', () => {
  it('recovers through the visible return link', async () => {
    const user = userEvent.setup();
    renderApp('/missing', new FakeAuthGateway(userA));

    expect(
      await screen.findByRole('heading', { name: 'This page isn’t here.' }),
    ).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Back to Bar Buddy' }));
    expect(
      await screen.findByRole('heading', { name: /Good to see you, avery/ }),
    ).toBeVisible();
  });
});

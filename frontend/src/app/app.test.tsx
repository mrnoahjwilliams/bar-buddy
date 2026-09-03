import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers';
import { appRoutes } from '@/app/routes';

describe('application shell', () => {
  it('recovers from an unknown URL through the visible return link', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/missing'],
    });
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'This page isn’t here.' }),
    ).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Back to Bar Buddy' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Your bar\.\s*Your next good drink\./,
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'This page isn’t here.' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Bar Buddy is in development/)).toBeVisible();
  });
});

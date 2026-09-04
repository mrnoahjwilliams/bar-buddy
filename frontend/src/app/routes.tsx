import type { RouteObject } from 'react-router-dom';
import { AppLayout } from '@/app/layout';
import { RequireGuest, RequireSession } from '@/features/auth/auth-guards';
import { AuthLayout } from '@/features/auth/auth-layout';

export const appRoutes: RouteObject[] = [
  {
    element: <RequireSession />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/',
            lazy: async () => ({
              Component: (await import('@/features/home/home-page')).HomePage,
            }),
          },
          {
            path: '/bar',
            lazy: async () => ({
              Component: (await import('@/features/bar/bar-page')).BarPage,
            }),
          },
          {
            path: '/drinks',
            lazy: async () => ({
              Component: (await import('@/features/drinks/drinks-page'))
                .DrinksPage,
            }),
          },
          {
            path: '/more',
            lazy: async () => ({
              Component: (await import('@/features/profile/more-page'))
                .MorePage,
            }),
          },
        ],
      },
    ],
  },
  {
    element: <RequireGuest />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          {
            path: '/login',
            lazy: async () => ({
              Component: (await import('@/features/auth/auth-pages')).LoginPage,
            }),
          },
          {
            path: '/signup',
            lazy: async () => ({
              Component: (await import('@/features/auth/auth-pages'))
                .SignupPage,
            }),
          },
          {
            path: '/forgot-password',
            lazy: async () => ({
              Component: (await import('@/features/auth/auth-pages'))
                .ForgotPasswordPage,
            }),
          },
        ],
      },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/reset-password',
        lazy: async () => ({
          Component: (await import('@/features/auth/auth-pages'))
            .ResetPasswordPage,
        }),
      },
    ],
  },
  {
    path: '*',
    lazy: async () => ({
      Component: (await import('@/app/not-found-page')).NotFoundPage,
    }),
  },
];

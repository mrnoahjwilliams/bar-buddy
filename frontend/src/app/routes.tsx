import type { RouteObject } from 'react-router-dom';
import { AppLayout } from '@/app/layout';
import {
  BarPage,
  DrinksPage,
  HomePage,
  MorePage,
  NotFoundPage,
} from '@/app/pages';
import { RequireGuest, RequireSession } from '@/features/auth/auth-guards';
import { AuthLayout } from '@/features/auth/auth-layout';
import {
  ForgotPasswordPage,
  LoginPage,
  ResetPasswordPage,
  SignupPage,
} from '@/features/auth/auth-pages';

export const appRoutes: RouteObject[] = [
  {
    element: <RequireSession />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/bar', element: <BarPage /> },
          { path: '/drinks', element: <DrinksPage /> },
          { path: '/more', element: <MorePage /> },
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
          { path: '/login', element: <LoginPage /> },
          { path: '/signup', element: <SignupPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
    ],
  },
  {
    element: <AuthLayout />,
    children: [{ path: '/reset-password', element: <ResetPasswordPage /> }],
  },
  { path: '*', element: <NotFoundPage /> },
];

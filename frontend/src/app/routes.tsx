import type { RouteObject } from 'react-router-dom';
import { AppLayout } from '@/app/layout';
import { WelcomePage, NotFoundPage } from '@/app/pages';

export const appRoutes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <WelcomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

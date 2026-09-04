import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/use-auth';

function SessionLoading() {
  return (
    <main className="grid min-h-svh place-items-center px-6" aria-live="polite">
      <p className="text-sm text-muted-foreground">Opening your bar…</p>
    </main>
  );
}

export function RequireSession() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <SessionLoading />;
  if (status === 'recovery') return <Navigate to="/reset-password" replace />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function RequireGuest() {
  const { status } = useAuth();
  if (status === 'loading') return <SessionLoading />;
  if (status === 'recovery') return <Navigate to="/reset-password" replace />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <Outlet />;
}

import { useState, type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/features/auth/auth-provider';
import type { AuthGateway } from '@/features/auth/auth-gateway';
import { getDefaultAuthGateway } from '@/features/auth/supabase-auth';

interface AppProvidersProps extends PropsWithChildren {
  authGateway?: AuthGateway;
}

export function AppProviders({ children, authGateway }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [gateway] = useState(() => authGateway ?? getDefaultAuthGateway());
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider gateway={gateway}>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

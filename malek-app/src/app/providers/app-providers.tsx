import { QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { AuthProvider } from '@/hooks/use-auth';
import { CompanyProvider } from '@/hooks/use-company';
import { queryClient } from './query-client';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CompanyProvider>{children}</CompanyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

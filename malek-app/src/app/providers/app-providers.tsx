import { QueryClientProvider } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import type { PropsWithChildren } from 'react';
import { AuthProvider } from '@/hooks/use-auth';
import { CompanyProvider, isCompanyGateExemptPath } from '@/hooks/use-company';
import { queryClient } from './query-client';

export function AppProviders({ children }: PropsWithChildren) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CompanyProvider gateExempt={isCompanyGateExemptPath(pathname)}>{children}</CompanyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

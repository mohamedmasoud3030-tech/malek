import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UtilitiesPage } from './utilities-page';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

export function UtilitiesWorkspaceE2EFixture() {
  return (
    <QueryClientProvider client={queryClient}>
      <div dir="rtl" data-e2e-utilities-workspace>
        <UtilitiesPage />
      </div>
    </QueryClientProvider>
  );
}

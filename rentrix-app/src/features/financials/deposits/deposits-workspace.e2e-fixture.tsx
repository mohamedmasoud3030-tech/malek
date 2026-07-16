import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DepositsWorkspace } from './deposits-workspace';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

export function DepositsWorkspaceE2EFixture() {
  return (
    <QueryClientProvider client={queryClient}>
      <div dir="rtl" data-e2e-deposits-workspace>
        <DepositsWorkspace />
      </div>
    </QueryClientProvider>
  );
}

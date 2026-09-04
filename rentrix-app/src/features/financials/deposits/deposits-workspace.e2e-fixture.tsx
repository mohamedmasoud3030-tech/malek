import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DepositsWorkspace } from './deposits-page';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

export function DepositsWorkspaceE2EFixture() {
  return (
    <QueryClientProvider client={queryClient}>
      <div dir="rtl" data-e2e-deposits-workspace>
        {/* The standalone page shell is the e2e surface: page identity and the
            create action come from the canonical workspace header. */}
        <DepositsWorkspace />
      </div>
    </QueryClientProvider>
  );
}

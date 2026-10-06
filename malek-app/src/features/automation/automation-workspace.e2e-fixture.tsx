import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AutomationCenterView } from './components/automation-center-view';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

export function AutomationWorkspaceE2EFixture() {
  return (
    <QueryClientProvider client={queryClient}>
      <div dir="rtl" data-e2e-automation-workspace>
        <AutomationCenterView />
      </div>
    </QueryClientProvider>
  );
}

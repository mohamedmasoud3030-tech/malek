import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentsVaultWorkspace } from './components/documents-vault-workspace';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

export function DocumentsVaultWorkspaceE2EFixture() {
  return (
    <QueryClientProvider client={queryClient}>
      <div dir="rtl" data-e2e-vault-workspace>
        <DocumentsVaultWorkspace mode="standalone" />
      </div>
    </QueryClientProvider>
  );
}

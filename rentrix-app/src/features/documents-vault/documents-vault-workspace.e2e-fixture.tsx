import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentsVaultPage } from './documents-vault-page';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

export function DocumentsVaultWorkspaceE2EFixture() {
  return (
    <QueryClientProvider client={queryClient}>
      <div dir="rtl" data-e2e-vault-workspace>
        <DocumentsVaultPage />
      </div>
    </QueryClientProvider>
  );
}

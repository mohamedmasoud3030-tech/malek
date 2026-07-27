import { DocumentsVaultWorkspace } from './components/documents-vault-workspace';

/**
 * Standalone /documents-vault route entry point. Renders the shared
 * DocumentsVaultWorkspace in "standalone" mode (full PageLayout +
 * PageHeader). The same workspace also powers the embedded "خزينة
 * المستندات" tab inside the operations hub — see
 * src/features/operations-hub.
 */
export function DocumentsVaultPage() {
  return <DocumentsVaultWorkspace mode="standalone" />;
}

export default DocumentsVaultPage;

import { DocumentsVaultPage } from '@/features/documents-vault/documents-vault-page';

/** Legacy bookmark adapter. New workflows enter documents through an owning entity. */
export function DocumentsVaultRouteComponent() {
  return <DocumentsVaultPage />;
}

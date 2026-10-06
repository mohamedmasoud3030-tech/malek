import { ContextualDocumentsSection } from '@/components/documents/contextual-documents-section';

/**
 * Contract documents use the same vault foundation as every other dossier.
 * The historical contract_documents service remains only as a legacy adapter
 * for old callers/data migration; new UI writes never create a second store.
 */
export function ContractDocumentsShell({ contractId }: Readonly<{ contractId: string }>) {
  return <ContextualDocumentsSection entityType="contract" entityId={contractId} entityLabel="العقد" />;
}

import { ContextualDocumentsPanel, type ContextualDocument } from '@/components/documents/contextual-documents-panel';
import { ATTACHMENTS_ACCEPT } from '@/lib/attachments-contract';
import { getContractDocumentSignedUrl, type ContractDocumentRecord } from './contractDocumentsService';
import { useContractDocuments, useDeleteContractDocument, useUploadContractDocument } from './useContractDocuments';

const EMPTY_DOCUMENTS: ContractDocumentRecord[] = [];
// تسمية الإجراء المشتركة في foundation: أرشفة المستند مع الاحتفاظ بسجله وتاريخه في الأرشيف.

type ContractDocumentsShellProps = Readonly<{ contractId: string }>;

function toContextualDocument(document: ContractDocumentRecord): ContextualDocument {
  return {
    id: document.id,
    title: document.file_name,
    typeLabel: document.mime_type?.includes('pdf') ? 'PDF' : 'مرفق',
    reference: document.id,
    fileName: document.file_name,
    fileSize: document.file_size ? `${(document.file_size / 1024).toFixed(1)} ك.ب` : null,
    mimeType: document.mime_type,
    url: undefined,
  };
}

export function ContractDocumentsShell({ contractId }: ContractDocumentsShellProps) {
  const documentsQuery = useContractDocuments(contractId);
  const uploadMutation = useUploadContractDocument(contractId);
  const deleteMutation = useDeleteContractDocument(contractId);
  const documents = documentsQuery.data ?? EMPTY_DOCUMENTS;

  return (
    <ContextualDocumentsPanel
      entityLabel="العقد"
      documents={documents.map(toContextualDocument)}
      isLoading={documentsQuery.isLoading}
      isError={documentsQuery.isError}
      errorMessage={documentsQuery.error instanceof Error ? documentsQuery.error.message : 'تعذر تحميل مستندات العقد.'}
      onRetry={() => void documentsQuery.refetch()}
      onUpload={async (file) => { await uploadMutation.mutateAsync(file); }}
      onArchive={async (document) => { await deleteMutation.mutateAsync(document.id); }}
      isUploading={uploadMutation.isPending}
      archivingId={deleteMutation.isPending ? documents.find((document) => document.id === deleteMutation.variables)?.id ?? null : null}
      resolveUrl={async (document) => {
        const record = documents.find((candidate) => candidate.id === document.id);
        return record ? String(await getContractDocumentSignedUrl(record) as unknown as string) : null;
      }}
      accept={ATTACHMENTS_ACCEPT}
    />
  );
}

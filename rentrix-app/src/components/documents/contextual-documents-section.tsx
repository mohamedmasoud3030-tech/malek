import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ContextualDocumentsPanel } from './contextual-documents-panel';
import { ATTACHMENTS_ACCEPT } from '@/lib/attachments-contract';
import { useOptionalAuth } from '@/hooks/use-auth';
import {
  archiveContextualDocument,
  defaultDocumentCategory,
  documentCategoryLabels,
  getContextualDocumentSignedUrl,
  listContextualDocuments,
  replaceContextualDocument,
  uploadContextualDocument,
  type ContextualDocumentRow,
  type DocumentEntityType,
} from '@/services/documents/contextualDocumentsService';

function humanDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ar-OM-u-nu-latn');
}

function richDocumentMetadata(metadata: ContextualDocumentRow['metadata']) {
  if (!metadata) return {};
  const parties = typeof metadata.parties === 'string' ? metadata.parties : metadata.parties?.join('، ');
  const amount = metadata.amount === undefined || metadata.amount === null ? null : String(metadata.amount);
  const importantDate = humanDate(metadata.importantDate ?? metadata.issueDate);
  const expiresAt = humanDate(metadata.expiresAt ?? metadata.expiryDate);
  const replacedAt = humanDate(metadata.replacedAt);
  return {
    reference: metadata.businessReference ?? metadata.reference ?? null,
    parties: parties || null,
    importantDate,
    expiresAt,
    amount,
    status: metadata.status ?? null,
    metadata: replacedAt ? `آخر استبدال: ${replacedAt}` : null,
  };
}

export function ContextualDocumentsSection({
  entityType,
  entityId,
  entityLabel,
}: Readonly<{ entityType: DocumentEntityType; entityId: string; entityLabel: string }>) {
  const auth = useOptionalAuth();
  const canWrite = auth?.canAccess('documents.write') ?? false;
  const queryClient = useQueryClient();
  const queryKey = ['contextual-documents', entityType, entityId] as const;
  const documentsQuery = useQuery({ queryKey, queryFn: () => listContextualDocuments(entityType, entityId), enabled: Boolean(entityId) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadContextualDocument({
      file,
      title: file.name,
      category: defaultDocumentCategory(entityType),
      relatedEntityType: entityType,
      relatedEntityId: entityId,
    }),
    onSuccess: invalidate,
  });
  const replaceMutation = useMutation({ mutationFn: ({ id, file }: { id: string; file: File }) => replaceContextualDocument(id, file), onSuccess: invalidate });
  const archiveMutation = useMutation({ mutationFn: (id: string) => archiveContextualDocument(id), onSuccess: invalidate });
  const documents = documentsQuery.data ?? [];
  const resolveUrl = async (documentId: string) => {
    const source = documents.find((candidate) => candidate.id === documentId);
    return source ? getContextualDocumentSignedUrl(source.storage_path) : null;
  };

  return (
    <ContextualDocumentsPanel
      entityLabel={entityLabel}
      documents={documents.map((document: ContextualDocumentRow) => ({
        id: document.id,
        title: document.title,
        typeLabel: documentCategoryLabels[document.category] ?? 'مستند',
        ...richDocumentMetadata(document.metadata),
        fileName: document.file_name,
        fileSize: document.file_size ? `${(document.file_size / 1024).toFixed(1)} ك.ب` : null,
        mimeType: document.mime_type,
        relatedEntity: entityLabel,
      }))}
      isLoading={documentsQuery.isLoading}
      isError={documentsQuery.isError}
      onRetry={() => void documentsQuery.refetch()}
      onUpload={canWrite ? async (file) => { await uploadMutation.mutateAsync(file); } : undefined}
      onReplace={canWrite ? async (document, file) => { await replaceMutation.mutateAsync({ id: document.id, file }); } : undefined}
      onArchive={canWrite ? async (document) => { await archiveMutation.mutateAsync(document.id); } : undefined}
      isUploading={uploadMutation.isPending || replaceMutation.isPending}
      archivingId={archiveMutation.isPending ? archiveMutation.variables ?? null : null}
      resolveUrl={async (document) => resolveUrl(document.id)}
      canUpload={canWrite}
      canArchive={canWrite}
      accept={ATTACHMENTS_ACCEPT}
    />
  );
}

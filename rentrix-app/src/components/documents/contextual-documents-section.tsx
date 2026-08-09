import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ContextualDocumentsPanel } from './contextual-documents-panel';
import { ATTACHMENTS_ACCEPT } from '@/lib/attachments-contract';
import { archiveContextualDocument, getContextualDocumentSignedUrl, listContextualDocuments, uploadContextualDocument, type ContextualDocumentRow } from '@/services/documents/contextualDocumentsService';

export function ContextualDocumentsSection({ entityType, entityId, entityLabel }: Readonly<{ entityType: string; entityId: string; entityLabel: string }>) {
  const queryClient = useQueryClient();
  const queryKey = ['contextual-documents', entityType, entityId] as const;
  const documentsQuery = useQuery({ queryKey, queryFn: () => listContextualDocuments(entityType, entityId), enabled: Boolean(entityId) });
  const uploadMutation = useMutation({ mutationFn: (file: File) => uploadContextualDocument({ file, title: file.name, category: 'other', relatedEntityType: entityType, relatedEntityId: entityId }), onSuccess: () => queryClient.invalidateQueries({ queryKey }) });
  const archiveMutation = useMutation({ mutationFn: (id: string) => archiveContextualDocument(id), onSuccess: () => queryClient.invalidateQueries({ queryKey }) });
  const documents = documentsQuery.data ?? [];
  return (
    <ContextualDocumentsPanel
      entityLabel={entityLabel}
      documents={documents.map((document: ContextualDocumentRow) => ({ id: document.id, title: document.title, typeLabel: document.category, reference: document.related_entity_id, fileName: document.file_name, fileSize: document.file_size ? `${(document.file_size / 1024).toFixed(1)} KB` : null, mimeType: document.mime_type, relatedEntity: document.related_entity_type }))}
      isLoading={documentsQuery.isLoading}
      isError={documentsQuery.isError}
      onRetry={() => void documentsQuery.refetch()}
      onUpload={async (file) => { await uploadMutation.mutateAsync(file); }}
      onArchive={async (document) => { await archiveMutation.mutateAsync(document.id); }}
      isUploading={uploadMutation.isPending}
      archivingId={archiveMutation.isPending ? archiveMutation.variables ?? null : null}
      resolveUrl={async (document) => { const source = documents.find((candidate) => candidate.id === document.id); return source ? getContextualDocumentSignedUrl(source.storage_path) : null; }}
      accept={ATTACHMENTS_ACCEPT}
    />
  );
}

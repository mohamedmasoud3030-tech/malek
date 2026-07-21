import { FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ATTACHMENTS_ACCEPT } from '@/lib/attachments-contract';
import { getContractDocumentSignedUrl, type ContractDocumentRecord } from './contractDocumentsService';
import { useContractDocuments, useDeleteContractDocument, useUploadContractDocument } from './useContractDocuments';

type ContractDocumentsShellProps = Readonly<{ contractId: string }>;

function isImageFileName(fileName: string) {
  return /\.(jpg|jpeg|png|webp)$/i.test(fileName);
}

// Stable empty-array identity so effects keyed on `documents` do not re-fire
// on every render when the query has no data yet.
const EMPTY_DOCUMENTS: ContractDocumentRecord[] = [];

function formatFileSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
}

/**
 * Resolve a display URL per document: legacy rows keep their absolute URL as
 * stored; private-bucket rows get a short-lived signed URL at view time.
 */
function useResolvedDocumentUrls(documents: ContractDocumentRecord[]) {
  const [resolvedMap, setResolvedMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (documents.length === 0) {
      setResolvedMap((current) => (Object.keys(current).length === 0 ? current : {}));
      return undefined;
    }

    let cancelled = false;
    void Promise.all(
      documents.map(async (doc) => {
        try {
          return [doc.id, await getContractDocumentSignedUrl(doc)] as const;
        } catch {
          return [doc.id, ''] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const [id, url] of entries) {
        if (url) map[id] = url;
      }
      setResolvedMap((current) => {
        const currentKeys = Object.keys(current);
        const nextKeys = Object.keys(map);
        if (currentKeys.length === nextKeys.length && nextKeys.every((key) => current[key] === map[key])) {
          return current;
        }
        return map;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [documents]);

  return resolvedMap;
}

export function ContractDocumentsShell({ contractId }: ContractDocumentsShellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { data: documents = EMPTY_DOCUMENTS, isLoading, isError, error } = useContractDocuments(contractId);
  const uploadMutation = useUploadContractDocument(contractId);
  const deleteMutation = useDeleteContractDocument(contractId);
  const resolvedUrls = useResolvedDocumentUrls(documents);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = '';
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    deleteMutation.mutate(pendingDeleteId, { onSettled: () => setPendingDeleteId(null) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="size-5 text-primary" />
          مستندات العقد
        </CardTitle>
        <CardDescription>ارفع نسخة موقعة من العقد أو أي مرفقات ذات صلة (صور أو PDF، بحد أقصى 5 ميغابايت).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-6">
        <div>
          <Button
            type="button"
            variant="secondary"
            disabled={uploadMutation.isPending}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" />
            {uploadMutation.isPending ? 'جاري الرفع...' : 'رفع مستند جديد'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ATTACHMENTS_ACCEPT}
            className="sr-only"
            onChange={handleFileChange}
            disabled={uploadMutation.isPending}
            aria-label="رفع مستند العقد"
          />
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">جارٍ تحميل المستندات...</p>}
        {isError && (
          <p className="text-sm font-bold text-destructive">
            {error instanceof Error ? error.message : 'تعذر تحميل المستندات'}
          </p>
        )}

        {!isLoading && !isError && documents.length === 0 && (
          <p className="text-sm text-muted-foreground">لا توجد مستندات مرفوعة لهذا العقد بعد.</p>
        )}

        {documents.length > 0 && (
          <ul className="grid gap-2">
            {documents.map((doc) => {
              const resolvedUrl = resolvedUrls[doc.id];
              return (
                <li
                  key={doc.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3"
                >
                  {isImageFileName(doc.file_name) && resolvedUrl ? (
                    <img src={resolvedUrl} alt={doc.file_name} className="size-12 rounded-lg object-cover border border-border" />
                  ) : (
                    <div className="grid size-12 place-items-center rounded-lg border border-border bg-background">
                      <FileText className="size-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {resolvedUrl ? (
                      <a
                        href={resolvedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm font-bold text-primary hover:underline"
                      >
                        {doc.file_name}
                      </a>
                    ) : (
                      <span className="block truncate text-sm font-bold">{doc.file_name}</span>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">{formatFileSize(doc.file_size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(doc.id)}
                    className="grid size-8 place-items-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label={`حذف ${doc.file_name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="حذف المستند؟"
        description="لا يمكن التراجع عن هذا الإجراء بعد الحذف."
        isLoading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}

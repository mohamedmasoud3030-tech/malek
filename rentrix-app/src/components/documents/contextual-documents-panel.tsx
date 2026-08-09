import { Download, Eye, FileText, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

export type ContextualDocument = Readonly<{
  id: string;
  title: string;
  typeLabel?: string | null;
  reference?: string | null;
  parties?: string | null;
  importantDate?: string | null;
  expiresAt?: string | null;
  amount?: ReactNode;
  status?: ReactNode;
  fileName: string;
  fileSize?: string | null;
  mimeType?: string | null;
  relatedEntity?: string | null;
  metadata?: ReactNode;
  url?: string | null;
}>;

export type ContextualDocumentsPanelProps = Readonly<{
  entityLabel: string;
  documents: readonly ContextualDocument[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  emptyMessage?: string;
  onRetry?: () => void;
  onUpload?: (file: File) => void | Promise<void>;
  onReplace?: (document: ContextualDocument, file: File) => void | Promise<void>;
  onArchive?: (document: ContextualDocument) => void | Promise<void>;
  isUploading?: boolean;
  archivingId?: string | null;
  resolveUrl?: (document: ContextualDocument) => Promise<string | null>;
  canUpload?: boolean;
  canArchive?: boolean;
  accept?: string;
  className?: string;
}>;

function isImage(document: ContextualDocument) {
  return document.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(document.fileName);
}

export function ContextualDocumentsPanel({
  entityLabel,
  documents,
  isLoading = false,
  isError = false,
  errorMessage = 'تعذر تحميل المستندات.',
  emptyMessage = 'لا توجد مستندات مرتبطة بهذا الكيان بعد.',
  onRetry,
  onUpload,
  onReplace,
  onArchive,
  isUploading = false,
  archivingId = null,
  resolveUrl,
  canUpload = Boolean(onUpload),
  canArchive = Boolean(onArchive),
  accept,
  className,
}: ContextualDocumentsPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [replaceTarget, setReplaceTarget] = useState<ContextualDocument | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ContextualDocument | null>(null);
  const [preview, setPreview] = useState<{ document: ContextualDocument; url: string | null } | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const pickFile = (file: File | undefined, handler?: (file: File) => void | Promise<void>) => {
    if (!file || !handler) return;
    void handler(file);
  };

  const resolveDocumentUrl = async (document: ContextualDocument) => document.url ?? (resolveUrl ? await resolveUrl(document) : null);

  const previewDocument = async (document: ContextualDocument) => {
    setResolvingId(document.id);
    try {
      setPreview({ document, url: await resolveDocumentUrl(document) });
    } finally {
      setResolvingId(null);
    }
  };

  const downloadDocument = async (document: ContextualDocument) => {
    setResolvingId(document.id);
    try {
      const url = await resolveDocumentUrl(document);
      if (!url) return;
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = document.fileName;
      anchor.rel = 'noopener noreferrer';
      anchor.target = '_blank';
      anchor.click();
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <section className={cn('space-y-4', className)} data-contextual-documents>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black">مستندات {entityLabel}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">المستندات والبيانات الوصفية والإجراءات داخل سياق الكيان، بدون مغادرة الصفحة.</p>
        </div>
        {canUpload ? (
          <>
            <Button type="button" className="min-h-11" disabled={isUploading} onClick={() => inputRef.current?.click()}>
              <Upload className="me-2 size-4" aria-hidden="true" />{isUploading ? 'جارٍ الرفع...' : 'رفع مستند'}
            </Button>
            <input ref={inputRef} type="file" className="sr-only" accept={accept} aria-label={`رفع مستند ${entityLabel}`} onChange={(event) => { pickFile(event.target.files?.[0], onUpload); event.target.value = ''; }} />
          </>
        ) : null}
      </div>

      {isLoading ? <div role="status" className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">جارٍ تحميل المستندات...</div> : null}
      {isError ? <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><span>{errorMessage}</span>{onRetry ? <Button variant="secondary" onClick={onRetry}><RefreshCw className="me-2 size-4" aria-hidden="true" />إعادة المحاولة</Button> : null}</div> : null}
      {!isLoading && !isError && documents.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{emptyMessage}</div> : null}

      {documents.length > 0 ? (
        <ul className="grid gap-2" aria-label={`مستندات ${entityLabel}`}>
          {documents.map((document) => (
            <li key={document.id} className="grid gap-3 rounded-xl border border-border/70 bg-card p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
              <div className="grid size-11 place-items-center rounded-lg border border-border bg-muted/40 text-primary" aria-hidden="true"><FileText className="size-5" /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold">{document.title}</p>{document.status ? <StatusBadge tone="neutral">{document.status}</StatusBadge> : null}</div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{document.fileName}{document.typeLabel ? ` · ${document.typeLabel}` : ''}{document.fileSize ? ` · ${document.fileSize}` : ''}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {document.reference ? <span>المرجع: {document.reference}</span> : null}{document.parties ? <span>الأطراف: {document.parties}</span> : null}{document.importantDate ? <span>التاريخ: {document.importantDate}</span> : null}{document.expiresAt ? <span>الانتهاء: {document.expiresAt}</span> : null}{document.amount ? <span>القيمة: {document.amount}</span> : null}{document.relatedEntity ? <span>مرتبط بـ: {document.relatedEntity}</span> : null}
                </div>
                {document.metadata ? <div className="mt-2 text-xs text-muted-foreground">{document.metadata}</div> : null}
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button type="button" variant="secondary" className="min-h-11" disabled={resolvingId === document.id} onClick={() => void previewDocument(document)}><Eye className="me-1 size-4" aria-hidden="true" />عرض</Button>
                {document.url || resolveUrl ? <Button type="button" variant="ghost" className="min-h-11" disabled={resolvingId === document.id} onClick={() => void downloadDocument(document)}><Download className="me-1 size-4" aria-hidden="true" />تنزيل</Button> : null}
                {onReplace ? <Button type="button" variant="ghost" className="min-h-11" onClick={() => { setReplaceTarget(document); window.setTimeout(() => window.document.getElementById('contextual-document-replace')?.click(), 0); }}><RefreshCw className="me-1 size-4" aria-hidden="true" />استبدال</Button> : null}
                {canArchive ? <Button type="button" variant="ghost" className="min-h-11 text-destructive" onClick={() => setArchiveTarget(document)} disabled={archivingId === document.id}><Trash2 className="me-1 size-4" aria-hidden="true" />أرشفة</Button> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <EntityPreviewDialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null); }} title={preview?.document.title ?? `معاينة مستند ${entityLabel}`} description={preview?.document.reference ? `المرجع: ${preview.document.reference}` : undefined}>
        {preview ? <div className="space-y-4">{preview.url && isImage(preview.document) ? <img src={preview.url} alt={preview.document.title} className="max-h-[60dvh] w-full rounded-xl object-contain" /> : preview.url ? <iframe title={preview.document.title} src={preview.url} className="h-[60dvh] w-full rounded-xl border" /> : <p className="rounded-xl bg-muted p-5 text-sm">تم تحميل بيانات المستند. رابط المعاينة غير متاح حاليًا.</p>}</div> : null}
      </EntityPreviewDialog>

      <input id="contextual-document-replace" type="file" className="sr-only" accept={accept} aria-label="استبدال المستند" onChange={(event) => { if (replaceTarget) pickFile(event.target.files?.[0], (file) => onReplace?.(replaceTarget, file)); event.target.value = ''; setReplaceTarget(null); }} />
      <ConfirmDialog open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open && !archivingId) setArchiveTarget(null); }} title="أرشفة المستند؟" description={`سيتم إخفاء المستند "${archiveTarget?.title ?? ''}" من سياق ${entityLabel} مع الاحتفاظ بسجله.`} confirmLabel="تأكيد الأرشفة" isLoading={Boolean(archiveTarget && archivingId === archiveTarget.id)} onConfirm={() => { if (archiveTarget) void Promise.resolve(onArchive?.(archiveTarget)).then(() => setArchiveTarget(null)); }} />
    </section>
  );
}

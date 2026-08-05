import { useMemo, useState, useEffect } from 'react';
import { Eye, FileText, FolderKanban, Image as ImageIcon, Trash2, UploadCloud, Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { AsyncContentState } from '@/components/async-content-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { ActiveFilterBar, type ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  vaultCategoryLabels,
  listVaultDocuments,
  uploadVaultDocument,
  softDeleteVaultDocument,
  getVaultDocumentSignedUrl,
  VAULT_MAX_FILE_SIZE,
  type VaultCategory,
  type VaultDocumentItem,
} from '../documents-vault-service';
import { toast } from 'sonner';
import { ATTACHMENTS_ACCEPT } from '@/lib/attachments-contract';
import { formatLatinDate, formatLatinDateTime, formatLatinNumber } from '@/lib/formatters';

const vaultMaxFileSizeMb = VAULT_MAX_FILE_SIZE / 1024 / 1024;
const vaultAccept = ATTACHMENTS_ACCEPT;

function useSignedUrls(documents: VaultDocumentItem[]) {
  const [signedMap, setSignedMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchSigned() {
      if (documents.length === 0) {
        setSignedMap((current) => (Object.keys(current).length === 0 ? current : {}));
        setLoading(false);
        return;
      }
      setLoading(true);
      const entries = await Promise.all(
        documents.map(async (doc) => {
          try {
            const url = await getVaultDocumentSignedUrl(doc.storagePath, 3600);
            return [doc.id, url] as const;
          } catch {
            return [doc.id, ''] as const;
          }
        }),
      );
      if (!cancelled) {
        const map: Record<string, string> = {};
        for (const [id, url] of entries) {
          if (url) map[id] = url;
        }
        setSignedMap(map);
        setLoading(false);
      }
    }
    fetchSigned();
    return () => {
      cancelled = true;
    };
  }, [documents]);

  return { signedMap, loading };
}

// Stable empty-array identity so the signed-URL effect does not re-fire on
// every render while the query has no data yet.
const EMPTY_VAULT_DOCUMENTS: VaultDocumentItem[] = [];

export type DocumentsVaultWorkspaceMode = 'standalone' | 'embedded';

export type DocumentsVaultWorkspaceProps = Readonly<{
  /**
   * standalone: renders the full page shell (PageLayout + PageHeader) —
   * used by the legacy /documents-vault route when visited directly.
   * embedded: renders only the workspace body — used inside the operations
   * hub, which already supplies its own page shell and section header.
   */
  mode?: DocumentsVaultWorkspaceMode;
}>;

/**
 * Owns all documents-vault workspace UI: KPI summary, upload form, filters,
 * document grid, preview and delete dialogs. Shared verbatim between the
 * standalone /documents-vault route and the embedded operations hub tab so
 * business logic, queries, and mutations are never duplicated.
 */
export function DocumentsVaultWorkspace({ mode = 'standalone' }: DocumentsVaultWorkspaceProps) {
  const [selectedCategory, setSelectedCategory] = useState<VaultCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState<VaultCategory>('contracts');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewItem, setPreviewItem] = useState<VaultDocumentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VaultDocumentItem | null>(null);
  const [previewSignedUrl, setPreviewSignedUrl] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const documentsQuery = useQuery({
    queryKey: ['vault-documents', selectedCategory, searchQuery],
    queryFn: () => listVaultDocuments({ category: selectedCategory, search: searchQuery }),
  });

  const documents = documentsQuery.data ?? EMPTY_VAULT_DOCUMENTS;
  const { signedMap } = useSignedUrls(documents);

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!uploadFile) throw new Error('اختر ملفاً للرفع');
      if (!uploadTitle.trim()) throw new Error('عنوان المستند مطلوب');
      return uploadVaultDocument({ file: uploadFile, title: uploadTitle, category: uploadCategory });
    },
    onSuccess: () => {
      toast.success('تم رفع المستند بنجاح إلى التخزين الخاص');
      setUploadFile(null);
      setUploadTitle('');
      queryClient.invalidateQueries({ queryKey: ['vault-documents'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'فشل رفع المستند');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => softDeleteVaultDocument(id),
    onSuccess: () => {
      toast.success('تمت أرشفة المستند');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['vault-documents'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'فشل أرشفة المستند');
    },
  });

  const totalPdfs = useMemo(
    () => documents.filter((document) => document.mimeType?.includes('pdf') || document.fileName.toLowerCase().endsWith('.pdf')).length,
    [documents],
  );
  const totalImages = useMemo(
    () => documents.filter((document) => document.mimeType?.startsWith('image/')).length,
    [documents],
  );

  const activeFilters = useMemo<ActiveFilterItem[]>(() => {
    const items: ActiveFilterItem[] = [];
    if (selectedCategory !== 'all') {
      items.push({
        key: 'category',
        label: 'التصنيف',
        value: vaultCategoryLabels[selectedCategory],
        onRemove: () => setSelectedCategory('all'),
      });
    }
    if (searchQuery.trim()) {
      items.push({ key: 'search', label: 'بحث', value: searchQuery, onRemove: () => setSearchQuery('') });
    }
    return items;
  }, [selectedCategory, searchQuery]);

  const handleDownload = async (document: VaultDocumentItem) => {
    try {
      const url = await getVaultDocumentSignedUrl(document.storagePath, 3600);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = document.fileName;
      anchor.target = '_blank';
      anchor.click();
      toast.success('تم إنشاء رابط التنزيل');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تنزيل الملف');
    }
  };

  const handlePreview = async (document: VaultDocumentItem) => {
    try {
      const url = await getVaultDocumentSignedUrl(document.storagePath, 3600);
      setPreviewSignedUrl(url);
      setPreviewItem(document);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر معاينة الملف');
    }
  };

  const body = (
    <>
      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="إجمالي المستندات" value={formatLatinNumber(documents.length, 'ar')} icon={FolderKanban} accent="primary" sub="ملفات محفوظة في تخزين خاص" />
        <KpiCard label="ملفات PDF" value={formatLatinNumber(totalPdfs, 'ar')} icon={FileText} accent="sky" sub="مستندات" />
        <KpiCard label="صور مرفقة" value={formatLatinNumber(totalImages, 'ar')} icon={ImageIcon} accent="emerald" sub="معاينات متاحة" />
        <KpiCard
          label="التخزين الخاص"
          value={documents.reduce((sum, document) => sum + (document.fileSize || 0), 0) > 0
            ? `${(documents.reduce((sum, document) => sum + (document.fileSize || 0), 0) / 1024 / 1024).toFixed(2)} MB`
            : '—'}
          icon={UploadCloud}
          accent="amber"
          sub="مساحة آمنة"
        />
      </ResponsiveCardGrid>

      <Card className="border-border/60">
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-sm font-black">رفع مستند جديد</CardTitle>
          <CardDescription>
            الحد الأقصى {vaultMaxFileSizeMb}MB. الأنواع المدعومة: PDF، JPEG، PNG، WebP. المعاينة والتنزيل مؤمنة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>عنوان المستند *</Label>
              <Input
                value={uploadTitle}
                onChange={(event) => setUploadTitle(event.target.value)}
                placeholder="مثال: عقد إيجار موثق - شقة 102"
              />
            </div>
            <div className="grid gap-2">
              <Label>التصنيف *</Label>
              <Select value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value as VaultCategory)}>
                {Object.entries(vaultCategoryLabels).map(([category, label]) => (
                  <option key={category} value={category}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>اختر الملف *</Label>
            <Input
              type="file"
              accept={vaultAccept}
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            />
            {uploadFile ? (
              <p className="text-xs text-muted-foreground">
                الملف: {uploadFile.name} - {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            ) : null}
          </div>
          {uploadMutation.isError ? (
            <p className="text-sm text-destructive">{(uploadMutation.error as Error)?.message}</p>
          ) : null}
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={uploadMutation.isPending || !uploadFile || !uploadTitle.trim()}
            className="min-h-11"
          >
            {uploadMutation.isPending ? 'جارٍ الرفع...' : 'رفع المستند إلى التخزين الخاص'}
          </Button>
        </CardContent>
      </Card>

      <FilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="بحث بعنوان المستند أو اسمه..."
        searchAriaLabel="بحث في المستندات"
        filters={
          <Select
            aria-label="التصنيف"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value as VaultCategory)}
            className="w-full sm:w-48"
          >
            {Object.entries(vaultCategoryLabels).map(([category, label]) => (
              <option key={category} value={category}>
                {label}
              </option>
            ))}
          </Select>
        }
      />

      <ActiveFilterBar
        filters={activeFilters}
        onClearAll={() => {
          setSelectedCategory('all');
          setSearchQuery('');
        }}
      />

      <AsyncContentState
        status={documentsQuery.isLoading ? 'loading' : documentsQuery.isError ? 'error' : documents.length === 0 ? 'empty' : 'ready'}
        error={documentsQuery.error as Error}
        errorTitle="تعذر تحميل المستندات"
        errorAction={<Button onClick={() => documentsQuery.refetch()}>إعادة المحاولة</Button>}
        emptyTitle="لا توجد مستندات"
        emptyDescription="ابدأ برفع أول مستند إلى التخزين الخاص."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((document) => {
            const signedUrl = signedMap[document.id];
            return (
              <Card key={document.id} className="overflow-hidden border-border/60 transition hover:border-primary/40">
                <CardHeader className="border-b border-border/60 p-4">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-bold truncate">{document.title}</CardTitle>
                      <CardDescription className="text-xs mt-1 truncate">
                        {document.fileName} · {document.relatedEntityTitle || 'غير مرتبط'} · تخزين خاص
                      </CardDescription>
                    </div>
                    <StatusBadge tone={document.mimeType?.includes('pdf') ? 'info' : 'warning'}>
                      {document.category ? vaultCategoryLabels[document.category] : '—'}
                    </StatusBadge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="grid aspect-video w-full place-items-center overflow-hidden rounded-xl border bg-muted/30">
                    {document.mimeType?.startsWith('image/') ? (
                      signedUrl ? (
                        <img src={signedUrl} alt={document.title} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <ImageIcon className="size-8" />
                          <span className="text-xs">جارٍ تحميل المعاينة...</span>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <FileText className="size-8 text-primary" />
                        <span className="text-xs font-bold">{document.fileName}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatLatinDate(new Date(document.uploadedAt), 'ar-OM')}</span>
                    <span>{document.fileSize ? `${(document.fileSize / 1024).toFixed(1)} KB` : ''} · خاص</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="min-h-10 flex-1 gap-1" onClick={() => handlePreview(document)}>
                      <Eye className="size-3.5" />
                      معاينة
                    </Button>
                    <Button size="sm" variant="secondary" className="min-h-10 flex-1 gap-1" onClick={() => handleDownload(document)}>
                      <Download className="size-3.5" />
                      تنزيل
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-10 gap-1 text-destructive"
                      onClick={() => setDeleteTarget(document)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </AsyncContentState>

      <Dialog
        open={Boolean(previewItem)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewItem(null);
            setPreviewSignedUrl(null);
          }
        }}
      >
        {previewItem ? (
          <DialogContent dir="rtl" className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="truncate">{previewItem.title}</DialogTitle>
              <DialogDescription>
                التصنيف: {vaultCategoryLabels[previewItem.category]} · تخزين خاص · {formatLatinDateTime(new Date(previewItem.uploadedAt), 'ar-OM')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid aspect-video w-full place-items-center overflow-hidden rounded-2xl border bg-muted/20">
              {previewItem.mimeType?.startsWith('image/') ? (
                previewSignedUrl ? (
                  <img src={previewSignedUrl} alt={previewItem.title} className="max-h-80 object-contain" />
                ) : (
                  <p className="text-sm text-muted-foreground">جارٍ تحميل المعاينة...</p>
                )
              ) : (
                <div className="space-y-3 p-6 text-center">
                  <FileText className="mx-auto size-16 text-primary" />
                  <p className="text-sm font-bold">{previewItem.fileName}</p>
                  <p className="text-xs text-muted-foreground">يتم تنزيل الملف عبر رابط موقّع مؤقت لمدة 60 دقيقة.</p>
                  <Button onClick={() => handleDownload(previewItem)}>تنزيل الملف</Button>
                </div>
              )}
            </div>
            <p className="hidden text-[11px] text-muted-foreground">مسار التخزين: {previewItem.storagePath}</p>
          </DialogContent>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`أرشفة المستند "${deleteTarget?.title ?? ''}"؟`}
        description={`سيتم أرشفة المستند "${deleteTarget?.title ?? ''}" وإخفاؤه من القوائم النشطة. المرجع: ${deleteTarget?.id ? deleteTarget.id.slice(0, 8) : ''} — الملف يبقى في التخزين الخاص للتدقيق ويمكن استرجاعه من الأرشيف.`}
        confirmLabel="تأكيد الأرشفة"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </>
  );

  if (mode === 'embedded') {
    return <div className="space-y-5">{body}</div>;
  }

  return (
    <PageLayout dir="rtl" lang="ar" size="wide">
      <PageHeader
        title="خزينة المستندات والمرفقات"
        description="أرشيف خاص؛ تحفظ مسارات التخزين فقط، وتتم المعاينة والتنزيل عبر روابط موقعة مؤقتة لمدة 60 دقيقة."
      />
      {body}
    </PageLayout>
  );
}

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
} from './documents-vault-service';
import { toast } from 'sonner';

const vaultMaxFileSizeMb = VAULT_MAX_FILE_SIZE / 1024 / 1024;
const vaultAccept = 'application/pdf,image/jpeg,image/png,image/webp';

function useSignedUrls(documents: VaultDocumentItem[]) {
  const [signedMap, setSignedMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchSigned() {
      if (documents.length === 0) {
        setSignedMap({});
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

export function DocumentsVaultPage() {
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

  const documents = documentsQuery.data ?? [];
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
      toast.success('تم حذف المستند');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['vault-documents'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'فشل حذف المستند');
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
      toast.success('تم إنشاء رابط تنزيل مؤقت (60 دقيقة)');
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

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="خزينة المستندات والمرفقات"
        description="أرشيف خاص؛ تحفظ مسارات التخزين فقط، وتتم المعاينة والتنزيل عبر روابط موقعة مؤقتة لمدة 60 دقيقة."
      />

      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="إجمالي المستندات" value={documents.length.toLocaleString('ar')} icon={FolderKanban} accent="primary" sub="ملفات محفوظة في تخزين خاص" />
        <KpiCard label="ملفات PDF" value={totalPdfs.toLocaleString('ar')} icon={FileText} accent="sky" sub="مستندات" />
        <KpiCard label="صور مرفقة" value={totalImages.toLocaleString('ar')} icon={ImageIcon} accent="emerald" sub="معاينات بروابط موقعة" />
        <KpiCard
          label="التخزين الخاص"
          value={documents.reduce((sum, document) => sum + (document.fileSize || 0), 0) > 0
            ? `${(documents.reduce((sum, document) => sum + (document.fileSize || 0), 0) / 1024 / 1024).toFixed(2)} MB`
            : '—'}
          icon={UploadCloud}
          accent="amber"
          sub="Bucket غير عام"
        />
      </ResponsiveCardGrid>

      <Card className="border-border/60">
        <CardHeader className="bg-muted/20 border-b">
          <CardTitle className="text-sm font-black">رفع مستند جديد</CardTitle>
          <CardDescription>
            الحد الأقصى {vaultMaxFileSizeMb}MB. الأنواع المدعومة: PDF، JPEG، PNG، WebP. المعاينة والتنزيل بروابط موقعة مؤقتة فقط.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
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
              <Card key={document.id} className="border-border/60 overflow-hidden hover:border-primary/40 transition">
                <CardHeader className="bg-muted/15 border-b p-4">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-bold truncate">{document.title}</CardTitle>
                      <CardDescription className="text-xs mt-1 truncate">
                        {document.fileName} · {document.relatedEntityTitle || 'غير مرتبط'} · تخزين خاص
                      </CardDescription>
                    </div>
                    <StatusBadge tone={document.mimeType?.includes('pdf') ? 'blue' : 'gold'}>
                      {document.category ? vaultCategoryLabels[document.category] : '—'}
                    </StatusBadge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="aspect-video w-full rounded-xl border bg-muted/30 grid place-items-center overflow-hidden">
                    {document.mimeType?.startsWith('image/') ? (
                      signedUrl ? (
                        <img src={signedUrl} alt={document.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <ImageIcon className="size-8 animate-pulse" />
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
                    <span>{new Date(document.uploadedAt).toLocaleDateString('ar-OM')}</span>
                    <span>{document.fileSize ? `${(document.fileSize / 1024).toFixed(1)} KB` : ''} · خاص</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => handlePreview(document)}>
                      <Eye className="size-3.5" />
                      معاينة
                    </Button>
                    <Button size="sm" variant="secondary" className="flex-1 gap-1" onClick={() => handleDownload(document)}>
                      <Download className="size-3.5" />
                      تنزيل
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-destructive"
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

      {previewItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-background border p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between border-b pb-3">
              <h3 className="font-black text-base truncate">{previewItem.title}</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPreviewItem(null);
                  setPreviewSignedUrl(null);
                }}
              >
                إغلاق
              </Button>
            </div>
            <div className="aspect-video w-full rounded-2xl border bg-muted/20 grid place-items-center overflow-hidden">
              {previewItem.mimeType?.startsWith('image/') ? (
                previewSignedUrl ? (
                  <img src={previewSignedUrl} alt={previewItem.title} className="max-h-80 object-contain" />
                ) : (
                  <p className="text-sm text-muted-foreground">جارٍ إنشاء رابط معاينة مؤقت...</p>
                )
              ) : (
                <div className="text-center p-6 space-y-3">
                  <FileText className="size-16 text-primary mx-auto" />
                  <p className="font-bold text-sm">{previewItem.fileName}</p>
                  <p className="text-xs text-muted-foreground">يتم تنزيل الملف عبر رابط موقع مؤقت لمدة 60 دقيقة.</p>
                  <Button onClick={() => handleDownload(previewItem)}>تنزيل الملف</Button>
                </div>
              )}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>التصنيف: {vaultCategoryLabels[previewItem.category]} · تخزين خاص</span>
              <span>{new Date(previewItem.uploadedAt).toLocaleString('ar-OM')}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">مسار التخزين: {previewItem.storagePath}</p>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`حذف المستند "${deleteTarget?.title ?? ''}"؟`}
        description="سيتم أرشفة المستند وإخفاؤه من القوائم. الملف يبقى في التخزين الخاص للتدقيق."
        confirmLabel="حذف"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </PageLayout>
  );
}

export default DocumentsVaultPage;

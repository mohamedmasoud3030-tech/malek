import { useMemo, useState } from 'react';
import { Eye, FileText, FolderKanban, Image as ImageIcon, Paperclip, Search, Trash2, UploadCloud, Download } from 'lucide-react';
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
import { vaultCategoryLabels, listVaultDocuments, uploadVaultDocument, softDeleteVaultDocument, getVaultDocumentDownloadUrl, type VaultCategory, type VaultDocumentItem } from './documents-vault-service';
import { toast } from 'sonner';

export function DocumentsVaultPage() {
  const [selectedCategory, setSelectedCategory] = useState<VaultCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState<VaultCategory>('contracts');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewItem, setPreviewItem] = useState<VaultDocumentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VaultDocumentItem | null>(null);

  const queryClient = useQueryClient();

  const documentsQuery = useQuery({
    queryKey: ['vault-documents', selectedCategory, searchQuery],
    queryFn: () => listVaultDocuments({ category: selectedCategory, search: searchQuery }),
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!uploadFile) throw new Error('اختر ملفاً للرفع');
      if (!uploadTitle.trim()) throw new Error('عنوان المستند مطلوب');
      return uploadVaultDocument({ file: uploadFile, title: uploadTitle, category: uploadCategory });
    },
    onSuccess: () => {
      toast.success('تم رفع المستند بنجاح');
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

  const documents = documentsQuery.data ?? [];

  const totalPdfs = useMemo(() => documents.filter((d) => d.mimeType?.includes('pdf') || d.fileName.toLowerCase().endsWith('.pdf')).length, [documents]);
  const totalImages = useMemo(() => documents.filter((d) => d.mimeType?.startsWith('image/')).length, [documents]);

  const activeFilters = useMemo<ActiveFilterItem[]>(() => {
    const items: ActiveFilterItem[] = [];
    if (selectedCategory !== 'all') {
      items.push({ key: 'category', label: 'التصنيف', value: vaultCategoryLabels[selectedCategory], onRemove: () => setSelectedCategory('all') });
    }
    if (searchQuery.trim()) {
      items.push({ key: 'search', label: 'بحث', value: searchQuery, onRemove: () => setSearchQuery('') });
    }
    return items;
  }, [selectedCategory, searchQuery]);

  const handleDownload = async (doc: VaultDocumentItem) => {
    try {
      const url = await getVaultDocumentDownloadUrl(doc.storagePath);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
      a.target = '_blank';
      a.click();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر تنزيل الملف');
    }
  };

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader title="خزينة المستندات والمرفقات" description="أرشيف حقيقي للمستندات مع تخزين آمن، ربط بالكيانات، وتحقق من نوع وحجم الملف." />

      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="إجمالي المستندات" value={documents.length.toLocaleString('ar')} icon={FolderKanban} accent="primary" sub="ملفات محفوظة" />
        <KpiCard label="ملفات PDF" value={totalPdfs.toLocaleString('ar')} icon={FileText} accent="sky" sub="مستندات" />
        <KpiCard label="صور مرفقة" value={totalImages.toLocaleString('ar')} icon={ImageIcon} accent="emerald" sub="معاينات" />
        <KpiCard label="التخزين" value={documents.reduce((acc, d) => acc + (d.fileSize || 0), 0) > 0 ? `${(documents.reduce((acc, d) => acc + (d.fileSize || 0), 0) / 1024 / 1024).toFixed(2)} MB` : '—'} icon={UploadCloud} accent="amber" sub="إجمالي" />
      </ResponsiveCardGrid>

      <Card className="border-border/60">
        <CardHeader className="bg-muted/20 border-b">
          <CardTitle className="text-sm font-black">رفع مستند جديد</CardTitle>
          <CardDescription>الحد الأقصى 10MB. الأنواع المدعومة: PDF، صور، Word، Excel. سيتم ربط الملف بالعنوان والتصنيف.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>عنوان المستند *</Label>
              <Input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="مثال: عقد إيجار موثق - شقة 102" />
            </div>
            <div className="grid gap-2">
              <Label>التصنيف *</Label>
              <Select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value as VaultCategory)}>
                {Object.entries(vaultCategoryLabels).map(([cat, label]) => (
                  <option key={cat} value={cat}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>اختر الملف *</Label>
            <Input type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
            {uploadFile && <p className="text-xs text-muted-foreground">الملف: {uploadFile.name} - {(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>}
          </div>
          {uploadMutation.isError && <p className="text-sm text-destructive">{(uploadMutation.error as Error)?.message}</p>}
          <Button onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending || !uploadFile || !uploadTitle.trim()} className="min-h-11">
            {uploadMutation.isPending ? 'جارٍ الرفع...' : 'رفع المستند'}
          </Button>
        </CardContent>
      </Card>

      <FilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="بحث بعنوان المستند أو اسمه..."
        searchAriaLabel="بحث في المستندات"
        filters={
          <Select aria-label="التصنيف" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value as VaultCategory)} className="w-full sm:w-48">
            {Object.entries(vaultCategoryLabels).map(([cat, label]) => (
              <option key={cat} value={cat}>
                {label}
              </option>
            ))}
          </Select>
        }
      />

      <ActiveFilterBar filters={activeFilters} onClearAll={() => { setSelectedCategory('all'); setSearchQuery(''); }} />

      <AsyncContentState
        status={documentsQuery.isLoading ? 'loading' : documentsQuery.isError ? 'error' : documents.length === 0 ? 'empty' : 'ready'}
        error={documentsQuery.error as Error}
        errorTitle="تعذر تحميل المستندات"
        errorAction={<Button onClick={() => documentsQuery.refetch()}>إعادة المحاولة</Button>}
        emptyTitle="لا توجد مستندات"
        emptyDescription="ابدأ برفع أول مستند (عقد، هوية، إيصال) باستخدام النموذج أعلاه."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="border-border/60 overflow-hidden hover:border-primary/40 transition">
              <CardHeader className="bg-muted/15 border-b p-4">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-bold truncate">{doc.title}</CardTitle>
                    <CardDescription className="text-xs mt-1 truncate">{doc.fileName} · {doc.relatedEntityTitle || 'غير مرتبط'}</CardDescription>
                  </div>
                  <StatusBadge tone={doc.mimeType?.includes('pdf') ? 'blue' : 'gold'}>{doc.category ? vaultCategoryLabels[doc.category] : '—'}</StatusBadge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="aspect-video w-full rounded-xl border bg-muted/30 grid place-items-center overflow-hidden">
                  {doc.mimeType?.startsWith('image/') ? (
                    <img src={doc.fileUrl} alt={doc.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="size-8 text-primary" />
                      <span className="text-xs font-bold">{doc.fileName}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{new Date(doc.uploadedAt).toLocaleDateString('ar-OM')}</span>
                  <span>{doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : ''}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => setPreviewItem(doc)}>
                    <Eye className="size-3.5" />
                    معاينة
                  </Button>
                  <Button size="sm" variant="secondary" className="flex-1 gap-1" onClick={() => handleDownload(doc)}>
                    <Download className="size-3.5" />
                    تنزيل
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => setDeleteTarget(doc)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </AsyncContentState>

      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-background border p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between border-b pb-3">
              <h3 className="font-black text-base truncate">{previewItem.title}</h3>
              <Button size="sm" variant="ghost" onClick={() => setPreviewItem(null)}>
                إغلاق
              </Button>
            </div>
            <div className="aspect-video w-full rounded-2xl border bg-muted/20 grid place-items-center overflow-hidden">
              {previewItem.mimeType?.startsWith('image/') ? (
                <img src={previewItem.fileUrl} alt={previewItem.title} className="max-h-80 object-contain" />
              ) : (
                <div className="text-center p-6 space-y-3">
                  <FileText className="size-16 text-primary mx-auto" />
                  <p className="font-bold text-sm">{previewItem.fileName}</p>
                  <Button onClick={() => handleDownload(previewItem)}>تنزيل / فتح</Button>
                </div>
              )}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>التصنيف: {vaultCategoryLabels[previewItem.category]}</span>
              <span>{new Date(previewItem.uploadedAt).toLocaleString('ar-OM')}</span>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`حذف المستند "${deleteTarget?.title ?? ''}"؟`}
        description="سيتم أرشفة المستند وإخفاؤه من القوائم. يمكن استرجاعه من سجل التدقيق إذا لزم."
        confirmLabel="حذف"
        isLoading={deleteMutation.isPending}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
      />

      {documents.length === 0 ? null : (
        <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground text-sm">
          <Paperclip className="size-6 mx-auto mb-2 opacity-50" />
          <p>لا توجد مستندات إضافية ضمن الفلاتر.</p>
        </div>
      )}
    </PageLayout>
  );
}

export default DocumentsVaultPage;

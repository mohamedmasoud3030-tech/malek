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
import { ContextualDocumentsPanel } from '@/components/documents/contextual-documents-panel';
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
      toast.error(error instanceof Error ? error.message : 'تعذر رفع المستند');
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
      toast.error(error instanceof Error ? error.message : 'تعذر أرشفة المستند');
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
        <ContextualDocumentsPanel
          entityLabel="السياق الحالي"
          documents={documents.map((document) => ({
            id: document.id,
            title: document.title,
            typeLabel: document.category ? vaultCategoryLabels[document.category] : 'مستند',
            reference: document.relatedEntityTitle,
            fileName: document.fileName,
            fileSize: document.fileSize ? `${(document.fileSize / 1024).toFixed(1)} KB` : null,
            mimeType: document.mimeType,
            url: signedMap[document.id] ?? null,
            relatedEntity: document.relatedEntityTitle,
            importantDate: formatLatinDate(new Date(document.uploadedAt), 'ar-OM'),
            metadata: <span>تخزين خاص · رابط مؤقت عند المعاينة</span>,
          }))}
          isLoading={documentsQuery.isLoading}
          isError={documentsQuery.isError}
          errorMessage="تعذر تحميل المستندات"
          onRetry={() => void documentsQuery.refetch()}
          onArchive={(document) => deleteMutation.mutateAsync(document.id)}
          archivingId={deleteMutation.isPending ? deleteMutation.variables ?? null : null}
          canUpload={false}
          accept={vaultAccept}
        />
      </AsyncContentState>

    </>
  );

  if (mode === 'embedded') {
    return <div className="space-y-5">{body}</div>;
  }

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
      <PageHeader
        title="خزينة المستندات والمرفقات"
        description="أرشيف خاص؛ تحفظ مسارات التخزين فقط، وتتم المعاينة والتنزيل عبر روابط موقعة مؤقتة لمدة 60 دقيقة."
      />
      {body}
    </PageLayout>
  );
}

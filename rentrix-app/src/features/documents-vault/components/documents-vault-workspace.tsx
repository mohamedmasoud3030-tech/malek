import { useMemo, useState, useEffect } from 'react';
import { Eye, FileText, FolderKanban, Image as ImageIcon, Trash2, UploadCloud, Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { RegisterMetricStrip } from '@/components/layout/register-summary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FilePickerField } from '@/components/ui/file-picker-field';
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
  const [uploadOpen, setUploadOpen] = useState(false);

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
      setUploadOpen(false);
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
      <div className="flex justify-end">
        <Button className="min-h-11" onClick={() => setUploadOpen(true)}>
          <UploadCloud className="me-2 size-4" aria-hidden="true" />
          رفع مستند
        </Button>
      </div>

      <RegisterMetricStrip
        aria-label="ملخص المستندات"
        items={[
          { id: 'total', label: 'المستندات', value: formatLatinNumber(documents.length, 'ar'), icon: FolderKanban, hideWhenEmpty: true },
          { id: 'pdf', label: 'PDF', value: formatLatinNumber(totalPdfs, 'ar'), icon: FileText, hideWhenEmpty: true },
          { id: 'images', label: 'صور', value: formatLatinNumber(totalImages, 'ar'), icon: ImageIcon, hideWhenEmpty: true },
        ]}
      />

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
        emptyAction={<Button onClick={() => setUploadOpen(true)}>رفع مستند</Button>}
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

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>رفع مستند</DialogTitle>
            <DialogDescription>
              العنوان والتصنيف والملف فقط. الحد الأقصى {vaultMaxFileSizeMb}MB — PDF أو JPEG أو PNG أو WebP.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="vault-upload-title">العنوان *</Label>
              <Input
                id="vault-upload-title"
                value={uploadTitle}
                onChange={(event) => setUploadTitle(event.target.value)}
                placeholder="مثال: عقد إيجار موثق"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vault-upload-category">التصنيف *</Label>
              <Select
                aria-label="التصنيف"
                value={uploadCategory}
                onChange={(event) => setUploadCategory(event.target.value as VaultCategory)}
              >
                {Object.entries(vaultCategoryLabels).map(([category, label]) => (
                  <option key={category} value={category}>{label}</option>
                ))}
              </Select>
            </div>
            <FilePickerField
              accept={vaultAccept}
              file={uploadFile}
              onChange={setUploadFile}
              label="الملف"
              required
              hint={`الحد الأقصى ${vaultMaxFileSizeMb}MB`}
            />
            {uploadMutation.isError ? (
              <p className="text-sm text-destructive">{(uploadMutation.error as Error)?.message}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setUploadOpen(false)}>إلغاء</Button>
              <Button
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending || !uploadFile || !uploadTitle.trim()}
              >
                {uploadMutation.isPending ? 'جارٍ الرفع...' : 'رفع'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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

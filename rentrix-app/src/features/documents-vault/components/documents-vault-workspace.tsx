import { useEffect, useMemo, useState } from 'react';
import { FileText, FolderKanban, Image as ImageIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { RegisterMetricStrip } from '@/components/layout/register-summary';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { AsyncContentState } from '@/components/async-content-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { ActiveFilterBar, type ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { ContextualDocumentsPanel } from '@/components/documents/contextual-documents-panel';
import {
  vaultCategoryLabels,
  listVaultDocuments,
  getVaultDocumentSignedUrl,
  type VaultCategory,
  type VaultDocumentItem,
} from '../documents-vault-service';
import { formatLatinDate, formatLatinNumber } from '@/lib/formatters';

function useSignedUrls(documents: VaultDocumentItem[]) {
  const [signedMap, setSignedMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function fetchSigned() {
      if (documents.length === 0) {
        setSignedMap((current) => (Object.keys(current).length === 0 ? current : {}));
        return;
      }
      const entries = await Promise.all(
        documents.map(async (document) => {
          try {
            const url = await getVaultDocumentSignedUrl(document.storagePath, 3600);
            return [document.id, url] as const;
          } catch {
            return [document.id, ''] as const;
          }
        }),
      );
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [id, url] of entries) {
        if (url) next[id] = url;
      }
      setSignedMap(next);
    }
    void fetchSigned();
    return () => {
      cancelled = true;
    };
  }, [documents]);

  return signedMap;
}

const EMPTY_VAULT_DOCUMENTS: VaultDocumentItem[] = [];

export type DocumentsVaultWorkspaceMode = 'standalone' | 'embedded';

export type DocumentsVaultWorkspaceProps = Readonly<{
  mode?: DocumentsVaultWorkspaceMode;
}>;

/**
 * Cross-entity document index only. Upload/replace/archive operations belong to
 * the entity that owns the document so a file can never be created without a
 * canonical property/unit/contract/maintenance/owner context.
 */
export function DocumentsVaultWorkspace({ mode = 'standalone' }: DocumentsVaultWorkspaceProps) {
  const [selectedCategory, setSelectedCategory] = useState<VaultCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const documentsQuery = useQuery({
    queryKey: ['vault-documents', selectedCategory, searchQuery],
    queryFn: () => listVaultDocuments({ category: selectedCategory, search: searchQuery }),
  });

  const documents = documentsQuery.data ?? EMPTY_VAULT_DOCUMENTS;
  const signedMap = useSignedUrls(documents);

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

  const body = (
    <>
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
        searchPlaceholder="ابحث بالعنوان أو اسم الملف أو الكيان المرتبط..."
        searchAriaLabel="بحث في فهرس المستندات"
        filters={
          <Select
            aria-label="التصنيف"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value as VaultCategory)}
            className="min-h-11 w-full sm:w-48"
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
        emptyDescription={searchQuery.trim() || selectedCategory !== 'all'
          ? 'لا توجد مستندات تطابق البحث أو التصنيف الحالي.'
          : 'ستظهر هنا المستندات التي تُضاف من ملفات العقارات والوحدات والعقود والصيانة والملاك.'}
      >
        <ContextualDocumentsPanel
          entityLabel="فهرس المستندات"
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
          canUpload={false}
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
        title="فهرس المستندات"
        description="بحث ومعاينة عبر كل الملفات المرتبطة. الإضافة والتعديل يتمان من ملف الكيان نفسه حتى يظل كل مستند مرتبطًا بسياقه الصحيح."
      />
      {body}
    </PageLayout>
  );
}

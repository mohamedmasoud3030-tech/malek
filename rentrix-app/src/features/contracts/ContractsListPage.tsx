import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { ContractFilters } from './components/ContractFilters';
import { ContractKpiGrid } from './components/ContractKpiGrid';
import { ContractResults } from './components/ContractResults';
import { ContractFormModal } from './contract-form-modal';
import { ListControlSurface } from '@/components/layout/list-controls';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { buildContractsCsvBlob, buildContractsCsvFilename } from './contractListExport';
import { useCompanySettingsContract } from '../settings/useCompanySettings';
import { useContractFilters } from './hooks/useContractFilters';
import { useContracts, useSoftDeleteContract } from './useContracts';
import { toast } from 'sonner';
import type { ContractListItem, ContractStatusFilter } from './services/contractService';

function exportContractsCsv(contracts: ContractListItem[]) {
  try {
    const url = URL.createObjectURL(buildContractsCsvBlob(contracts));
    const link = document.createElement('a');
    link.href = url;
    link.download = buildContractsCsvFilename(new Date());
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (error) {
    console.error('Failed to export contracts CSV:', error);
    toast.error('تعذر تصدير الملف');
  }
}

export type ContractsListPageProps = Readonly<{
  embedded?: boolean;
}>;

export function ContractsListPage({ embedded = false }: ContractsListPageProps) {
  const [status, setStatus] = useState<ContractStatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editContractId, setEditContractId] = useState<string | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // When search or expiringOnly is active, fetch all rows so client-side
  // filtering works across the full dataset — not just the current page.
  const hasClientFilter = Boolean(searchTerm.trim()) || expiringOnly;
  const params = useMemo(
    () => ({ status, page: hasClientFilter ? 1 : page, pageSize: hasClientFilter ? 5000 : pageSize }),
    [status, page, hasClientFilter],
  );
  const contractsQuery = useContracts(params);
  const companySettings = useCompanySettingsContract();
  const deleteMutation = useSoftDeleteContract();
  const contracts = contractsQuery.data?.rows ?? [];
  const totalPages = hasClientFilter ? 1 : Math.max(1, Math.ceil((contractsQuery.data?.count ?? 0) / pageSize));

  const { filteredContracts, hasActiveFilters } = useContractFilters({
    contracts,
    expiringOnly,
    searchTerm,
    status,
  });

  // Show error toast once per error occurrence, not on every retry
  const errorToastShownRef = useRef(false);
  useEffect(() => {
    if (contractsQuery.isError && !errorToastShownRef.current) {
      errorToastShownRef.current = true;
      toast.error('تعذر تحميل العقود');
    }
    if (!contractsQuery.isError) {
      errorToastShownRef.current = false;
    }
  }, [contractsQuery.isError]);

  const openCreate = () => { setEditContractId(undefined); setModalOpen(true); };
  const openEdit = (id: string) => { setEditContractId(id); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditContractId(undefined); };
  const resetFilters = () => { setStatus('all'); setSearchTerm(''); setExpiringOnly(false); setPage(1); };
  const confirmDelete = async () => {
    if (!deleteId || deleteMutation.isPending) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // keep dialog open on failure, preserve context
    }
  };

  return (
    <>
      <EmbeddableWorkspace
        embedded={embedded}
        dir="rtl"
        size="wide"
        visualVariant="malek-pro"
        title="العقود"
        description="إدارة دورة العقد من مسودة إلى نشط ثم منتهي أو ملغي."
        count={hasClientFilter ? filteredContracts.length : (contractsQuery.data?.count ?? filteredContracts.length)}
        primaryAction={
          <Button onClick={openCreate}>
            <Plus className="me-2 size-4" />إنشاء عقد
          </Button>
        }
        secondaryActions={
          <Button variant="secondary" onClick={() => exportContractsCsv(filteredContracts)} disabled={!filteredContracts.length} aria-label="تصدير العقود كملف CSV">
            <Download className="me-2 size-4" />تصدير CSV
          </Button>
        }
      >

        <ContractKpiGrid companySettings={companySettings} contracts={contracts} filteredContracts={filteredContracts} totalCount={contractsQuery.data?.count ?? contracts.length} />

        <ListControlSurface>
          <ContractFilters
            expiringOnly={expiringOnly}
            hasActiveFilters={hasActiveFilters}
            resetFilters={resetFilters}
            searchTerm={searchTerm}
            setExpiringOnly={(updater) => { setExpiringOnly(updater); setPage(1); }}
            setSearchTerm={(value) => { setSearchTerm(value); setPage(1); }}
            setStatus={(value) => { setStatus(value); setPage(1); }}
            status={status}
          />
        </ListControlSurface>

        <ContractResults
          companySettings={companySettings}
          contracts={filteredContracts}
          expandedId={expandedId}
          emptyDescription={hasActiveFilters ? 'جرّب تغيير عبارة البحث أو فلتر الحالة لعرض عقود أخرى.' : 'ابدأ بإنشاء أول عقد وربطه بالعقار والوحدة والمستأجر.'}
          emptyTitle={hasActiveFilters ? 'لا توجد عقود مطابقة' : 'لا توجد عقود'}
          error={contractsQuery.error}
          isError={contractsQuery.isError}
          isLoading={contractsQuery.isLoading}
          onCreate={hasActiveFilters ? undefined : openCreate}
          onDelete={setDeleteId}
          onEdit={openEdit}
          onRetry={() => contractsQuery.refetch()}
          pagination={!hasClientFilter && totalPages > 1 ? {
            page,
            pageSize,
            total: contractsQuery.data?.count ?? 0,
            onPageChange: setPage,
          } : undefined}
          setExpandedId={setExpandedId}
        />
      </EmbeddableWorkspace>

      <ContractFormModal open={modalOpen} onClose={closeModal} contractId={editContractId} />

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="أرشفة العقد؟"
        description="سيتم أرشفة العقد وإخفاؤه من القائمة النشطة مع الاحتفاظ بسجله المحاسبي وتاريخه بالكامل، ولا يتم حذفه بشكل نهائي. المرجع التجاري سيبقى محفوظاً للتدقيق."
        confirmLabel="تأكيد الأرشفة"
        isLoading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}


export function ContractsWorkspace({ embedded = true }: ContractsListPageProps) {
  return <ContractsListPage embedded={embedded} />;
}

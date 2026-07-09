import { useEffect, useMemo, useRef, useState } from 'react';
import { ContractFilters } from './components/ContractFilters';
import { ContractKpiGrid } from './components/ContractKpiGrid';
import { ContractListHeader } from './components/ContractListHeader';
import { ContractListState } from './components/ContractListState';
import { ContractResults } from './components/ContractResults';
import { ContractFormModal } from './contract-form-modal';
import { PageLayout } from '@/components/layout/page-layout';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
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

export function ContractsListPage() {
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

  const { filteredContracts, hasActiveFilters, hasContracts } = useContractFilters({
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
  const confirmDelete = () => {
    if (deleteId) deleteMutation.mutate(deleteId, { onSettled: () => setDeleteId(null) });
  };

  return (
    <>
      <PageLayout dir="rtl" size="wide">
        <ContractListHeader
          canExport={Boolean(filteredContracts.length)}
          onCreate={openCreate}
          onExport={() => exportContractsCsv(filteredContracts)}
        />

        <ContractKpiGrid companySettings={companySettings} contracts={contracts} filteredContracts={filteredContracts} />

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

        <ContractListState
          error={contractsQuery.error}
          hasContracts={hasContracts}
          isError={contractsQuery.isError}
          isLoading={contractsQuery.isLoading}
          onCreate={openCreate}
          onRetry={() => contractsQuery.refetch()}
          resultsCount={filteredContracts.length}
        />

        <ContractResults
          companySettings={companySettings}
          contracts={filteredContracts}
          expandedId={expandedId}
          isError={contractsQuery.isError}
          isLoading={contractsQuery.isLoading}
          onDelete={setDeleteId}
          onEdit={openEdit}
          setExpandedId={setExpandedId}
        />

        {!hasClientFilter && totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>الصفحة {page} من {totalPages}</span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                السابق
              </Button>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                التالي
              </Button>
            </div>
          </div>
        )}
      </PageLayout>

      <ContractFormModal open={modalOpen} onClose={closeModal} contractId={editContractId} />

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="حذف العقد؟"
        description="سيتم حذف العقد بشكل نهائي ولا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف"
        isLoading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}

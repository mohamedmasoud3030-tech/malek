import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Download, FileSpreadsheet, Plus } from 'lucide-react';
import { ContractFilters } from './components/ContractFilters';
import { ContractKpiGrid } from './components/ContractKpiGrid';
import { ContractResults } from './components/ContractResults';
import { ContractFormModal } from './contract-form-modal';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  buildContractsCsvBlob,
  buildContractsCsvFilename,
  buildContractsXlsxBlob,
  buildContractsXlsxFilename,
} from './contractListExport';
import { useCompanySettingsContract } from '../settings/useCompanySettings';
import { useContractFilters, type LeaseModeFilter } from './hooks/useContractFilters';
import { useContracts, useSoftDeleteContract } from './useContracts';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { ContractListItem, ContractStatusFilter } from './services/contractService';

function downloadContractsFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function exportContractsCsv(contracts: ContractListItem[]) {
  try {
    downloadContractsFile(buildContractsCsvBlob(contracts), buildContractsCsvFilename(new Date()));
  } catch (error) {
    console.error('Failed to export contracts CSV:', error);
    toast.error('تعذر تصدير ملف CSV');
  }
}

function exportContractsXlsx(contracts: ContractListItem[]) {
  try {
    downloadContractsFile(buildContractsXlsxBlob(contracts), buildContractsXlsxFilename(new Date()));
    toast.success('تم تجهيز ملف Excel');
  } catch (error) {
    console.error('Failed to export contracts XLSX:', error);
    toast.error('تعذر تصدير ملف Excel');
  }
}

export type ContractsListPageProps = Readonly<{ embedded?: boolean }>;

export function ContractsListPage({ embedded = false }: ContractsListPageProps) {
  const navigate = useNavigate();
  const { canAccess } = useAuth();
  const canCreate = canAccess('contracts.create');
  const canEdit = canAccess('contracts.edit');
  const canCancel = canAccess('contracts.cancel');
  const canExport = canAccess('contracts.view');
  const [status, setStatus] = useState<ContractStatusFilter>('all');
  const [leaseMode, setLeaseMode] = useState<LeaseModeFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editContractId, setEditContractId] = useState<string | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const hasClientFilter = Boolean(searchTerm.trim()) || expiringOnly || leaseMode !== 'all';
  const params = useMemo(
    () => ({ status, page: hasClientFilter ? 1 : page, pageSize: hasClientFilter ? 5000 : pageSize }),
    [status, page, hasClientFilter],
  );
  const contractsQuery = useContracts(params);
  const companySettings = useCompanySettingsContract();
  const deleteMutation = useSoftDeleteContract();
  const contracts = contractsQuery.data?.rows ?? [];
  const totalPages = hasClientFilter ? 1 : Math.max(1, Math.ceil((contractsQuery.data?.count ?? 0) / pageSize));

  const { filteredContracts, hasActiveFilters } = useContractFilters({ contracts, expiringOnly, leaseMode, searchTerm, status });

  const errorToastShownRef = useRef(false);
  useEffect(() => {
    if (contractsQuery.isError && !errorToastShownRef.current) {
      errorToastShownRef.current = true;
      toast.error('تعذر تحميل العقود');
    }
    if (!contractsQuery.isError) errorToastShownRef.current = false;
  }, [contractsQuery.isError]);

  const openCreate = () => { if (canCreate) { setEditContractId(undefined); setModalOpen(true); } };
  const openEdit = (id: string) => {
    if (!canEdit) return;
    setEditContractId(id);
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditContractId(undefined); };
  const handlePreview = (id: string) => {
    void navigate({ to: '/contracts/$contractId', params: { contractId: id } });
  };
  const resetFilters = () => { setStatus('all'); setLeaseMode('all'); setSearchTerm(''); setExpiringOnly(false); setPage(1); };
  const confirmDelete = async () => {
    if (!canCancel || !deleteId || deleteMutation.isPending) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // keep dialog open on failure, preserve context
    }
  };

  const exportActions = canExport ? (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        onClick={() => exportContractsXlsx(filteredContracts)}
        disabled={!filteredContracts.length}
        aria-label="تصدير العقود كملف Excel"
      >
        <FileSpreadsheet className="me-2 size-4" />Excel
      </Button>
      <Button
        variant="ghost"
        onClick={() => exportContractsCsv(filteredContracts)}
        disabled={!filteredContracts.length}
        aria-label="تصدير العقود كملف CSV"
      >
        <Download className="me-2 size-4" />CSV
      </Button>
    </div>
  ) : undefined;

  return (
    <>
      <EmbeddableWorkspace
        embedded={embedded}
        dir="rtl"
        size="wide"
        visualVariant="malek-pro"
        title="العقود"
        count={hasClientFilter ? filteredContracts.length : (contractsQuery.data?.count ?? filteredContracts.length)}
        primaryAction={canCreate ? (
          <Button onClick={openCreate}>
            <Plus className="me-2 size-4" />إنشاء عقد
          </Button>
        ) : undefined}
        secondaryActions={exportActions}
      >
        <ContractKpiGrid companySettings={companySettings} contracts={contracts} filteredContracts={filteredContracts} totalCount={contractsQuery.data?.count ?? contracts.length} />

        <ContractFilters
          expiringOnly={expiringOnly}
          hasActiveFilters={hasActiveFilters}
          leaseMode={leaseMode}
          resetFilters={resetFilters}
          searchTerm={searchTerm}
          setExpiringOnly={(updater) => { setExpiringOnly(updater); setPage(1); }}
          setLeaseMode={(value) => { setLeaseMode(value); setPage(1); }}
          setSearchTerm={(value) => { setSearchTerm(value); setPage(1); }}
          setStatus={(value) => { setStatus(value); setPage(1); }}
          status={status}
        />

        <ContractResults
          companySettings={companySettings}
          contracts={filteredContracts}
          expandedId={expandedId}
          emptyDescription={hasActiveFilters ? 'جرّب تغيير عبارة البحث أو نوع الإيجار أو فلتر الحالة لعرض عقود أخرى.' : 'ابدأ بإنشاء أول عقد وربطه بالعقار والوحدة والمستأجر.'}
          emptyTitle={hasActiveFilters ? 'لا توجد عقود مطابقة' : 'لا توجد عقود'}
          error={contractsQuery.error}
          isError={contractsQuery.isError}
          isLoading={contractsQuery.isLoading}
          onCreate={!hasActiveFilters && canCreate ? openCreate : undefined}
          onDelete={canCancel ? setDeleteId : undefined}
          onEdit={canEdit ? openEdit : undefined}
          onPreview={handlePreview}
          onRetry={() => contractsQuery.refetch()}
          pagination={!hasClientFilter && totalPages > 1 ? { page, pageSize, total: contractsQuery.data?.count ?? 0, onPageChange: setPage } : undefined}
          setExpandedId={setExpandedId}
        />
      </EmbeddableWorkspace>

      {canCreate || canEdit ? <ContractFormModal open={modalOpen} onClose={closeModal} contractId={editContractId} /> : null}

      {canCancel ? (
        <ConfirmDialog
          open={Boolean(deleteId)}
          onOpenChange={(open) => { if (!open) setDeleteId(null); }}
          title="أرشفة العقد؟"
          description="سيتم أرشفة العقد وإخفاؤه من القائمة النشطة مع الاحتفاظ بسجله المحاسبي وتاريخه بالكامل، ولا يتم حذفه بشكل نهائي. المرجع التجاري سيبقى محفوظاً للتدقيق."
          confirmLabel="تأكيد الأرشفة"
          isLoading={deleteMutation.isPending}
          onConfirm={confirmDelete}
        />
      ) : null}
    </>
  );
}

export function ContractsWorkspace({ embedded = true }: ContractsListPageProps) {
  return <ContractsListPage embedded={embedded} />;
}

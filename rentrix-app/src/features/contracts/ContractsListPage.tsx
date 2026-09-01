import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, FileSpreadsheet, FileText, Plus } from 'lucide-react';
import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { ContractKpiGrid } from './components/ContractKpiGrid';
import { ContractResults } from './components/ContractResults';
import { contractColumnOptions, defaultContractColumns } from './components/ContractTable';
import { ContractFormModal } from './contract-form-modal';
import { ListPage } from '@/components/layout/list-page';
import { Button } from '@/components/ui/button';
import { DataTableColumnsMenu } from '@/components/ui/data-table';
import { ExportMenu } from '@/components/ui/export-menu';
import { FilterTabs } from '@/components/ui/filter-tabs';
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
import { contractStatusValues } from './contractSchema';
import type { ContractListItem, ContractStatusFilter } from './services/contractService';

const contractStatusFilterLabels: Record<ContractStatusFilter, string> = {
  all: 'الكل',
  draft: 'مسودة',
  active: 'نشط',
  expired: 'منتهي',
  terminated: 'ملغي',
};

const contractLeaseModeOptions: { value: LeaseModeFilter; label: string }[] = [
  { value: 'all', label: 'كل الإيجارات' },
  { value: 'long_term', label: 'طويل' },
  { value: 'short_stay', label: 'إقامة قصيرة' },
];

const contractStatusFilterOptions = (['all', ...contractStatusValues] as ContractStatusFilter[]).map((filter) => ({
  value: filter,
  label: contractStatusFilterLabels[filter],
}));

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
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultContractColumns]);
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
  const activeFilters: ActiveFilterItem[] = [];
  if (searchTerm.trim()) {
    activeFilters.push({ key: 'search', label: 'البحث', value: searchTerm.trim(), onRemove: () => { setSearchTerm(''); setPage(1); } });
  }
  if (status !== 'all') {
    activeFilters.push({ key: 'status', label: 'الحالة', value: contractStatusFilterLabels[status], onRemove: () => { setStatus('all'); setPage(1); } });
  }
  if (leaseMode !== 'all') {
    const leaseLabel = contractLeaseModeOptions.find((option) => option.value === leaseMode)?.label ?? leaseMode;
    activeFilters.push({ key: 'leaseMode', label: 'نوع الإيجار', value: leaseLabel, onRemove: () => { setLeaseMode('all'); setPage(1); } });
  }
  if (expiringOnly) {
    activeFilters.push({ key: 'expiringOnly', label: 'الانتهاء', value: 'خلال 30 يوم', onRemove: () => { setExpiringOnly(false); setPage(1); } });
  }
  const confirmDelete = async () => {
    if (!canCancel || !deleteId || deleteMutation.isPending) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // keep dialog open on failure, preserve context
    }
  };

  return (
    <>
      <ListPage
        embedded={embedded}
        dir="rtl"
        title="العقود"
        workspaceName="contracts"
        viewModeStorageKey="malek:contracts:register-view-mode-v1"
        count={hasClientFilter ? filteredContracts.length : (contractsQuery.data?.count ?? filteredContracts.length)}
        primaryAction={canCreate ? (
          <Button onClick={openCreate}>
            <Plus className="me-2 size-4" />إنشاء عقد
          </Button>
        ) : undefined}
        search={{
          value: searchTerm,
          onChange: (value) => { setSearchTerm(value); setPage(1); },
          placeholder: 'بحث باسم المستأجر، الوحدة، العقار، أو رقم العقد',
        }}
        filters={(
          <FilterTabs
            options={contractLeaseModeOptions}
            value={leaseMode}
            onChange={(value) => { setLeaseMode(value as LeaseModeFilter); setPage(1); }}
            tone="contracts"
          />
        )}
        advancedFilters={(
          <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start" data-contract-advanced-filters>
            <div className="min-w-0 space-y-1.5">
              <p className="text-[11px] font-black text-muted-foreground">حالة العقد</p>
              <FilterTabs
                options={contractStatusFilterOptions}
                value={status}
                onChange={(value) => { setStatus(value as ContractStatusFilter); setPage(1); }}
                tone="contracts"
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <p className="text-[11px] font-black text-muted-foreground">قرب الانتهاء</p>
              <Button
                variant={expiringOnly ? 'primary' : 'secondary'}
                onClick={() => { setExpiringOnly((value) => !value); setPage(1); }}
                className="min-h-11 shrink-0 rounded-lg px-3 text-xs"
              >
                <AlertTriangle className="me-1.5 size-3.5" />
                تنتهي خلال 30 يوم
              </Button>
            </div>
          </div>
        )}
        advancedFilterTitle="فلاتر العقود"
        advancedFilterDescription="ابدأ بالبحث ونوع الإيجار. افتح هذه الفلاتر عند الحاجة لتقييد الحالة أو العقود القريبة من الانتهاء."
        activeFilters={activeFilters}
        onClearAllFilters={resetFilters}
        toolbarActions={(
          <>
            <div className="hidden min-w-0 items-center gap-2 md:flex" data-contract-columns-control>
              <DataTableColumnsMenu
                columns={contractColumnOptions}
                visibleKeys={visibleColumnKeys}
                onChange={setVisibleColumnKeys}
              />
            </div>
            {canExport ? (
              <ExportMenu
                disabled={filteredContracts.length === 0}
                items={[
                  { id: 'xlsx', label: 'ملف Excel', icon: FileSpreadsheet, onClick: () => exportContractsXlsx(filteredContracts) },
                  { id: 'csv', label: 'ملف CSV', icon: FileText, onClick: () => exportContractsCsv(filteredContracts) },
                ]}
              />
            ) : null}
          </>
        )}
      >
        <ContractKpiGrid companySettings={companySettings} contracts={contracts} filteredContracts={filteredContracts} totalCount={contractsQuery.data?.count ?? contracts.length} />

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
          visibleColumnKeys={visibleColumnKeys}
        />
      </ListPage>

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

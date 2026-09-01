import { AlertTriangle, FileSpreadsheet, FileText, Plus } from 'lucide-react';
import { useState } from 'react';
import { ListPage } from '@/components/layout/list-page';
import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { Button } from '@/components/ui/button';
import { DataTableColumnsMenu } from '@/components/ui/data-table';
import { ExportMenu } from '@/components/ui/export-menu';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { defaultCompanySettingsContract } from '@/lib/companySettings';
import { ContractKpiGrid } from './components/ContractKpiGrid';
import { ContractResults } from './components/ContractResults';
import { contractColumnOptions, defaultContractColumns } from './components/ContractTable';
import { contractStatusValues } from './contractSchema';
import { useContractFilters, type LeaseModeFilter } from './hooks/useContractFilters';
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

/**
 * Static marketing/demo capture of the real contracts workspace —
 * same canonical list shell, KPI grid, filters and results components as
 * production, fed with showcase rows. Rendered only behind VITE_E2E.
 */
const FIXTURE_COMPANY_ID = '00000000-0000-4000-8000-0000000000c1';

const fixtureContractDefaults = {
  company_id: FIXTURE_COMPANY_ID,
  reference: null,
  billing_day: 1,
  grace_days: 0,
  lease_mode: 'long_term',
  daily_reference_rate: null,
  agreement_version_id: null,
  collection_role_snapshot: null,
  operating_model_snapshot: null,
  maker_user_id: null,
  checker_user_id: null,
  maker_signature: null,
  checker_signature: null,
  approval_status: null,
  submitted_at: null,
  approved_at: null,
  rejected_at: null,
  rejection_reason: null,
  approval_evidence: null,
  is_sole_admin_exception: false,
} as const;

const fixtureContracts: ContractListItem[] = [
  {
    ...fixtureContractDefaults,
    id: 'c-000001', property_id: 'p-000001', unit_id: 'u-301', tenant_id: 't-001',
    start_date: '2026-01-01', end_date: '2026-12-31', rent_amount: 420,
    payment_cycle: 'monthly', payment_terms_id: null, status: 'active',
    cancellation_reason: null, renewed_from_id: null, notes: null,
    created_at: '2025-12-20T08:00:00Z', updated_at: '2026-07-01T08:00:00Z', deleted_at: null,
    attachment_url: null, agreement_id: null,
    properties: { id: 'p-000001', title: 'برج الواحة السكني', address: 'الخوير، مسقط' },
    units: { id: 'u-301', unit_number: '301', floor: '3', status: 'occupied', rent_amount: 420 },
    people: { id: 't-001', full_name: 'أحمد الحارثي', phone: '96892110011', email: null, national_id: null },
  },
  {
    ...fixtureContractDefaults,
    id: 'c-000002', property_id: 'p-000002', unit_id: 'u-v2', tenant_id: 't-002',
    start_date: '2025-09-01', end_date: '2026-08-31', rent_amount: 950,
    payment_cycle: 'quarterly', payment_terms_id: null, status: 'active',
    cancellation_reason: null, renewed_from_id: null, notes: null,
    created_at: '2025-08-22T08:00:00Z', updated_at: '2026-06-30T08:00:00Z', deleted_at: null,
    attachment_url: null, agreement_id: null,
    properties: { id: 'p-000002', title: 'فيلات الموج الغربية', address: 'الموج، مسقط' },
    units: { id: 'u-v2', unit_number: 'V-2', floor: null, status: 'occupied', rent_amount: 950 },
    people: { id: 't-002', full_name: 'سارة القتبية', phone: '96894550022', email: null, national_id: null },
  },
  {
    ...fixtureContractDefaults,
    id: 'c-000003', property_id: 'p-000003', unit_id: 'u-g04', tenant_id: 't-003',
    start_date: '2026-03-01', end_date: '2027-02-28', rent_amount: 600,
    payment_cycle: 'monthly', payment_terms_id: null, status: 'active',
    cancellation_reason: null, renewed_from_id: null, notes: null,
    created_at: '2026-02-25T08:00:00Z', updated_at: '2026-07-05T08:00:00Z', deleted_at: null,
    attachment_url: null, agreement_id: null,
    properties: { id: 'p-000003', title: 'عمارة النور التجارية', address: 'صحار، شمال الباطنة' },
    units: { id: 'u-g04', unit_number: 'G-04', floor: 'G', status: 'occupied', rent_amount: 600 },
    people: { id: 't-003', full_name: 'محفوظ التجارية ش.م.م', phone: '96826840033', email: null, national_id: null },
  },
  {
    ...fixtureContractDefaults,
    id: 'c-000004', property_id: 'p-000005', unit_id: 'u-705', tenant_id: 't-004',
    start_date: '2026-06-01', end_date: '2027-05-31', rent_amount: 1200,
    payment_cycle: 'annual', payment_terms_id: null, status: 'active',
    cancellation_reason: null, renewed_from_id: null, notes: null,
    created_at: '2026-05-26T08:00:00Z', updated_at: '2026-06-01T08:00:00Z', deleted_at: null,
    attachment_url: null, agreement_id: null,
    properties: { id: 'p-000005', title: 'برج مطرح التجاري', address: 'مطرح، مسقط' },
    units: { id: 'u-705', unit_number: '705', floor: '7', status: 'occupied', rent_amount: 1200 },
    people: { id: 't-004', full_name: 'شركة أفق الخليج', phone: '96824780044', email: null, national_id: null },
  },
  {
    ...fixtureContractDefaults,
    id: 'c-000005', property_id: 'p-000001', unit_id: 'u-205', tenant_id: 't-005',
    start_date: '2025-08-15', end_date: '2026-08-14', rent_amount: 380,
    payment_cycle: 'monthly', payment_terms_id: null, status: 'active',
    cancellation_reason: null, renewed_from_id: null, notes: null,
    created_at: '2025-08-10T08:00:00Z', updated_at: '2026-06-15T08:00:00Z', deleted_at: null,
    attachment_url: null, agreement_id: null,
    properties: { id: 'p-000001', title: 'برج الواحة السكني', address: 'الخوير، مسقط' },
    units: { id: 'u-205', unit_number: '205', floor: '2', status: 'occupied', rent_amount: 380 },
    people: { id: 't-005', full_name: 'ناصر الريامي', phone: '96891770055', email: null, national_id: null },
  },
  {
    ...fixtureContractDefaults,
    id: 'c-000006', property_id: 'p-000004', unit_id: 'u-b12', tenant_id: 't-006',
    start_date: '2025-07-01', end_date: '2026-06-30', rent_amount: 700,
    payment_cycle: 'semi_annual', payment_terms_id: null, status: 'expired',
    cancellation_reason: null, renewed_from_id: null, notes: null,
    created_at: '2025-06-28T08:00:00Z', updated_at: '2026-07-01T08:00:00Z', deleted_at: null,
    attachment_url: null, agreement_id: null,
    properties: { id: 'p-000004', title: 'مجمع السلام السكني', address: 'صلالة، ظفار' },
    units: { id: 'u-b12', unit_number: 'B-12', floor: '1', status: 'available', rent_amount: 700 },
    people: { id: 't-006', full_name: 'خميس الحضرمي', phone: '96899330066', email: null, national_id: null },
  },
  {
    ...fixtureContractDefaults,
    id: 'c-000007', property_id: 'p-000005', unit_id: 'u-302', tenant_id: 't-007',
    start_date: '2026-08-01', end_date: '2027-07-31', rent_amount: 880,
    payment_cycle: 'monthly', payment_terms_id: null, status: 'draft',
    cancellation_reason: null, renewed_from_id: null, notes: null,
    created_at: '2026-07-12T08:00:00Z', updated_at: '2026-07-12T08:00:00Z', deleted_at: null,
    attachment_url: null, agreement_id: null,
    properties: { id: 'p-000005', title: 'برج مطرح التجاري', address: 'مطرح، مسقط' },
    units: { id: 'u-302', unit_number: '302', floor: '3', status: 'reserved', rent_amount: 880 },
    people: { id: 't-007', full_name: 'منيرة السيابية', phone: '96890110077', email: null, national_id: null },
  },
];

export function ContractsListE2EFixture() {
  const [status, setStatus] = useState<ContractStatusFilter>('all');
  const [leaseMode, setLeaseMode] = useState<LeaseModeFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultContractColumns]);

  const { filteredContracts, hasActiveFilters } = useContractFilters({
    contracts: fixtureContracts,
    expiringOnly,
    leaseMode,
    searchTerm,
    status,
  });

  const activeFilters: ActiveFilterItem[] = [];
  if (searchTerm.trim()) activeFilters.push({ key: 'search', label: 'البحث', value: searchTerm.trim(), onRemove: () => setSearchTerm('') });
  if (status !== 'all') activeFilters.push({ key: 'status', label: 'الحالة', value: contractStatusFilterLabels[status], onRemove: () => setStatus('all') });
  if (leaseMode !== 'all') activeFilters.push({ key: 'leaseMode', label: 'نوع الإيجار', value: contractLeaseModeOptions.find((option) => option.value === leaseMode)?.label ?? leaseMode, onRemove: () => setLeaseMode('all') });
  if (expiringOnly) activeFilters.push({ key: 'expiringOnly', label: 'الانتهاء', value: 'خلال 30 يوم', onRemove: () => setExpiringOnly(false) });

  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground outline-none" dir="rtl" tabIndex={-1} data-e2e-contracts-workspace>
      <ListPage
        dir="rtl"
        title="العقود"
        description="إدارة دورة العقد من مسودة إلى نشط ثم منتهي أو ملغي."
        count={filteredContracts.length}
        workspaceName="contracts"
        viewModeStorageKey="malek:contracts:register-view-mode-v1"
        primaryAction={(
          <Button onClick={() => undefined}>
            <Plus className="me-2 size-4" />إنشاء عقد
          </Button>
        )}
        search={{ value: searchTerm, onChange: setSearchTerm, placeholder: 'بحث باسم المستأجر، الوحدة، العقار، أو رقم العقد' }}
        filters={
          <FilterTabs
            options={contractLeaseModeOptions}
            value={leaseMode}
            onChange={(value) => setLeaseMode(value as LeaseModeFilter)}
            tone="contracts"
          />
        }
        advancedFilters={(
          <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start" data-contract-advanced-filters>
            <div className="min-w-0 space-y-1.5">
              <p className="text-[11px] font-black text-muted-foreground">حالة العقد</p>
              <FilterTabs
                options={contractStatusFilterOptions}
                value={status}
                onChange={(value) => setStatus(value as ContractStatusFilter)}
                tone="contracts"
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <p className="text-[11px] font-black text-muted-foreground">قرب الانتهاء</p>
              <Button
                variant={expiringOnly ? 'primary' : 'secondary'}
                onClick={() => setExpiringOnly((value) => !value)}
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
        onClearAllFilters={() => { setStatus('all'); setLeaseMode('all'); setSearchTerm(''); setExpiringOnly(false); }}
        toolbarActions={(
          <>
            <div className="hidden min-w-0 items-center gap-2 md:flex" data-contract-columns-control>
              <DataTableColumnsMenu columns={contractColumnOptions} visibleKeys={visibleColumnKeys} onChange={setVisibleColumnKeys} />
            </div>
            <ExportMenu
              items={[
                { id: 'xlsx', label: 'ملف Excel', icon: FileSpreadsheet, onClick: () => undefined },
                { id: 'csv', label: 'ملف CSV', icon: FileText, onClick: () => undefined },
              ]}
            />
          </>
        )}
      >
        <ContractKpiGrid
          companySettings={defaultCompanySettingsContract}
          contracts={fixtureContracts}
          filteredContracts={filteredContracts}
          totalCount={fixtureContracts.length}
        />
        <ContractResults
          companySettings={defaultCompanySettingsContract}
          contracts={filteredContracts}
          expandedId={expandedId}
          emptyDescription={hasActiveFilters ? 'لا توجد عقود مطابقة لبيانات الاختبار.' : 'لا توجد عقود في بيانات الاختبار.'}
          emptyTitle="لا توجد عقود مطابقة"
          error={null}
          isError={false}
          isLoading={false}
          onDelete={() => undefined}
          onEdit={() => undefined}
          onPreview={() => undefined}
          onRetry={() => undefined}
          setExpandedId={setExpandedId}
          visibleColumnKeys={visibleColumnKeys}
        />
      </ListPage>
    </main>
  );
}

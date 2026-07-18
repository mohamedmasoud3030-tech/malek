import { useState } from 'react';
import { PageLayout } from '@/components/layout/page-layout';
import { defaultCompanySettingsContract } from '@/lib/companySettings';
import { ContractFilters } from './components/ContractFilters';
import { ContractKpiGrid } from './components/ContractKpiGrid';
import { ContractListHeader } from './components/ContractListHeader';
import { ContractResults } from './components/ContractResults';
import { useContractFilters } from './hooks/useContractFilters';
import type { ContractListItem, ContractStatusFilter } from './services/contractService';

/**
 * Static marketing/demo capture of the real contracts workspace —
 * same header, KPI grid, filters and results components as production,
 * fed with showcase rows. Rendered only behind VITE_E2E.
 */
const fixtureContracts: ContractListItem[] = [
  {
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
  const [searchTerm, setSearchTerm] = useState('');
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { filteredContracts, hasActiveFilters } = useContractFilters({
    contracts: fixtureContracts,
    expiringOnly,
    searchTerm,
    status,
  });

  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground" dir="rtl" data-e2e-contracts-workspace>
      <PageLayout dir="rtl" size="wide">
        <ContractListHeader
          canExport={Boolean(filteredContracts.length)}
          onCreate={() => undefined}
          onExport={() => undefined}
        />
        <ContractKpiGrid
          companySettings={defaultCompanySettingsContract}
          contracts={fixtureContracts}
          filteredContracts={filteredContracts}
        />
        <ContractFilters
          expiringOnly={expiringOnly}
          hasActiveFilters={hasActiveFilters}
          resetFilters={() => { setStatus('all'); setSearchTerm(''); setExpiringOnly(false); }}
          searchTerm={searchTerm}
          setExpiringOnly={(updater) => setExpiringOnly(updater)}
          setSearchTerm={setSearchTerm}
          setStatus={setStatus}
          status={status}
        />
        <ContractResults
          companySettings={defaultCompanySettingsContract}
          contracts={filteredContracts}
          expandedId={expandedId}
          emptyDescription="لا توجد عقود مطابقة لبيانات الاختبار."
          emptyTitle="لا توجد عقود مطابقة"
          error={null}
          isError={false}
          isLoading={false}
          onDelete={() => undefined}
          onEdit={() => undefined}
          onRetry={() => undefined}
          setExpandedId={setExpandedId}
        />
      </PageLayout>
    </main>
  );
}

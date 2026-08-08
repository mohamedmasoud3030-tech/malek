import { Download, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ListControlSurface } from '@/components/layout/list-controls';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { defaultCompanySettingsContract } from '@/lib/companySettings';
import { ContractFilters } from './components/ContractFilters';
import { ContractKpiGrid } from './components/ContractKpiGrid';
import { ContractResults } from './components/ContractResults';
import type { ContractListItem, ContractStatusFilter } from './services/contractService';

const fixtureContracts: ContractListItem[] = [
  {
    id: 'contract-001',
    company_id: 'company-1',
    property_id: 'property-1',
    unit_id: 'unit-1',
    tenant_id: 'tenant-1',
    contract_number: 'CTR-001',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    rent_amount: 450,
    payment_cycle: 'monthly',
    status: 'active',
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    agreement_id: null,
    agreement_version_id: null,
    agreement_model_snapshot: null,
    commission_type_snapshot: null,
    commission_value_snapshot: null,
    contract_terms_snapshot: null,
    owner_agreement_id: null,
    owner_agreement_version: null,
    owner_agreement_model: null,
    owner_commission_type: null,
    owner_commission_value: null,
    owner_agreement_terms: null,
    people: {
      id: 'tenant-1',
      full_name: 'محمد سالم',
      phone: '+96890000000',
      email: 'tenant@example.com',
      national_id: null,
    },
    units: {
      id: 'unit-1',
      unit_number: '101',
      floor: '1',
      status: 'occupied',
    },
    properties: {
      id: 'property-1',
      title: 'برج السلام',
      address: 'مسقط',
    },
  } as ContractListItem,
  {
    id: 'contract-002',
    company_id: 'company-1',
    property_id: 'property-2',
    unit_id: 'unit-2',
    tenant_id: 'tenant-2',
    contract_number: 'CTR-002',
    start_date: '2026-02-01',
    end_date: '2026-11-30',
    rent_amount: 520,
    payment_cycle: 'monthly',
    status: 'draft',
    notes: null,
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
    deleted_at: null,
    agreement_id: null,
    agreement_version_id: null,
    agreement_model_snapshot: null,
    commission_type_snapshot: null,
    commission_value_snapshot: null,
    contract_terms_snapshot: null,
    owner_agreement_id: null,
    owner_agreement_version: null,
    owner_agreement_model: null,
    owner_commission_type: null,
    owner_commission_value: null,
    owner_agreement_terms: null,
    people: {
      id: 'tenant-2',
      full_name: 'سارة أحمد',
      phone: '+96891111111',
      email: 'tenant2@example.com',
      national_id: null,
    },
    units: {
      id: 'unit-2',
      unit_number: '202',
      floor: '2',
      status: 'available',
    },
    properties: {
      id: 'property-2',
      title: 'مجمع النور',
      address: 'صحار',
    },
  } as ContractListItem,
];

export function ContractsListE2EFixture() {
  const [status, setStatus] = useState<ContractStatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredContracts = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return fixtureContracts.filter((contract) => {
      const matchesStatus = status === 'all' || contract.status === status;
      const matchesSearch = needle.length === 0 || [
        contract.contract_number,
        contract.people?.full_name,
        contract.properties?.title,
        contract.units?.unit_number,
      ].some((value) => value?.toLowerCase().includes(needle));
      return matchesStatus && matchesSearch;
    });
  }, [searchTerm, status]);
  const hasActiveFilters = status !== 'all' || searchTerm.trim().length > 0 || expiringOnly;

  return (
    <main dir="rtl">
      <PageLayout size="wide" visualVariant="malek-pro">
        <PageHeader
          title="العقود"
          description="إدارة دورة العقد من مسودة إلى نشط ثم منتهي أو ملغي."
          primaryAction={
            <Button onClick={() => undefined}>
              <Plus className="me-2 size-4" />إنشاء عقد
            </Button>
          }
          secondaryActions={
            <Button variant="secondary" disabled={!filteredContracts.length} aria-label="تصدير العقود كملف CSV">
              <Download className="me-2 size-4" />تصدير CSV
            </Button>
          }
        />
        <ContractKpiGrid
          companySettings={defaultCompanySettingsContract}
          contracts={fixtureContracts}
          filteredContracts={filteredContracts}
          totalCount={fixtureContracts.length}
        />
        <ListControlSurface>
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
        </ListControlSurface>
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
          onPreview={() => undefined}
          onRetry={() => undefined}
          setExpandedId={setExpandedId}
        />
      </PageLayout>
    </main>
  );
}

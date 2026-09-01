import { FileText } from 'lucide-react';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { PageLayout } from '@/components/layout/page-layout';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { defaultCompanySettingsContract } from '@/lib/companySettings';
import { ContractDetailWorkspace } from './components/ContractDetailWorkspace';
import { contractStatusLabels, contractStatusTone } from './contractSchema';
import type { ContractDetail } from './services/contractService';

const fixtureContract: ContractDetail = {
  id: 'contract-detail-1749',
  company_id: '00000000-0000-4000-8000-0000000000c1',
  property_id: 'property-1',
  unit_id: 'unit-205',
  tenant_id: 'tenant-1',
  reference: 'CON-2026-01749',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  rent_amount: 1250,
  payment_cycle: 'monthly',
  payment_terms_id: null,
  status: 'active',
  lease_mode: 'long_term',
  daily_reference_rate: null,
  billing_day: 1,
  grace_days: 5,
  agreement_id: null,
  agreement_version_id: null,
  collection_role_snapshot: 'AGENT',
  operating_model_snapshot: 'OWNER_AGENCY',
  approval_status: 'APPROVED',
  maker_user_id: 'maker-1',
  checker_user_id: 'checker-1',
  maker_signature: 'مدير المكتب',
  checker_signature: 'المراجع المالي',
  submitted_at: '2026-01-01T09:00:00Z',
  approved_at: '2026-01-01T10:30:00Z',
  rejected_at: null,
  rejection_reason: null,
  approval_evidence: null,
  is_sole_admin_exception: false,
  created_at: '2026-01-01T08:00:00Z',
  updated_at: '2026-08-15T08:00:00Z',
  deleted_at: null,
  notes: 'لقطة تفصيلية صحيحة للتحقق من عدم استخدام سجل العقود كبديل لتفاصيل العقد.',
  cancellation_reason: null,
  renewed_from_id: null,
  attachment_url: null,
  properties: { id: 'property-1', title: 'برج الواحة السكني', address: 'الخوير، مسقط' },
  units: { id: 'unit-205', unit_number: '205', floor: '2', status: 'occupied', rent_amount: 1250 },
  people: { id: 'tenant-1', full_name: 'أحمد الحارثي', phone: '+96890000000', email: null, national_id: 'OM1234567' },
  renewed_from: null,
};

export function ContractDetailE2EFixture() {
  const status = fixtureContract.status;
  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground outline-none" dir="rtl" tabIndex={-1} data-e2e-contract-detail-workspace>
      <PageLayout dir="rtl" size="wide" visualVariant="malek-pro">
        <EntityDetailHeader
          title={fixtureContract.reference ?? 'عقد الإيجار'}
          subtitle={`${fixtureContract.people?.full_name} · ${fixtureContract.properties?.title} · الوحدة ${fixtureContract.units?.unit_number}`}
          status={<StatusBadge tone={contractStatusTone[status]}>{contractStatusLabels[status]}</StatusBadge>}
          backTo="/contracts"
          actions={(
            <>
              <Button className="min-h-11"><FileText className="me-2 size-4" aria-hidden="true" />تعديل</Button>
              <ActionMenu label="إجراءات العقد" items={[{ id: 'print', label: 'طباعة العقد', onSelect: () => undefined }]} />
            </>
          )}
        />
        <ContractDetailWorkspace contract={fixtureContract} settings={defaultCompanySettingsContract} />
      </PageLayout>
    </main>
  );
}

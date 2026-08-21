import { Download, Plus } from 'lucide-react';
import { ListPage } from '@/components/layout/list-page';
import { Button } from '@/components/ui/button';
import { EntityTable } from '@/components/ui/entity-table';
import { EntitySummaryStrip } from '@/components/ui/entity-summary-strip';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { propertyStatusTone } from './components/property-status';
import type { Property } from '@/types/domain';

// WP-DB0: fixtures must satisfy the frozen row contract, including the tenant
// key and the columns the schema actually defines.
const FIXTURE_COMPANY_ID = '00000000-0000-4000-8000-0000000000c1';

const fixtureProperties: Property[] = [
  {
    id: 'p-000001',
    title: 'برج الواحة السكني',
    type: 'مبنى سكني',
    address: 'الخوير، مسقط',
    owner_name: 'سعيد البلوشي',
    purchase_value: 420000,
    current_value: 510000,
    status: 'active',
    notes: null,
    created_at: '2026-01-04T08:00:00Z',
    updated_at: '2026-07-10T08:00:00Z',
    deleted_at: null,
    owner_id: null,
    name: '',
    company_id: FIXTURE_COMPANY_ID,
  },
  {
    id: 'p-000002',
    title: 'فيلات الموج الغربية',
    type: 'فيلا',
    address: 'الموج، مسقط',
    owner_name: 'مريم الهنائية',
    purchase_value: 260000,
    current_value: 305000,
    status: 'active',
    notes: null,
    created_at: '2026-02-11T08:00:00Z',
    updated_at: '2026-07-08T08:00:00Z',
    deleted_at: null,
    owner_id: null,
    name: '',
    company_id: FIXTURE_COMPANY_ID,
  },
  {
    id: 'p-000003',
    title: 'عمارة النور التجارية',
    type: 'عمارة تجارية',
    address: 'صحار، شمال الباطنة',
    owner_name: 'خالد الشحي',
    purchase_value: 180000,
    current_value: 214000,
    status: 'active',
    notes: null,
    created_at: '2026-03-02T08:00:00Z',
    updated_at: '2026-07-12T08:00:00Z',
    deleted_at: null,
    owner_id: null,
    name: '',
    company_id: FIXTURE_COMPANY_ID,
  },
  {
    id: 'p-000004',
    title: 'مجمع السلام السكني',
    type: 'مجمع سكني',
    address: 'صلالة، ظفار',
    owner_name: 'عبدالله المعمري',
    purchase_value: 350000,
    current_value: 390000,
    status: 'maintenance',
    notes: null,
    created_at: '2026-04-18T08:00:00Z',
    updated_at: '2026-07-14T08:00:00Z',
    deleted_at: null,
    owner_id: null,
    name: '',
    company_id: FIXTURE_COMPANY_ID,
  },
  {
    id: 'p-000005',
    title: 'برج مطرح التجاري',
    type: 'مبنى مكاتب',
    address: 'مطرح، مسقط',
    owner_name: 'سعيد البلوشي',
    purchase_value: 540000,
    current_value: 655000,
    status: 'active',
    notes: null,
    created_at: '2026-05-07T08:00:00Z',
    updated_at: '2026-07-11T08:00:00Z',
    deleted_at: null,
    owner_id: null,
    name: '',
    company_id: FIXTURE_COMPANY_ID,
  },
  {
    id: 'p-000006',
    title: 'فيلا الياسمين',
    type: 'فيلا',
    address: 'نزوى، الداخلية',
    owner_name: 'مريم الهنائية',
    purchase_value: 95000,
    current_value: 110000,
    status: 'inactive',
    notes: null,
    created_at: '2026-05-28T08:00:00Z',
    updated_at: '2026-07-01T08:00:00Z',
    deleted_at: null,
    owner_id: null,
    name: '',
    company_id: FIXTURE_COMPANY_ID,
  },
];

const statusLabels: Record<Property['status'], string> = {
  active: 'نشط',
  inactive: 'غير نشط',
  maintenance: 'صيانة',
  sold: 'مباع',
};

export function PropertiesListE2EFixture() {
  const linkedOwnerCount = fixtureProperties.filter((property) => Boolean(property.owner_name)).length;
  const attentionCount = fixtureProperties.filter((property) => property.status !== 'active').length;

  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground outline-none" dir="rtl" tabIndex={-1} data-e2e-properties-workspace>
      <ListPage
        visualVariant="malek-pro"
        title="العقارات"
        description="متابعة جاهزية العقار والمالك واتفاقية التشغيل والوحدات من مساحة واحدة."
        count={fixtureProperties.length}
        primaryAction={(
          <Button>
            <Plus className="me-2 size-4" aria-hidden="true" />إضافة عقار
          </Button>
        )}
        secondaryActions={(
          <Button variant="secondary">
            <Download className="me-2 size-4" aria-hidden="true" />تصدير CSV
          </Button>
        )}
        search={{ value: '', onChange: () => undefined, placeholder: 'ابحث باسم العقار أو العنوان…' }}
        filters={(
          <Select aria-label="تصفية حسب الحالة" value="all" onChange={() => undefined}>
            <option value="all">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="maintenance">صيانة</option>
            <option value="inactive">غير نشط</option>
          </Select>
        )}
      >
        <div data-property-summary>
          <EntitySummaryStrip
            ariaLabel="ملخص سجل العقارات"
            items={[
              { label: 'النتائج', value: fixtureProperties.length },
              { label: 'مرتبطة بمالك', value: linkedOwnerCount },
              { label: 'تحتاج متابعة', value: attentionCount, tone: 'warning' },
            ]}
          />
        </div>

        <section data-property-register className="min-w-0">
          <EntityTable
            aria-label="جدول العقارات"
            rows={fixtureProperties}
            keyOf={(property) => property.id}
            onRowClick={() => undefined}
            mobileVisibleSecondaryKeys={['status', 'owner_name']}
            columns={[
              {
                key: 'title',
                header: 'العقار',
                priority: 'identity',
                render: (property) => <span className="font-black">{property.title ?? '—'}</span>,
              },
              {
                key: 'status',
                header: 'الحالة',
                priority: 'primary',
                render: (property) => (
                  <StatusBadge tone={propertyStatusTone[property.status] ?? 'neutral'}>
                    {statusLabels[property.status] ?? property.status}
                  </StatusBadge>
                ),
              },
              { key: 'owner_name', header: 'المالك', priority: 'secondary', render: (property) => property.owner_name ?? '—' },
              { key: 'address', header: 'العنوان', priority: 'detail', render: (property) => property.address ?? '—' },
            ]}
          />
        </section>
      </ListPage>
    </main>
  );
}

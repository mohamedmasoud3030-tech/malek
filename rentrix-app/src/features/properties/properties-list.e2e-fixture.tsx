import { Building2, Download, Edit, Plus, Trash2 } from 'lucide-react';
import { ListPage } from '@/components/layout/list-page';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EntityCell } from '@/components/ui/entity-cell';
import { FilterBar } from '@/components/ui/filter-bar';
import { MobileCard } from '@/components/ui/mobile-card';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { propertyStatusTone } from './components/property-status';
import type { Property } from '@/types/domain';

/**
 * Static marketing/demo capture of the real properties workspace —
 * reuses the exact list page chrome and table components, fed with
 * showcase data instead of live queries. Rendered only behind VITE_E2E.
 * Kept structurally identical to PropertiesListPage (unified buttons,
 * mobile cards) so captured evidence matches production.
 */
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
  },
];

const statusLabels: Record<Property['status'], string> = {
  active: 'نشط',
  inactive: 'غير نشط',
  maintenance: 'صيانة',
  sold: 'مباع',
};

export function PropertiesListE2EFixture() {
  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground" dir="rtl" data-e2e-properties-workspace>
      <ListPage
        title="العقارات"
        description="إدارة ملفات العقارات والأصول العقارية"
        count={fixtureProperties.length}
        primaryAction={
          <Button>
            <Plus className="me-2 size-4" aria-hidden="true" />إضافة عقار
          </Button>
        }
        secondaryActions={
          <Button variant="secondary">
            <Download className="me-2 size-4" aria-hidden="true" />تصدير CSV
          </Button>
        }
        filters={
          <FilterBar
            searchValue=""
            onSearchChange={() => undefined}
            searchPlaceholder="ابحث باسم العقار أو العنوان…"
            filters={
              <Select aria-label="تصفية حسب الحالة" value="all" onChange={() => undefined}>
                <option value="all">كل الحالات</option>
                <option value="active">نشط</option>
                <option value="maintenance">صيانة</option>
                <option value="inactive">غير نشط</option>
              </Select>
            }
          />
        }
      >
        <DataTable
          aria-label="جدول العقارات"
          rows={fixtureProperties}
          keyOf={(p) => p.id}
          onRowClick={() => undefined}
          renderMobileCard={(p) => (
            <MobileCard
              title={p.title ?? 'عقار'}
              subtitle={p.address ?? 'العنوان غير محدد'}
              badge={(
                <StatusBadge tone={propertyStatusTone[p.status] ?? 'neutral'} dot>
                  {statusLabels[p.status] ?? p.status}
                </StatusBadge>
              )}
              stats={<span className="text-xs text-muted-foreground">اضغط لفتح تفاصيل العقار</span>}
              onClick={() => undefined}
              actions={(
                <div className="grid w-full grid-cols-2 gap-2">
                  <Button variant="secondary" className="min-h-11 text-xs gap-1">
                    <Edit className="size-3.5" />تعديل
                  </Button>
                  <Button variant="danger" className="min-h-11 text-xs gap-1">
                    <Trash2 className="size-3.5" />أرشفة
                  </Button>
                </div>
              )}
            />
          )}
          columns={[
            {
              key: 'title',
              header: 'العقار',
              render: (p) => <EntityCell icon={Building2} title={p.title ?? '—'} subtitle={p.type ?? undefined} />,
            },
            { key: 'address', header: 'العنوان', render: (p) => p.address ?? '—' },
            { key: 'owner_name', header: 'المالك', render: (p) => p.owner_name ?? '—' },
            {
              key: 'current_value',
              header: 'القيمة الحالية',
              render: (p) => (p.current_value ? `${p.current_value.toLocaleString('en-US')} ر.ع.` : '—'),
            },
            {
              key: 'status',
              header: 'الحالة',
              render: (p) => (
                <StatusBadge tone={propertyStatusTone[p.status] ?? 'neutral'} dot>
                  {statusLabels[p.status] ?? p.status}
                </StatusBadge>
              ),
            },
          ]}
        />
      </ListPage>
    </main>
  );
}

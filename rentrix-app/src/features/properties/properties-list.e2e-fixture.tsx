import {
  Building2,
  CircleCheck,
  Download,
  Edit,
  Handshake,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { ListPage } from '@/components/layout/list-page';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EntityCell } from '@/components/ui/entity-cell';
import { MobileCard } from '@/components/ui/mobile-card';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { propertyStatusTone } from './components/property-status';
import type { Property } from '@/types/domain';

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

function Metric({
  label,
  value,
  hint,
  icon: Icon,
}: Readonly<{
  label: string;
  value: number;
  hint: string;
  icon: typeof Building2;
}>) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border/75 bg-card p-4 shadow-card">
      <div className="absolute inset-inline-end-0 inset-block-start-0 size-24 rounded-full bg-primary/7 blur-2xl" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">{hint}</p>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/8 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

export function PropertiesListE2EFixture() {
  const readyCount = fixtureProperties.filter((property) => property.status === 'active').length;
  const attentionCount = fixtureProperties.length - readyCount;
  const linkedOwnerCount = fixtureProperties.filter((property) => Boolean(property.owner_name)).length;
  const readinessRate = Math.round((readyCount / fixtureProperties.length) * 100);

  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground" dir="rtl" data-e2e-properties-workspace>
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
        search={{
          value: '',
          onChange: () => undefined,
          placeholder: 'ابحث باسم العقار أو العنوان…',
        }}
        filters={(
          <Select aria-label="تصفية حسب الحالة" value="all" onChange={() => undefined}>
            <option value="all">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="maintenance">صيانة</option>
            <option value="inactive">غير نشط</option>
          </Select>
        )}
      >
        <section
          data-property-summary
          aria-label="ملخص جاهزية العقارات"
          className="grid gap-3 lg:grid-cols-[minmax(17rem,1.05fr)_minmax(0,2fr)]"
        >
          <article className="relative overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar p-5 text-sidebar-foreground shadow-elevated">
            <div className="absolute -inset-inline-end-12 -inset-block-start-16 size-48 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-sidebar-foreground/65">جاهزية التشغيل</p>
                  <p className="mt-2 text-4xl font-black tabular-nums">{readinessRate}%</p>
                </div>
                <span className="grid size-12 place-items-center rounded-2xl border border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground">
                  <CircleCheck className="size-6" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-sidebar-accent">
                <div className="h-full rounded-full bg-primary" style={{ width: `${readinessRate}%` }} aria-hidden="true" />
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-sidebar-foreground/72">
                <span>{readyCount} جاهزة</span>
                <span>{attentionCount} تحتاج متابعة</span>
              </div>
            </div>
          </article>

          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="إجمالي العقارات" value={fixtureProperties.length} hint="كل النتائج المطابقة" icon={Building2} />
            <Metric label="مرتبطة بمالك" value={linkedOwnerCount} hint="ضمن الصفحة الحالية" icon={Handshake} />
            <Metric label="تحتاج متابعة" value={attentionCount} hint="حالة تشغيل أو مراجعة" icon={TriangleAlert} />
          </div>
        </section>

        <section data-property-register className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card">
          <header className="flex flex-col gap-3 border-b border-border/70 bg-muted/35 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-primary/9 text-primary">
                  <Building2 className="size-4.5" aria-hidden="true" />
                </span>
                <h2 className="text-base font-black">سجل العقارات</h2>
              </div>
              <p className="mt-1.5 text-xs font-medium text-muted-foreground">{fixtureProperties.length} عقارات في العرض الحالي.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-warning/20 bg-warning-bg px-3 py-1.5 text-xs font-black text-warning">
              <TriangleAlert className="size-3.5" aria-hidden="true" />
              {attentionCount} تحتاج متابعة
            </span>
          </header>

          <div className="p-3 sm:p-4">
            <DataTable
              aria-label="جدول العقارات"
              rows={fixtureProperties}
              keyOf={(property) => property.id}
              onRowClick={() => undefined}
              renderMobileCard={(property) => (
                <MobileCard
                  title={property.title ?? 'عقار'}
                  subtitle={property.address ?? 'العنوان غير محدد'}
                  badge={(
                    <StatusBadge tone={propertyStatusTone[property.status] ?? 'neutral'} dot>
                      {statusLabels[property.status] ?? property.status}
                    </StatusBadge>
                  )}
                  stats={(
                    <span className="text-xs font-bold text-muted-foreground">
                      {property.status === 'active' ? 'جاهز للتشغيل' : 'يحتاج متابعة'}
                    </span>
                  )}
                  onClick={() => undefined}
                  actions={(
                    <div className="grid w-full grid-cols-2 gap-2">
                      <Button variant="secondary" className="min-h-11 gap-1 text-xs">
                        <Edit className="size-3.5" />تعديل
                      </Button>
                      <Button variant="danger" className="min-h-11 gap-1 text-xs">
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
                  render: (property) => <EntityCell icon={Building2} title={property.title ?? '—'} subtitle={property.type ?? undefined} />,
                },
                { key: 'address', header: 'العنوان', render: (property) => property.address ?? '—' },
                { key: 'owner_name', header: 'المالك', render: (property) => property.owner_name ?? '—' },
                {
                  key: 'current_value',
                  header: 'القيمة الحالية',
                  render: (property) => (property.current_value ? `${property.current_value.toLocaleString('en-US')} ر.ع.` : '—'),
                },
                {
                  key: 'status',
                  header: 'الحالة',
                  render: (property) => (
                    <StatusBadge tone={propertyStatusTone[property.status] ?? 'neutral'} dot>
                      {statusLabels[property.status] ?? property.status}
                    </StatusBadge>
                  ),
                },
              ]}
            />
          </div>
        </section>
      </ListPage>
    </main>
  );
}

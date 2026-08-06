import { AlertCircle, Clock, Flame, PlusCircle, Printer, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { Select } from '@/components/ui/select';
import type { Property, Unit } from '@/types/domain';
import { MaintenanceList } from './components/maintenance-list';
import type { Maintenance } from './maintenance-service';

const fixtureProperties: Property[] = [
  { id: 'p-000001', title: 'برج الواحة السكني', type: 'مبنى سكني', address: 'الخوير، مسقط', owner_name: null, purchase_value: null, current_value: null, status: 'active', notes: null, created_at: '2026-01-04T08:00:00Z', updated_at: '2026-07-10T08:00:00Z', deleted_at: null },
  { id: 'p-000003', title: 'عمارة النور التجارية', type: 'عمارة تجارية', address: 'صحار، شمال الباطنة', owner_name: null, purchase_value: null, current_value: null, status: 'active', notes: null, created_at: '2026-03-02T08:00:00Z', updated_at: '2026-07-12T08:00:00Z', deleted_at: null },
  { id: 'p-000004', title: 'مجمع السلام السكني', type: 'مجمع سكني', address: 'صلالة، ظفار', owner_name: null, purchase_value: null, current_value: null, status: 'maintenance', notes: null, created_at: '2026-04-18T08:00:00Z', updated_at: '2026-07-14T08:00:00Z', deleted_at: null },
  { id: 'p-000005', title: 'برج مطرح التجاري', type: 'مبنى مكاتب', address: 'مطرح، مسقط', owner_name: null, purchase_value: null, current_value: null, status: 'active', notes: null, created_at: '2026-05-07T08:00:00Z', updated_at: '2026-07-11T08:00:00Z', deleted_at: null },
];

const fixtureUnits: Unit[] = [
  { id: 'u-302', name: null, property_id: 'p-000001', unit_number: '302', floor: '3', status: 'occupied', rent_amount: 420, notes: null, created_at: '2026-01-04T08:00:00Z', updated_at: '2026-07-10T08:00:00Z', deleted_at: null },
  { id: 'u-g04', name: null, property_id: 'p-000003', unit_number: 'G-04', floor: 'G', status: 'occupied', rent_amount: 600, notes: null, created_at: '2026-03-02T08:00:00Z', updated_at: '2026-07-12T08:00:00Z', deleted_at: null },
];

const base = {
  company_id: '00000000-0000-4000-8000-000000000001',
  no: null,
  description: null,
  assigned_to: null,
  cost: null,
  charged_to: null,
  notes: null,
  work_description: null,
  response_time_hours: null,
  expense_id: null,
  invoice_id: null,
  reported_by: null,
  unit_id: null,
  technician_name: null,
  completed_at: null,
  resolved_at: null,
  attachment_url: null,
  created_at: '2026-07-14T08:00:00Z',
  updated_at: '2026-07-15T08:00:00Z',
  deleted_at: null,
};

const fixtureRows: Maintenance[] = [
  { ...base, id: 'm-01', property_id: 'p-000001', unit_id: 'u-302', title: 'تسريب مياه في مطبخ الوحدة 302', priority: 'urgent', status: 'in_progress', request_date: '2026-07-15', scheduled_date: '2026-07-16', technician_name: 'سالم الحوسني' },
  { ...base, id: 'm-02', property_id: 'p-000004', title: 'عطل في نظام التكييف المركزي', priority: 'high', status: 'open', request_date: '2026-07-14', scheduled_date: '2026-07-18', technician_name: null },
  { ...base, id: 'm-03', property_id: 'p-000005', title: 'الصيانة الدورية للمصعد الرئيسي', priority: 'medium', status: 'open', request_date: '2026-07-13', scheduled_date: '2026-07-20', technician_name: 'فريق المصاعد' },
  { ...base, id: 'm-04', property_id: 'p-000003', unit_id: 'u-g04', title: 'فحص مضخة المياه الأرضية', priority: 'medium', status: 'in_progress', request_date: '2026-07-12', scheduled_date: '2026-07-16', technician_name: 'سالم الحوسني' },
  { ...base, id: 'm-05', property_id: 'p-000001', title: 'تبديل قفل البوابة الرئيسية', priority: 'low', status: 'resolved', request_date: '2026-07-08', scheduled_date: '2026-07-09', technician_name: 'محمود خلف' },
];

function Metric({
  label,
  value,
  hint,
  icon: Icon,
}: Readonly<{
  label: string;
  value: number;
  hint: string;
  icon: typeof Wrench;
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

export function MaintenanceE2EFixture() {
  const openCount = fixtureRows.filter((row) => row.status === 'open').length;
  const inProgressCount = fixtureRows.filter((row) => row.status === 'in_progress').length;
  const urgentCount = fixtureRows.filter((row) => row.priority === 'urgent').length;

  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground" dir="rtl" data-e2e-maintenance-workspace>
      <PageLayout dir="rtl" size="wide" visualVariant="malek-pro">
        <PageHeader
          title="طلبات الصيانة"
          description="غرفة متابعة للطلبات العاجلة والمفتوحة وقيد التنفيذ مع الإجراءات والطباعة من مكان واحد."
          primaryAction={(
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="min-h-11 gap-2 font-bold">
                <Printer className="size-4 text-primary" aria-hidden="true" />
                طباعة كشف الصيانة A4
              </Button>
              <Button type="button" className="min-h-11">
                <PlusCircle className="me-2 size-4" aria-hidden="true" />
                طلب صيانة جديد
              </Button>
            </div>
          )}
        />

        <section
          data-maintenance-summary
          aria-label="ملخص تشغيل الصيانة"
          className="grid gap-3 lg:grid-cols-[minmax(17rem,1.05fr)_minmax(0,2fr)]"
        >
          <article className="relative overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar p-5 text-sidebar-foreground shadow-elevated">
            <div className="absolute -inset-inline-end-12 -inset-block-start-16 size-48 rounded-full bg-destructive/20 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-sidebar-foreground/65">طلبات تحتاج انتباهًا فوريًا</p>
                  <p className="mt-2 text-4xl font-black tabular-nums">{urgentCount}</p>
                </div>
                <span className="grid size-12 place-items-center rounded-2xl border border-sidebar-border bg-sidebar-accent text-warning">
                  <Flame className="size-6" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-4 text-xs font-medium leading-5 text-sidebar-foreground/72">
                أولوية عاجلة ضمن الطلبات الحالية. افتح الطلب لتحديد المسؤول أو بدء التنفيذ.
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-sidebar-foreground/72">
                <span>{openCount} مفتوحة</span>
                <span>{inProgressCount} قيد التنفيذ</span>
              </div>
            </div>
          </article>

          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="إجمالي الطلبات" value={fixtureRows.length} hint="ضمن العرض الحالي" icon={Wrench} />
            <Metric label="طلبات مفتوحة" value={openCount} hint="تحتاج إلى بدء المتابعة" icon={AlertCircle} />
            <Metric label="قيد التنفيذ" value={inProgressCount} hint="يعمل عليها الفريق" icon={Clock} />
          </div>
        </section>

        <FilterBar
          searchValue=""
          onSearchChange={() => undefined}
          searchPlaceholder="ابحث برقم الطلب أو العنوان…"
          filters={(
            <>
              <Select aria-label="تصفية حسب الحالة" value="all" onChange={() => undefined}>
                <option value="all">كل الحالات</option>
                <option value="open">مفتوح</option>
                <option value="in_progress">قيد التنفيذ</option>
                <option value="resolved">تم الحل</option>
              </Select>
              <Select aria-label="تصفية حسب الأولوية" value="all" onChange={() => undefined}>
                <option value="all">كل الأولويات</option>
                <option value="urgent">عاجلة</option>
                <option value="high">عالية</option>
                <option value="medium">متوسطة</option>
                <option value="low">منخفضة</option>
              </Select>
            </>
          )}
        />

        <section data-maintenance-register className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card">
          <header className="flex flex-col gap-3 border-b border-border/70 bg-muted/35 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-primary/9 text-primary">
                  <Wrench className="size-4.5" aria-hidden="true" />
                </span>
                <h2 className="text-base font-black">سجل طلبات الصيانة</h2>
              </div>
              <p className="mt-1.5 text-xs font-medium text-muted-foreground">{fixtureRows.length} طلبات ضمن العرض الحالي.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-xs font-black text-destructive">
              <Flame className="size-3.5" aria-hidden="true" />
              {urgentCount} عاجلة
            </span>
          </header>
          <div className="p-3 sm:p-4">
            <MaintenanceList
              rows={fixtureRows}
              properties={fixtureProperties}
              allUnits={fixtureUnits}
              actionsPending={false}
              onViewDetails={() => undefined}
              onEdit={() => undefined}
              onStatusAction={() => undefined}
            />
          </div>
        </section>
      </PageLayout>
    </main>
  );
}

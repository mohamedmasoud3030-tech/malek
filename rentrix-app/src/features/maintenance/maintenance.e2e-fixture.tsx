import { AlertCircle, Clock, Flame, PlusCircle, Printer, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import type { Property, Unit } from '@/types/domain';
import { MaintenanceList } from './components/maintenance-list';
import type { Maintenance } from './maintenance-service';

/**
 * Static marketing/demo capture of the real maintenance workspace —
 * same header, KPI cards, filter bar and list component as production,
 * fed with showcase rows. Rendered only behind VITE_E2E.
 */
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
  no: null, description: null, assigned_to: null, cost: null, charged_to: null,
  notes: null, work_description: null, response_time_hours: null, expense_id: null,
  invoice_id: null, reported_by: null, unit_id: null, technician_name: null,
  completed_at: null, resolved_at: null, attachment_url: null,
  created_at: '2026-07-14T08:00:00Z', updated_at: '2026-07-15T08:00:00Z', deleted_at: null,
};

const fixtureRows: Maintenance[] = [
  { ...base, id: 'm-01', property_id: 'p-000001', unit_id: 'u-302', title: 'تسريب مياه في مطبخ الوحدة 302', priority: 'urgent', status: 'in_progress', request_date: '2026-07-15', scheduled_date: '2026-07-16', technician_name: 'سالم الحوسني' },
  { ...base, id: 'm-02', property_id: 'p-000004', title: 'عطل في نظام التكييف المركزي', priority: 'high', status: 'open', request_date: '2026-07-14', scheduled_date: '2026-07-18', technician_name: null },
  { ...base, id: 'm-03', property_id: 'p-000005', title: 'الصيانة الدورية للمصعد الرئيسي', priority: 'medium', status: 'open', request_date: '2026-07-13', scheduled_date: '2026-07-20', technician_name: 'فريق المصاعد' },
  { ...base, id: 'm-04', property_id: 'p-000003', unit_id: 'u-g04', title: 'فحص مضخة المياه الأرضية', priority: 'medium', status: 'in_progress', request_date: '2026-07-12', scheduled_date: '2026-07-16', technician_name: 'سالم الحوسني' },
  { ...base, id: 'm-05', property_id: 'p-000001', title: 'تبديل قفل البوابة الرئيسية', priority: 'low', status: 'resolved', request_date: '2026-07-08', scheduled_date: '2026-07-09', technician_name: 'محمود خلف' },
];

export function MaintenanceE2EFixture() {
  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground" dir="rtl" data-e2e-maintenance-workspace>
      <PageLayout dir="rtl" size="wide">
        <PageHeader
          title="طلبات الصيانة"
          description="تتبع طلبات الصيانة حسب الحالة والأولوية والعقار، مع إجراءات واضحة للموبايل والديسكتوب وطباعة التقرير الشامل."
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

        <ResponsiveCardGrid desktopColumns={4}>
          <KpiCard icon={Wrench} label="طلبات مفتوحة" value={3} sub="بانتظار البدء" />
          <KpiCard icon={Clock} label="قيد التنفيذ" value={2} sub="فرق ميدانية الآن" />
          <KpiCard icon={Flame} label="أولوية عاجلة" value={1} sub="تسريب نشط خلال 24 ساعة" />
          <KpiCard icon={AlertCircle} label="متوسط زمن الإغلاق" value="1.8 يوم" sub="آخر 30 يوماً" />
        </ResponsiveCardGrid>

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

        <MaintenanceList
          rows={fixtureRows}
          properties={fixtureProperties}
          allUnits={fixtureUnits}
          actionsPending={false}
          onViewDetails={() => undefined}
          onEdit={() => undefined}
          onStatusAction={() => undefined}
        />
      </PageLayout>
    </main>
  );
}

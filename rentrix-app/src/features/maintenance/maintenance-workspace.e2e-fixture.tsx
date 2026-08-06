import { PageLayout } from '@/components/layout/page-layout';
import { SectionHeader } from '@/components/ui/section-header';
import { FilterBar } from '@/components/ui/filter-bar';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { KpiCard } from '@/components/ui/kpi-card';
import { Wrench, AlertCircle, Clock, Flame } from 'lucide-react';

export function MaintenanceWorkspaceE2EFixture() {
  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground" dir="rtl" data-e2e-maintenance-workspace>
      <div className="px-3 py-4 sm:px-6 lg:px-8">
        <PageLayout className="space-y-6" visualVariant="malek-pro">
          <SectionHeader title="طلبات الصيانة" description="تتبع طلبات الصيانة حسب الحالة والأولوية والعقار" />

          <ResponsiveCardGrid desktopColumns={4}>
            <KpiCard label="إجمالي الطلبات" value="12" sub="ضمن الفلاتر" icon={Wrench} />
            <KpiCard label="طلبات مفتوحة" value="5" sub="تحتاج متابعة" icon={AlertCircle} />
            <KpiCard label="قيد التنفيذ" value="4" sub="يعمل عليها الفريق" icon={Clock} />
            <KpiCard label="طلبات عاجلة" value="3" sub="أولوية فورية" icon={Flame} />
          </ResponsiveCardGrid>

          <FilterBar
            searchValue=""
            onSearchChange={() => {}}
            searchPlaceholder="بحث في طلبات الصيانة"
            searchAriaLabel="بحث في طلبات الصيانة"
            filters={
              <>
                <Select aria-label="تصفية حسب الحالة" value="all" onChange={() => {}}>
                  <option value="all">كل الحالات</option>
                  <option value="open">مفتوح</option>
                  <option value="in_progress">قيد التنفيذ</option>
                  <option value="resolved">تم الحل</option>
                  <option value="closed">مغلق</option>
                </Select>
                <Select aria-label="تصفية حسب الأولوية" value="all" onChange={() => {}}>
                  <option value="all">كل الأولويات</option>
                  <option value="low">منخفضة</option>
                  <option value="medium">متوسطة</option>
                  <option value="high">عالية</option>
                  <option value="urgent">عاجلة</option>
                </Select>
                <Select aria-label="تصفية حسب العقار" value="" onChange={() => {}}>
                  <option value="">كل العقارات</option>
                  <option value="prop-1">برج النيل</option>
                  <option value="prop-2">مجمع العذيبة</option>
                </Select>
              </>
            }
          />

          <Card>
            <CardHeader>
              <CardTitle>قائمة طلبات الصيانة</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div data-entity-card className="rounded-2xl border p-4">
                <h4 className="font-bold">تسرب مياه في شقة 102</h4>
                <p className="text-sm text-muted-foreground mt-2">حالة: مفتوح - أولوية: عاجلة</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="min-h-11 rounded-xl border bg-background text-sm font-bold">تعديل</button>
                  <button className="min-h-11 rounded-xl border bg-background text-sm font-bold">حل</button>
                </div>
              </div>
              <div data-entity-card className="rounded-2xl border p-4">
                <h4 className="font-bold">عطل مصعد المبنى الرئيسي</h4>
                <p className="text-sm text-muted-foreground mt-2">حالة: قيد التنفيذ - أولوية: عالية</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="min-h-11 rounded-xl border bg-background text-sm font-bold">تعديل</button>
                  <button className="min-h-11 rounded-xl border bg-background text-sm font-bold">حل</button>
                </div>
              </div>
            </CardContent>
          </Card>
        </PageLayout>
      </div>
    </main>
  );
}

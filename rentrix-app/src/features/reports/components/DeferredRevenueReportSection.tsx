import { useState } from 'react';
import { CalendarRange, DollarSign, Layers, Printer, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { getTodayLocalDateString } from '../reports-page.helpers';
import { calculateDeferredRevenueSchedule } from '@/features/financials/reports/deferred-revenue-service';
import { ReportCard } from './common';

const defaultSettings: DocumentSettings = {
  company: {
    name: 'رينتريكس لإدارة العقارات',
    address: 'سلطنة عمان - مسقط',
    phone: '+968 24000000',
  },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

export function DeferredRevenueReportSection({ isLoading }: Readonly<{ isLoading: boolean }>) {
  const todayStr = getTodayLocalDateString();

  const [sampleCollections] = useState([
    {
      contractId: 'c-101',
      tenantName: 'أحمد بن علي البوسعيدي',
      propertyTitle: 'برج النيل المكتبي',
      amount: 1200, // Annual upfront payment
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    },
    {
      contractId: 'c-102',
      tenantName: 'سالم بن حمد الرئيسي',
      propertyTitle: 'مجمع العذيبة السكني',
      amount: 600, // 6-month upfront payment
      startDate: '2026-06-01',
      endDate: '2026-11-30',
    },
  ]);

  const schedule = calculateDeferredRevenueSchedule(sampleCollections, todayStr);

  const handlePrintDeferredReport = () => {
    DocumentTemplates.renderReportPdf(
      {
        reportTitle: 'كشف جدولة وتحقيق الإيرادات المؤجلة (Accrual Deferred Revenue)',
        reportType: 'Deferred_Revenue_Accrual_Schedule',
        periodFrom: todayStr,
        periodTo: todayStr,
        sections: [
          {
            title: 'جدول توزيع استحقاق الدفعات الإيجارية على أشهر العقد',
            rows: schedule.schedules.map((s) => ({
              label: `${s.tenantName} - (${s.propertyTitle})`,
              value: `المقبوض مقدماً: ${s.totalCollected} ر.ع | الإيراد المحقق شهرياً: ${s.recognizedRevenueCurrentMonth} ر.ع | المتبقي التزام إيراد مؤجل: ${s.deferredRevenueRemaining} ر.ع`,
            })),
            totals: [
              'إجمالي الالتزامات المؤجلة',
              `${schedule.totalDeferredLiability.toLocaleString('ar-OM')} ر.ع`,
            ],
          },
        ],
        totalSummary: `إجمالي المقبوضات المسبقة: ${schedule.totalUpfrontCollections} ر.ع | الإيراد المحقق للشهر الحالي: ${schedule.totalRecognizedRevenue} ر.ع | الإيرادات المؤجلة المتبقية: ${schedule.totalDeferredLiability} ر.ع`,
      },
      defaultSettings,
    );
  };

  return (
    <div className="space-y-4">
      <ReportCard
        title="محاسبة الإيرادات المؤجلة والاستحقاق (Accrual Revenue Recognition)"
        description="توزيع التحصيلات الإيجارية المدفوعة مقدماً (سنوية أو ربع سنوية) على أشهر الاستحقاق الفعلية وفق المبادئ المحاسبية المعتمدة."
        action={
          <Button variant="outline" size="sm" onClick={handlePrintDeferredReport} className="min-h-9 gap-1.5 text-xs font-bold">
            <Printer className="size-3.5 text-primary" aria-hidden="true" />
            طباعة جدول الإيرادات المؤجلة A4
          </Button>
        }
        isLoading={isLoading}
      >
        <ResponsiveCardGrid className="p-4" desktopColumns={3}>
          <KpiCard label="إجمالي الدفعات المقبوضة مقدماً" value={formatMoney(schedule.totalUpfrontCollections)} icon={DollarSign} accent="emerald" sub="إيقاعات المقبوضات النقية" />
          <KpiCard label="الإيراد المحقق للشهر الحالي" value={formatMoney(schedule.totalRecognizedRevenue)} icon={CalendarRange} accent="primary" sub="مبدأ الاستحقاق الشهري" />
          <KpiCard label="التزام الإيرادات المؤجلة المتبقية" value={formatMoney(schedule.totalDeferredLiability)} icon={Scale} accent="amber" sub="إلتزام إيراد غير مكتسب" />
        </ResponsiveCardGrid>

        <div className="border-t border-border/70 p-4">
          <p className="mb-3 font-bold text-sm">جدول توزيع الإطفاء الشهري للإيرادات</p>
          <div className="space-y-2">
            {schedule.schedules.map((item) => (
              <div key={item.contractId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background p-3 text-xs">
                <div>
                  <p className="font-bold text-sm">{item.tenantName}</p>
                  <p className="text-muted-foreground">{item.propertyTitle} · فترة العقد: {item.periodStart} إلى {item.periodEnd}</p>
                </div>
                <div className="flex gap-4 text-left">
                  <div>
                    <span className="text-muted-foreground block">المحقق شهرياً</span>
                    <strong className="text-primary font-bold" dir="ltr">{formatMoney(item.recognizedRevenueCurrentMonth)}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">الإيراد المؤجل المتبقي</span>
                    <strong className="text-emerald-600 font-bold" dir="ltr">{formatMoney(item.deferredRevenueRemaining)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ReportCard>
    </div>
  );
}

import { Building2, LineChart, Printer, TrendingUp, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import type { OccupancyChartRow } from '../reports-page.helpers';
import { getTodayLocalDateString } from '../reports-page.helpers';
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

export type PropertyAnalyticsProps = Readonly<{
  occupancyRows: OccupancyChartRow[];
  expenseRows: Array<{ propertyId: string; propertyTitle: string | null; total: number; count: number }>;
  isLoading: boolean;
}>;

export function PropertyAnalyticsSection({ occupancyRows, expenseRows, isLoading }: PropertyAnalyticsProps) {
  const handlePrintPropertyAnalytics = () => {
    const propertyMap = new Map<string, { title: string; occupied: number; vacant: number; expenses: number }>();

    for (const row of occupancyRows) {
      propertyMap.set(row.propertyId, {
        title: row.property,
        occupied: row.occupied,
        vacant: row.vacant,
        expenses: 0,
      });
    }

    for (const exp of expenseRows) {
      const existing = propertyMap.get(exp.propertyId);
      if (existing) {
        existing.expenses = exp.total;
      } else {
        propertyMap.set(exp.propertyId, {
          title: exp.propertyTitle || 'عقار',
          occupied: 0,
          vacant: 0,
          expenses: exp.total,
        });
      }
    }

    const reportRows = Array.from(propertyMap.values()).map((p) => {
      const totalUnits = p.occupied + p.vacant;
      const occRate = totalUnits > 0 ? ((p.occupied / totalUnits) * 100).toFixed(0) : '0';
      return {
        label: p.title,
        value: `الوحدات: ${totalUnits} (${p.occupied} مشغولة / ${p.vacant} شاغرة) | نسبة الإشغال: ${occRate}% | إجمالي المصروفات: ${p.expenses.toLocaleString('ar-OM')} ر.ع`,
      };
    });

    const todayStr = getTodayLocalDateString();

    DocumentTemplates.renderReportPdf(
      {
        reportTitle: 'كشف التحليل التنفيذي واستغلال المحفظة العقارية',
        reportType: 'Property_Portfolio_Executive_Analysis',
        periodFrom: todayStr,
        periodTo: todayStr,
        sections: [
          {
            title: 'جدول أداء واستغلال العقارات ونسب العائد والنفقات',
            rows: reportRows,
          },
        ],
        totalSummary: `إجمالي العقارات المحللة: ${propertyMap.size} عقار | كشف استثماري موثق رسمي مع الاعتماد والتوقيعات`,
      },
      defaultSettings,
    );
  };

  const totalProperties = occupancyRows.length;
  const totalOccupiedUnits = occupancyRows.reduce((acc, r) => acc + r.occupied, 0);
  const totalVacantUnits = occupancyRows.reduce((acc, r) => acc + r.vacant, 0);
  const totalPortfolioUnits = totalOccupiedUnits + totalVacantUnits;
  const overallOccupancyRate = totalPortfolioUnits > 0 ? ((totalOccupiedUnits / totalPortfolioUnits) * 100).toFixed(1) : '0';
  const totalExpensesSum = expenseRows.reduce((acc, r) => acc + r.total, 0);

  return (
    <div className="space-y-4">
      <ReportCard
        title="التحليل التنفيذي للمحفظة العقارية (Property Analytics)"
        description="رصد الأداء المالي والتشغيلي لكل عقار: نسب الإشغال، تكاليف الصيانة، الكفاءة الاستثمارية، وتوزيع النفقات."
        action={
          <Button variant="outline" size="sm" onClick={handlePrintPropertyAnalytics} className="min-h-9 gap-1.5 text-xs font-bold">
            <Printer className="size-3.5 text-primary" aria-hidden="true" />
            طباعة كشف تحليل العقارات التنفيذي A4
          </Button>
        }
        isLoading={isLoading}
      >
        <ResponsiveCardGrid className="p-4" desktopColumns={4}>
          <KpiCard label="عدد العقارات المدارة" value={totalProperties.toLocaleString('ar')} icon={Building2} accent="primary" sub="العقارات الفعالة" />
          <KpiCard label="معدل إشغال المحفظة" value={`${overallOccupancyRate}%`} icon={TrendingUp} accent="emerald" sub={`${totalOccupiedUnits} من أصل ${totalPortfolioUnits} وحدة`} />
          <KpiCard label="الوحدات الشاغرة" value={totalVacantUnits.toLocaleString('ar')} icon={LineChart} accent="amber" sub="متاحة للتأجير" />
          <KpiCard label="إجمالي مصروفات التشغيل" value={formatMoney(totalExpensesSum)} icon={WalletCards} accent="rose" sub="نفقات صيانة وتشغيل" />
        </ResponsiveCardGrid>

        <div className="border-t border-border/70 p-4">
          <p className="mb-3 font-black text-sm">تفاصيل أداء العقارات في المحفظة</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {occupancyRows.map((row) => {
              const totalU = row.occupied + row.vacant;
              const rate = totalU > 0 ? Math.round((row.occupied / totalU) * 100) : 0;
              const propExpense = expenseRows.find((e) => e.propertyId === row.propertyId)?.total ?? 0;

              return (
                <div key={row.propertyId} className="rounded-2xl border border-border bg-background p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                    <span className="font-bold text-sm">{row.property}</span>
                    <span className="text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded-lg">
                      {rate}% إشغال
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                    <div>
                      <span>الوحدات: </span>
                      <strong className="text-foreground">{totalU} ({row.occupied} مؤجرة)</strong>
                    </div>
                    <div>
                      <span>المصروفات: </span>
                      <strong className="text-foreground" dir="ltr">{formatMoney(propExpense)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
            {occupancyRows.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد بيانات عقارية متاحة للتحليل.</p> : null}
          </div>
        </div>
      </ReportCard>
    </div>
  );
}

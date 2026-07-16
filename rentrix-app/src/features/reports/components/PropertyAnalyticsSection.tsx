import { Building2, DoorOpen, Printer, TrendingUp, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import type { OccupancyChartRow } from '../reports-page.helpers';
import { getTodayLocalDateString } from '../reports-page.helpers';
import { ReportList, ReportListRow, ReportPanel, ReportState } from './report-section-primitives';

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
  const expenseByProperty = new Map(expenseRows.map((row) => [row.propertyId, row] as const));
  const totalProperties = occupancyRows.length;
  const totalOccupiedUnits = occupancyRows.reduce((total, row) => total + row.occupied, 0);
  const totalVacantUnits = occupancyRows.reduce((total, row) => total + row.vacant, 0);
  const totalPortfolioUnits = totalOccupiedUnits + totalVacantUnits;
  const overallOccupancyRate = totalPortfolioUnits > 0 ? Math.round((totalOccupiedUnits / totalPortfolioUnits) * 100) : 0;
  const totalExpenses = expenseRows.reduce((total, row) => total + row.total, 0);

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

    for (const expense of expenseRows) {
      const existing = propertyMap.get(expense.propertyId);
      if (existing) existing.expenses = expense.total;
      else {
        propertyMap.set(expense.propertyId, {
          title: expense.propertyTitle || 'عقار',
          occupied: 0,
          vacant: 0,
          expenses: expense.total,
        });
      }
    }

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
            rows: Array.from(propertyMap.values()).map((property) => {
              const units = property.occupied + property.vacant;
              const rate = units > 0 ? Math.round((property.occupied / units) * 100) : 0;
              return {
                label: property.title,
                value: `الوحدات: ${units} (${property.occupied} مشغولة / ${property.vacant} شاغرة) | نسبة الإشغال: ${rate}% | إجمالي المصروفات: ${property.expenses.toLocaleString('ar-OM')} ر.ع`,
              };
            }),
          },
        ],
        totalSummary: `إجمالي العقارات المحللة: ${propertyMap.size} عقار`,
      },
      defaultSettings,
    );
  };

  return (
    <div className="space-y-4">
      <ResponsiveCardGrid>
        <KpiCard label="العقارات المدارة" value={totalProperties.toLocaleString('ar')} icon={Building2} sub={`${totalPortfolioUnits.toLocaleString('ar')} وحدة`} />
        <KpiCard label="إشغال المحفظة" value={`${overallOccupancyRate}%`} icon={TrendingUp} sub={`${totalOccupiedUnits.toLocaleString('ar')} وحدة مشغولة`} />
        <KpiCard label="الوحدات الشاغرة" value={totalVacantUnits.toLocaleString('ar')} icon={DoorOpen} sub="فرص تأجير متاحة" />
        <KpiCard label="مصروفات التشغيل" value={formatMoney(totalExpenses)} icon={WalletCards} sub={`${expenseRows.reduce((total, row) => total + row.count, 0).toLocaleString('ar')} حركة`} />
      </ResponsiveCardGrid>

      <ReportPanel
        title="أداء العقارات"
        description="قراءة موحّدة للإشغال والشواغر والمصروفات لكل عقار."
        icon={Building2}
        action={(
          <Button variant="outline" size="sm" onClick={handlePrintPropertyAnalytics} className="min-h-10 gap-1.5 text-xs">
            <Printer className="size-3.5" aria-hidden="true" />
            طباعة A4
          </Button>
        )}
        isLoading={isLoading}
      >
        {occupancyRows.length === 0 ? (
          <div className="p-4"><ReportState message="لا توجد بيانات عقارية متاحة للتحليل." /></div>
        ) : (
          <ReportList>
            {occupancyRows.map((row) => {
              const units = row.occupied + row.vacant;
              const rate = units > 0 ? Math.round((row.occupied / units) * 100) : 0;
              const expense = expenseByProperty.get(row.propertyId);
              return (
                <ReportListRow
                  key={row.propertyId}
                  title={row.property}
                  subtitle={`${row.occupied.toLocaleString('ar')} مشغولة · ${row.vacant.toLocaleString('ar')} شاغرة · ${expense?.count.toLocaleString('ar') ?? '٠'} مصروفات`}
                  meta={`${units.toLocaleString('ar')} وحدة`}
                  value={(
                    <div className="text-end">
                      <p dir="ltr">{rate}%</p>
                      <p className="mt-1 text-[11px] font-medium text-muted-foreground" dir="ltr">{formatMoney(expense?.total ?? 0)}</p>
                    </div>
                  )}
                />
              );
            })}
          </ReportList>
        )}
      </ReportPanel>
    </div>
  );
}

import { Building2, DoorOpen, Download, Printer, TrendingUp, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { DocumentTemplates, type ReportDocumentData } from '@/services/documents/DocumentTemplates';
import type { OccupancyChartRow } from '../reports-page.helpers';
import { getTodayLocalDateString } from '../reports-page.helpers';
import {
  ReportInsightNote,
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportProgress,
  ReportState,
} from './report-section-primitives';

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
  const expensePerOccupiedUnit = totalOccupiedUnits > 0 ? totalExpenses / totalOccupiedUnits : 0;
  const highestExpenseProperty = [...expenseRows].sort((a, b) => b.total - a.total)[0];
  const highestExpenseShare = highestExpenseProperty && totalExpenses > 0
    ? (highestExpenseProperty.total / totalExpenses) * 100
    : 0;
  const lowestOccupancyProperty = [...occupancyRows]
    .filter((row) => row.occupied + row.vacant > 0)
    .sort((a, b) => (a.occupied / (a.occupied + a.vacant)) - (b.occupied / (b.occupied + b.vacant)))[0];
  const lowestOccupancyRate = lowestOccupancyProperty
    ? (lowestOccupancyProperty.occupied / (lowestOccupancyProperty.occupied + lowestOccupancyProperty.vacant)) * 100
    : 0;

  const { settings: documentSettings, isReady: isDocumentSettingsReady } = useDocumentSettings();
  const currencySymbol = documentSettings.currencySymbol || documentSettings.currency;

  const buildPropertyAnalyticsData = (): ReportDocumentData => {
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
    return {
      reportTitle: 'كشف التحليل التنفيذي واستغلال المحفظة العقارية',
      reportType: 'Property_Portfolio_Executive_Analysis',
      periodFrom: todayStr,
      periodTo: todayStr,
      sections: [
        {
          title: 'جدول أداء واستغلال العقارات ونسب العائد والنفقات',
          columns: ['العقار', 'إجمالي الوحدات', 'المشغولة', 'الشاغرة', 'نسبة الإشغال', 'إجمالي المصروفات'],
          rows: Array.from(propertyMap.values()).map((property) => {
            const units = property.occupied + property.vacant;
            const rate = units > 0 ? Math.round((property.occupied / units) * 100) : 0;
            return [
              property.title,
              units,
              property.occupied,
              property.vacant,
              `${rate}%`,
              `${property.expenses.toLatinLocaleString('ar-OM')} ${currencySymbol}`,
            ];
          }),
        },
      ],
      totalSummary: `إجمالي العقارات: ${propertyMap.size} | إشغال المحفظة: ${overallOccupancyRate}% | المصروف لكل وحدة مشغولة: ${expensePerOccupiedUnit.toLatinLocaleString('ar-OM')} ${currencySymbol}`,
    };
  };

  const handlePrintPropertyAnalytics = async () => {
    try {
      await DocumentTemplates.printReportDocument(buildPropertyAnalyticsData(), documentSettings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذرت طباعة التقرير.');
    }
  };

  const handleDownloadPropertyAnalytics = async () => {
    try {
      await DocumentTemplates.downloadReportPdf(buildPropertyAnalyticsData(), documentSettings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تنزيل ملف PDF.');
    }
  };

  return (
    <div className="space-y-4">
      <ResponsiveCardGrid>
        <KpiCard label="العقارات المدارة" value={totalProperties.toLatinLocaleString('ar')} icon={Building2} sub={`${totalPortfolioUnits.toLatinLocaleString('ar')} وحدة`} />
        <KpiCard label="إشغال المحفظة" value={`${overallOccupancyRate}%`} icon={TrendingUp} sub={`${totalOccupiedUnits.toLatinLocaleString('ar')} وحدة مشغولة`} />
        <KpiCard label="مصروف للوحدة المشغولة" value={formatMoney(expensePerOccupiedUnit)} icon={WalletCards} sub={`${totalExpenses.toLatinLocaleString('ar-OM')} إجمالي المصروفات`} />
        <KpiCard label="الوحدات الشاغرة" value={totalVacantUnits.toLatinLocaleString('ar')} icon={DoorOpen} sub="فرص تأجير متاحة" />
      </ResponsiveCardGrid>

      <div className="grid gap-3 sm:grid-cols-2">
        <ReportProgress
          label="إشغال المحفظة"
          value={overallOccupancyRate}
          helper={`${totalOccupiedUnits.toLatinLocaleString('ar')} من ${totalPortfolioUnits.toLatinLocaleString('ar')} وحدة`}
          tone={overallOccupancyRate >= 90 ? 'good' : overallOccupancyRate >= 75 ? 'warning' : 'critical'}
        />
        <ReportProgress
          label="تركيز التكلفة في أعلى عقار"
          value={highestExpenseShare}
          helper={highestExpenseProperty ? `${highestExpenseProperty.propertyTitle ?? highestExpenseProperty.propertyId} · ${formatMoney(highestExpenseProperty.total)}` : 'لا توجد مصروفات'}
          tone={highestExpenseShare <= 40 ? 'good' : highestExpenseShare <= 60 ? 'warning' : 'critical'}
        />
      </div>

      <ReportInsightNote title="قراءة المحفظة">
        {lowestOccupancyProperty && lowestOccupancyRate < 70
          ? `${lowestOccupancyProperty.property} هو الأقل إشغالًا بنسبة ${Math.round(lowestOccupancyRate)}%؛ ابدأ بمراجعة شواغره وتسعيره وحالته التشغيلية.`
          : highestExpenseShare > 60
            ? 'تكلفة التشغيل متركزة في عقار واحد؛ راجع أسباب المصروفات قبل اعتماد قرارات صيانة أو تسعير جديدة.'
            : 'استغلال المحفظة وتوزيع تكاليفها متوازنان نسبيًا بين العقارات.'}
      </ReportInsightNote>

      <ReportPanel
        title="أداء العقارات"
        description="قراءة موحّدة للإشغال والشواغر والمصروفات لكل عقار."
        eyebrow="مقارنة المحفظة"
        icon={Building2}
        action={(
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={handlePrintPropertyAnalytics} disabled={!isDocumentSettingsReady} className="min-h-10 gap-1.5 text-xs">
              <Printer className="size-3.5" aria-hidden="true" />
              طباعة A4
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPropertyAnalytics} disabled={!isDocumentSettingsReady} className="min-h-10 gap-1.5 text-xs">
              <Download className="size-3.5" aria-hidden="true" />
              تنزيل PDF
            </Button>
          </div>
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
              const propertyExpensePerOccupied = row.occupied > 0 ? (expense?.total ?? 0) / row.occupied : 0;
              return (
                <ReportListRow
                  key={row.propertyId}
                  title={row.property}
                  subtitle={`${row.occupied.toLatinLocaleString('ar')} مشغولة · ${row.vacant.toLatinLocaleString('ar')} شاغرة · ${expense?.count.toLatinLocaleString('ar') ?? '٠'} مصروفات`}
                  meta={`${units.toLatinLocaleString('ar')} وحدة · ${formatMoney(propertyExpensePerOccupied)} للوحدة المشغولة`}
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

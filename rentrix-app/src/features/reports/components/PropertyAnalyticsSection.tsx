import { Building2, Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { documentService } from '@/services/documents/DocumentService';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import { toReportDocumentPayload, type ReportDocumentData } from '@/services/documents/documentPayloadAdapters';
import type { OccupancyChartRow, PropertyPerformanceRow } from '../reports-page.helpers';
import { getTodayLocalDateString } from '../reports-page.helpers';
import {
  ReportInsightNote,
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportProgress,
  ReportState,
  ReportSummaryStrip,
} from './report-section-primitives';
import { formatLatinNumber } from '@/lib/formatters';

export type PropertyAnalyticsProps = Readonly<{
  occupancyRows: OccupancyChartRow[];
  expenseRows: Array<{ propertyId: string; propertyTitle: string | null; total: number; count: number }>;
  performanceRows: readonly PropertyPerformanceRow[];
  isLoading: boolean;
}>;

export function PropertyAnalyticsSection({ occupancyRows, expenseRows, performanceRows, isLoading }: PropertyAnalyticsProps) {
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

  const { companySettings: documentSettings, isReady: isDocumentSettingsReady } = useDocumentSettings();
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
          title: 'تقرير أداء العقارات والوحدات — صف قرار موحّد',
          columns: ['العقار', 'إيجارات العقود حسب دورتها', 'الإشغال', 'أطول شغور', 'المحصّل', 'المتأخر', 'المصروفات', 'صيانة غير مرحلة كمصروف', 'أولوية المتابعة'], 
          rows: (performanceRows.length > 0 ? performanceRows : Array.from(propertyMap.values()).map((property) => {
            const units = property.occupied + property.vacant;
            const rate = units > 0 ? Math.round((property.occupied / units) * 100) : 0;
            return {
              propertyTitle: property.title,
              referenceRevenue: 0,
              occupancyRate: rate,
              occupiedUnits: property.occupied,
              vacantUnits: property.vacant,
              longestVacancyDays: 0,
              collected: 0,
              overdue: 0,
              expenses: property.expenses,
              maintenanceCost: 0,
              openMaintenanceCount: 0,
              priority: 'مستقر' as const,
            };
          })).map((property) => [
            property.propertyTitle,
            `${formatLatinNumber(property.referenceRevenue, 'ar-OM')} ${currencySymbol}`,
            `${Math.round(property.occupancyRate)}% (${property.occupiedUnits}/${property.occupiedUnits + property.vacantUnits})`,
            `${formatLatinNumber(property.longestVacancyDays, 'ar')} يوم`,
            `${formatLatinNumber(property.collected, 'ar-OM')} ${currencySymbol}`,
            `${formatLatinNumber(property.overdue, 'ar-OM')} ${currencySymbol}`,
            `${formatLatinNumber(property.expenses, 'ar-OM')} ${currencySymbol}`,
            `${formatLatinNumber(property.maintenanceCost, 'ar-OM')} ${currencySymbol} / ${formatLatinNumber(property.openMaintenanceCount, 'ar')} مفتوحة`,
            property.priority,
          ]),
        },
      ],
      totalSummary: `إجمالي العقارات: ${propertyMap.size} | إشغال المحفظة: ${overallOccupancyRate}% | المصروف لكل وحدة مشغولة: ${formatLatinNumber(expensePerOccupiedUnit, 'ar-OM')} ${currencySymbol}`,
    };
  };

  const handlePrintPropertyAnalytics = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: () => documentService.printDocument('generic_report', { settings: documentSettings, payload: toReportDocumentPayload(buildPropertyAnalyticsData()) }),
      fallbackMessage: 'تعذرت طباعة التقرير.',
    });
  };

  const handleDownloadPropertyAnalytics = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: () => documentService.downloadDocumentPdf('generic_report', { settings: documentSettings, payload: toReportDocumentPayload(buildPropertyAnalyticsData()) }),
      fallbackMessage: 'تعذر تنزيل ملف PDF.',
    });
  };

  return (
    <div className="space-y-3">
      <ReportSummaryStrip
        dataReportSummary="property-analytics"
        items={[
          { label: 'العقارات المدارة', value: formatLatinNumber(totalProperties, 'ar'), detail: `${formatLatinNumber(totalPortfolioUnits, 'ar')} وحدة` },
          { label: 'إشغال المحفظة', value: `${overallOccupancyRate}%`, detail: `${formatLatinNumber(totalOccupiedUnits, 'ar')} وحدة مشغولة`, tone: overallOccupancyRate < 75 ? 'warning' : undefined },
          { label: 'مصروف للوحدة المشغولة', value: formatMoney(expensePerOccupiedUnit), detail: `${formatLatinNumber(totalExpenses, 'ar-OM')} إجمالي المصروفات` },
          { label: 'الوحدات الشاغرة', value: formatLatinNumber(totalVacantUnits, 'ar'), detail: 'فرص تأجير متاحة' },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <ReportProgress
          label="إشغال المحفظة"
          value={overallOccupancyRate}
          helper={`${formatLatinNumber(totalOccupiedUnits, 'ar')} من ${formatLatinNumber(totalPortfolioUnits, 'ar')} وحدة`}
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
        <p className="mb-2">أولوية المتابعة محسوبة تشغيليًا من ضغط المتأخرات والشغور وطلبات الصيانة المفتوحة وعبء المصروفات؛ ليست درجة خطر مالية أو بديلًا عن القوائم المحاسبية.</p>
        {lowestOccupancyProperty && lowestOccupancyRate < 70
          ? `${lowestOccupancyProperty.property} هو الأقل إشغالًا بنسبة ${Math.round(lowestOccupancyRate)}%؛ ابدأ بمراجعة شواغره وتسعيره وحالته التشغيلية.`
          : highestExpenseShare > 60
            ? 'تكلفة التشغيل متركزة في عقار واحد؛ راجع أسباب المصروفات قبل اعتماد قرارات صيانة أو تسعير جديدة.'
            : 'استغلال المحفظة وتوزيع تكاليفها متوازنان نسبيًا بين العقارات.'}
      </ReportInsightNote>

      <ReportPanel
        title="أداء العقارات والوحدات"
        description="صف قرار واحد لكل عقار: إيجارات العقود حسب دورتها دون تطبيع شهري، الإشغال، الشغور بالأيام، التحصيل الكامل للفترة، المتأخرات، المصروفات، والصيانة غير المرحلة كمصروف."
        eyebrow="تقرير قرار قابل للتصرف"
        icon={Building2}
        action={(
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={handlePrintPropertyAnalytics} disabled={!isDocumentSettingsReady} className="min-h-11 gap-1.5 text-xs">
              <Printer className="size-3.5" aria-hidden="true" />
              طباعة A4
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPropertyAnalytics} disabled={!isDocumentSettingsReady} className="min-h-11 gap-1.5 text-xs">
              <Download className="size-3.5" aria-hidden="true" />
              تنزيل PDF
            </Button>
          </div>
        )}
        isLoading={isLoading}
      >
        {performanceRows.length === 0 && occupancyRows.length === 0 ? (
          <div className="p-4"><ReportState message="لا توجد بيانات عقارية متاحة للتحليل." /></div>
        ) : performanceRows.length > 0 ? (
          <ReportList>
            {performanceRows.map((row) => {
              const priorityTone = row.priority === 'متابعة فورية' ? 'danger' : row.priority === 'مراجعة' ? 'warning' : 'success';
              return (
                <ReportListRow
                  key={row.propertyId}
                  title={row.propertyTitle}
                  subtitle={`إيجارات العقود حسب دورتها ${formatMoney(row.referenceRevenue)} · محصّل الفترة ${formatMoney(row.collected)} · متأخر ${formatMoney(row.overdue)}`}
                  meta={`${formatLatinNumber(row.occupiedUnits, 'ar')} مشغولة / ${formatLatinNumber(row.vacantUnits, 'ar')} شاغرة · أطول شغور ${formatLatinNumber(row.longestVacancyDays, 'ar')} يوم · صيانة مفتوحة ${formatLatinNumber(row.openMaintenanceCount, 'ar')}`}
                  value={(
                    <div className="space-y-1 text-end">
                      <StatusBadge tone={priorityTone}>{row.priority}</StatusBadge>
                      <p className="text-xs font-medium text-muted-foreground" dir="ltr">أولوية {row.riskScore}/100 · {Math.round(row.occupancyRate)}% · مصروفات {formatMoney(row.expenses)}</p>
                    </div>
                  )}
                />
              );
            })}
          </ReportList>
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
                  subtitle={`${formatLatinNumber(row.occupied, 'ar')} مشغولة · ${formatLatinNumber(row.vacant, 'ar')} شاغرة · ${formatLatinNumber(expense?.count ?? 0, 'ar')} مصروفات`}
                  meta={`${formatLatinNumber(units, 'ar')} وحدة · ${formatMoney(propertyExpensePerOccupied)} للوحدة المشغولة`}
                  value={(<div className="text-end"><p dir="ltr">{rate}%</p><p className="mt-1 text-xs font-medium text-muted-foreground" dir="ltr">{formatMoney(expense?.total ?? 0)}</p></div>)}
                />
              );
            })}
          </ReportList>
        )}
      </ReportPanel>
    </div>
  );
}


import { Building2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { DocumentReadinessError, runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import { downloadPropertyReportPdf, printPropertyReport } from '../documents/professional-property-report';
import type { OccupancyChartRow, PropertyPerformanceRow } from '../reports-page.helpers';
import type { ReportDrillHandler } from '../report-workspaces';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import type { ReportsFilterState } from '../reports-workspace-filters';
import {
  ReportInsightNote,
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportProgress,
  ReportState,
  ReportSummaryStrip,
} from '@/components/ui/report-section-primitives';
import { ReportOutputActions } from './report-output-actions';
import { formatLatinNumber } from '@/lib/formatters';

export type PropertyAnalyticsProps = Readonly<{
  occupancyRows: OccupancyChartRow[];
  expenseRows: Array<{ propertyId: string; propertyTitle: string | null; total: number; count: number }>;
  performanceRows: readonly PropertyPerformanceRow[];
  isLoading: boolean;
  onDrill: ReportDrillHandler;
  /** Workspace read model — enables the professional property performance report. */
  model?: ReportsWorkspaceModel | null;
  /** Workspace scope — period, as-of and property selection for the report. */
  filters?: ReportsFilterState | null;
}>;

export function PropertyAnalyticsSection({ occupancyRows, expenseRows, performanceRows, isLoading, onDrill, model, filters }: PropertyAnalyticsProps) {
  const expenseByProperty = new Map(expenseRows.map((row) => [row.propertyId, row] as const));
  const totalProperties = occupancyRows.length;
  const totalOccupiedUnits = occupancyRows.reduce((total, row) => total + row.occupied, 0);
  const totalVacantUnits = occupancyRows.reduce((total, row) => total + row.vacant, 0);
  const totalNonRentableUnits = occupancyRows.reduce((total, row) => total + (row.nonRentable ?? 0), 0);
  const totalPortfolioUnits = totalOccupiedUnits + totalVacantUnits + totalNonRentableUnits;
  const overallOccupancyRate = totalPortfolioUnits > 0 ? Math.round((totalOccupiedUnits / totalPortfolioUnits) * 100) : 0;
  const totalExpenses = expenseRows.reduce((total, row) => total + row.total, 0);
  const expensePerOccupiedUnit = totalOccupiedUnits > 0 ? totalExpenses / totalOccupiedUnits : 0;
  const highestExpenseProperty = [...expenseRows].sort((a, b) => b.total - a.total)[0];
  const highestExpenseShare = highestExpenseProperty && totalExpenses > 0
    ? (highestExpenseProperty.total / totalExpenses) * 100
    : 0;
  const lowestOccupancyProperty = [...occupancyRows]
    .filter((row) => row.occupied + row.vacant + (row.nonRentable ?? 0) > 0)
    .sort((a, b) => {
      const totalA = a.occupied + a.vacant + (a.nonRentable ?? 0);
      const totalB = b.occupied + b.vacant + (b.nonRentable ?? 0);
      return (a.occupied / totalA) - (b.occupied / totalB);
    })[0];
  const lowestOccupancyRate = lowestOccupancyProperty
    ? (lowestOccupancyProperty.occupied / (lowestOccupancyProperty.occupied + lowestOccupancyProperty.vacant + (lowestOccupancyProperty.nonRentable ?? 0))) * 100
    : 0;

  const { companySettings: documentSettings, isReady: isDocumentSettingsReady } = useDocumentSettings();

  const runProfessionalPropertyReport = async (mode: 'print' | 'pdf') => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady && Boolean(model && filters),
      operation: async () => {
        if (!model || !filters) {
          throw new DocumentReadinessError('تعذر إصدار تقرير أداء العقار: نموذج بيانات التقرير غير متاح في هذه الورشة.');
        }
        if (model.isIncomplete) {
          throw new DocumentReadinessError('تعذر إصدار تقرير أداء العقار: مصادر البيانات غير مكتملة. أعد تحديث المصادر ثم أعد المحاولة.');
        }
        if (mode === 'print') {
          await printPropertyReport({ settings: documentSettings, model, filters });
        } else {
          await downloadPropertyReportPdf({ settings: documentSettings, model, filters });
        }
      },
      fallbackMessage: mode === 'print'
        ? 'تعذرت طباعة تقرير أداء العقار.'
        : 'تعذر تنزيل تقرير أداء العقار كملف PDF.',
    });
  };

  const handlePrintProfessionalPropertyReport = () => runProfessionalPropertyReport('print');
  const handleDownloadProfessionalPropertyReport = () => runProfessionalPropertyReport('pdf');

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
        action={model && filters ? (
          <ReportOutputActions
            downloadLabel="تنزيل تقرير العقار PDF"
            menuLabel="خيارات إخراج تقرير العقار"
            onDownloadPdf={handleDownloadProfessionalPropertyReport}
            onPrint={handlePrintProfessionalPropertyReport}
          />
        ) : undefined}
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
                  action={(
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => onDrill('collections', 'overdue', { propertyId: row.propertyId })}
                        className="inline-flex min-h-11 items-center rounded-lg border border-border/70 px-2 text-[11px] font-black text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                      >
                        متأخرات العقار
                      </button>
                      <button
                        type="button"
                        onClick={() => onDrill('leasing', 'occupancy', { propertyId: row.propertyId })}
                        className="inline-flex min-h-11 items-center rounded-lg border border-border/70 px-2 text-[11px] font-black text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                      >
                        الشواغر
                      </button>
                      <button
                        type="button"
                        onClick={() => onDrill('operations', 'maintenance_analytics', { propertyId: row.propertyId })}
                        className="inline-flex min-h-11 items-center rounded-lg border border-border/70 px-2 text-[11px] font-black text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                      >
                        الصيانة
                      </button>
                    </div>
                  )}
                />
              );
            })}
          </ReportList>
        ) : (
          <ReportList>
            {occupancyRows.map((row) => {
              const units = row.occupied + row.vacant + (row.nonRentable ?? 0);
              const rate = units > 0 ? Math.round((row.occupied / units) * 100) : 0;
              const expense = expenseByProperty.get(row.propertyId);
              const propertyExpensePerOccupied = row.occupied > 0 ? (expense?.total ?? 0) / row.occupied : 0;
              return (
                <ReportListRow
                  key={row.propertyId}
                  title={row.property}
                  subtitle={`${formatLatinNumber(row.occupied, 'ar')} مشغولة · ${formatLatinNumber(row.vacant, 'ar')} شاغرة · ${formatLatinNumber(row.nonRentable ?? 0, 'ar')} غير قابلة للتأجير · ${formatLatinNumber(expense?.count ?? 0, 'ar')} مصروفات`}
                  meta={`${formatLatinNumber(units, 'ar')} وحدة · ${formatMoney(propertyExpensePerOccupied)} للوحدة المشغولة`}
                  value={(<div className="text-end"><p dir="ltr">{rate}%</p><p className="mt-1 text-xs font-medium text-muted-foreground" dir="ltr">{formatMoney(expense?.total ?? 0)}</p></div>)}
                  action={(
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => onDrill('leasing', 'occupancy', { propertyId: row.propertyId })}
                        className="inline-flex min-h-11 items-center rounded-lg border border-border/70 px-2 text-[11px] font-black text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                      >
                        الشواغر
                      </button>
                      <button
                        type="button"
                        onClick={() => onDrill('operations', 'expenses', { propertyId: row.propertyId })}
                        className="inline-flex min-h-11 items-center rounded-lg border border-border/70 px-2 text-[11px] font-black text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                      >
                        المصروفات
                      </button>
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

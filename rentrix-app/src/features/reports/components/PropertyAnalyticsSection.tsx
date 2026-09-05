import { Building2, Scale, TrendingUp } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import {
  DocumentReadinessError,
  runGuardedDocumentAction,
} from '@/services/documents/runDocumentAction';
import {
  downloadPropertyReportPdf,
  printPropertyReport,
} from '../documents/professional-property-report';
import type {
  OccupancyChartRow,
  PropertyPerformanceRow,
} from '../reports-page.helpers';
import type { ReportDrillHandler } from '../report-route';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import type { ReportsFilterState } from '../reports-workspace-filters';
import {
  ReportDrillAction,
  ReportInsightNote,
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportProgress,
  ReportState,
  ReportSummaryStrip,
} from '@/components/ui/report-section-primitives';
import { ReportDocumentActions } from './report-document-actions';
import { formatLatinNumber } from '@/lib/formatters';
import {
  buildPropertyAnalyticsBenchmark,
  buildPropertyAnalyticsComparison,
  buildPropertyAnalyticsExecutive,
  buildPropertyAnalyticsInsights,
  perUnit,
  rateOf,
  type MetricValue,
  type PropertyAnalyticsBenchmarkRow,
  type PropertyAnalyticsComparisonRow,
  type PropertyAnalyticsInsight,
  type PropertyExpenseRow,
} from '../property-analytics-model';

/** Unavailable is rendered as an em dash — it is never published as `0`. */
export const UNAVAILABLE = '—';

function metricCount(value: MetricValue): string {
  return value == null ? UNAVAILABLE : formatLatinNumber(value, 'ar');
}

function metricMoney(value: MetricValue): string {
  return value == null ? UNAVAILABLE : formatMoney(value);
}

function metricRate(value: MetricValue): string {
  return value == null ? UNAVAILABLE : `${Math.round(value)}%`;
}

function changeLabel(row: PropertyAnalyticsComparisonRow): string {
  if (row.change == null) return UNAVAILABLE;
  const sign = row.change > 0 ? '+' : '';
  if (row.kind === 'rate') return `${sign}${row.change} نقطة`;
  if (row.kind === 'count')
    return `${sign}${formatLatinNumber(row.change, 'ar')}`;
  return `${sign}${formatMoney(row.change)}`;
}

function changeTone(
  row: PropertyAnalyticsComparisonRow,
): 'success' | 'danger' | 'neutral' {
  if (row.change == null || row.direction === 'flat') return 'neutral';
  const improved = row.higherIsBetter
    ? row.direction === 'up'
    : row.direction === 'down';
  return improved ? 'success' : 'danger';
}

function metricValue(
  value: MetricValue,
  kind: PropertyAnalyticsComparisonRow['kind'],
): string {
  if (value == null) return UNAVAILABLE;
  if (kind === 'rate') return metricRate(value);
  if (kind === 'count') return metricCount(value);
  return metricMoney(value);
}

export type PropertyAnalyticsProps = Readonly<{
  occupancyRows: OccupancyChartRow[];
  expenseRows: PropertyExpenseRow[];
  performanceRows: readonly PropertyPerformanceRow[];
  isLoading: boolean;
  onDrill: ReportDrillHandler;
  /** Workspace read model — enables the professional property performance report. */
  model?: ReportsWorkspaceModel | null;
  /** Workspace scope — period, as-of and property selection for the report. */
  filters?: ReportsFilterState | null;
  /** Deterministic comparison rows (current vs previous comparable period). */
  comparison?: readonly PropertyAnalyticsComparisonRow[];
  /** Portfolio benchmark rows — only meaningful at single-property scope. */
  benchmark?: readonly PropertyAnalyticsBenchmarkRow[];
  /** Deterministic insights explaining already-computed figures. */
  insights?: readonly PropertyAnalyticsInsight[];
  /** Executive summary metrics; recomputed locally when the model is absent. */
  executive?: ReturnType<typeof buildPropertyAnalyticsExecutive>;
  /** Previous comparable period window, for the comparison caption. */
  previousPeriod?: Readonly<{ from: string; to: string }> | null;
}>;

export function PropertyAnalyticsSection({
  occupancyRows,
  expenseRows,
  performanceRows,
  isLoading,
  onDrill,
  model,
  filters,
  comparison,
  benchmark,
  insights,
  executive,
  previousPeriod,
}: PropertyAnalyticsProps) {
  const fallbackInput = {
    occupancyRows,
    expenseRows,
    performanceRows,
    selectedPropertyId: filters?.propertyId || null,
  } as const;
  const summary = executive ?? buildPropertyAnalyticsExecutive(fallbackInput);
  const comparisonRows =
    comparison ?? buildPropertyAnalyticsComparison(fallbackInput);
  const benchmarkRows =
    benchmark ?? buildPropertyAnalyticsBenchmark(fallbackInput);
  const insightRows = insights ?? buildPropertyAnalyticsInsights(fallbackInput);
  const scope = summary.scope;

  const expenseByProperty = new Map(
    expenseRows.map((row) => [row.propertyId, row] as const),
  );
  const totalExpenses = expenseRows.reduce(
    (total, row) => total + row.total,
    0,
  );
  const highestExpenseProperty = [...expenseRows].sort(
    (a, b) => b.total - a.total,
  )[0];
  const highestExpenseShare = highestExpenseProperty
    ? rateOf(highestExpenseProperty.total, totalExpenses)
    : null;

  const {
    companySettings: documentSettings,
    isReady: isDocumentSettingsReady,
  } = useDocumentSettings();

  const runProfessionalPropertyReport = async (mode: 'print' | 'pdf') => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady && Boolean(model && filters),
      operation: async () => {
        if (!model || !filters) {
          throw new DocumentReadinessError(
            'تعذر إصدار تقرير أداء العقار: نموذج بيانات التقرير غير متاح في هذه الورشة.',
          );
        }
        if (model.isIncomplete) {
          throw new DocumentReadinessError(
            'تعذر إصدار تقرير أداء العقار: مصادر البيانات غير مكتملة. أعد تحديث المصادر ثم أعد المحاولة.',
          );
        }
        if (mode === 'print') {
          await printPropertyReport({
            settings: documentSettings,
            model,
            filters,
          });
        } else {
          await downloadPropertyReportPdf({
            settings: documentSettings,
            model,
            filters,
          });
        }
      },
      fallbackMessage:
        mode === 'print'
          ? 'تعذرت طباعة تقرير أداء العقار.'
          : 'تعذر تنزيل تقرير أداء العقار كملف PDF.',
    });
  };

  const handlePrintProfessionalPropertyReport = () =>
    runProfessionalPropertyReport('print');
  const handleDownloadProfessionalPropertyReport = () =>
    runProfessionalPropertyReport('pdf');

  return (
    <div className="space-y-3">
      <ReportSummaryStrip
        dataReportSummary="property-analytics"
        items={[
          {
            label: 'العقارات في النطاق',
            value: metricCount(scope.properties),
            detail: `${metricCount(scope.units)} وحدة`,
          },
          {
            label: 'نسبة الإشغال',
            value: metricRate(scope.occupancyRate),
            detail: `${metricCount(scope.occupied)} مشغولة`,
            tone:
              scope.occupancyRate != null && scope.occupancyRate < 75
                ? 'warning'
                : undefined,
          },
          {
            label: 'وحدات شاغرة',
            value: metricCount(scope.vacant),
            detail: `${metricCount(scope.nonRentable)} غير قابلة للتأجير`,
          },
          {
            label: 'محصّل الفترة',
            value: metricMoney(summary.collected),
            detail: `مستحق ${metricMoney(summary.due)}`,
          },
          {
            label: 'المتأخرات',
            value: metricMoney(summary.overdue),
            detail: 'كما في تاريخ الإعداد',
            tone:
              summary.overdue != null && summary.overdue > 0
                ? 'critical'
                : undefined,
          },
          {
            label: 'المصروفات المسجلة',
            value: metricMoney(summary.expenses),
            detail: `${metricMoney(summary.expensePerOccupiedUnit)} للوحدة المشغولة`,
          },
          {
            label: 'صيانة مفتوحة',
            value: metricCount(summary.openMaintenance),
            detail: `${metricCount(summary.expiringContracts)} عقد ينتهي قريبًا`,
          },
          {
            label: 'قيمة إيجار مرجعية للشواغر',
            value: metricMoney(summary.vacancyReferenceRent),
            detail:
              summary.longestVacancyDays != null
                ? `أطول شغور ${metricCount(summary.longestVacancyDays)} يوم`
                : 'لا شواغر قائمة',
          },
        ]}
      />

      {comparisonRows.length > 0 ? (
        <ReportPanel
          title="ما الذي تغيّر؟"
          description={
            previousPeriod
              ? `مقارنة الفترة الحالية بالفترة السابقة المماثلة (${previousPeriod.from} إلى ${previousPeriod.to}). تغير المعدلات بالنقاط المئوية وتغير المبالغ بالفرق المطلق.`
              : 'مقارنة الفترة الحالية بالفترة السابقة المماثلة. تغير المعدلات بالنقاط المئوية وتغير المبالغ بالفرق المطلق.'
          }
          eyebrow="مقارنة قاطعة"
          icon={TrendingUp}
        >
          <ReportList>
            {comparisonRows.map((row) => (
              <ReportListRow
                key={row.key}
                title={row.label}
                subtitle={`الفترة الحالية ${metricValue(row.current, row.kind)} · الفترة السابقة ${metricValue(row.previous, row.kind)}`}
                value={
                  <StatusBadge tone={changeTone(row)}>
                    {changeLabel(row)}
                  </StatusBadge>
                }
              />
            ))}
          </ReportList>
        </ReportPanel>
      ) : null}

      {benchmarkRows.length > 0 ? (
        <ReportPanel
          title="العقار مقابل بقية المحفظة"
          description="مقارنة العقار المحدد ببقية العقارات المدارة ضمن نفس النطاق ومن نفس مصادر البيانات."
          eyebrow="مرجعية المحفظة"
          icon={Scale}
        >
          <ReportList>
            {benchmarkRows.map((row) => (
              <ReportListRow
                key={row.key}
                title={row.label}
                subtitle={`هذا العقار ${metricValue(row.property, row.kind)}`}
                value={
                  <span dir="ltr">{metricValue(row.portfolio, row.kind)}</span>
                }
                meta="متوسط بقية المحفظة"
              />
            ))}
          </ReportList>
        </ReportPanel>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {scope.occupancyRate != null ? (
          <ReportProgress
            label="نسبة الإشغال"
            value={scope.occupancyRate}
            helper={`${metricCount(scope.occupied)} من ${metricCount(scope.units)} وحدة (مشغولة + شاغرة + غير قابلة للتأجير)`}
            tone={
              scope.occupancyRate >= 90
                ? 'good'
                : scope.occupancyRate >= 75
                  ? 'warning'
                  : 'critical'
            }
          />
        ) : null}
        {highestExpenseShare != null && highestExpenseProperty ? (
          <ReportProgress
            label="تركيز المصروفات في أعلى عقار"
            value={highestExpenseShare}
            helper={`${highestExpenseProperty.propertyTitle ?? highestExpenseProperty.propertyId} · ${formatMoney(highestExpenseProperty.total)}`}
            tone={
              highestExpenseShare <= 40
                ? 'good'
                : highestExpenseShare <= 60
                  ? 'warning'
                  : 'critical'
            }
          />
        ) : null}
      </div>

      <ReportInsightNote title="ما الذي يحتاج انتباهًا؟">
        <ul className="list-inside list-disc space-y-1">
          {insightRows.map((insight) => (
            <li key={insight.key} data-insight-tone={insight.tone}>
              {insight.text}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs">
          أولوية المتابعة ترتيب تشغيلي محسوب من ضغط المتأخرات والشغور والصيانة
          المفتوحة وعبء المصروفات؛ ليست احتمال تعثر ولا بديلًا عن القوائم
          المحاسبية. تكلفة الصيانة غير المرحّلة ضغط تشغيلي وليست مصروفًا ماليًا.
          قيمة الإيجار المرجعية للشواغر ليست إيرادًا ولا ذمة مدينة.
        </p>
      </ReportInsightNote>

      <ReportPanel
        title="أداء العقارات والوحدات"
        description="صف قرار واحد لكل عقار: إيجارات العقود حسب دورتها دون تطبيع شهري، الإشغال، الشغور بالأيام، التحصيل الكامل للفترة، المتأخرات، المصروفات، والصيانة غير المرحّلة كمصروف."
        eyebrow="أين يجب التصرف؟"
        icon={Building2}
        action={
          model && filters ? (
            <ReportDocumentActions
              reportLabel="تقرير أداء العقار"
              layout="compact"
              primaryDownloadLabel="تنزيل تقرير العقار PDF"
              menuLabel="خيارات إخراج تقرير العقار"
              onDownloadPdf={handleDownloadProfessionalPropertyReport}
              onPrint={handlePrintProfessionalPropertyReport}
            />
          ) : undefined
        }
        isLoading={isLoading}
      >
        {performanceRows.length === 0 && occupancyRows.length === 0 ? (
          <div className="p-4">
            <ReportState message="لا توجد بيانات عقارية متاحة للتحليل." />
          </div>
        ) : performanceRows.length > 0 ? (
          <ReportList>
            {performanceRows.map((row) => {
              const priorityTone =
                row.priority === 'متابعة فورية'
                  ? 'danger'
                  : row.priority === 'مراجعة'
                    ? 'warning'
                    : 'success';
              const rowUnits =
                row.occupiedUnits + row.vacantUnits + row.nonRentableUnits;
              const rowOccupancy = rateOf(row.occupiedUnits, rowUnits);
              return (
                <ReportListRow
                  key={row.propertyId}
                  title={row.propertyTitle}
                  subtitle={`إيجارات العقود حسب دورتها ${formatMoney(row.referenceRevenue)} · محصّل الفترة ${formatMoney(row.collected)} · متأخر ${formatMoney(row.overdue)}`}
                  meta={`${formatLatinNumber(row.occupiedUnits, 'ar')} مشغولة / ${formatLatinNumber(row.vacantUnits, 'ar')} شاغرة · أطول شغور ${formatLatinNumber(row.longestVacancyDays, 'ar')} يوم · صيانة مفتوحة ${formatLatinNumber(row.openMaintenanceCount, 'ar')}`}
                  value={
                    <div className="space-y-1 text-end">
                      <StatusBadge tone={priorityTone}>
                        {row.priority}
                      </StatusBadge>
                      <p
                        className="text-xs font-medium text-muted-foreground"
                        dir="ltr"
                      >
                        أولوية {row.riskScore}/100 · {metricRate(rowOccupancy)}{' '}
                        · مصروفات {formatMoney(row.expenses)}
                      </p>
                    </div>
                  }
                  action={
                    <div className="flex flex-wrap gap-1">
                      <ReportDrillAction
                        label="متأخرات العقار"
                        variant="ghost"
                        ariaLabel={`فتح متأخرات ${row.propertyTitle}`}
                        onClick={() =>
                          onDrill('analytics', 'overdue', {
                            propertyId: row.propertyId,
                          })
                        }
                      />
                      <ReportDrillAction
                        label="الشواغر"
                        variant="ghost"
                        ariaLabel={`فتح شواغر ${row.propertyTitle}`}
                        onClick={() =>
                          onDrill('analytics', 'occupancy', {
                            propertyId: row.propertyId,
                          })
                        }
                      />
                      <ReportDrillAction
                        label="الصيانة"
                        variant="ghost"
                        ariaLabel={`فتح صيانة ${row.propertyTitle}`}
                        onClick={() =>
                          onDrill('analytics', 'maintenance_analytics', {
                            propertyId: row.propertyId,
                          })
                        }
                      />
                    </div>
                  }
                />
              );
            })}
          </ReportList>
        ) : (
          <ReportList>
            {occupancyRows.map((row) => {
              const units = row.occupied + row.vacant + (row.nonRentable ?? 0);
              const rate = rateOf(row.occupied, units);
              const expense = expenseByProperty.get(row.propertyId);
              const propertyExpensePerOccupied = perUnit(
                expense?.total ?? null,
                row.occupied,
              );
              return (
                <ReportListRow
                  key={row.propertyId}
                  title={row.property}
                  subtitle={`${formatLatinNumber(row.occupied, 'ar')} مشغولة · ${formatLatinNumber(row.vacant, 'ar')} شاغرة · ${formatLatinNumber(row.nonRentable ?? 0, 'ar')} غير قابلة للتأجير · ${formatLatinNumber(expense?.count ?? 0, 'ar')} مصروفات`}
                  meta={`${formatLatinNumber(units, 'ar')} وحدة · ${metricMoney(propertyExpensePerOccupied)} للوحدة المشغولة`}
                  value={
                    <div className="text-end">
                      <p dir="ltr">{metricRate(rate)}</p>
                      <p
                        className="mt-1 text-xs font-medium text-muted-foreground"
                        dir="ltr"
                      >
                        {expense ? formatMoney(expense.total) : UNAVAILABLE}
                      </p>
                    </div>
                  }
                  action={
                    <div className="flex flex-wrap gap-1">
                      <ReportDrillAction
                        label="الشواغر"
                        variant="ghost"
                        ariaLabel={`فتح شواغر ${row.property}`}
                        onClick={() =>
                          onDrill('analytics', 'occupancy', {
                            propertyId: row.propertyId,
                          })
                        }
                      />
                      <ReportDrillAction
                        label="المصروفات"
                        variant="ghost"
                        ariaLabel={`فتح مصروفات ${row.property}`}
                        onClick={() =>
                          onDrill('analytics', 'expenses', {
                            propertyId: row.propertyId,
                          })
                        }
                      />
                    </div>
                  }
                />
              );
            })}
          </ReportList>
        )}
      </ReportPanel>
    </div>
  );
}

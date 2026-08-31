import { Gauge, LayoutDashboard } from 'lucide-react';
import { formatDate, formatMoney } from '@/features/financials/components/financials-formatters';
import type {
  CollectionSummaryReport,
  ExpenseBreakdownPropertyRow,
  FinancialPeriodSummaryReport,
} from '@/features/financials/reports/financial-reporting/report-types';
import type { ArrearsSummaryReport } from '@/features/financials/reports/arrears-reports-service';
import type { MaintenanceSummary } from '@/features/maintenance/maintenance-helpers';
import { formatLatinNumber } from '@/lib/formatters';
import { buildExecutiveHealthInsights } from '../reports-insights';
import { OperationalPrioritiesPanel } from './OperationalPrioritiesPanel';
import type { ExpiringContractRow, OccupancyChartRow } from '../reports-page.helpers';
import { buildReportCsvFilename, toFinancialSummaryCsv } from '../reports-page.helpers';
import type { ReportDrillHandler } from '../report-workspaces';
import { ReportShareActions } from './ReportShareActions';
import {
  ReportDrillAction,
  ReportInsightNote,
  ReportPanel,
  ReportProgress,
  ReportSummaryStrip,
  type ReportSummaryItem,
} from '@/components/ui/report-section-primitives';

type OverviewSectionProps = Readonly<{
  summary: FinancialPeriodSummaryReport | undefined;
  collectionSummary: CollectionSummaryReport | undefined;
  /** Server-authoritative realization rate. Never derived from period cash here. */
  collectionRate: number | undefined;
  occupancyRows: readonly OccupancyChartRow[];
  expiringRows: readonly ExpiringContractRow[];
  expenseRows: ExpenseBreakdownPropertyRow[];
  overdueSummary: ArrearsSummaryReport | undefined;
  maintenanceSummary: MaintenanceSummary;
  /** Active report scope, used only to build canonical share/export targets. */
  from: string;
  to: string;
  canExportReports: boolean;
  isLoading: boolean;
  onDrill: ReportDrillHandler;
}>;

/**
 * أداء المكتب — the office decision surface.
 *
 * It answers exactly one question: *what deserves my attention across the
 * office right now?* It is deliberately NOT a second dashboard and NOT a
 * report of its own:
 *
 *   - it summarizes (one quiet authoritative strip, no KPI card grid),
 *   - it reads (one executive note plus four portfolio ratios),
 *   - it routes (the priority queue opens the workspace that owns the detail).
 *
 * Detail that another workspace owns — receipt lists, per-property expense
 * tables, aging tables — is never repeated here.
 *
 * Financial authority is untouched. Nothing on this surface recomputes a
 * financial truth: the collection rate is the server-authoritative value,
 * `outstanding` and `overdue` stay two different figures with two different
 * meanings, posted expenses are never netted into a profit, and occupancy is
 * read from the canonical occupancy rows exactly as provided.
 */
export function OverviewSection({
  summary,
  collectionSummary,
  collectionRate,
  occupancyRows,
  expiringRows,
  expenseRows,
  overdueSummary,
  maintenanceSummary,
  from,
  to,
  canExportReports,
  isLoading,
  onDrill,
}: OverviewSectionProps) {
  const emptySummary = {
    invoiced: 0,
    paid: 0,
    outstanding: 0,
    expenses: 0,
    netCash: 0,
    invoicesCount: 0,
    paymentsCount: 0,
    expensesCount: 0,
  };
  const report = summary ?? emptySummary;

  // Occupancy semantics are consumed, not decided here. Preserve the canonical
  // three-way leasing classification: available is vacant; maintenance/reserved
  // remain non-rentable and stay inside the total-unit denominator.
  const occupancy = occupancyRows.reduce(
    (totals, row) => ({
      occupied: totals.occupied + row.occupied,
      vacant: totals.vacant + row.vacant,
      nonRentable: totals.nonRentable + (row.nonRentable ?? 0),
    }),
    { occupied: 0, vacant: 0, nonRentable: 0 },
  );
  const totalUnits = occupancy.occupied + occupancy.vacant + occupancy.nonRentable;
  const occupancyRate = totalUnits > 0 ? (occupancy.occupied / totalUnits) * 100 : 0;

  const invoiced = collectionSummary?.invoiced ?? report.invoiced;
  const paid = collectionSummary?.paid ?? report.paid;
  const outstanding = collectionSummary?.outstanding ?? report.outstanding;

  // outstanding ≠ overdue. `outstanding` is every uncollected obligation in the
  // period (current + late); `overdue` is only what passed its due date and is
  // owned by the arrears summary. When arrears are unavailable the figure is
  // reported as unavailable — the outstanding balance is never substituted for
  // it, because that would silently relabel current receivables as late.
  const hasOverdueAuthority = overdueSummary !== undefined;
  const overdueTotal = overdueSummary?.totalOverdue ?? 0;

  const expensesTotal = expenseRows.reduce((total, row) => total + row.total, 0);
  const openMaintenance = (maintenanceSummary.open ?? 0) + (maintenanceSummary.inProgress ?? 0);

  const hasCollectionRate = typeof collectionRate === 'number' && Number.isFinite(collectionRate);
  const collectionRateLabel = hasCollectionRate
    ? `${formatLatinNumber(Math.round(collectionRate), 'ar')}%`
    : 'غير متاحة';

  const insights = buildExecutiveHealthInsights({
    collectionRate: hasCollectionRate ? collectionRate : 0,
    invoiced,
    paid,
    outstanding,
    expenses: collectionSummary?.expensesTotal ?? report.expenses,
    occupiedUnits: occupancy.occupied,
    totalUnits,
  });
  const collectionInsight = insights[0];
  const expenseInsight = insights[1];

  // `buildExecutiveHealthInsights` returns the four canonical ratios in a fixed
  // order with collection efficiency first. When the authoritative rate is
  // unavailable that ratio is dropped rather than published as a 0% nobody
  // measured; the executive note states why.
  const healthRatios = hasCollectionRate ? insights : insights.slice(1);

  const executiveSummary = !hasCollectionRate
    ? 'مؤشر كفاءة التحصيل المعتمد غير متاح حاليًا؛ اقرأ المستحق والمحصّل والمتبقي كما هي دون افتراض نسبة بديلة.'
    : collectionInsight?.tone === 'critical'
      ? 'كفاءة التحصيل منخفضة وتحتاج مراجعة قائمة المتابعة وترتيب أولوية التواصل.'
      : expenseInsight?.tone === 'critical'
        ? 'المصروفات المسجلة مرتفعة مقارنة بالتحصيلات في هذا العرض التشغيلي؛ راجع التصنيفات والعقارات الأعلى تكلفة قبل استنتاج الربحية.'
        : 'المؤشرات التشغيلية الأساسية مستقرة؛ تابع التحصيل والإشغال، وافتح المراجعة المالية المتقدمة عند الحاجة إلى تحليل محاسبي أعمق.';

  /**
   * One compact strip instead of a grid of clickable KPI cards. Each figure
   * carries the label that keeps its meaning unambiguous — especially the two
   * receivable figures, which are neither interchangeable nor additive.
   */
  const summaryItems: readonly ReportSummaryItem[] = [
    {
      label: 'المستحق للفترة',
      value: formatMoney(invoiced),
      detail: `${formatLatinNumber(collectionSummary?.invoicesCount ?? report.invoicesCount, 'ar')} فاتورة`,
    },
    {
      label: 'المحصّل',
      value: formatMoney(paid),
      detail: `كفاءة التحصيل ${collectionRateLabel}`,
      tone: 'good',
    },
    {
      label: 'المتبقي',
      value: formatMoney(outstanding),
      detail: 'يشمل الجاري والمتأخر',
      tone: 'warning',
    },
    {
      label: 'المتأخر',
      value: hasOverdueAuthority ? formatMoney(overdueTotal) : '—',
      detail: hasOverdueAuthority
        ? `تجاوز تاريخ استحقاقه حتى ${formatDate(overdueSummary.asOf)}`
        : 'مؤشر المتأخرات غير متاح',
      tone: hasOverdueAuthority && overdueTotal > 0 ? 'critical' : 'default',
    },
    {
      label: 'نسبة الإشغال',
      value: `${formatLatinNumber(Math.round(occupancyRate), 'ar')}%`,
      detail: `${formatLatinNumber(occupancy.occupied, 'ar')} مشغولة من ${formatLatinNumber(totalUnits, 'ar')}`,
    },
    {
      label: 'المصروفات المسجلة',
      value: formatMoney(expensesTotal),
      detail: 'سندات مصروفات — ليست قائمة دخل',
    },
  ];

  const financialSummaryRows = toFinancialSummaryCsv(report);

  return (
    <div className="space-y-4">
      <ReportPanel
        title="خلاصة المكتب"
        description="أرقام الفترة كما تعتمدها مصادرها — بلا إعادة احتساب هنا وبلا تكرار لجداول ورش العمل المالكة لها."
        eyebrow="القراءة التنفيذية"
        icon={LayoutDashboard}
        isLoading={isLoading}
        action={canExportReports ? (
          <ReportShareActions
            className="flex flex-wrap gap-2"
            reportLabel="خلاصة أداء المكتب"
            target={{
              section: 'analytics',
              view: 'overview',
              filters: {
                from,
                to,
                asOf: to,
                propertyId: '',
                unitId: '',
                tenantId: '',
                ownerId: '',
                contractId: '',
              },
            }}
            summaryText={`المستحق ${formatMoney(invoiced)} | المحصّل ${formatMoney(paid)} | المتبقي ${formatMoney(outstanding)} | كفاءة التحصيل ${collectionRateLabel}`}
            csv={{ filename: buildReportCsvFilename('financial-summary'), rows: financialSummaryRows }}
          />
        ) : null}
      >
        <div className="px-4 pb-4 pt-3 sm:px-5">
          <ReportSummaryStrip dataReportSummary="office-overview" items={summaryItems} />
        </div>
        <div className="px-4 pb-4 sm:px-5">
          <ReportInsightNote title="الخلاصة التنفيذية">{executiveSummary}</ReportInsightNote>
        </div>
      </ReportPanel>

      <OperationalPrioritiesPanel
        overdueTotal={hasOverdueAuthority ? overdueTotal : 0}
        overdueAsOf={overdueSummary?.asOf}
        vacantUnits={occupancy.vacant}
        expiringContracts={expiringRows.length}
        openMaintenance={openMaintenance}
        isLoading={isLoading}
        onDrill={onDrill}
      />

      <ReportPanel
        title="صحة المحفظة"
        description="أربع نسب تلخص التحصيل والتكلفة والإشغال وانكشاف الذمم — للقراءة فقط، والتفاصيل في ورشة العمل المختصة."
        eyebrow="نسب معتمدة"
        icon={Gauge}
        isLoading={isLoading}
        action={(
          <ReportDrillAction
            label="التحصيل والمتأخرات"
            onClick={() => onDrill('collections', 'collections')}
          />
        )}
      >
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          {healthRatios.map((insight) => (
            <ReportProgress
              key={insight.label}
              label={insight.label}
              value={insight.value}
              helper={insight.helper}
              tone={insight.tone}
            />
          ))}
        </div>
      </ReportPanel>
    </div>
  );
}

import { AlertTriangle, ArrowLeft, Building2, FileSpreadsheet, FileText, Gauge, LayoutDashboard, ReceiptText, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate, formatMoney } from '@/features/financials/components/financials-formatters';
import type {
  CollectionSummaryReport,
  ExpenseBreakdownPropertyRow,
  FinancialPeriodSummaryReport,
} from '@/features/financials/reports/financial-reporting/report-types';
import type { ArrearsSummaryReport } from '@/features/financials/reports/arrears-reports-service';
import type { MaintenanceSummary } from '@/features/maintenance/maintenance-helpers';
import { formatLatinNumber } from '@/lib/formatters';
import { csvRowsToXlsxBlob, downloadBlob, xlsxFilenameFromCsv } from '@/lib/tabular-export';
import { buildExecutiveHealthInsights } from '../reports-insights';
import { OperationalPrioritiesPanel } from './OperationalPrioritiesPanel';
import type { ExpiringContractRow, OccupancyChartRow } from '../reports-page.helpers';
import { buildReportCsvFilename, createReceiptPrintHref, downloadCsv, toFinancialSummaryCsv } from '../reports-page.helpers';
import type { ReportDrillHandler } from '../report-workspaces';
import {
  ReportInsightNote,
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportProgress,
  ReportState,
  ReportSummaryStrip,
} from '@/components/ui/report-section-primitives';

type ReceiptRow = Readonly<{
  id: string;
  receipt_number: string;
  payment_date: string;
  amount: number;
  tenant_name: string | null;
}>;

type OverviewSectionProps = Readonly<{
  summary: FinancialPeriodSummaryReport | undefined;
  collectionSummary: CollectionSummaryReport | undefined;
  collectionRate: number;
  cashflowRows: ReadonlyArray<Readonly<{ month: string; revenue: number; expenses: number }>>;
  receiptRows: readonly ReceiptRow[];
  occupancyRows: readonly OccupancyChartRow[];
  expiringRows: readonly ExpiringContractRow[];
  expenseRows: ExpenseBreakdownPropertyRow[];
  overdueSummary: ArrearsSummaryReport | undefined;
  maintenanceSummary: MaintenanceSummary;
  canExportReports: boolean;
  isLoading: boolean;
  onDrill: ReportDrillHandler;
}>;

type LaunchKpi = Readonly<{
  key: string;
  label: string;
  value: string;
  detail: string;
  icon: typeof LayoutDashboard;
  tone?: 'default' | 'warning' | 'critical' | 'good';
  workspace: Parameters<ReportDrillHandler>[0];
  view?: Parameters<ReportDrillHandler>[1];
}>;

/**
 * أداء المكتب — an executive launchpad, deliberately NOT a second dashboard.
 * Every KPI is a doorway into the workspace that owns the detail; the
 * destination tables are never repeated here. Summary → insight →
 * drill-through.
 */
export function OverviewSection({
  summary,
  collectionSummary,
  collectionRate,
  receiptRows,
  occupancyRows,
  expiringRows,
  expenseRows,
  overdueSummary,
  maintenanceSummary,
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
  const occupancy = occupancyRows.reduce(
    (totals, row) => ({
      occupied: totals.occupied + row.occupied,
      vacant: totals.vacant + row.vacant,
    }),
    { occupied: 0, vacant: 0 },
  );
  const totalUnits = occupancy.occupied + occupancy.vacant;
  const occupancyRate = totalUnits > 0 ? (occupancy.occupied / totalUnits) * 100 : 0;
  const overdueTotal = overdueSummary?.totalOverdue ?? report.outstanding;
  const expensesTotal = expenseRows.reduce((total, row) => total + row.total, 0);
  const openMaintenance = (maintenanceSummary.open ?? 0) + (maintenanceSummary.inProgress ?? 0);
  const latestReceipts = receiptRows.slice(0, 4);
  const insights = buildExecutiveHealthInsights({
    collectionRate,
    invoiced: collectionSummary?.invoiced ?? report.invoiced,
    paid: collectionSummary?.paid ?? report.paid,
    outstanding: collectionSummary?.outstanding ?? report.outstanding,
    expenses: collectionSummary?.expensesTotal ?? report.expenses,
    occupiedUnits: occupancy.occupied,
    totalUnits,
  });
  const collectionInsight = insights[0];
  const expenseInsight = insights[1];

  const kpis: readonly LaunchKpi[] = [
    {
      key: 'invoiced',
      label: 'المستحق للفترة',
      value: formatMoney(collectionSummary?.invoiced ?? report.invoiced),
      detail: `${formatLatinNumber(collectionSummary?.invoicesCount ?? report.invoicesCount, 'ar')} فاتورة`,
      icon: ReceiptText,
      workspace: 'collections',
      view: 'collections',
    },
    {
      key: 'paid',
      label: 'المحصّل',
      value: formatMoney(collectionSummary?.paid ?? report.paid),
      detail: `كفاءة ${Number.isFinite(collectionRate) ? Math.round(collectionRate) : 0}%`,
      icon: ReceiptText,
      tone: 'good',
      workspace: 'collections',
      view: 'collections',
    },
    {
      key: 'outstanding',
      label: 'المتبقي',
      value: formatMoney(collectionSummary?.outstanding ?? report.outstanding),
      detail: 'مستحق غير محصّل',
      icon: ReceiptText,
      tone: 'warning',
      workspace: 'collections',
      view: 'collections',
    },
    {
      key: 'overdue',
      label: 'المتأخر',
      value: formatMoney(overdueTotal),
      detail: overdueSummary ? `حتى ${formatDate(overdueSummary.asOf)}` : 'حتى تاريخ اليوم',
      icon: AlertTriangle,
      tone: overdueTotal > 0 ? 'critical' : 'default',
      workspace: 'collections',
      view: 'overdue',
    },
    {
      key: 'occupancy',
      label: 'نسبة الإشغال',
      value: `${Math.round(occupancyRate)}%`,
      detail: `${formatLatinNumber(occupancy.occupied, 'ar')} مشغولة من ${formatLatinNumber(totalUnits, 'ar')}`,
      icon: Building2,
      workspace: 'leasing',
      view: 'occupancy',
    },
    {
      key: 'vacant',
      label: 'وحدات شاغرة',
      value: formatLatinNumber(occupancy.vacant, 'ar'),
      detail: 'تحتاج تأجيرًا أو متابعة',
      icon: Building2,
      tone: occupancy.vacant > 0 ? 'warning' : 'default',
      workspace: 'leasing',
      view: 'occupancy',
    },
    {
      key: 'expiring',
      label: 'عقود قريبة من الانتهاء',
      value: formatLatinNumber(expiringRows.length, 'ar'),
      detail: 'خلال 60 يومًا',
      icon: FileText,
      tone: expiringRows.length > 0 ? 'warning' : 'default',
      workspace: 'leasing',
      view: 'expiring',
    },
    {
      key: 'expenses',
      label: 'المصروفات المسجلة',
      value: formatMoney(expensesTotal),
      detail: 'من سندات المصروفات',
      icon: FileSpreadsheet,
      workspace: 'operations',
      view: 'expenses',
    },
    {
      key: 'maintenance',
      label: 'صيانة مفتوحة',
      value: formatLatinNumber(openMaintenance, 'ar'),
      detail: 'مفتوحة أو قيد التنفيذ',
      icon: Wrench,
      tone: openMaintenance > 0 ? 'warning' : 'default',
      workspace: 'operations',
      view: 'maintenance_analytics',
    },
  ];

  const financialSummaryRows = toFinancialSummaryCsv(report);
  const financialSummaryCsvFilename = buildReportCsvFilename('financial-summary');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-bold leading-5 text-muted-foreground">
          القراءة التنفيذية لهذه الفترة — كل مؤشر يفتح ورشة العمل المختصة به بالتفاصيل الكاملة.
        </p>
        {canExportReports ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11 shrink-0 gap-2 text-xs"
              onClick={() => downloadBlob(csvRowsToXlsxBlob(financialSummaryRows, 'الملخص المالي'), xlsxFilenameFromCsv(financialSummaryCsvFilename))}
            >
              <FileSpreadsheet className="size-4" aria-hidden="true" />
              Excel
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 shrink-0 gap-2 text-xs"
              onClick={() => downloadCsv(financialSummaryCsvFilename, financialSummaryRows)}
            >
              <FileText className="size-4" aria-hidden="true" />
              CSV
            </Button>
          </div>
        ) : null}
      </div>

      <ReportPanel
        title="مؤشرات المكتب"
        description="المستحق والمحصّل والمتبقي والمتأخر والإشغال والمصروفات والصيانة — بلا جداول مكررة هنا."
        eyebrow="خلاصة الفترة"
        icon={LayoutDashboard}
        isLoading={isLoading}
      >
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 sm:p-5">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <button
                key={kpi.key}
                type="button"
                onClick={() => onDrill(kpi.workspace, kpi.view)}
                className="group flex min-h-24 items-start justify-between gap-2 rounded-xl border border-border/70 bg-background p-3.5 text-start transition-colors hover:border-primary/30 hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    {kpi.label}
                  </span>
                  <span className="mt-1.5 block truncate text-lg font-black tabular-nums text-foreground">{kpi.value}</span>
                  <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted-foreground">{kpi.detail}</span>
                </span>
                <ArrowLeft className="mt-1 size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary rtl:rotate-180" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </ReportPanel>

      <OperationalPrioritiesPanel
        overdueTotal={overdueTotal}
        overdueAsOf={overdueSummary?.asOf}
        vacantUnits={occupancy.vacant}
        expiringContracts={expiringRows.length}
        openMaintenance={openMaintenance}
        isLoading={isLoading}
        onDrill={onDrill}
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <ReportPanel
          title="صحة المحفظة"
          description="أربع نسب تلخص التحصيل والتكلفة والإشغال وانكشاف المتأخرات."
          eyebrow="قراءة تنفيذية"
          icon={Gauge}
          className="lg:col-span-7"
          isLoading={isLoading}
        >
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {insights.map((insight) => (
              <ReportProgress
                key={insight.label}
                label={insight.label}
                value={insight.value}
                helper={insight.helper}
                tone={insight.tone}
              />
            ))}
          </div>
          <div className="px-4 pb-4">
            <ReportInsightNote title="الخلاصة التنفيذية">
              {collectionInsight?.tone === 'critical'
                ? 'كفاءة التحصيل منخفضة وتحتاج مراجعة قائمة المتابعة وترتيب أولوية التواصل.'
                : expenseInsight?.tone === 'critical'
                  ? 'المصروفات المسجلة مرتفعة مقارنة بالتحصيلات في هذا العرض التشغيلي؛ راجع التصنيفات والعقارات الأعلى تكلفة قبل استنتاج الربحية.'
                  : 'المؤشرات التشغيلية الأساسية مستقرة؛ تابع التحصيل والإشغال، وافتح المراجعة المالية المتقدمة عند الحاجة إلى تحليل محاسبي أعمق.'}
            </ReportInsightNote>
          </div>
        </ReportPanel>

        <ReportPanel
          title="آخر التحصيلات"
          description="أحدث الإيصالات المنشورة داخل النطاق المحدد."
          eyebrow="حركة حديثة"
          icon={ReceiptText}
          className="lg:col-span-5"
          isLoading={isLoading}
          action={(
            <button
              type="button"
              onClick={() => onDrill('collections', 'collection_movement')}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border/70 px-2.5 text-xs font-black text-primary transition-colors hover:bg-primary/[0.025]"
            >
              حركة التحصيل
              <ArrowLeft className="size-3.5" aria-hidden="true" />
            </button>
          )}
        >
          {latestReceipts.length === 0 ? (
            <div className="p-4">
              <ReportState message="لا توجد تحصيلات حديثة داخل الفترة." />
            </div>
          ) : (
            <ReportList>
              {latestReceipts.map((receipt) => (
                <ReportListRow
                  key={receipt.id}
                  title={(
                    <a className="hover:text-primary hover:underline" href={createReceiptPrintHref(receipt.id)}>
                      {receipt.tenant_name || 'مستأجر غير مسمى'}
                    </a>
                  )}
                  subtitle={`إيصال ${receipt.receipt_number}`}
                  meta={formatDate(receipt.payment_date)}
                  value={<span dir="ltr">{formatMoney(receipt.amount)}</span>}
                />
              ))}
            </ReportList>
          )}
        </ReportPanel>
      </div>

      <ReportPanel
        title="أعلى العقارات مصروفات"
        description="أعلى ثلاثة عقارات في المصروفات المسجلة لهذه الفترة — افتح أي عقار في ورشة العقارات والوحدات."
        eyebrow="تركيز التكلفة"
        icon={Building2}
        isLoading={isLoading}
      >
        {expenseRows.length === 0 ? (
          <div className="p-4">
            <ReportState message="لا توجد مصروفات مسجلة خلال الفترة." />
          </div>
        ) : (
          <div className="px-4 pb-4 pt-2 sm:px-5">
            <ReportSummaryStrip
              dataReportSummary="office-top-cost-properties"
              items={[...expenseRows]
                .sort((a, b) => b.total - a.total)
                .slice(0, 3)
                .map((row) => ({
                  label: row.propertyTitle ?? 'عقار غير محدد',
                  value: formatMoney(row.total),
                  detail: `${formatLatinNumber(row.count, 'ar')} حركة`,
                  tone: 'warning' as const,
                }))}
            />
            <div className="mt-3">
              <button
                type="button"
                onClick={() => onDrill('properties')}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border/70 px-2.5 text-xs font-black text-primary transition-colors hover:bg-primary/[0.025]"
              >
                فتح العقارات والوحدات
                <ArrowLeft className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </ReportPanel>
    </div>
  );
}

import { BarChart3, FileSpreadsheet, FileText, Gauge, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate, formatMoney } from '@/features/financials/components/financials-formatters';
import {
  useCollectionSummaryReport,
  useFinancialCashflowReport,
  useFinancialPeriodSummaryReport,
} from '@/features/financials/reports/useFinancialReports';
import { csvRowsToXlsxBlob, downloadBlob, xlsxFilenameFromCsv } from '@/lib/tabular-export';
import { buildExecutiveHealthInsights } from '../reports-insights';
import { buildReportCsvFilename, createReceiptPrintHref, downloadCsv, toFinancialSummaryCsv } from '../reports-page.helpers';
import { ReportBarChart, type ReportBarSeries } from './charts/report-bar-chart';
import {
  ReportInsightNote,
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportProgress,
  ReportState,
} from './report-section-primitives';

/** Operating cash comparison series — labels only, values come from the report. */
const CASHFLOW_CHART_SERIES = [
  { dataKey: 'revenue', name: 'المحصّل', tone: 'primary' },
  { dataKey: 'expenses', name: 'المصروفات', tone: 'negative' },
] as const satisfies readonly ReportBarSeries[];

type ReceiptRow = Readonly<{
  id: string;
  receipt_number: string;
  payment_date: string;
  amount: number;
  tenant_name: string | null;
}>;

type OccupancyRow = Readonly<{
  property: string;
  occupied: number;
  vacant: number;
}>;

export function OverviewSection({
  summary,
  collectionSummary,
  collectionRate,
  cashflowRows,
  receiptRows,
  occupancyRows,
  canExportReports,
  isLoading,
}: Readonly<{
  summary: NonNullable<ReturnType<typeof useFinancialPeriodSummaryReport>['data']> | undefined;
  collectionSummary: NonNullable<ReturnType<typeof useCollectionSummaryReport>['data']> | undefined;
  collectionRate: number;
  cashflowRows: NonNullable<ReturnType<typeof useFinancialCashflowReport>['data']>['rows'];
  receiptRows: readonly ReceiptRow[];
  occupancyRows: readonly OccupancyRow[];
  canExportReports: boolean;
  isLoading: boolean;
}>) {
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
  const financialSummaryRows = toFinancialSummaryCsv(report);
  const financialSummaryCsvFilename = buildReportCsvFilename('financial-summary');

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <ReportPanel
        title="التحصيل والمصروفات المسجلة"
        description="مقارنة تشغيلية بين التحصيلات والمصروفات المسجلة شهرًا بشهر. تعرض النتيجة المفهومة هنا، وتبقى التفاصيل المالية والرقابية في طبقتها المتخصصة عند الحاجة."
        eyebrow="حركة تشغيلية"
        icon={BarChart3}
        className="lg:col-span-7"
        action={canExportReports ? (
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
        ) : undefined}
        isLoading={isLoading}
      >
        {cashflowRows.length === 0 ? (
          <div className="p-4 sm:p-5">
            <ReportState
              title="لا توجد حركة تشغيلية شهرية كافية"
              message="وسّع الفترة أو أضف تحصيلات ومصروفات لعرض المقارنة التشغيلية."
            />
          </div>
        ) : (
          <div className="p-3 sm:p-5">
            <ReportBarChart
              data={cashflowRows}
              series={CASHFLOW_CHART_SERIES}
              xKey="month"
              ariaLabel="مقارنة المحصّل والمصروفات الشهرية"
            />
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <MiniSummary label="الفواتير" value={formatMoney(collectionSummary?.invoiced ?? report.invoiced)} />
              <MiniSummary label="المحصّل" value={formatMoney(collectionSummary?.paid ?? report.paid)} />
              <MiniSummary label="المصروفات" value={formatMoney(collectionSummary?.expensesTotal ?? report.expenses)} />
              <MiniSummary label="فرق التحصيل والمصروفات" value={formatMoney(report.netCash)} />
            </div>
          </div>
        )}
      </ReportPanel>

      <div className="space-y-4 lg:col-span-5">
        <ReportPanel
          title="صحة المحفظة"
          description="أربع نسب تلخص التحصيل والتكلفة والإشغال وانكشاف الذمم."
          eyebrow="قراءة تنفيذية"
          icon={Gauge}
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
                ? 'كفاءة التحصيل منخفضة وتحتاج مراجعة قائمة المتأخرات وأولوية التواصل.'
                : expenseInsight?.tone === 'critical'
                  ? 'المصروفات المسجلة مرتفعة مقارنة بالتحصيلات في هذا العرض التشغيلي؛ راجع التصنيفات والعقارات الأعلى تكلفة قبل استنتاج الربحية.'
                  : 'المؤشرات التشغيلية الأساسية مستقرة؛ تابع التحصيل والإشغال، وافتح التفاصيل المالية المتخصصة عند الحاجة إلى تحليل أعمق.'}
            </ReportInsightNote>
          </div>
        </ReportPanel>

        <ReportPanel
          title="آخر التحصيلات"
          description="أحدث الإيصالات المنشورة داخل النطاق المحدد."
          eyebrow="حركة حديثة"
          icon={ReceiptText}
          isLoading={isLoading}
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
    </div>
  );
}

function MiniSummary({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-extrabold tabular-nums" dir="ltr">{value}</p>
    </div>
  );
}

import { BarChart3, FileSpreadsheet, Gauge, ReceiptText } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { formatDate, formatMoney } from '@/features/financials/components/financials-formatters';
import {
  useCollectionSummaryReport,
  useFinancialCashflowReport,
  useFinancialPeriodSummaryReport,
} from '@/features/financials/reports/useFinancialReports';
import { buildExecutiveHealthInsights } from '../reports-insights';
import { buildReportCsvFilename, createReceiptPrintHref, downloadCsv, toFinancialSummaryCsv } from '../reports-page.helpers';
import {
  ReportInsightNote,
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportProgress,
  ReportState,
} from './report-section-primitives';

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
  cashflowRows,
  receiptRows,
  occupancyRows,
  canExportReports,
  isLoading,
}: Readonly<{
  summary: NonNullable<ReturnType<typeof useFinancialPeriodSummaryReport>['data']> | undefined;
  collectionSummary: NonNullable<ReturnType<typeof useCollectionSummaryReport>['data']> | undefined;
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
    invoiced: collectionSummary?.invoiced ?? report.invoiced,
    paid: collectionSummary?.paid ?? report.paid,
    outstanding: collectionSummary?.outstanding ?? report.outstanding,
    expenses: collectionSummary?.expensesTotal ?? report.expenses,
    occupiedUnits: occupancy.occupied,
    totalUnits,
  });
  const collectionInsight = insights[0];
  const expenseInsight = insights[1];

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <ReportPanel
        title="حركة السيولة"
        description="التحصيل مقابل المصروفات شهرًا بشهر داخل نطاق التقرير."
        eyebrow="اتجاه مالي"
        icon={BarChart3}
        className="lg:col-span-7"
        action={canExportReports ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 shrink-0 gap-2 text-xs"
            onClick={() => downloadCsv(buildReportCsvFilename('financial-summary'), toFinancialSummaryCsv(report))}
          >
            <FileSpreadsheet className="size-4" aria-hidden="true" />
            CSV
          </Button>
        ) : undefined}
        isLoading={isLoading}
      >
        {cashflowRows.length === 0 ? (
          <div className="p-4 sm:p-5">
            <ReportState
              title="لا توجد حركة شهرية كافية"
              message="وسّع الفترة أو أضف تحصيلات ومصروفات لعرض اتجاه السيولة."
            />
          </div>
        ) : (
          <div className="p-3 sm:p-5">
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashflowRows} margin={{ top: 12, right: 0, left: 0, bottom: 0 }} barGap={6}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} width={58} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" name="المحصّل" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" name="المصروفات" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              <MiniSummary label="الفواتير" value={formatMoney(collectionSummary?.invoiced ?? report.invoiced)} />
              <MiniSummary label="المحصّل" value={formatMoney(collectionSummary?.paid ?? report.paid)} />
              <MiniSummary label="المصروفات" value={formatMoney(collectionSummary?.expensesTotal ?? report.expenses)} />
              <MiniSummary label="صافي الحركة" value={formatMoney(report.netCash)} />
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
                  ? 'المصروفات تستهلك نسبة مرتفعة من المتحصل وتحتاج مراجعة التصنيفات والعقارات الأعلى تكلفة.'
                  : 'المؤشرات الأساسية مستقرة؛ تابع التحصيل والإشغال للحفاظ على الأداء.'}
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
      <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-extrabold tabular-nums" dir="ltr">{value}</p>
    </div>
  );
}

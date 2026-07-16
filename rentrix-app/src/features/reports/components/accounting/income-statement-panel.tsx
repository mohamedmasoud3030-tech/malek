import { TrendingUp } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatMoney, getErrorMessage } from '@/features/financials/components/financials-formatters';
import type { IncomeStatementReport } from '@/features/financials/reports/financialReportsService';
import { ReportList, ReportListRow, ReportPanel, ReportState } from '../report-section-primitives';

export function IncomeStatementPanel({
  from,
  to,
  report,
  error,
  isLoading,
  action,
}: Readonly<{
  from: string;
  to: string;
  report: IncomeStatementReport | undefined;
  error: unknown;
  isLoading: boolean;
  action?: React.ReactNode;
}>) {
  return (
    <ReportPanel
      title="تقرير الدخل"
      description={`الإيرادات والمصروفات من ${from || '—'} إلى ${to || '—'}.`}
      icon={TrendingUp}
      action={action}
      isLoading={isLoading}
    >
      {error ? (
        <div className="p-4"><ReportState kind="error" message={getErrorMessage(error, 'تعذر تحميل تقرير الدخل من RPC.')} /></div>
      ) : !report ? (
        <div className="p-4"><ReportState message="تعذر تحميل تقرير الدخل للفترة المحددة." /></div>
      ) : (
        <>
          <ResponsiveCardGrid className="border-b border-border/60 p-4" gap="sm">
            <KpiCard label="الإيرادات" value={formatMoney(report.totalRevenue)} icon={TrendingUp} compact />
            <KpiCard label="المصروفات" value={formatMoney(report.totalExpenses)} icon={TrendingUp} compact />
            <KpiCard label="صافي الدخل" value={formatMoney(report.netIncome)} icon={TrendingUp} compact />
            <KpiCard label="حالة النتيجة" value={report.netIncome >= 0 ? 'ربح' : 'خسارة'} icon={TrendingUp} compact />
          </ResponsiveCardGrid>

          <div className="grid lg:grid-cols-2">
            <StatementGroup title="الإيرادات" rows={report.revenue} emptyMessage="لا توجد إيرادات في الفترة." />
            <StatementGroup title="المصروفات" rows={report.expenses} emptyMessage="لا توجد مصروفات في الفترة." />
          </div>
        </>
      )}
    </ReportPanel>
  );
}

function StatementGroup({
  title,
  rows,
  emptyMessage,
}: Readonly<{
  title: string;
  rows: Array<{ label: string; amount: number }>;
  emptyMessage: string;
}>) {
  return (
    <section className="border-b border-border/60 last:border-b-0 lg:border-b-0 lg:border-s lg:first:border-s-0">
      <p className="border-b border-border/60 bg-muted/20 px-4 py-2.5 text-xs font-bold text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <div className="p-4"><ReportState message={emptyMessage} /></div>
      ) : (
        <ReportList>
          {rows.map((row, index) => (
            <ReportListRow key={`${row.label}-${index}`} title={row.label} value={<span dir="ltr">{formatMoney(row.amount)}</span>} />
          ))}
        </ReportList>
      )}
    </section>
  );
}

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { WalletCards } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { useFinancialCashflowReport, useFinancialPeriodSummaryReport } from '@/features/financials/reports/useFinancialReports';
import { buildReportCsvFilename, downloadCsv, toFinancialSummaryCsv } from '../reports-page.helpers';
import { ReportCard } from './common';

export function OverviewSection({ summary, cashflowRows, canExportReports, isLoading }: Readonly<{
  summary: NonNullable<ReturnType<typeof useFinancialPeriodSummaryReport>['data']> | undefined;
  cashflowRows: NonNullable<ReturnType<typeof useFinancialCashflowReport>['data']>['rows'];
  canExportReports: boolean;
  isLoading: boolean;
}>) {
  const emptySummary = { invoiced: 0, paid: 0, outstanding: 0, expenses: 0, netCash: 0, invoicesCount: 0, paymentsCount: 0, expensesCount: 0 };
  const report = summary ?? emptySummary;

  return (
    <ReportCard
      title="نظرة عامة على الفترة"
      description="ملخص الفواتير والتحصيل والمصروفات المسجلة للفترة المحددة."
      onExportCsv={canExportReports ? () => downloadCsv(buildReportCsvFilename('financial-summary'), toFinancialSummaryCsv(report)) : undefined}
      isLoading={isLoading}
    >
      <ResponsiveCardGrid className="p-4" desktopColumns={4}>
        <KpiCard label="إجمالي الفواتير" value={formatMoney(report.invoiced)} icon={WalletCards} accent="sky" sub={`${report.invoicesCount} فواتير`} />
        <KpiCard label="إجمالي التحصيل" value={formatMoney(report.paid)} icon={WalletCards} accent="emerald" sub={`${report.paymentsCount} مدفوعات`} />
        <KpiCard label="الرصيد المستحق" value={formatMoney(report.outstanding)} icon={WalletCards} accent="amber" sub="من فواتير الفترة" />
        <KpiCard label="إجمالي المصروفات" value={formatMoney(report.expenses)} icon={WalletCards} accent="rose" sub={`${report.expensesCount} مصروفات`} />
      </ResponsiveCardGrid>
      <div className="h-72 p-4 pt-0">
        {cashflowRows.length === 0 ? (
          <p className="grid h-full place-items-center text-sm text-muted-foreground">لا توجد بيانات شهرية كافية لعرض التدفق النقدي للفترة.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashflowRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="revenue" name="المحصّل" fill="#0f766e" />
              <Bar dataKey="expenses" name="المصاريف" fill="#e11d48" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ReportCard>
  );
}

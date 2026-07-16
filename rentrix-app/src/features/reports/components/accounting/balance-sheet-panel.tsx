import { Landmark } from 'lucide-react';
import { formatMoney, getErrorMessage } from '@/features/financials/components/financials-formatters';
import type { BalanceSheetReport } from '@/features/financials/reports/financialReportsService';
import { ReportList, ReportListRow, ReportPanel, ReportState } from '../report-section-primitives';

export function BalanceSheetPanel({
  asOf,
  report,
  error,
  isLoading,
  action,
}: Readonly<{
  asOf: string;
  report: BalanceSheetReport | undefined;
  error: unknown;
  isLoading: boolean;
  action?: React.ReactNode;
}>) {
  return (
    <ReportPanel
      title="قائمة المركز المالي"
      description={`الأصول والالتزامات وحقوق الملكية كما في ${asOf || '—'}.`}
      icon={Landmark}
      action={action}
      isLoading={isLoading}
    >
      {error ? (
        <div className="p-4"><ReportState kind="error" message={getErrorMessage(error, 'تعذر تحميل قائمة المركز المالي من RPC.')} /></div>
      ) : !report ? (
        <div className="p-4"><ReportState message="تعذر تحميل قائمة المركز المالي لهذا التاريخ." /></div>
      ) : (
        <div className="grid lg:grid-cols-3">
          <BalanceGroup title="الأصول" rows={report.assets} total={report.totalAssets} />
          <BalanceGroup title="الالتزامات" rows={report.liabilities} total={report.totalLiabilities} />
          <BalanceGroup title="حقوق الملكية" rows={report.equity} total={report.totalEquity} />
        </div>
      )}
    </ReportPanel>
  );
}

function BalanceGroup({
  title,
  rows,
  total,
}: Readonly<{
  title: string;
  rows: Array<{ code: string; name: string; amount: number }>;
  total: number;
}>) {
  return (
    <section className="border-b border-border/60 last:border-b-0 lg:border-b-0 lg:border-s lg:first:border-s-0">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-2.5 text-xs">
        <span className="font-bold text-muted-foreground">{title}</span>
        <span className="font-bold" dir="ltr">{formatMoney(total)}</span>
      </div>
      {rows.length === 0 ? (
        <div className="p-4"><ReportState message={`لا توجد بنود في ${title}.`} /></div>
      ) : (
        <ReportList>
          {rows.map((row) => (
            <ReportListRow
              key={row.code}
              title={row.name}
              subtitle={row.code}
              value={<span dir="ltr">{formatMoney(row.amount)}</span>}
            />
          ))}
        </ReportList>
      )}
    </section>
  );
}

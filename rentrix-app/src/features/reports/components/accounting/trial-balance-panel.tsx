import { Scale } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney, getErrorMessage } from '@/features/financials/components/financials-formatters';
import type { TrialBalanceReport } from '@/features/financials/reports/financialReportsService';
import { ReportList, ReportListRow, ReportPanel, ReportState } from '../report-section-primitives';

export function TrialBalancePanel({
  asOf,
  report,
  error,
  isLoading,
  action,
}: Readonly<{
  asOf: string;
  report: TrialBalanceReport | undefined;
  error: unknown;
  isLoading: boolean;
  action?: React.ReactNode;
}>) {
  return (
    <ReportPanel
      title="ميزان المراجعة"
      description={`الأرصدة المدينة والدائنة كما في ${asOf || '—'}.`}
      icon={Scale}
      action={action}
      isLoading={isLoading}
    >
      {error ? (
        <div className="p-4"><ReportState kind="error" message={getErrorMessage(error, 'تعذر تحميل ميزان المراجعة من RPC.')} /></div>
      ) : !report || report.accounts.length === 0 ? (
        <div className="p-4"><ReportState message="لا توجد حسابات لعرض ميزان المراجعة لهذا التاريخ." /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 border-b border-border/60 bg-muted/20 p-4 text-sm">
            <div><p className="text-xs text-muted-foreground">إجمالي المدين</p><p className="mt-1 font-bold" dir="ltr">{formatMoney(report.totalDebits)}</p></div>
            <div><p className="text-xs text-muted-foreground">إجمالي الدائن</p><p className="mt-1 font-bold" dir="ltr">{formatMoney(report.totalCredits)}</p></div>
          </div>
          <ReportList>
            {report.accounts.map((account) => (
              <ReportListRow
                key={account.code}
                title={account.name}
                subtitle={account.code}
                meta={account.balanceType === 'debit' ? 'مدين' : 'دائن'}
                value={<span dir="ltr">{formatMoney(account.balance)}</span>}
              />
            ))}
          </ReportList>
          <div className="border-t border-border/60 p-4">
            <StatusBadge tone={report.isBalanced ? 'success' : 'danger'}>
              {report.isBalanced ? 'الميزان متوازن' : 'الميزان غير متوازن'}
            </StatusBadge>
          </div>
        </>
      )}
    </ReportPanel>
  );
}

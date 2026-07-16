import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BalanceSheetReport, IncomeStatementReport, TrialBalanceReport } from '@/features/financials/reports/financialReportsService';
import { exportBalanceSheetToPdf, exportIncomeStatementToPdf, exportTrialBalanceToPdf } from '@/services/pdfService';
import { BalanceSheetPanel } from './accounting/balance-sheet-panel';
import { IncomeStatementPanel } from './accounting/income-statement-panel';
import { TrialBalancePanel } from './accounting/trial-balance-panel';

type AccountingReportsSectionProps = Readonly<{
  asOf: string;
  from: string;
  to: string;
  trialBalance: TrialBalanceReport | undefined;
  incomeStatement: IncomeStatementReport | undefined;
  balanceSheet: BalanceSheetReport | undefined;
  isTrialBalanceLoading: boolean;
  isIncomeStatementLoading: boolean;
  isBalanceSheetLoading: boolean;
  trialBalanceError: unknown;
  incomeStatementError: unknown;
  balanceSheetError: unknown;
  isLoading: boolean;
}>;

export function AccountingReportsSection({
  asOf,
  from,
  to,
  trialBalance,
  incomeStatement,
  balanceSheet,
  isTrialBalanceLoading,
  isIncomeStatementLoading,
  isBalanceSheetLoading,
  trialBalanceError,
  incomeStatementError,
  balanceSheetError,
  isLoading,
}: AccountingReportsSectionProps) {
  const handlePrintTrialBalance = () => {
    if (!trialBalance) return;
    exportTrialBalanceToPdf(
      {
        lines: trialBalance.accounts.map((account) => ({
          no: account.code,
          name: account.name,
          debit: account.balanceType === 'debit' ? account.balance : 0,
          credit: account.balanceType === 'credit' ? account.balance : 0,
        })),
        totalDebit: trialBalance.totalDebits,
        totalCredit: trialBalance.totalCredits,
      },
      {},
      asOf || '—',
    );
  };

  const handlePrintIncomeStatement = () => {
    if (!incomeStatement) return;
    exportIncomeStatementToPdf(
      {
        totalRevenue: incomeStatement.totalRevenue,
        totalExpense: incomeStatement.totalExpenses,
        netIncome: incomeStatement.netIncome,
        revenues: incomeStatement.revenue,
        expenses: incomeStatement.expenses,
      },
      {},
      `${from || '—'} إلى ${to || '—'}`,
    );
  };

  const handlePrintBalanceSheet = () => {
    if (!balanceSheet) return;
    exportBalanceSheetToPdf(
      {
        assets: balanceSheet.assets.map((item) => ({ label: item.name, amount: item.amount })),
        liabilities: balanceSheet.liabilities.map((item) => ({ label: item.name, amount: item.amount })),
        equity: balanceSheet.equity.map((item) => ({ label: item.name, amount: item.amount })),
        totalAssets: balanceSheet.totalAssets,
        totalLiabilities: balanceSheet.totalLiabilities,
        totalEquity: balanceSheet.totalEquity,
      },
      {},
      asOf || '—',
    );
  };

  const printButton = (label: string, handler: () => void, disabled: boolean) => (
    <Button type="button" size="sm" variant="outline" onClick={handler} disabled={disabled} className="min-h-10 gap-1.5 text-xs">
      <Printer className="size-3.5" aria-hidden="true" />
      {label}
    </Button>
  );

  return (
    <div className="space-y-4">
      <TrialBalancePanel
        asOf={asOf}
        report={trialBalance}
        error={trialBalanceError}
        isLoading={isTrialBalanceLoading || isLoading}
        action={printButton('طباعة الميزان', handlePrintTrialBalance, !trialBalance)}
      />

      <IncomeStatementPanel
        from={from}
        to={to}
        report={incomeStatement}
        error={incomeStatementError}
        isLoading={isIncomeStatementLoading || isLoading}
        action={printButton('طباعة الدخل', handlePrintIncomeStatement, !incomeStatement)}
      />

      <BalanceSheetPanel
        asOf={asOf}
        report={balanceSheet}
        error={balanceSheetError}
        isLoading={isBalanceSheetLoading || isLoading}
        action={printButton('طباعة المركز المالي', handlePrintBalanceSheet, !balanceSheet)}
      />
    </div>
  );
}

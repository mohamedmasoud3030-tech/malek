import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BalanceSheetReport, IncomeStatementReport, TrialBalanceReport } from '@/features/financials/reports/financialReportsService';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { DocumentTemplates, type ReportDocumentData } from '@/services/documents/DocumentTemplates';
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
  const { settings: documentSettings, isReady: isDocumentSettingsReady } = useDocumentSettings();

  const buildTrialBalanceDocument = (): ReportDocumentData | null => {
    if (!trialBalance) return null;
    return {
      reportTitle: 'ميزان المراجعة',
      reportType: 'Trial_Balance',
      periodFrom: asOf || '—',
      periodTo: asOf || '—',
      sections: [
        {
          title: 'أرصدة الحسابات',
          columns: ['رقم الحساب', 'اسم الحساب', 'مدين', 'دائن'],
          rows: trialBalance.accounts.map((account) => [
            account.code,
            account.name,
            account.balanceType === 'debit' ? account.balance : 0,
            account.balanceType === 'credit' ? account.balance : 0,
          ]),
          totals: ['الإجمالي', '', String(trialBalance.totalDebits), String(trialBalance.totalCredits)],
        },
      ],
      totalSummary: trialBalance.isBalanced ? 'الميزان متوازن' : 'الميزان غير متوازن',
    };
  };

  const buildIncomeStatementDocument = (): ReportDocumentData | null => {
    if (!incomeStatement) return null;
    return {
      reportTitle: 'قائمة الدخل',
      reportType: 'Income_Statement',
      periodFrom: from || '—',
      periodTo: to || '—',
      sections: [
        {
          title: 'الإيرادات',
          rows: incomeStatement.revenue.map((row) => ({ label: row.label, value: row.amount })),
          totals: ['إجمالي الإيرادات', String(incomeStatement.totalRevenue)],
        },
        {
          title: 'المصروفات',
          rows: incomeStatement.expenses.map((row) => ({ label: row.label, value: row.amount })),
          totals: ['إجمالي المصروفات', String(incomeStatement.totalExpenses)],
        },
      ],
      totalSummary: `صافي الدخل: ${incomeStatement.netIncome}`,
    };
  };

  const buildBalanceSheetDocument = (): ReportDocumentData | null => {
    if (!balanceSheet) return null;
    return {
      reportTitle: 'قائمة المركز المالي',
      reportType: 'Balance_Sheet',
      periodFrom: asOf || '—',
      periodTo: asOf || '—',
      sections: [
        { title: 'الأصول', rows: balanceSheet.assets.map((item) => ({ label: item.name, value: item.amount })), totals: ['إجمالي الأصول', String(balanceSheet.totalAssets)] },
        { title: 'الالتزامات', rows: balanceSheet.liabilities.map((item) => ({ label: item.name, value: item.amount })), totals: ['إجمالي الالتزامات', String(balanceSheet.totalLiabilities)] },
        { title: 'حقوق الملكية', rows: balanceSheet.equity.map((item) => ({ label: item.name, value: item.amount })), totals: ['إجمالي حقوق الملكية', String(balanceSheet.totalEquity)] },
      ],
      totalSummary: `الأصول ${balanceSheet.totalAssets} | الالتزامات ${balanceSheet.totalLiabilities} | حقوق الملكية ${balanceSheet.totalEquity}`,
    };
  };

  const runPrint = (builder: () => ReportDocumentData | null) => {
    const data = builder();
    if (!data || !isDocumentSettingsReady) return;
    void DocumentTemplates.printReportDocument(data, documentSettings);
  };

  const runPdf = (builder: () => ReportDocumentData | null) => {
    const data = builder();
    if (!data || !isDocumentSettingsReady) return;
    void DocumentTemplates.downloadReportPdf(data, documentSettings);
  };

  const documentActions = (label: string, builder: () => ReportDocumentData | null, disabled: boolean) => (
    <div className="flex flex-wrap gap-1.5">
      <Button type="button" size="sm" variant="outline" onClick={() => runPrint(builder)} disabled={disabled || !isDocumentSettingsReady} className="min-h-10 gap-1.5 text-xs">
        <Printer className="size-3.5" aria-hidden="true" />
        {label}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => runPdf(builder)} disabled={disabled || !isDocumentSettingsReady} className="min-h-10 gap-1.5 text-xs">
        <Download className="size-3.5" aria-hidden="true" />
        PDF
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <TrialBalancePanel
        asOf={asOf}
        report={trialBalance}
        error={trialBalanceError}
        isLoading={isTrialBalanceLoading || isLoading}
        action={documentActions('طباعة الميزان', buildTrialBalanceDocument, !trialBalance)}
      />

      <IncomeStatementPanel
        from={from}
        to={to}
        report={incomeStatement}
        error={incomeStatementError}
        isLoading={isIncomeStatementLoading || isLoading}
        action={documentActions('طباعة الدخل', buildIncomeStatementDocument, !incomeStatement)}
      />

      <BalanceSheetPanel
        asOf={asOf}
        report={balanceSheet}
        error={balanceSheetError}
        isLoading={isBalanceSheetLoading || isLoading}
        action={documentActions('طباعة المركز المالي', buildBalanceSheetDocument, !balanceSheet)}
      />
    </div>
  );
}

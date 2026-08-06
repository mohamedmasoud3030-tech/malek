import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BalanceSheetReport, IncomeStatementReport, TrialBalanceReport } from '@/features/financials/reports/financialReportsService';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { documentService } from '@/services/documents/DocumentService';
import {
  toBalanceSheetDocumentPayload,
  toIncomeStatementDocumentPayload,
  toTrialBalanceDocumentPayload,
  type BalanceSheetDocumentData,
  type IncomeStatementDocumentData,
  type TrialBalanceDocumentData,
} from '@/services/documents/documentPayloadAdapters';
import { runDocumentAction } from '@/services/documents/runDocumentAction';
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

type AccountingDocumentBuilder<T> = () => T | null;
type AccountingDocumentActions<T> = Readonly<{
  label: string;
  builder: AccountingDocumentBuilder<T>;
  print: (data: T) => Promise<void>;
  pdf: (data: T) => Promise<void>;
  disabled: boolean;
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
  const { companySettings: documentSettings, isReady: isDocumentSettingsReady } = useDocumentSettings();

  const buildTrialBalanceDocument = (): TrialBalanceDocumentData | null => {
    if (!trialBalance) return null;
    return {
      asOf: asOf || '—',
      accounts: trialBalance.accounts,
      totalDebits: trialBalance.totalDebits,
      totalCredits: trialBalance.totalCredits,
      isBalanced: trialBalance.isBalanced,
    };
  };

  const buildIncomeStatementDocument = (): IncomeStatementDocumentData | null => {
    if (!incomeStatement) return null;
    return {
      periodFrom: from || '—',
      periodTo: to || '—',
      revenue: incomeStatement.revenue,
      expenses: incomeStatement.expenses,
      totalRevenue: incomeStatement.totalRevenue,
      totalExpenses: incomeStatement.totalExpenses,
      netIncome: incomeStatement.netIncome,
    };
  };

  const buildBalanceSheetDocument = (): BalanceSheetDocumentData | null => {
    if (!balanceSheet) return null;
    return {
      asOf: asOf || '—',
      assets: balanceSheet.assets,
      liabilities: balanceSheet.liabilities,
      equity: balanceSheet.equity,
      totalAssets: balanceSheet.totalAssets,
      totalLiabilities: balanceSheet.totalLiabilities,
      totalEquity: balanceSheet.totalEquity,
    };
  };

  const documentActions = <T,>({ label, builder, print, pdf, disabled }: AccountingDocumentActions<T>) => {
    const runPrint = () => {
      const data = builder();
      if (!data || !isDocumentSettingsReady) return;
      void runDocumentAction(() => print(data), 'تعذرت طباعة التقرير.');
    };
    const runPdf = () => {
      const data = builder();
      if (!data || !isDocumentSettingsReady) return;
      void runDocumentAction(() => pdf(data), 'تعذر تنزيل التقرير كملف PDF.');
    };

    return (
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant="outline" onClick={runPrint} disabled={disabled || !isDocumentSettingsReady} className="min-h-10 gap-1.5 text-xs">
          <Printer className="size-3.5" aria-hidden="true" />
          {label}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={runPdf} disabled={disabled || !isDocumentSettingsReady} className="min-h-10 gap-1.5 text-xs">
          <Download className="size-3.5" aria-hidden="true" />
          PDF
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <TrialBalancePanel
        asOf={asOf}
        report={trialBalance}
        error={trialBalanceError}
        isLoading={isTrialBalanceLoading || isLoading}
        action={documentActions({
          label: 'طباعة الميزان',
          builder: buildTrialBalanceDocument,
          print: (data) => documentService.printDocument('trial_balance', { settings: documentSettings, payload: toTrialBalanceDocumentPayload(data) }),
          pdf: (data) => documentService.downloadDocumentPdf('trial_balance', { settings: documentSettings, payload: toTrialBalanceDocumentPayload(data) }),
          disabled: !trialBalance,
        })}
      />

      <IncomeStatementPanel
        from={from}
        to={to}
        report={incomeStatement}
        error={incomeStatementError}
        isLoading={isIncomeStatementLoading || isLoading}
        action={documentActions({
          label: 'طباعة الدخل',
          builder: buildIncomeStatementDocument,
          print: (data) => documentService.printDocument('income_statement', { settings: documentSettings, payload: toIncomeStatementDocumentPayload(data) }),
          pdf: (data) => documentService.downloadDocumentPdf('income_statement', { settings: documentSettings, payload: toIncomeStatementDocumentPayload(data) }),
          disabled: !incomeStatement,
        })}
      />

      <BalanceSheetPanel
        asOf={asOf}
        report={balanceSheet}
        error={balanceSheetError}
        isLoading={isBalanceSheetLoading || isLoading}
        action={documentActions({
          label: 'طباعة المركز المالي',
          builder: buildBalanceSheetDocument,
          print: (data) => documentService.printDocument('balance_sheet', { settings: documentSettings, payload: toBalanceSheetDocumentPayload(data) }),
          pdf: (data) => documentService.downloadDocumentPdf('balance_sheet', { settings: documentSettings, payload: toBalanceSheetDocumentPayload(data) }),
          disabled: !balanceSheet,
        })}
      />
    </div>
  );
}

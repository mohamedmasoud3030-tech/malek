import { useState } from 'react';
import { Download, Landmark, Printer, Scale, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BalanceSheetReport, IncomeStatementReport, TrialBalanceReport } from '@/features/accounting/reports/contracts';
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
import { DocumentReadinessError, runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import {
  isAccountingStatementOutputReady,
  summarizeReconciliationReadiness,
  useSubledgerGlReconciliation,
} from '../accounting-report-authority';
import { AccountingReconciliationReadiness } from './accounting/accounting-reconciliation-readiness';
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

type AccountingStatementId = 'trial_balance' | 'income_statement' | 'balance_sheet';

const statementViews = [
  { id: 'trial_balance', label: 'ميزان المراجعة', icon: Scale },
  { id: 'income_statement', label: 'الأرباح والخسائر', icon: TrendingUp },
  { id: 'balance_sheet', label: 'المركز المالي', icon: Landmark },
] as const;

const MISSING_REPORT_DATA_MESSAGE =
  'تعذر إصدار التقرير: لا توجد بيانات محاسبية مُحمَّلة للفترة المحددة. يرجى عرض التقرير أولاً ثم إعادة المحاولة.';
const RECONCILIATION_NOT_READY_MESSAGE =
  'تعذر إصدار التقرير: مطابقة الدفاتر المساعدة مع الأستاذ العام غير ناجحة أو غير مكتملة. عالج فروقات المطابقة ثم أعد المحاولة.';

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
  const [activeStatement, setActiveStatement] = useState<AccountingStatementId>('trial_balance');
  const { companySettings: documentSettings, isReady: isDocumentSettingsReady } = useDocumentSettings();
  const reconciliationQuery = useSubledgerGlReconciliation(asOf);
  const reconciliationRows = reconciliationQuery.data ?? [];
  const reconciliationReadiness = summarizeReconciliationReadiness(reconciliationRows);
  const isAccountingOutputReady = isAccountingStatementOutputReady(reconciliationReadiness, {
    isLoading: reconciliationQuery.isLoading,
    isError: reconciliationQuery.isError,
  });

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
    const assertAccountingOutputReady = () => {
      if (!isAccountingOutputReady) throw new DocumentReadinessError(RECONCILIATION_NOT_READY_MESSAGE);
    };

    const runPrint = () => {
      void runGuardedDocumentAction({
        isReady: isDocumentSettingsReady,
        operation: async () => {
          assertAccountingOutputReady();
          const data = builder();
          if (!data) throw new DocumentReadinessError(MISSING_REPORT_DATA_MESSAGE);
          await print(data);
        },
        fallbackMessage: 'تعذرت طباعة التقرير.',
      });
    };
    const runPdf = () => {
      void runGuardedDocumentAction({
        isReady: isDocumentSettingsReady,
        operation: async () => {
          assertAccountingOutputReady();
          const data = builder();
          if (!data) throw new DocumentReadinessError(MISSING_REPORT_DATA_MESSAGE);
          await pdf(data);
        },
        fallbackMessage: 'تعذر تنزيل التقرير كملف PDF.',
      });
    };

    const outputDisabled = disabled || !isDocumentSettingsReady || !isAccountingOutputReady;

    return (
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant="outline" onClick={runPrint} disabled={outputDisabled} className="min-h-11 gap-1.5 text-xs">
          <Printer className="size-3.5" aria-hidden="true" />
          {label}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={runPdf} disabled={outputDisabled} className="min-h-11 gap-1.5 text-xs">
          <Download className="size-3.5" aria-hidden="true" />
          PDF
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <AccountingReconciliationReadiness
        asOf={asOf}
        rows={reconciliationRows}
        readiness={reconciliationReadiness}
        isLoading={reconciliationQuery.isLoading}
        isError={reconciliationQuery.isError}
        onRefetch={() => { void reconciliationQuery.refetch(); }}
      />

      <div
        className="grid grid-cols-3 gap-1 rounded-xl border border-border/60 bg-muted/20 p-1"
        role="tablist"
        aria-label="القوائم المحاسبية"
      >
        {statementViews.map((statement) => {
          const Icon = statement.icon;
          const isActive = activeStatement === statement.id;
          return (
            <button
              key={statement.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`accounting-statement-${statement.id}`}
              onClick={() => setActiveStatement(statement.id)}
              className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
                isActive
                  ? 'bg-card text-foreground shadow-card'
                  : 'text-muted-foreground hover:bg-background/80 hover:text-foreground'
              }`}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{statement.label}</span>
            </button>
          );
        })}
      </div>

      {activeStatement === 'trial_balance' ? (
        <div id="accounting-statement-trial_balance" role="tabpanel">
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
        </div>
      ) : null}

      {activeStatement === 'income_statement' ? (
        <div id="accounting-statement-income_statement" role="tabpanel">
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
        </div>
      ) : null}

      {activeStatement === 'balance_sheet' ? (
        <div id="accounting-statement-balance_sheet" role="tabpanel">
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
      ) : null}
    </div>
  );
}

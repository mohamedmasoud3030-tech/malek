import { AlertCircle, Inbox, Printer, Scale, TrendingDown, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney, getErrorMessage } from '@/features/financials/components/financials-formatters';
import type {
  BalanceSheetReport,
  IncomeStatementReport,
  TrialBalanceReport,
} from '@/features/financials/reports/financialReportsService';
import {
  exportBalanceSheetToPdf,
  exportIncomeStatementToPdf,
  exportTrialBalanceToPdf,
} from '@/services/pdfService';

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

function ReportError({ error, label }: { error: unknown; label: string }) {
  return (
    <div className="flex min-h-24 items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertCircle className="size-5" />
      {getErrorMessage(error, `تعذر تحميل ${label} من RPC.`)}
    </div>
  );
}

function ReportEmpty({ label }: { label: string }) {
  return (
    <div className="flex min-h-24 items-center gap-3 rounded-xl border border-dashed bg-background/70 p-3 text-sm text-muted-foreground">
      <Inbox className="size-5 text-muted-foreground/70" />
      {label}
    </div>
  );
}

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
        lines: trialBalance.accounts.map((acc) => ({
          no: acc.code,
          name: acc.name,
          debit: acc.balanceType === 'debit' ? acc.balance : 0,
          credit: acc.balanceType === 'credit' ? acc.balance : 0,
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
        assets: balanceSheet.assets.map((a) => ({ label: a.name, amount: a.amount })),
        liabilities: balanceSheet.liabilities.map((l) => ({ label: l.name, amount: l.amount })),
        equity: balanceSheet.equity.map((eq) => ({ label: eq.name, amount: eq.amount })),
        totalAssets: balanceSheet.totalAssets,
        totalLiabilities: balanceSheet.totalLiabilities,
        totalEquity: balanceSheet.totalEquity,
      },
      {},
      asOf || '—',
    );
  };

  return (
    <div className="space-y-4">
      <Card className="scroll-mt-28 border-border/60 bg-muted/20">
        <CardHeader className="px-4 py-3 sm:px-5">
          <CardTitle className="text-sm font-black">التقارير المحاسبية الأساسية</CardTitle>
          <CardDescription>
            قائمة ميزان مراجعة وتقرير دخل وقائمة مركز مالي مشتقة من جداول التشغيل المصدرية (فواتير، تحصيلات، مصاريف، تسويات مالك).
            جاهزة للطباعة والتصدير بجودة A4 المعتمدة لتقديمها للإدارة أو المراجع المحاسبي.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-1">
        {/* Trial Balance */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
            <div>
              <CardTitle className="text-sm font-black">ميزان المراجعة</CardTitle>
              <CardDescription>كما في {asOf || '—'} (مشتق تشغيلي).</CardDescription>
            </div>
            {trialBalance && (
              <Button type="button" size="sm" variant="outline" onClick={handlePrintTrialBalance} className="min-h-9 gap-1.5 text-xs">
                <Printer className="size-3.5" aria-hidden="true" />
                طباعة الميزان A4
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {isTrialBalanceLoading || isLoading ? (
              <Skeleton className="h-40" />
            ) : trialBalanceError ? (
              <ReportError error={trialBalanceError} label="ميزان المراجعة" />
            ) : !trialBalance || trialBalance.accounts.length === 0 ? (
              <ReportEmpty label="لا توجد حسابات لعرض ميزان المراجعة لهذا التاريخ." />
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="px-2 py-2 text-start font-medium">الكود</th>
                        <th className="px-2 py-2 text-start font-medium">الحساب</th>
                        <th className="px-2 py-2 text-end font-medium">مدين</th>
                        <th className="px-2 py-2 text-end font-medium">دائن</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trialBalance.accounts.map((account) => (
                        <tr key={account.code} className="border-b border-border/40">
                          <td className="px-2 py-2 font-mono text-xs text-muted-foreground">{account.code}</td>
                          <td className="px-2 py-2">{account.name}</td>
                          <td className="px-2 py-2 text-end" dir="ltr">
                            {account.balanceType === 'debit' ? formatMoney(account.balance) : '—'}
                          </td>
                          <td className="px-2 py-2 text-end" dir="ltr">
                            {account.balanceType === 'credit' ? formatMoney(account.balance) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-black">
                        <td className="px-2 py-2" colSpan={2}>الإجمالي</td>
                        <td className="px-2 py-2 text-end" dir="ltr">{formatMoney(trialBalance.totalDebits)}</td>
                        <td className="px-2 py-2 text-end" dir="ltr">{formatMoney(trialBalance.totalCredits)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className={`text-xs ${trialBalance.isBalanced ? 'text-emerald-600' : 'text-destructive'}`}>
                  {trialBalance.isBalanced ? 'القيد متوازن (مدين = دائن).' : 'القيد غير متوازن — راجع المصدر.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Income Statement */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
            <div>
              <CardTitle className="text-sm font-black">تقرير الدخل والربحية</CardTitle>
              <CardDescription>من {from || '—'} إلى {to || '—'}.</CardDescription>
            </div>
            {incomeStatement && (
              <Button type="button" size="sm" variant="outline" onClick={handlePrintIncomeStatement} className="min-h-9 gap-1.5 text-xs">
                <Printer className="size-3.5" aria-hidden="true" />
                طباعة تقرير الدخل A4
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {isIncomeStatementLoading || isLoading ? (
              <Skeleton className="h-40" />
            ) : incomeStatementError ? (
              <ReportError error={incomeStatementError} label="تقرير الدخل" />
            ) : !incomeStatement ? (
              <ReportEmpty label="تعذر تحميل تقرير الدخل." />
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-xs font-bold text-muted-foreground">الإيرادات</p>
                  {incomeStatement.revenue.map((line, index) => (
                    <div key={`${line.label}-${index}`} className="flex items-center justify-between gap-2 py-1 text-sm">
                      <span>{line.label}</span>
                      <span dir="ltr">{formatMoney(line.amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2 border-t border-border/40 py-1 text-sm font-black">
                    <span>إجمالي الإيرادات</span>
                    <span dir="ltr">{formatMoney(incomeStatement.totalRevenue)}</span>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold text-muted-foreground">المصاريف</p>
                  {incomeStatement.expenses.length === 0 ? (
                    <p className="py-1 text-sm text-muted-foreground">لا توجد مصاريف في الفترة.</p>
                  ) : (
                    incomeStatement.expenses.map((line, index) => (
                      <div key={`${line.label}-${index}`} className="flex items-center justify-between gap-2 py-1 text-sm">
                        <span>{line.label}</span>
                        <span dir="ltr">{formatMoney(line.amount)}</span>
                      </div>
                    ))
                  )}
                  <div className="flex items-center justify-between gap-2 border-t border-border/40 py-1 text-sm font-black">
                    <span>إجمالي المصاريف</span>
                    <span dir="ltr">{formatMoney(incomeStatement.totalExpenses)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/30 p-3 text-sm font-black">
                  <span className="flex items-center gap-2"><TrendingDown className="size-4" />صافي الدخل</span>
                  <span dir="ltr">{formatMoney(incomeStatement.netIncome)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Balance Sheet */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
            <div>
              <CardTitle className="text-sm font-black">قائمة المركز المالي</CardTitle>
              <CardDescription>كما في {asOf || '—'} (مشتق تشغيلي).</CardDescription>
            </div>
            {balanceSheet && (
              <Button type="button" size="sm" variant="outline" onClick={handlePrintBalanceSheet} className="min-h-9 gap-1.5 text-xs">
                <Printer className="size-3.5" aria-hidden="true" />
                طباعة المركز المالي A4
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {isBalanceSheetLoading || isLoading ? (
              <Skeleton className="h-40" />
            ) : balanceSheetError ? (
              <ReportError error={balanceSheetError} label="قائمة المركز المالي" />
            ) : !balanceSheet ? (
              <ReportEmpty label="تعذر تحميل قائمة المركز المالي." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs font-bold text-muted-foreground">الأصول</p>
                  {balanceSheet.assets.map((item) => (
                    <div key={item.code} className="flex items-center justify-between gap-2 py-1 text-sm">
                      <span>{item.name}</span>
                      <span dir="ltr">{formatMoney(item.amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2 border-t border-border/40 py-1 text-sm font-black">
                    <span><WalletCards className="me-1 inline size-3" />الإجمالي</span>
                    <span dir="ltr">{formatMoney(balanceSheet.totalAssets)}</span>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold text-muted-foreground">الالتزامات</p>
                  {balanceSheet.liabilities.map((item) => (
                    <div key={item.code} className="flex items-center justify-between gap-2 py-1 text-sm">
                      <span>{item.name}</span>
                      <span dir="ltr">{formatMoney(item.amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2 border-t border-border/40 py-1 text-sm font-black">
                    <span>الإجمالي</span>
                    <span dir="ltr">{formatMoney(balanceSheet.totalLiabilities)}</span>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold text-muted-foreground">حقوق الملكية</p>
                  {balanceSheet.equity.map((item) => (
                    <div key={item.code} className="flex items-center justify-between gap-2 py-1 text-sm">
                      <span>{item.name}</span>
                      <span dir="ltr">{formatMoney(item.amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2 border-t border-border/40 py-1 text-sm font-black">
                    <span><Scale className="me-1 inline size-3" />الإجمالي</span>
                    <span dir="ltr">{formatMoney(balanceSheet.totalEquity)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { AlertCircle, Inbox, WalletCards } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney, formatShortId, getErrorMessage } from '@/features/financials/components/financials-formatters';
import type { DailyCollectionReportRow, OwnerStatementReport, TenantStatementReport } from '@/features/financials/reports/financialReportsService';
import {
  useAgedReceivablesReport,
  useCashFlowStatementReport,
  useExpenseBreakdownReport,
  useFinancialPeriodSummaryReport,
  useVatReturnReport,
} from '@/features/financials/reports/useFinancialReports';
import { createReceiptPrintHref } from '../reports-page.helpers';

export function StatementsSection({ agedReport, receiptRows, financialSummary, expenseBreakdown, cashFlowStatement, vatReturn, dailyRows, tenantStatement, ownerStatement, selectedContractId, selectedOwnerId, tenantStatementError, ownerStatementError, isTenantStatementLoading, isOwnerStatementLoading, isLoading }: Readonly<{
  agedReport: NonNullable<ReturnType<typeof useAgedReceivablesReport>['data']> | undefined;
  receiptRows: Array<{ id: string; receipt_number: string; payment_date: string; amount: number; tenant_name: string | null }>;
  financialSummary: NonNullable<ReturnType<typeof useFinancialPeriodSummaryReport>['data']> | undefined;
  expenseBreakdown: NonNullable<ReturnType<typeof useExpenseBreakdownReport>['data']> | undefined;
  cashFlowStatement: NonNullable<ReturnType<typeof useCashFlowStatementReport>['data']> | undefined;
  vatReturn: NonNullable<ReturnType<typeof useVatReturnReport>['data']> | undefined;
  dailyRows: DailyCollectionReportRow[];
  tenantStatement: TenantStatementReport | undefined;
  ownerStatement: OwnerStatementReport | undefined;
  selectedContractId: string;
  selectedOwnerId: string;
  tenantStatementError: unknown;
  ownerStatementError: unknown;
  isTenantStatementLoading: boolean;
  isOwnerStatementLoading: boolean;
  isLoading: boolean;
}>) {
  const tenantRows = (agedReport?.rows ?? []).slice(0, 6);
  const ownerMovementRows = (expenseBreakdown?.byProperty ?? []).slice(0, 6);
  const totalCollections = dailyRows.reduce((total, row) => total + row.totalPaid, 0);
  const totalExpenses = financialSummary?.expenses ?? 0;
  const totalInvoiced = financialSummary?.invoiced ?? 0;
  const totalOutstanding = financialSummary?.outstanding ?? 0;
  const totalPayments = financialSummary?.paymentsCount ?? 0;
  const totalInvoicesCount = financialSummary?.invoicesCount ?? 0;
  const totalExpensesCount = financialSummary?.expensesCount ?? 0;
  const totalReceiptsCount = receiptRows.length;

  return (
    <div className="space-y-4">
      <Card className="scroll-mt-28 border-border/60 bg-muted/20">
        <CardHeader className="px-4 py-3 sm:px-5">
          <CardTitle className="text-sm font-black">كشوف الحساب</CardTitle>
          <CardDescription>
            كشوف حركة تشغيلية للقراءة فقط. لا تعرض هذه الصفحة أرصدة جارية ولا تسويات نهائية ولا دفتر أستاذ محاسبي.
            إذا لم تتوفر بيانات كافية، تظهر رسالة توضيح بدلاً من أرقام مُقدَّرة.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60">
          <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
            <CardTitle className="text-sm font-black">كشف حساب المستأجر</CardTitle>
            <CardDescription>ذمم ومتأخرات المستأجرين من تقرير receivables، مع أحدث إيصالات متاحة من السجل.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-4 sm:p-5">
            {selectedContractId ? (
              isTenantStatementLoading ? (
                <Skeleton className="h-32" />
              ) : tenantStatementError ? (
                <div className="flex min-h-24 items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="size-5" />
                  {getErrorMessage(tenantStatementError, 'تعذر تحميل كشف المستأجر من rpt_tenant_statement.')}
                </div>
              ) : tenantStatement?.error ? (
                <div className="flex min-h-24 items-center gap-3 rounded-xl border border-dashed bg-background/70 p-3 text-sm text-muted-foreground">
                  <Inbox className="size-5 text-muted-foreground/70" />
                  {tenantStatement.error}
                </div>
              ) : tenantStatement && tenantStatement.lines.length > 0 ? (
                <div className="space-y-2">
                  <div className="rounded-xl bg-muted/30 p-3 text-sm">
                    <p className="font-medium">{tenantStatement.tenantName ?? 'مستأجر غير محدد'}</p>
                    <p className="text-xs text-muted-foreground">{tenantStatement.propertyName ?? '—'} · {tenantStatement.unitName ?? '—'}</p>
                    <div className="mt-1 flex items-center justify-between gap-2"><span>الرصيد النهائي</span><span className="font-black" dir="ltr">{formatMoney(tenantStatement.finalBalance)}</span></div>
                  </div>
                  {tenantStatement.lines.slice(0, 5).map((line, index) => (
                    <div key={`${line.date}-${index}`} className="rounded-xl border p-3 text-xs">
                      <p className="font-bold">{line.description ?? line.type ?? 'حركة'}</p>
                      <div className="mt-1 grid grid-cols-3 gap-2 text-muted-foreground"><span>{line.date ?? '—'}</span><span>مدين: {formatMoney(line.debit)}</span><span>دائن: {formatMoney(line.credit)}</span></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-24 items-center gap-3 rounded-xl border border-dashed bg-background/70 p-3 text-sm text-muted-foreground"><Inbox className="size-5 text-muted-foreground/70" />لا توجد حركات في كشف المستأجر لهذا العقد.</div>
              )
            ) : isLoading ? (
              <Skeleton className="h-32" />
            ) : tenantRows.length === 0 ? (
              <div className="flex min-h-24 items-center gap-3 rounded-xl border border-dashed bg-background/70 p-3 text-sm text-muted-foreground"><Inbox className="size-5 text-muted-foreground/70" />اختر عقدًا من الفلاتر لعرض كشف المستأجر الحقيقي من RPC، أو لا توجد ذمم حسب تاريخ as-of.</div>
            ) : (
              tenantRows.map((row) => <div key={row.contractId} className="rounded-xl bg-muted/30 p-3 text-sm"><p className="font-medium">{row.tenantName ?? 'مستأجر غير محدد'}</p><div className="mt-1 flex items-center justify-between gap-2"><span className="text-muted-foreground">ذمم</span><span className="font-black" dir="ltr">{formatMoney(row.totalOutstanding)}</span></div><div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">متأخر</span><span className="font-black text-destructive" dir="ltr">{formatMoney(row.totalOverdue)}</span></div><p className="mt-1 text-xs text-muted-foreground">{row.invoiceCount.toLocaleString('ar')} فواتير مرتبطة</p></div>)
            )}
            {receiptRows.slice(0, 3).map((receipt) => (
              <a key={`receipt-${receipt.id}`} className="block rounded-xl border p-3 text-sm hover:border-primary/40" href={createReceiptPrintHref(receipt.id)}>
                {receipt.receipt_number} · {receipt.tenant_name ?? '—'} · <span dir="ltr">{formatMoney(receipt.amount)}</span>
              </a>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
            <CardTitle className="text-sm font-black">ملخص حركة المالك</CardTitle>
            <CardDescription>ملخص حركة عقار مدعوم بالمصروفات المرتبطة به. ليس كشف تسوية مالك.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-4 sm:p-5">
            {selectedOwnerId ? (
              isOwnerStatementLoading ? (
                <Skeleton className="h-32" />
              ) : ownerStatementError ? (
                <div className="flex min-h-24 items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="size-5" />{getErrorMessage(ownerStatementError, 'تعذر تحميل كشف المالك من rpt_owner_statement.')}</div>
              ) : ownerStatement?.error ? (
                <div className="flex min-h-24 items-center gap-3 rounded-xl border border-dashed bg-background/70 p-3 text-sm text-muted-foreground"><Inbox className="size-5 text-muted-foreground/70" />{ownerStatement.error}</div>
              ) : ownerStatement && ownerStatement.transactions.length > 0 ? (
                <div className="space-y-2"><div className="rounded-xl bg-muted/30 p-3 text-sm"><p className="font-medium">{ownerStatement.ownerName ?? 'مالك غير محدد'}</p><div className="mt-1 flex items-center justify-between gap-2"><span>صافي الحركة</span><span className="font-black" dir="ltr">{formatMoney(ownerStatement.totalNet)}</span></div><p className="text-xs text-muted-foreground">الإجمالي {formatMoney(ownerStatement.totalGross)} · الاستقطاعات {formatMoney(ownerStatement.totalDeductions)}</p></div>{ownerStatement.transactions.slice(0, 5).map((tx, index) => <div key={`${tx.date}-${index}`} className="rounded-xl border p-3 text-xs"><p className="font-bold">{tx.details ?? tx.type ?? 'حركة'}</p><div className="mt-1 flex justify-between gap-2 text-muted-foreground"><span>{tx.date ?? '—'}</span><span dir="ltr">{formatMoney(tx.net)}</span></div></div>)}</div>
              ) : (
                <div className="flex min-h-24 items-center gap-3 rounded-xl border border-dashed bg-background/70 p-3 text-sm text-muted-foreground"><Inbox className="size-5 text-muted-foreground/70" />لا توجد حركات في كشف المالك للفترة المحددة.</div>
              )
            ) : isLoading ? (
              <Skeleton className="h-32" />
            ) : ownerMovementRows.length === 0 ? (
              <div className="flex min-h-24 items-center gap-3 rounded-xl border border-dashed bg-background/70 p-3 text-sm text-muted-foreground">
                <Inbox className="size-5 text-muted-foreground/70" />
                لا توجد حركة مصروفات عقارية للفترة المحددة، ولا تتوفر بيانات مالك تفصيلية بعد.
              </div>
            ) : (
              ownerMovementRows.map((row) => (
                <div key={row.propertyId} className="rounded-xl bg-muted/30 p-3 text-sm">
                  <p className="font-medium">{row.propertyTitle ?? formatShortId(row.propertyId)}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">مصروفات مسجلة</span>
                    <span className="font-black" dir="ltr">{formatMoney(row.total)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{row.count.toLocaleString('ar')} حركة مصروفات في الفترة</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
            <CardTitle className="text-sm font-black">ملخص حركة المكتب</CardTitle>
            <CardDescription>ملخص فواتير وتحصيلات ومصروفات للفترة، وليس قائمة دخل أو دفتر حسابات.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 sm:p-5">
            <KpiCard label="فواتير الفترة" value={formatMoney(totalInvoiced)} icon={WalletCards} accent="sky" sub={`${totalInvoicesCount} فواتير`} compact />
            <KpiCard label="تحصيلات الفترة" value={formatMoney(totalCollections)} icon={WalletCards} accent="emerald" sub={`${totalPayments} مدفوعات`} compact />
            <KpiCard label="مصروفات الفترة" value={formatMoney(totalExpenses)} icon={WalletCards} accent="rose" sub={`${totalExpensesCount} مصروفات`} compact />
            <KpiCard label="رصيد مستحق (قراءة فقط)" value={formatMoney(totalOutstanding)} icon={WalletCards} accent="amber" sub={`${totalReceiptsCount} إيصالات متاحة للطباعة`} compact />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
            <CardTitle className="text-sm font-black">Cash Flow RPC</CardTitle>
            <CardDescription>قراءة مباشرة من `rpt_cash_flow` للفترة المختارة، بدون دفتر أستاذ عام.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 sm:p-5">
            {isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <>
                <KpiCard label="مقبوضات تشغيلية" value={formatMoney(cashFlowStatement?.operating.receipts ?? 0)} icon={WalletCards} accent="emerald" compact />
                <KpiCard label="مصروفات تشغيلية" value={formatMoney(cashFlowStatement?.operating.expenses ?? 0)} icon={WalletCards} accent="rose" compact />
                <KpiCard label="صافي التغير" value={formatMoney(cashFlowStatement?.netChange ?? 0)} icon={WalletCards} accent="sky" compact />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
            <CardTitle className="text-sm font-black">VAT Return RPC</CardTitle>
            <CardDescription>ملخص ضريبة القيمة المضافة من `rpt_vat_return` للفترة المختارة.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 sm:p-5">
            {isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <>
                <KpiCard label="إجمالي المبيعات الخاضعة" value={formatMoney(vatReturn?.totalSalesAmount ?? 0)} icon={WalletCards} accent="sky" compact />
                <KpiCard label="إجمالي VAT" value={formatMoney(vatReturn?.totalTaxAmount ?? 0)} icon={WalletCards} accent="amber" compact />
                <KpiCard label="عدد الفواتير" value={(vatReturn?.invoiceCount ?? 0).toLocaleString('ar')} icon={WalletCards} accent="primary" compact />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

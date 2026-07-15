import { AlertCircle, Inbox, Printer, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
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
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { createReceiptPrintHref } from '../reports-page.helpers';

const defaultDocumentSettings: DocumentSettings = {
  company: {
    name: 'رينتريكس لإدارة العقارات',
    address: 'سلطنة عمان - مسقط',
    phone: '+968 24000000',
  },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

export function StatementsSection({ agedReport, receiptRows, financialSummary, expenseBreakdown, cashFlowStatement, vatReturn, dailyRows, tenantStatement, ownerStatement, selectedContractId, selectedOwnerId, tenantStatementError, ownerStatementError, isTenantStatementLoading, isOwnerStatementLoading, isLoading, filters }: Readonly<{
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
  filters?: { from: string; to: string };
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

  const handlePrintTenantStatement = () => {
    if (!tenantStatement) return;
    DocumentTemplates.renderTenantStatementPdf(
      {
        tenantName: tenantStatement.tenantName || 'مستأجر غير محدد',
        periodFrom: filters?.from || '—',
        periodTo: filters?.to || '—',
        propertyTitle: tenantStatement.propertyName || 'عقار غير محدد',
        unitNumber: tenantStatement.unitName || '—',
        openingBalance: 0,
        totalInvoiced: tenantStatement.lines.reduce((acc, l) => acc + (l.debit || 0), 0),
        totalPaid: tenantStatement.lines.reduce((acc, l) => acc + (l.credit || 0), 0),
        closingBalance: tenantStatement.finalBalance || 0,
        lines: tenantStatement.lines.map((l) => ({
          date: l.date || '—',
          type: l.type || 'حركة',
          description: l.description || 'حركة حساب',
          debit: l.debit || 0,
          credit: l.credit || 0,
          balance: l.debit - l.credit,
        })),
      },
      defaultDocumentSettings,
    );
  };

  const handlePrintOwnerStatement = () => {
    if (!ownerStatement) return;
    DocumentTemplates.renderOwnerStatementPdf(
      {
        ownerName: ownerStatement.ownerName || 'مالك غير محدد',
        periodFrom: filters?.from || '—',
        periodTo: filters?.to || '—',
        propertyTitle: 'كافة العقارات المدارة',
        totalRent: ownerStatement.totalGross || 0,
        totalExpenses: ownerStatement.totalDeductions || 0,
        totalCommission: 0,
        netAmount: ownerStatement.totalNet || 0,
        transactions: ownerStatement.transactions.map((t) => ({
          date: t.date || '—',
          type: t.type || 'حركة',
          description: t.details || 'حركة مالية',
          amount: t.net || 0,
        })),
      },
      defaultDocumentSettings,
    );
  };

  return (
    <div className="space-y-4">
      <Card className="scroll-mt-28 border-border/60 bg-muted/20">
        <CardHeader className="px-4 py-3 sm:px-5">
          <CardTitle className="text-sm font-black">Workspace كشوف الحساب والورقيات المعتمدة</CardTitle>
          <CardDescription>
            اختر المالك أو العقد والفترة من فلاتر الصفحة أعلاه لطباعة وتصدير كشف حساب ملون بفرص المطبوعات الرسمية وموثق آلياً.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveCardGrid desktopColumns={3}>
            <StatementWorkspaceCue title="كشف مستأجر" value={selectedContractId ? 'عقد محدد' : 'اختر عقدًا من الفلاتر'} tone={selectedContractId ? 'ready' : 'muted'} />
            <StatementWorkspaceCue title="كشف مالك" value={selectedOwnerId ? 'مالك محدد' : 'اختر مالكًا من الفلاتر'} tone={selectedOwnerId ? 'ready' : 'muted'} />
            <StatementWorkspaceCue title="فترة الكشف" value={`${filters?.from || '—'} إلى ${filters?.to || '—'}`} tone="ready" />
          </ResponsiveCardGrid>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
            <div>
              <CardTitle className="text-sm font-black">كشف حساب المستأجر</CardTitle>
              <CardDescription>ذمم ومتأخرات المستأجرين مع دفتر الحركة المباشر.</CardDescription>
            </div>
            {tenantStatement && (
              <Button type="button" size="sm" variant="outline" onClick={handlePrintTenantStatement} className="min-h-9 gap-1.5 text-xs">
                <Printer className="size-3.5" aria-hidden="true" />
                طباعة الكشف
              </Button>
            )}
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
              <div className="flex min-h-24 items-center gap-3 rounded-xl border border-dashed bg-background/70 p-3 text-sm text-muted-foreground"><Inbox className="size-5 text-muted-foreground/70" />اختر عقدًا من الفلاتر لعرض كشف المستأجر الحقيقي من RPC.</div>
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
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
            <div>
              <CardTitle className="text-sm font-black">ملخص حركة المالك</CardTitle>
              <CardDescription>ملخص الإيرادات والمصروفات والاستقطاعات.</CardDescription>
            </div>
            {ownerStatement && (
              <Button type="button" size="sm" variant="outline" onClick={handlePrintOwnerStatement} className="min-h-9 gap-1.5 text-xs">
                <Printer className="size-3.5" aria-hidden="true" />
                طباعة الكشف
              </Button>
            )}
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
                لا توجد حركة مصروفات عقارية للفترة المحددة.
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
            <CardDescription>ملخص فواتير وتحصيلات ومصروفات للفترة.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <ResponsiveCardGrid desktopColumns={4} gap="sm">
              <KpiCard label="فواتير الفترة" value={formatMoney(totalInvoiced)} icon={WalletCards} accent="sky" sub={`${totalInvoicesCount} فواتير`} compact />
              <KpiCard label="تحصيلات الفترة" value={formatMoney(totalCollections)} icon={WalletCards} accent="emerald" sub={`${totalPayments} مدفوعات`} compact />
              <KpiCard label="مصروفات الفترة" value={formatMoney(totalExpenses)} icon={WalletCards} accent="rose" sub={`${totalExpensesCount} مصروفات`} compact />
              <KpiCard label="رصيد مستحق" value={formatMoney(totalOutstanding)} icon={WalletCards} accent="amber" sub={`${totalReceiptsCount} إيصالات متاحة للطباعة`} compact />
            </ResponsiveCardGrid>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
            <CardTitle className="text-sm font-black">Cash Flow RPC</CardTitle>
            <CardDescription>قراءة مباشرة من `rpt_cash_flow` للفترة المختارة.</CardDescription>
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

function StatementWorkspaceCue({ title, value, tone }: Readonly<{ title: string; value: string; tone: 'ready' | 'muted' }>) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background p-3">
      <p className="text-xs font-black text-muted-foreground">{title}</p>
      <p className={tone === 'ready' ? 'mt-1 font-black text-primary' : 'mt-1 font-black text-muted-foreground'}>{value}</p>
    </div>
  );
}

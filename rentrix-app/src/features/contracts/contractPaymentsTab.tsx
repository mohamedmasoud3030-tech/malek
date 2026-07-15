import { FileText, LockKeyhole, ReceiptText, WalletCards } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCompanyDate, formatDefaultCompanyMoney, formatCompanyNumber } from '@/lib/companyFormatters';
import { invoiceStatusLabels } from '@/features/financials/components/invoice-status-labels';
import { paymentMethodLabels } from '@/features/financials/components/receipt-formatters';
import type { ContractPaymentsSnapshot } from './services/contractPaymentService';
import { useContractPayments } from './useContractPayments';

const invoiceStatusTone: Record<string, string> = {
  draft: 'gray', issued: 'blue', UNPAID: 'blue',
  partial: 'gold', PARTIALLY_PAID: 'gold',
  paid: 'green', PAID: 'green',
  overdue: 'red', OVERDUE: 'red',
  void: 'gray', VOID: 'gray',
};

function formatDate(value: string): string {
  return formatCompanyDate(null, value);
}

function getPaymentsErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'تعذر تحميل مدفوعات وفواتير العقد.';
}

type Invoice = ContractPaymentsSnapshot['invoices'][number];
type Payment = ContractPaymentsSnapshot['payments'][number];

function ContractPaymentsSummary({ snapshot }: Readonly<{ snapshot: ContractPaymentsSnapshot }>) {
  return (
    <ResponsiveCardGrid desktopColumns={5}>
      <KpiCard label="عدد الفواتير" value={formatCompanyNumber(null, snapshot.summary.invoiceCount)} icon={ReceiptText} accent="primary" compact />
      <KpiCard label="عدد الدفعات" value={formatCompanyNumber(null, snapshot.summary.paymentCount)} icon={WalletCards} accent="sky" compact />
      <KpiCard label="إجمالي الفواتير" value={formatDefaultCompanyMoney(snapshot.summary.totalInvoiced)} icon={WalletCards} accent="primary" compact />
      <KpiCard label="إجمالي المدفوع" value={formatDefaultCompanyMoney(snapshot.summary.totalPaid)} icon={WalletCards} accent="emerald" compact />
      <KpiCard label="المتبقي" value={formatDefaultCompanyMoney(snapshot.summary.totalRemaining)} icon={WalletCards} accent="amber" compact />
    </ResponsiveCardGrid>
  );
}

function ContractInvoicesTable({ snapshot }: Readonly<{ snapshot: ContractPaymentsSnapshot }>) {
  const columns: ColumnDef<Invoice>[] = [
    { key: 'id', header: 'الفاتورة', render: (inv) => <span className="font-mono text-xs font-bold">#{inv.id.slice(0, 8)}</span> },
    { key: 'due_date', header: 'الاستحقاق', render: (inv) => formatDate(inv.due_date) },
    {
      key: 'status', header: 'الحالة',
      render: (inv) => (
        <StatusBadge tone={(invoiceStatusTone[inv.status ?? ''] ?? 'gray') as 'gray' | 'blue' | 'gold' | 'green' | 'red'}>
          {invoiceStatusLabels[inv.status]}
        </StatusBadge>
      ),
    },
    { key: 'amount', header: 'المبلغ', render: (inv) => <span className="font-bold">{formatDefaultCompanyMoney(inv.amount)}</span> },
    { key: 'paid_amount', header: 'المدفوع', render: (inv) => <span className="font-bold text-success tabular-nums">{formatDefaultCompanyMoney(inv.paid_amount)}</span> },
    { key: 'remaining', header: 'المتبقي', render: (inv) => <span className="font-bold">{formatDefaultCompanyMoney(inv.remaining_amount)}</span> },
  ];

  return (
    <EntityTable
      aria-label="جدول فواتير العقد"
      rows={snapshot.invoices}
      columns={columns}
      keyOf={(inv) => inv.id}
      emptyTitle="لا توجد فواتير مرتبطة"
      emptyDescription="لم يتم العثور على فواتير حالية لهذا العقد عبر مسار البيانات المعتمد."
    />
  );
}

function ContractPaymentsTable({ snapshot }: Readonly<{ snapshot: ContractPaymentsSnapshot }>) {
  const columns: ColumnDef<Payment>[] = [
    { key: 'payment_date', header: 'تاريخ الدفع', render: (p) => formatDate(p.payment_date) },
    { key: 'amount', header: 'المبلغ', render: (p) => <span className="font-bold">{formatDefaultCompanyMoney(p.amount)}</span> },
    { key: 'method', header: 'طريقة الدفع', render: (p) => paymentMethodLabels[p.payment_method] },
    { key: 'invoice_id', header: 'مرجع الفاتورة', render: (p) => <span className="font-mono text-xs font-bold">#{p.invoice_id.slice(0, 8)}</span> },
    { key: 'receipt_ref', header: 'مرجع الإيصال', render: (p) => <span className="font-mono text-xs font-bold">{p.receipt_reference}</span> },
    { key: 'ref_number', header: 'مرجع خارجي', render: (p) => p.reference_number ?? '—' },
  ];

  return (
    <EntityTable
      aria-label="جدول دفعات العقد"
      rows={snapshot.payments}
      columns={columns}
      keyOf={(p) => p.id}
      emptyTitle="لا توجد دفعات مسجلة"
      emptyDescription="سيظهر هنا سجل الدفعات والإيصالات المرجعية عند توفر دفعات منشورة على فواتير هذا العقد."
    />
  );
}

export function ContractPaymentsTab({ contractId }: Readonly<{ contractId: string }>) {
  const paymentsQuery = useContractPayments(contractId);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/35">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <WalletCards className="size-5 text-primary" />
              تبويب مدفوعات العقد
            </CardTitle>
            <CardDescription>
              عرض قراءة فقط للفواتير والدفعات ومراجع الإيصالات المرتبطة بهذا العقد فقط.
            </CardDescription>
          </div>
          <StatusBadge tone="gray">
            <LockKeyhole className="me-1 size-3" />
            قراءة فقط
          </StatusBadge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <p className="rounded-xl border border-border/70 bg-card p-4 text-sm leading-7 text-muted-foreground">
          هذا العرض لا ينشئ دفعات، ولا يصدر إيصالات، ولا يعدّل الفواتير. يتم عرض السجلات الموجودة فقط من مسارات الفواتير والمدفوعات الحالية.
        </p>

        {paymentsQuery.isLoading && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-sm font-bold text-muted-foreground">
            جاري تحميل مدفوعات العقد…
          </div>
        )}
        {paymentsQuery.isError && (
          <EmptyState
            title="تعذر تحميل المدفوعات"
            description={getPaymentsErrorMessage(paymentsQuery.error)}
            action={<Button type="button" onClick={() => paymentsQuery.refetch()}>إعادة المحاولة</Button>}
          />
        )}
        {paymentsQuery.data && (
          <div className="space-y-5">
            <ContractPaymentsSummary snapshot={paymentsQuery.data} />
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <FileText className="size-5 text-primary" />الفواتير المرتبطة
              </h3>
              <ContractInvoicesTable snapshot={paymentsQuery.data} />
            </section>
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <ReceiptText className="size-5 text-primary" />الدفعات ومراجع الإيصالات
              </h3>
              <ContractPaymentsTable snapshot={paymentsQuery.data} />
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

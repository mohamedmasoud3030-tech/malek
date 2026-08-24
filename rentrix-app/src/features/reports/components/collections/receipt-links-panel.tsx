import { ExternalLink, Printer, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate, formatMoney } from '@/features/financials/components/financials-formatters';
import { formatInvoiceStatusLabel } from '@/features/financials/components/invoice-status-labels';
import { createReceiptPrintHref } from '../../reports-page.helpers';
import { ReportPanel } from '../report-section-primitives';

export type CollectionReceiptRow = Readonly<{
  id: string;
  receipt_number: string;
  payment_date: string;
  amount: number;
  tenant_name: string | null;
  property_title: string | null;
  unit_number: string | null;
  contract_id: string | null;
  invoice_id: string | null;
  invoice_reference?: string | null;
  invoice_status?: string | null;
  payment_method: string;
  reference_number?: string | null;
  status: 'posted' | 'void';
}>;

const paymentMethodLabels: Record<string, string> = {
  cash: 'نقدًا',
  bank_transfer: 'تحويل بنكي',
  card: 'بطاقة',
  check: 'شيك',
  other: 'أخرى',
};

export function ReceiptLinksPanel({ rows, isLoading }: Readonly<{ rows: CollectionReceiptRow[]; isLoading: boolean }>) {
  const columns: ColumnDef<CollectionReceiptRow>[] = [
    {
      key: 'receipt',
      header: 'الإيصال / المرجع',
      priority: 'identity',
      render: (receipt) => (
        <div className="min-w-0">
          <p className="font-black" dir="ltr">{receipt.receipt_number}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="ltr">{receipt.reference_number || 'بدون مرجع دفع خارجي'}</p>
        </div>
      ),
    },
    {
      key: 'tenant',
      header: 'المستأجر',
      priority: 'secondary',
      render: (receipt) => receipt.tenant_name ?? 'غير محدد',
    },
    {
      key: 'propertyUnit',
      header: 'العقار / الوحدة',
      priority: 'secondary',
      render: (receipt) => (
        <div className="min-w-0">
          <p className="font-semibold">{receipt.property_title ?? 'عقار غير محدد'}</p>
          <p className="text-xs text-muted-foreground">{receipt.unit_number ? `وحدة ${receipt.unit_number}` : 'وحدة غير محددة'}</p>
        </div>
      ),
    },
    {
      key: 'invoice',
      header: 'الفاتورة المرتبطة',
      priority: 'secondary',
      render: (receipt) => receipt.invoice_id ? (
        <div className="min-w-0">
          <p className="font-semibold" dir="ltr">{receipt.invoice_reference || 'فاتورة مرتبطة'}</p>
          <p className="text-xs text-muted-foreground">{receipt.invoice_status ? formatInvoiceStatusLabel(receipt.invoice_status) : '—'}</p>
        </div>
      ) : 'غير مرتبطة بفواتير',
    },
    {
      key: 'paymentDate',
      header: 'تاريخ الدفع',
      priority: 'detail',
      render: (receipt) => <span dir="ltr" className="tabular-nums">{formatDate(receipt.payment_date)}</span>,
    },
    {
      key: 'method',
      header: 'طريقة الدفع',
      priority: 'detail',
      render: (receipt) => paymentMethodLabels[receipt.payment_method] ?? receipt.payment_method,
    },
    {
      key: 'amount',
      header: 'المبلغ',
      priority: 'primary',
      render: (receipt) => <strong dir="ltr" className="tabular-nums">{formatMoney(receipt.amount)}</strong>,
    },
    {
      key: 'status',
      header: 'الحالة',
      priority: 'primary',
      render: (receipt) => (
        <StatusBadge tone={receipt.status === 'posted' ? 'success' : 'danger'}>
          {receipt.status === 'posted' ? 'مرحّل' : 'ملغى'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      priority: 'actions',
      render: (receipt) => (
        <div className="flex flex-wrap gap-1.5" data-row-action>
          <Button asChild size="sm" variant="secondary" className="min-h-11">
            <a href={createReceiptPrintHref(receipt.id)}>
              <Printer className="me-1 size-3.5" aria-hidden="true" />
              الإيصال
            </a>
          </Button>
          {receipt.contract_id ? (
            <Button asChild size="sm" variant="ghost" className="min-h-11">
              <a href={`/contracts/${encodeURIComponent(receipt.contract_id)}`}>
                <ExternalLink className="me-1 size-3.5" aria-hidden="true" />
                العقد
              </a>
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <ReportPanel
      title="سجل التحصيلات والإيصالات"
      description="المستأجر والعقار والوحدة والعقد والفاتورة وطريقة الدفع والمرجع والحالة في سجل واحد."
      icon={ReceiptText}
      isLoading={isLoading}
    >
      <div className="p-3 sm:p-4">
        <EntityTable
          aria-label="سجل التحصيلات والإيصالات"
          rows={rows}
          columns={columns}
          keyOf={(receipt) => receipt.id}
          isLoading={isLoading}
          emptyTitle="لا توجد تحصيلات ضمن الفترة"
          emptyDescription="غيّر نطاق التقرير أو الفلاتر لعرض تحصيلات أخرى."
        />
      </div>
    </ReportPanel>
  );
}

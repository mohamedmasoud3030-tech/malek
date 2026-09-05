import { FolderOpen, HandCoins } from 'lucide-react';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { PreviewFacts } from '@/components/ui/quick-preview';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { getFinanceStatusTone, mapInvoiceStatusToFinanceKind } from '../finance-status-mapping';
import { formatDate, formatInvoiceStatusLabel, formatMoney } from './financials-formatters';
import { getInvoiceGrossAmount, type InvoiceListItem } from '../invoices/invoiceService';
import { getSafeRemainingAmount } from '../financialMath';
import { billingPeriodLabel } from './invoice-list-section';

/**
 * Invoice Quick Preview — glance-first.
 *
 * Amounts are shown from live totals without recomputing status. The full
 * collection workspace (payment form, payment history, document export) is
 * reached through the explicit footer action; nothing is collected here.
 */
export function InvoicePreviewDialog({
  invoice,
  open,
  onOpenChange,
  onOpenWorkspace,
  onCollect,
}: Readonly<{
  invoice: InvoiceListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenWorkspace: (invoiceId: string) => void;
  onCollect?: (invoiceId: string) => void;
}>) {
  const grossAmount = invoice ? getInvoiceGrossAmount(invoice) : 0;
  const remaining = invoice ? getSafeRemainingAmount(grossAmount, invoice.paid_amount) : 0;

  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={invoice ? (invoice.reference ?? 'فاتورة بلا مرجع') : 'معاينة الفاتورة'}
      description={invoice ? invoice.contracts
        ? `${invoice.contracts.people?.full_name ?? 'مستأجر غير محدد'} · ${invoice.contracts.properties?.title ?? 'عقار غير محدد'} · ${invoice.contracts.units?.unit_number ? `وحدة ${invoice.contracts.units.unit_number}` : ''}`
        : undefined
      : undefined}
      status={invoice ? (
        <StatusBadge tone={getFinanceStatusTone(mapInvoiceStatusToFinanceKind(invoice.status))}>{formatInvoiceStatusLabel(invoice.status)}</StatusBadge>
      ) : undefined}
      footer={invoice ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="min-h-11 flex-1 sm:flex-none"
            onClick={() => onOpenWorkspace(invoice.id)}
          >
            <FolderOpen className="me-2 size-4" aria-hidden="true" />
            فتح مساحة الفاتورة والتحصيل
          </Button>
          {onCollect ? (
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => onCollect(invoice.id)}>
              <HandCoins className="me-2 size-4" aria-hidden="true" />
              تحصيل
            </Button>
          ) : null}
        </div>
      ) : undefined}
    >
      {invoice ? (
        <PreviewFacts
          rows={[
            { label: 'المستأجر', value: invoice.contracts?.people?.full_name ?? 'غير محدد' },
            {
              label: 'العقار / الوحدة',
              value: invoice.contracts?.properties?.title
                ? `${invoice.contracts.properties.title}${invoice.contracts.units?.unit_number ? ` · وحدة ${invoice.contracts.units.unit_number}` : ''}`
                : 'غير محدد',
            },
            { label: 'فترة الفاتورة', value: billingPeriodLabel(invoice) },
            { label: 'تاريخ الاستحقاق', value: invoice.due_date ? formatDate(invoice.due_date) : '—' },
            { label: 'الإجمالي شامل VAT', value: <span dir="ltr">{formatMoney(grossAmount)}</span> },
            { label: 'المدفوع', value: <span dir="ltr">{formatMoney(invoice.paid_amount)}</span> },
            {
              label: 'المتبقي',
              value: <span dir="ltr" className={remaining > 0 ? 'font-bold text-destructive' : 'text-success'}>{formatMoney(remaining)}</span>,
            },
          ]}
        />
      ) : null}
    </EntityPreviewDialog>
  );
}

import { Ban, Copy, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { PreviewFacts } from '@/components/ui/quick-preview';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate, formatMoney } from '../components/financials-formatters';
import { formatReceiptContext, paymentMethodLabels, receiptStatusLabels } from '../components/receipt-formatters';
import type { ReceiptRecord } from './receiptService';

/**
 * Receipt Quick Preview — the canonical in-app receipt inspection surface.
 *
 * Clicking a receipt from the register (desktop row or mobile card) opens this
 * compact centered window: amount, date, method, reference, linked invoice and
 * context, plus the actions that belong to receipt handling. Printing keeps
 * using the dedicated print surface (A4); the user is never redirected to a
 * page just to look at a receipt.
 */
export function ReceiptPreviewDialog({
  receipt,
  open,
  onOpenChange,
  onPrint,
  canRequestVoid,
  onRequestVoid,
}: Readonly<{
  receipt: ReceiptRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrint?: (receiptId: string) => void;
  canRequestVoid: boolean;
  onRequestVoid?: (receipt: ReceiptRecord) => void;
}>) {
  const handleCopyNumber = () => {
    if (!receipt) return;
    void navigator.clipboard.writeText(receipt.receipt_number).then(() => {
      toast.success(`تم نسخ رقم الإيصال: ${receipt.receipt_number}`);
    });
  };

  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={receipt ? `إيصال ${receipt.receipt_number}` : 'معاينة الإيصال'}
      description={receipt?.receipt_number ? `مرجع: ${receipt.receipt_number}` : undefined}
      status={receipt ? (
        <StatusBadge tone={receipt.status === 'posted' ? 'success' : 'danger'}>
          {receiptStatusLabels[receipt.status]}
        </StatusBadge>
      ) : undefined}
      footer={receipt ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="min-h-11 flex-1 sm:flex-none"
            onClick={() => { if (onPrint) onPrint(receipt.id); }}
          >
            <Printer className="me-2 size-4" aria-hidden="true" />
            طباعة A4
          </Button>
          <Button type="button" variant="secondary" className="min-h-11" onClick={handleCopyNumber}>
            <Copy className="me-2 size-4" aria-hidden="true" />
            نسخ رقم الإيصال
          </Button>
          {canRequestVoid && receipt.status === 'posted' && onRequestVoid ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 text-destructive"
              onClick={() => onRequestVoid(receipt)}
            >
              <Ban className="me-2 size-4" aria-hidden="true" />
              طلب إلغاء
            </Button>
          ) : null}
        </div>
      ) : undefined}
    >
      {receipt ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-[11px] font-medium text-muted-foreground">المبلغ المدفوع</p>
            <p className="mt-1 text-2xl font-black text-success [overflow-wrap:anywhere]" dir="ltr">
              {formatMoney(receipt.amount)}
            </p>
          </div>
          <PreviewFacts
            rows={[
              { label: 'تاريخ الدفع', value: formatDate(receipt.payment_date) },
              { label: 'طريقة الدفع', value: paymentMethodLabels[receipt.payment_method] ?? receipt.payment_method },
              { label: 'المرجع', value: receipt.reference_number ? <span dir="ltr">{receipt.reference_number}</span> : '—' },
              {
                label: 'الفاتورة المرتبطة',
                value: receipt.invoice_reference
                  ? <span dir="ltr">{receipt.invoice_reference}</span>
                  : receipt.invoice_id
                    ? `فاتورة ${receipt.invoice_id.slice(0, 8)}`
                    : 'بدون فاتورة',
              },
              { label: 'المستأجر', value: receipt.tenant_name ?? 'غير محدد' },
              {
                label: 'العقار / الوحدة',
                value: receipt.property_title
                  ? `${receipt.property_title}${receipt.unit_number ? ` · وحدة ${receipt.unit_number}` : ''}`
                  : 'غير محدد',
              },
              { label: 'السياق', value: formatReceiptContext(receipt), wide: true },
            ]}
          />
        </div>
      ) : null}
    </EntityPreviewDialog>
  );
}

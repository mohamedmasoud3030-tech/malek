import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { EntityTable } from '@/components/ui/entity-table';
import { Download, Printer, ReceiptText } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ReceiptRecord } from '../receipts/receiptService';
import { formatDate, formatMoney, formatShortId } from './financials-formatters';
import { ReceiptDetailCard } from './receipt-detail-card';
import { formatReceiptContext, paymentMethodLabels, receiptStatusLabels } from './receipt-formatters';

type ReceiptsSectionProps = {
  receipts: ReceiptRecord[];
  selectedReceiptId: string;
  receiptDetail: ReceiptRecord | undefined;
  isReceiptsLoading: boolean;
  isReceiptsError: boolean;
  receiptsError: unknown;
  isReceiptDetailLoading: boolean;
  isReceiptDetailError: boolean;
  receiptDetailError: unknown;
  onSelectReceipt: (receiptId: string) => void;
  onPrintReceipt?: (receiptId: string) => void;
  onExportReceipt?: (receiptId: string) => void;
};

export function ReceiptsSection({
  receipts,
  selectedReceiptId,
  receiptDetail,
  isReceiptsLoading,
  isReceiptsError,
  receiptsError,
  isReceiptDetailLoading,
  isReceiptDetailError,
  receiptDetailError,
  onSelectReceipt,
  onPrintReceipt,
  onExportReceipt,
}: ReceiptsSectionProps) {
  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <ReceiptText className="size-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>الإيصالات</CardTitle>
              <p className="mt-1 text-xs font-bold leading-5 text-muted-foreground">راجع تفاصيل التحصيل وطريقة الدفع والفاتورة المرتبطة بوضوح.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-3 sm:p-6">
          <EntityTable
            aria-label="جدول الإيصالات"
            rows={receipts}
            columns={[
              { key: 'receipt_number', header: 'رقم الإيصال', render: (receipt) => <span className="font-bold">{`إيصال ${receipt.receipt_number}`}</span> },
              { key: 'payment_date', header: 'التاريخ والطريقة', render: (receipt) => <span>{formatDate(receipt.payment_date)} · {paymentMethodLabels[receipt.payment_method] ?? receipt.payment_method}</span> },
              { key: 'invoice', header: 'الفاتورة والسياق', render: (receipt) => <span>{formatShortId(receipt.invoice_id)} · {formatReceiptContext(receipt)}</span> },
              { key: 'amount', header: 'المبلغ المحصل', render: (receipt) => <span dir="ltr" className="font-black text-success">{formatMoney(receipt.amount)}</span> },
              { key: 'status', header: 'الحالة', render: (receipt) => <StatusBadge tone={receipt.status === 'void' ? 'danger' : 'success'}>{receiptStatusLabels[receipt.status] ?? receipt.status}</StatusBadge> },
              {
                key: 'actions',
                header: 'إجراءات',
                render: (receipt) => (
                  <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                    {onPrintReceipt ? <Button variant="secondary" className="min-h-11" onClick={() => onPrintReceipt(receipt.id)}><Printer className="me-1 size-4" aria-hidden="true" />طباعة</Button> : null}
                    {onExportReceipt ? <Button variant="secondary" className="min-h-11" onClick={() => onExportReceipt(receipt.id)}><Download className="me-1 size-4" aria-hidden="true" />PDF</Button> : null}
                  </div>
                ),
              },
            ]}
            keyOf={(receipt) => receipt.id}
            isLoading={isReceiptsLoading}
            error={isReceiptsError ? receiptsError : null}
            errorTitle="تعذر تحميل الإيصالات"
            emptyTitle="لا توجد إيصالات حتى الآن"
            emptyDescription="ستظهر هنا الإيصالات والتحصيلات المرتبطة بالفواتير."
            onRowClick={(receipt) => onSelectReceipt(receipt.id)}
          />
        </CardContent>
      </Card>

      <EntityPreviewDialog
        open={selectedReceiptId.length > 0}
        onOpenChange={(open) => { if (!open) onSelectReceipt(''); }}
        title="معاينة الإيصال"
        description={receiptDetail ? `الإيصال ${receiptDetail.receipt_number} — التفاصيل بدون مغادرة سجل الإيصالات.` : 'تحميل تفاصيل الإيصال...'}
      >
        <ReceiptDetailCard
          selectedReceiptId={selectedReceiptId}
          receiptDetail={receiptDetail}
          isLoading={isReceiptDetailLoading}
          isError={isReceiptDetailError}
          error={receiptDetailError}
        />
      </EntityPreviewDialog>
    </>
  );
}

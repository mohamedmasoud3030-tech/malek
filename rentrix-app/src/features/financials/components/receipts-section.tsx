import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Printer, ReceiptText } from 'lucide-react';
import { MobileCard } from '@/components/ui/mobile-card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ReceiptRecord } from '../receipts/receiptService';
import { formatDate, formatMoney, formatShortId, getErrorMessage } from './financials-formatters';
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
        <div className="space-y-3">
          {isReceiptsLoading ? <div className="rounded-3xl border border-dashed p-8 text-center font-bold text-muted-foreground">جارٍ تحميل الإيصالات...</div> : null}
          {isReceiptsError ? <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center font-bold text-destructive">{getErrorMessage(receiptsError, 'تعذر تحميل الإيصالات')}</div> : null}
          {!isReceiptsLoading && !isReceiptsError && receipts.length === 0 ? (
            <div className="rounded-3xl border border-dashed p-8 text-center font-bold text-muted-foreground">لا توجد إيصالات حتى الآن</div>
          ) : null}
          {!isReceiptsLoading && !isReceiptsError && receipts.map((receipt) => {
            const isSelected = selectedReceiptId === receipt.id;
            const isVoid = receipt.status === 'VOID';
            return (
              <MobileCard
                key={receipt.id}
                variant={isSelected ? 'elevated' : 'default'}
                accent={isVoid ? 'danger' : 'success'}
                className={isSelected ? 'ring-2 ring-primary/20' : undefined}
                title={`إيصال ${receipt.receipt_number}`}
                subtitle={`${formatDate(receipt.payment_date)} · ${paymentMethodLabels[receipt.payment_method] ?? receipt.payment_method}`}
                badge={<StatusBadge tone={isVoid ? 'red' : 'green'}>{receiptStatusLabels[receipt.status] ?? receipt.status}</StatusBadge>}
                onClick={() => onSelectReceipt(receipt.id)}
                meta={(
                  <div className="space-y-1">
                    <p><span className="font-black text-foreground">الفاتورة:</span> {formatShortId(receipt.invoice_id)}</p>
                    <p><span className="font-black text-foreground">السياق:</span> {formatReceiptContext(receipt)}</p>
                  </div>
                )}
                stats={(
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-muted-foreground">المبلغ المحصل</span>
                    <span className="text-xl font-black text-success">{formatMoney(receipt.amount)}</span>
                  </div>
                )}
                actions={(onPrintReceipt || onExportReceipt) ? (
                  <div className="grid w-full grid-cols-2 gap-2">
                    {onPrintReceipt && (
                      <Button variant="secondary" className="min-h-11 rounded-xl text-xs" onClick={() => onPrintReceipt(receipt.id)}>
                        <Printer className="me-1 size-4" />طباعة
                      </Button>
                    )}
                    {onExportReceipt && (
                      <Button variant="secondary" className="min-h-11 rounded-xl text-xs" onClick={() => onExportReceipt(receipt.id)}>
                        <Download className="me-1 size-4" />PDF
                      </Button>
                    )}
                  </div>
                ) : undefined}
              />
            );
          })}
        </div>

        <ReceiptDetailCard
          selectedReceiptId={selectedReceiptId}
          receiptDetail={receiptDetail}
          isLoading={isReceiptDetailLoading}
          isError={isReceiptDetailError}
          error={receiptDetailError}
        />
      </CardContent>
    </Card>
  );
}

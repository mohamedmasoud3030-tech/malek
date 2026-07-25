import { Printer } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ReceiptRecord } from '../receipts/receiptService';
import { formatDate, formatMoney, formatShortId, getErrorMessage } from './financials-formatters';
import { formatReceiptContext, paymentMethodLabels } from './receipt-formatters';

type ReceiptDetailCardProps = {
  selectedReceiptId: string;
  receiptDetail: ReceiptRecord | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
};

function getReceiptPrintHref(receiptId: string) {
  return `/receipts?receiptId=${encodeURIComponent(receiptId)}`;
}

export function ReceiptDetailCard({ selectedReceiptId, receiptDetail, isLoading, isError, error }: ReceiptDetailCardProps) {
  return (
    <div className="rounded-2xl border p-4">
      <h4 className="font-black">تفاصيل الإيصال</h4>
      {selectedReceiptId.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="اختر إيصالاً" description="اضغط على أي إيصال من القائمة لعرض تفاصيله وروابط الطباعة هنا." />
        </div>
      ) : null}
      {selectedReceiptId && isLoading ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4" role="status" aria-live="polite" aria-label="جارٍ تحميل تفاصيل الإيصال">
          {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
        </div>
      ) : null}
      {selectedReceiptId && isError ? (
        <div className="mt-3">
          <EmptyState
            title="تعذر تحميل تفاصيل الإيصال"
            description={getErrorMessage(error, 'أعد المحاولة بعد لحظات.')}
            role="alert"
            ariaLive="assertive"
          />
        </div>
      ) : null}
      {receiptDetail ? (
        <details className="group mt-3 overflow-hidden rounded-2xl border border-border/70 bg-card open:shadow-sm" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-black transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <span>اضغط لتوسيع تفاصيل الإيصال {receiptDetail.receipt_number}</span>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] text-primary transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="space-y-3 border-t border-border/70 p-4">
          <div className="flex justify-end print:hidden">
            <Button variant="secondary" asChild>
              <a href={getReceiptPrintHref(receiptDetail.id)}><Printer className="me-2 size-4" />عرض/طباعة الإيصال</a>
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">رقم الإيصال</p>
              <p className="mt-1 font-bold">{receiptDetail.receipt_number}</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">رقم الدفع</p>
              <p className="mt-1 font-bold">{formatShortId(receiptDetail.payment_id)}</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">رقم الفاتورة</p>
              <p className="mt-1 font-bold">{formatShortId(receiptDetail.invoice_id)}</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">رقم العقد</p>
              <p className="mt-1 font-bold">{formatShortId(receiptDetail.contract_id)}</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">تاريخ الدفع</p>
              <p className="mt-1 font-bold">{formatDate(receiptDetail.payment_date)}</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">المبلغ</p>
              <p className="mt-1 font-bold">{formatMoney(receiptDetail.amount)}</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">طريقة الدفع</p>
              <p className="mt-1 font-bold">{paymentMethodLabels[receiptDetail.payment_method] ?? receiptDetail.payment_method}</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">المرجع</p>
              <p className="mt-1 font-bold">{receiptDetail.reference_number ?? '—'}</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">تاريخ الإنشاء</p>
              <p className="mt-1 font-bold">{formatDate(receiptDetail.created_at)}</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-3 md:col-span-2 xl:col-span-3">
              <p className="text-xs text-muted-foreground">السياق المرتبط</p>
              <p className="mt-1 font-bold">{formatReceiptContext(receiptDetail)}</p>
            </div>
          </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}

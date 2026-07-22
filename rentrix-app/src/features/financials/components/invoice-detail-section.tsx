import { CircleCheck, Download, HandCoins, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Payment } from '@/types/domain';
import { getInvoiceGrossAmount, type InvoiceDetail } from '../invoices/invoiceService';
import { openReceiptPrintTab } from '../receipts/receipt-print';
import { formatDate, formatMoney, getErrorMessage } from './financials-formatters';
import { QuickPaymentForm } from './quick-payment-form';
import { formatReceiptNumber, getPaymentReceiptBinding, paymentMethodLabels } from './receipt-formatters';

export type CollectionSuccess = {
  receiptId: string;
  amount: number;
  method: Payment['payment_method'];
};

type InvoiceDetailSectionProps = {
  selectedInvoiceId: string;
  invoiceDetail: InvoiceDetail | undefined;
  remaining: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  amount: string;
  method: Payment['payment_method'];
  paymentDate: string;
  reference: string;
  amountValidationMessage: string;
  isPaymentPending: boolean;
  isPaymentDisabled: boolean;
  /**
   * Last successfully posted payment within this workspace. Drives the
   * inline success panel (print receipt / collect next invoice) so the
   * collector keeps flow without hunting for the receipt list.
   */
  collectionSuccess?: CollectionSuccess | null;
  hasNextCollectibleInvoice?: boolean;
  collectionFocusKey?: number;
  onCollectNextInvoice?: () => void;
  onPrintCollectionReceipt?: () => void;
  onDismissCollection?: () => void;
  onAmountChange: (amount: string) => void;
  onMethodChange: (method: Payment['payment_method']) => void;
  onPaymentDateChange: (paymentDate: string) => void;
  onReferenceChange: (reference: string) => void;
  onPostPayment: () => void;
  onExportPdf?: () => void;
};

export function InvoiceDetailSection({
  selectedInvoiceId,
  invoiceDetail,
  remaining,
  isLoading,
  isError,
  error,
  amount,
  method,
  paymentDate,
  reference,
  amountValidationMessage,
  isPaymentPending,
  isPaymentDisabled,
  collectionSuccess = null,
  hasNextCollectibleInvoice = false,
  collectionFocusKey = 0,
  onCollectNextInvoice,
  onPrintCollectionReceipt,
  onDismissCollection,
  onAmountChange,
  onMethodChange,
  onPaymentDateChange,
  onReferenceChange,
  onPostPayment,
  onExportPdf,
}: InvoiceDetailSectionProps) {
  const grossAmount = invoiceDetail ? getInvoiceGrossAmount(invoiceDetail) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>تفاصيل الفاتورة وسجل المدفوعات</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedInvoiceId ? <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">اختر فاتورة لعرض التفاصيل وتسجيل دفعة</div> : null}
        {selectedInvoiceId && isLoading ? <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">جارٍ تحميل تفاصيل الفاتورة...</div> : null}
        {selectedInvoiceId && isError ? <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center text-destructive">{getErrorMessage(error, 'تعذر تحميل تفاصيل الفاتورة')}</div> : null}
        {invoiceDetail ? <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/20 p-4">
            <div>
              <p className="text-sm text-muted-foreground">إخراج المستند</p>
              <p className="font-black">يمكن تصدير الفاتورة الحالية من نفس بياناتها المحملة.</p>
            </div>
            <Button type="button" variant="secondary" onClick={onExportPdf} disabled={!onExportPdf}>
              <Download className="me-2 size-4" />تصدير PDF
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-6">
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">رقم الفاتورة</p>
              <p className="mt-2 font-black">#{invoiceDetail.id.slice(0, 8)}</p>
            </div>
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">تاريخ الاستحقاق</p>
              <p className="mt-2 font-black">{formatDate(invoiceDetail.due_date)}</p>
            </div>
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">الإجمالي شامل VAT</p>
              <p className="mt-2 font-black">{formatMoney(grossAmount)}</p>
            </div>
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">VAT</p>
              <p className="mt-2 font-black">{formatMoney(invoiceDetail.tax_amount)}</p>
            </div>
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">المدفوع</p>
              <p className="mt-2 font-black">{formatMoney(invoiceDetail.paid_amount)}</p>
            </div>
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">المتبقي</p>
              <p className="mt-2 font-black">{formatMoney(remaining)}</p>
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <h4 className="font-black">سجل المدفوعات</h4>
            <div className="mt-3 space-y-2">
              {invoiceDetail.payments.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد مدفوعات مسجلة لهذه الفاتورة</p> : null}
              {invoiceDetail.payments.map((payment) => {
                const binding = getPaymentReceiptBinding(payment);
                return (
                  <div key={payment.id} className={`flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between ${binding.isVoid ? 'border border-dashed border-danger/40 bg-muted/10' : 'bg-muted/30'}`}>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                      <span>{formatDate(payment.payment_date)}</span>
                      <span className="text-sm text-muted-foreground">{paymentMethodLabels[payment.payment_method] ?? payment.payment_method}</span>
                      <span className={binding.isVoid ? 'font-bold text-danger' : 'font-bold'}>{formatMoney(payment.amount)}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-lg bg-background px-2 py-1 text-xs font-bold tabular-nums text-muted-foreground" dir="ltr">{binding.receiptNumber}</span>
                      {binding.isVoid ? <span className="text-xs font-bold text-danger">{binding.statusLabel}</span> : null}
                      <Button type="button" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => openReceiptPrintTab(payment.id)} title={`طباعة إيصال ${binding.receiptNumber}`}>
                        <Printer className="me-1 size-4" />إيصال
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {collectionSuccess ? (
            <div className="rounded-2xl border border-success/40 bg-success/10 p-4" role="status">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/15 text-success">
                    <CircleCheck className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-success">تم تسجيل الدفعة بنجاح</p>
                    <p className="mt-1 text-sm font-bold text-muted-foreground">
                      تم تحصيل {formatMoney(collectionSuccess.amount)} ({paymentMethodLabels[collectionSuccess.method] ?? collectionSuccess.method}) — إيصال القبض <span className="tabular-nums" dir="ltr">{formatReceiptNumber(collectionSuccess.receiptId)}</span> جاهز للطباعة أو يمكنك متابعة التحصيل مباشرة.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {onPrintCollectionReceipt ? (
                    <Button type="button" variant="outline" className="min-h-10" onClick={onPrintCollectionReceipt}>
                      <Printer className="me-1 size-4" />طباعة الإيصال
                    </Button>
                  ) : null}
                  {hasNextCollectibleInvoice && onCollectNextInvoice ? (
                    <Button type="button" className="min-h-10" onClick={onCollectNextInvoice}>
                      <HandCoins className="me-1 size-4" />تحصيل الفاتورة التالية
                    </Button>
                  ) : null}
                  {onDismissCollection ? (
                    <Button type="button" variant="ghost" className="min-h-10 px-2" onClick={onDismissCollection} aria-label="إغلاق تنبيه النجاح">
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <QuickPaymentForm
            remainingAmount={remaining}
            amount={amount}
            method={method}
            paymentDate={paymentDate}
            reference={reference}
            amountValidationMessage={amountValidationMessage}
            isPending={isPaymentPending}
            isPaymentDisabled={isPaymentDisabled}
            focusKey={collectionFocusKey}
            onAmountChange={onAmountChange}
            onMethodChange={onMethodChange}
            onPaymentDateChange={onPaymentDateChange}
            onReferenceChange={onReferenceChange}
            onPostPayment={onPostPayment}
          />
        </> : null}
      </CardContent>
    </Card>
  );
}

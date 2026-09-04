import { CircleCheck, Download, HandCoins, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PreviewFacts } from '@/components/ui/quick-preview';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import type { Payment } from '@/types/domain';
import { getInvoiceGrossAmount, type InvoiceDetail } from '../invoices/invoiceService';
import { openReceiptPrintTab } from '../receipts/receipt-print';
import type { ReceiptRecord } from '../receipts/receiptService';
import { formatDate, formatMoney, formatShortId, getErrorMessage } from './financials-formatters';
import { QuickPaymentForm } from './quick-payment-form';
import { formatReceiptContext, getPaymentReceiptBinding, paymentMethodLabels } from './receipt-formatters';

export type CollectionSuccess = {
  receiptId: string;
  receiptNumber: string | null;
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
   * inline success panel (receipt confirmation / print / collect next) so the
   * collector keeps flow without opening a second receipt dialog.
   */
  collectionSuccess?: CollectionSuccess | null;
  collectionReceiptDetail?: ReceiptRecord;
  isCollectionReceiptLoading?: boolean;
  isCollectionReceiptError?: boolean;
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
  collectionReceiptDetail,
  isCollectionReceiptLoading = false,
  isCollectionReceiptError = false,
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
  const collectionReceiptNumber = collectionReceiptDetail?.receipt_number ?? collectionSuccess?.receiptNumber ?? null;

  return (
    <section className="space-y-4" aria-labelledby="invoice-detail-heading" data-invoice-detail>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="invoice-detail-heading" className="text-base font-black">تفاصيل الفاتورة وسجل المدفوعات</h3>
        {invoiceDetail ? (
          <Button type="button" variant="secondary" className="min-h-11" onClick={onExportPdf} disabled={!onExportPdf}>
            <Download className="me-2 size-4" aria-hidden="true" />تصدير PDF
          </Button>
        ) : null}
      </div>
      {!selectedInvoiceId ? <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">اختر فاتورة لعرض التفاصيل وتسجيل دفعة</div> : null}
      {selectedInvoiceId && isLoading ? <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">جارٍ تحميل تفاصيل الفاتورة...</div> : null}
      {selectedInvoiceId && isError ? <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center text-destructive">{getErrorMessage(error, 'تعذر تحميل تفاصيل الفاتورة')}</div> : null}
      {invoiceDetail ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-12 lg:items-start">
          <div className="min-w-0 space-y-4 lg:col-span-7">
          <PreviewFacts
            rows={[
              { label: 'رقم الفاتورة', value: invoiceDetail.reference ?? 'فاتورة بلا مرجع' },
              { label: 'تاريخ الاستحقاق', value: formatDate(invoiceDetail.due_date) },
              { label: 'الإجمالي شامل VAT', value: <span dir="ltr">{formatMoney(grossAmount)}</span> },
              { label: 'VAT', value: <span dir="ltr">{formatMoney(invoiceDetail.tax_amount)}</span> },
              { label: 'المدفوع', value: <span dir="ltr">{formatMoney(invoiceDetail.paid_amount)}</span> },
              { label: 'المتبقي', value: <span dir="ltr">{formatMoney(remaining)}</span> },
            ]}
          />

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
                      <Button type="button" variant="outline" className="min-h-11 px-2.5 text-xs" onClick={() => openReceiptPrintTab(payment.id)} title={`طباعة إيصال ${binding.receiptNumber}`}>
                        <Printer className="me-1 size-4" />إيصال
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {collectionSuccess ? (
            <div className="rounded-2xl border border-success/40 bg-success/10 p-4" role="status" data-collection-receipt-confirmation>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/15 text-success">
                    <CircleCheck className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-success">تم تسجيل الدفعة بنجاح</p>
                    <p className="mt-1 text-sm font-bold text-muted-foreground">
                      تم تحصيل {formatMoney(collectionSuccess.amount)} ({paymentMethodLabels[collectionSuccess.method] ?? collectionSuccess.method})
                      {collectionReceiptNumber ? <> — إيصال القبض <span className="tabular-nums" dir="ltr">{collectionReceiptNumber}</span></> : null}.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {onPrintCollectionReceipt ? (
                    <Button type="button" variant="outline" className="min-h-11" onClick={onPrintCollectionReceipt}>
                      <Printer className="me-1 size-4" />عرض/طباعة الإيصال
                    </Button>
                  ) : null}
                  {hasNextCollectibleInvoice && onCollectNextInvoice ? (
                    <Button type="button" className="min-h-11" onClick={onCollectNextInvoice}>
                      <HandCoins className="me-1 size-4" />تحصيل الفاتورة التالية
                    </Button>
                  ) : null}
                  {onDismissCollection ? (
                    <Button type="button" variant="ghost" className="min-h-11 px-2" onClick={onDismissCollection} aria-label="إغلاق تنبيه النجاح">
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>

              {isCollectionReceiptLoading && !collectionReceiptDetail ? (
                <p className="mt-3 rounded-xl border border-success/20 bg-background/70 px-3 py-2 text-xs font-bold text-muted-foreground" aria-live="polite">
                  جارٍ تأكيد بيانات إيصال القبض من السجل...
                </p>
              ) : null}

              {collectionReceiptDetail ? (
                <div className="mt-3 rounded-xl border border-success/20 bg-background/75 p-3">
                  <ResponsiveCardGrid desktopColumns={3} gap="sm">
                    <div>
                      <p className="text-xs font-bold text-muted-foreground">رقم الإيصال المعتمد</p>
                      <p className="mt-1 font-black tabular-nums" dir="ltr">{collectionReceiptDetail.receipt_number}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-muted-foreground">الفاتورة</p>
                      <p className="mt-1 font-black">{collectionReceiptDetail.invoice_reference ?? formatShortId(collectionReceiptDetail.invoice_id)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-muted-foreground">السياق</p>
                      <p className="mt-1 font-black">{formatReceiptContext(collectionReceiptDetail)}</p>
                    </div>
                  </ResponsiveCardGrid>
                </div>
              ) : null}

              {isCollectionReceiptError && !collectionReceiptDetail ? (
                <p className="mt-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-bold text-warning">
                  تم تسجيل الدفعة، لكن تعذر تحميل تفاصيل الإيصال الآن. يمكنك فتح الإيصال من زر العرض/الطباعة دون إعادة تسجيل الدفع.
                </p>
              ) : null}
            </div>
          ) : null}

          </div>

          <div className="min-w-0 lg:col-span-5">
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
          </div>
        </div>
      ) : null}
    </section>
  );
}

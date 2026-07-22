import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Payment } from '@/types/domain';
import { getInvoiceGrossAmount, type InvoiceDetail } from '../invoices/invoiceService';
import { formatDate, formatMoney, getErrorMessage } from './financials-formatters';
import { QuickPaymentForm } from './quick-payment-form';
import { paymentMethodLabels } from './receipt-formatters';

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
              {invoiceDetail.payments.map((payment) => (
                <div key={payment.id} className="flex flex-col gap-1 rounded-xl bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>{formatDate(payment.payment_date)}</span>
                  <span className="font-bold">{formatMoney(payment.amount)}</span>
                  <span className="text-sm text-muted-foreground">{paymentMethodLabels[payment.payment_method] ?? payment.payment_method}</span>
                </div>
              ))}
            </div>
          </div>

          <QuickPaymentForm
            remainingAmount={remaining}
            amount={amount}
            method={method}
            paymentDate={paymentDate}
            reference={reference}
            amountValidationMessage={amountValidationMessage}
            isPending={isPaymentPending}
            isPaymentDisabled={isPaymentDisabled}
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

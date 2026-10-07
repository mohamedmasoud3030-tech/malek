import { isValidDateInput } from '../financials-date-utils';
import { getInvoiceRemainingAmount, type InvoiceRemainingInput } from './invoice-amounts';

export function getInvoicePaymentValidationMessage({
  amount,
  amountValue,
  invoiceDetail,
  paymentDate,
  rawAmountValue,
  selectedInvoiceId,
}: Readonly<{
  amount: string;
  amountValue: number;
  invoiceDetail: (InvoiceRemainingInput & { id: string }) | undefined;
  paymentDate: string;
  rawAmountValue: number;
  selectedInvoiceId: string;
}>): string {
  if (!selectedInvoiceId || !invoiceDetail || invoiceDetail.id !== selectedInvoiceId) return 'اختر فاتورة صالحة أولاً';
  if (!amount.trim()) return 'المبلغ مطلوب';
  if (!Number.isFinite(rawAmountValue)) return 'المبلغ يجب أن يكون رقماً صالحاً';
  if (amountValue <= 0) return 'المبلغ يجب أن يكون أكبر من صفر';
  if (amountValue > getInvoiceRemainingAmount(invoiceDetail)) return 'المبلغ يجب ألا يتجاوز الرصيد المتبقي';
  if (!paymentDate) return 'تاريخ الدفع مطلوب';
  if (!isValidDateInput(paymentDate)) return 'تاريخ الدفع غير صالح';
  return '';
}

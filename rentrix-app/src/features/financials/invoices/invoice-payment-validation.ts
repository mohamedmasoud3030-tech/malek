import { isValidDateInput } from '../financials-date-utils';
import { getSafeRemainingAmount, toFinancialNumber } from '../financialMath';
import { getInvoiceGrossAmount } from './invoiceService';

import type { Invoice } from '@/types/domain';

type InvoiceRemainingInput = Pick<Invoice, 'amount' | 'paid_amount'> & Partial<Pick<Invoice, 'tax_amount'>>;

/**
 * Remaining collectible amount for an invoice — ALWAYS gross-based
 * (net amount + VAT − paid), matching the list view, the summary cards and
 * the status logic in summarizeInvoices. Using the net amount here previously
 * prevented collectors from ever paying the VAT portion of taxed invoices.
 */
export function getInvoiceRemainingAmount(invoice: InvoiceRemainingInput): number {
  return getSafeRemainingAmount(getInvoiceGrossAmount(invoice), toFinancialNumber(invoice.paid_amount));
}

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

import { describe, expect, it } from 'vitest';
import { getInvoiceRemainingAmount, getInvoicePaymentValidationMessage } from './invoice-payment-validation';

const VALID_DATE = '2026-07-22';

describe('getInvoiceRemainingAmount', () => {
  it('is gross-based: net amount plus VAT minus paid', () => {
    expect(getInvoiceRemainingAmount({ amount: 300, tax_amount: 15, paid_amount: 0 })).toBe(315);
    expect(getInvoiceRemainingAmount({ amount: 300, tax_amount: 15, paid_amount: 300 })).toBe(15);
    expect(getInvoiceRemainingAmount({ amount: 300, tax_amount: null, paid_amount: 100 })).toBe(200);
    expect(getInvoiceRemainingAmount({ amount: 300, tax_amount: 15, paid_amount: 315 })).toBe(0);
  });
});

describe('getInvoicePaymentValidationMessage', () => {
  const base = { paymentDate: VALID_DATE, selectedInvoiceId: 'inv-t1' };

  it('regression: a taxed invoice can be collected in full including its VAT portion', () => {
    const invoiceDetail = { id: 'inv-t1', amount: 300, tax_amount: 15, paid_amount: 0 };
    expect(getInvoicePaymentValidationMessage({ amount: '315', amountValue: 315, rawAmountValue: 315, invoiceDetail, ...base })).toBe('');

    const partiallyPaid = { id: 'inv-t1', amount: 300, tax_amount: 15, paid_amount: 300 };
    expect(getInvoicePaymentValidationMessage({ amount: '15', amountValue: 15, rawAmountValue: 15, invoiceDetail: partiallyPaid, ...base })).toBe('');
  });

  it('rejects amounts above the gross remaining balance', () => {
    const invoiceDetail = { id: 'inv-t1', amount: 300, tax_amount: 15, paid_amount: 0 };
    expect(getInvoicePaymentValidationMessage({ amount: '315.001', amountValue: 315.001, rawAmountValue: 315.001, invoiceDetail, ...base }))
      .toBe('المبلغ يجب ألا يتجاوز الرصيد المتبقي');
  });

  it('requires a selected invoice, a positive valid amount, and a valid payment date', () => {
    const invoiceDetail = { id: 'inv-t1', amount: 100, tax_amount: 0, paid_amount: 0 };

    expect(getInvoicePaymentValidationMessage({ amount: '50', amountValue: 50, rawAmountValue: 50, invoiceDetail: undefined, ...base })).toBe('اختر فاتورة صالحة أولاً');
    expect(getInvoicePaymentValidationMessage({ amount: '50', amountValue: 50, rawAmountValue: 50, invoiceDetail, paymentDate: VALID_DATE, selectedInvoiceId: 'other' })).toBe('اختر فاتورة صالحة أولاً');
    expect(getInvoicePaymentValidationMessage({ amount: '', amountValue: 0, rawAmountValue: 0, invoiceDetail, ...base })).toBe('المبلغ مطلوب');
    expect(getInvoicePaymentValidationMessage({ amount: 'abc', amountValue: 0, rawAmountValue: NaN, invoiceDetail, ...base })).toBe('المبلغ يجب أن يكون رقماً صالحاً');
    expect(getInvoicePaymentValidationMessage({ amount: '-5', amountValue: -5, rawAmountValue: -5, invoiceDetail, ...base })).toBe('المبلغ يجب أن يكون أكبر من صفر');
    expect(getInvoicePaymentValidationMessage({ amount: '50', amountValue: 50, rawAmountValue: 50, invoiceDetail, paymentDate: '', selectedInvoiceId: 'inv-t1' })).toBe('تاريخ الدفع مطلوب');
    expect(getInvoicePaymentValidationMessage({ amount: '50', amountValue: 50, rawAmountValue: 50, invoiceDetail, paymentDate: '2026-13-99', selectedInvoiceId: 'inv-t1' })).toBe('تاريخ الدفع غير صالح');
  });
});

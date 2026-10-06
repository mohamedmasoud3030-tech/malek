import { describe, expect, it } from 'vitest';
import {
  formatPaymentMethodLabel,
  formatReceiptNumber,
  formatReceiptStatusLabel,
  getPaymentReceiptBinding,
  getReceiptStatusTone,
  paymentMethodLabels,
  receiptStatusLabels,
} from './receipt-formatters';

describe('formatReceiptNumber', () => {
  it('never fabricates a receipt number from the payment id', () => {
    expect(formatReceiptNumber('1234567890abcdef')).toBe('إيصال بلا مرجع تجاري');
    expect(formatReceiptNumber('ab')).toBe('إيصال بلا مرجع تجاري');
    expect(formatReceiptNumber('')).toBe('—');
  });
});

describe('canonical receipt status vocabulary', () => {
  it('exposes exactly the two receipt statuses the service projects', () => {
    expect(Object.keys(receiptStatusLabels)).toEqual(['posted', 'void']);
    expect(formatReceiptStatusLabel('posted')).toBe('مرحّل');
    expect(formatReceiptStatusLabel('void')).toBe('ملغى');
    expect(formatReceiptStatusLabel(null)).toBe('—');
  });

  it('maps posted → success and void → danger everywhere', () => {
    expect(getReceiptStatusTone('posted')).toBe('success');
    expect(getReceiptStatusTone('void')).toBe('danger');
  });
});

describe('canonical payment-method vocabulary', () => {
  it('labels every canonical method and tolerates legacy spellings', () => {
    expect(paymentMethodLabels.cash).toBe('نقداً');
    expect(formatPaymentMethodLabel('bank_transfer')).toBe('تحويل بنكي');
    expect(formatPaymentMethodLabel('bank')).toBe('تحويل بنكي');
    expect(formatPaymentMethodLabel('cheque')).toBe('شيك');
    expect(formatPaymentMethodLabel('CASH')).toBe('نقداً');
  });

  it('never hides an unknown method code and falls back for empty input', () => {
    expect(formatPaymentMethodLabel('crypto')).toBe('crypto');
    expect(formatPaymentMethodLabel(null)).toBe('—');
    expect(formatPaymentMethodLabel('', 'غير محدد')).toBe('غير محدد');
  });
});

describe('getPaymentReceiptBinding', () => {
  it('binds a posted payment to its print view and receipt number', () => {
    expect(getPaymentReceiptBinding({ id: '1234567890abcdef', status: 'POSTED' })).toEqual({
      printHref: '/receipts?receiptId=1234567890abcdef',
      receiptNumber: 'إيصال بلا مرجع تجاري',
      isVoid: false,
      statusLabel: 'مرحّل',
    });
  });

  it('prefers the server-generated receipt reference when the row carries one', () => {
    expect(getPaymentReceiptBinding({ id: 'pay-1', receipt_reference: 'REC-2026-0007' }).receiptNumber).toBe('REC-2026-0007');
  });

  it('treats payments without an explicit status as posted', () => {
    const binding = getPaymentReceiptBinding({ id: 'pay-1' });
    expect(binding.isVoid).toBe(false);
    expect(binding.statusLabel).toBe('مرحّل');
  });

  it('marks void payments while keeping them printable for the audit trail', () => {
    const binding = getPaymentReceiptBinding({ id: 'pay-voided-42', status: 'VOID' });
    expect(binding.isVoid).toBe(true);
    expect(binding.statusLabel).toBe('ملغى');
    expect(binding.printHref).toBe('/receipts?receiptId=pay-voided-42');
  });

  it('encodes special characters in the print link', () => {
    expect(getPaymentReceiptBinding({ id: 'receipt id/42' }).printHref)
      .toBe('/receipts?receiptId=receipt%20id%2F42');
  });
});

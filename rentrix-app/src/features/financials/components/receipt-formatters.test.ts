import { describe, expect, it } from 'vitest';
import { formatReceiptNumber, getPaymentReceiptBinding } from './receipt-formatters';

describe('formatReceiptNumber', () => {
  it('derives the receipt number from the payment id prefix', () => {
    expect(formatReceiptNumber('1234567890abcdef')).toBe('REC-12345678');
    expect(formatReceiptNumber('ab')).toBe('REC-ab');
  });
});

describe('getPaymentReceiptBinding', () => {
  it('binds a posted payment to its print view and receipt number', () => {
    expect(getPaymentReceiptBinding({ id: '1234567890abcdef', status: 'POSTED' })).toEqual({
      printHref: '/receipts?receiptId=1234567890abcdef',
      receiptNumber: 'REC-12345678',
      isVoid: false,
      statusLabel: 'مرحّل',
    });
  });

  it('treats payments without an explicit status as posted', () => {
    const binding = getPaymentReceiptBinding({ id: 'pay-1' });
    expect(binding.isVoid).toBe(false);
    expect(binding.statusLabel).toBe('مرحّل');
  });

  it('marks void payments while keeping them printable for the audit trail', () => {
    const binding = getPaymentReceiptBinding({ id: 'pay-voided-42', status: 'VOID' });
    expect(binding.isVoid).toBe(true);
    expect(binding.statusLabel).toBe('ملغي');
    expect(binding.printHref).toBe('/receipts?receiptId=pay-voided-42');
  });

  it('encodes special characters in the print link', () => {
    expect(getPaymentReceiptBinding({ id: 'receipt id/42' }).printHref)
      .toBe('/receipts?receiptId=receipt%20id%2F42');
  });
});

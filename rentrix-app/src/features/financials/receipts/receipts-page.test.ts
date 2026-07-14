import { describe, expect, it } from 'vitest';
import type { AuthorizationContext } from '@/features/auth/permissions';
import type { ReceiptRecord } from './receiptService';
import { canVoidReceipts, createReceiptPrintHref, sumPostedReceiptAmount } from './receipts-page';

function authorization(role: AuthorizationContext['role']): AuthorizationContext {
  return {
    userId: `user-${role.toLowerCase()}`,
    email: `${role.toLowerCase()}@example.test`,
    role,
  };
}

function receipt(id: string, amount: number, status: ReceiptRecord['status']): ReceiptRecord {
  return {
    id,
    receipt_number: `REC-${id}`,
    payment_id: id,
    invoice_id: null,
    invoice_status: null,
    contract_id: null,
    payment_date: '2026-07-14',
    amount,
    payment_method: 'cash',
    reference_number: null,
    created_at: '2026-07-14T00:00:00Z',
    status,
    tenant_name: null,
    unit_number: null,
    property_title: null,
  };
}

describe('receipts page action helpers', () => {
  it('allows only admins and managers to void receipts', () => {
    expect(canVoidReceipts(authorization('ADMIN'))).toBe(true);
    expect(canVoidReceipts(authorization('MANAGER'))).toBe(true);
    expect(canVoidReceipts(authorization('USER'))).toBe(false);
    expect(canVoidReceipts(null)).toBe(false);
  });

  it('creates merged receipt print links with encoded receipt ids', () => {
    expect(createReceiptPrintHref('receipt id/42')).toBe('/receipts?receiptId=receipt%20id%2F42');
  });

  it('excludes void receipts from the collection KPI total', () => {
    expect(sumPostedReceiptAmount([
      receipt('posted-1', 100, 'posted'),
      receipt('void-1', 999, 'void'),
      receipt('posted-2', 50, 'posted'),
    ])).toBe(150);
  });
});

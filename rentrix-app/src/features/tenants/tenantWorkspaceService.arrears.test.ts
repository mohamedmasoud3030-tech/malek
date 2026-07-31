import { describe, expect, it } from 'vitest';
import { isInvoiceInArrears, type TenantInvoice } from './tenantWorkspaceService';

const today = '2026-07-31';

function invoiceFixture(
  status: TenantInvoice['status'],
  overrides: Partial<TenantInvoice> = {},
): TenantInvoice {
  return {
    contract_id: 'contract-1',
    status,
    amount: 100,
    paid_amount: 0,
    due_date: '2026-07-01',
    ...overrides,
  };
}

describe('tenant workspace arrears visibility', () => {
  it.each([
    'issued',
    'unpaid',
    'UNPAID',
    'partial',
    'PARTIALLY_PAID',
    'overdue',
    'OVERDUE',
  ] as TenantInvoice['status'][])(
    'shows overdue receivable status %s regardless of stored casing',
    (status) => {
      expect(isInvoiceInArrears(invoiceFixture(status), today)).toBe(true);
    },
  );

  it.each([
    'paid',
    'PAID',
    'void',
    'VOID',
    'draft',
  ] as TenantInvoice['status'][])(
    'does not mark non-receivable status %s as arrears',
    (status) => {
      expect(isInvoiceInArrears(invoiceFixture(status), today)).toBe(false);
    },
  );

  it('does not mark a future unpaid invoice as arrears', () => {
    expect(isInvoiceInArrears(invoiceFixture('UNPAID', { due_date: '2026-08-01' }), today)).toBe(false);
  });

  it('does not mark a fully paid or overpaid receivable invoice as arrears', () => {
    expect(isInvoiceInArrears(invoiceFixture('partial', { paid_amount: 100 }), today)).toBe(false);
    expect(isInvoiceInArrears(invoiceFixture('OVERDUE', { paid_amount: 150 }), today)).toBe(false);
  });

  it('treats explicit overdue status as arrears even on the as-of date', () => {
    expect(isInvoiceInArrears(invoiceFixture('OVERDUE', { due_date: today }), today)).toBe(true);
  });
});

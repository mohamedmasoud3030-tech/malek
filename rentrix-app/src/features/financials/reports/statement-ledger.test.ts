import { describe, expect, it } from 'vitest';
import type { TenantStatementReport } from './statements-reports-service';
import {
  OWNER_STATEMENT_GENERIC_TRANSACTION_LABEL,
  TENANT_STATEMENT_GENERIC_LINE_LABEL,
  deriveTenantOpeningBalance,
  getOwnerStatementTransactionTypeLabel,
  getTenantStatementLineTypeLabel,
  ownerStatementTransactionTypeLabels,
  tenantStatementLineTypeLabels,
} from './statement-ledger';

function tenantStatement(lines: TenantStatementReport['lines'], finalBalance = 0): TenantStatementReport {
  return {
    contractId: 'c-1',
    tenantName: 'أحمد',
    tenantPhone: null,
    unitName: null,
    propertyName: null,
    startDate: null,
    endDate: null,
    lines,
    finalBalance,
    error: null,
  };
}

describe('statement ledger vocabulary (rpt_tenant_statement / rpt_owner_statement)', () => {
  it('labels every tx_type the tenant statement RPC emits without falling back', () => {
    expect(Object.keys(tenantStatementLineTypeLabels).sort()).toEqual(['invoice', 'receipt']);
    expect(getTenantStatementLineTypeLabel('invoice')).toBe('فاتورة / استحقاق');
    expect(getTenantStatementLineTypeLabel('receipt')).toBe('دفعة / إيصال');
    for (const type of Object.keys(tenantStatementLineTypeLabels)) {
      expect(getTenantStatementLineTypeLabel(type)).not.toBe(TENANT_STATEMENT_GENERIC_LINE_LABEL);
    }
  });

  it('labels every tx_type the owner statement RPC emits without falling back', () => {
    expect(Object.keys(ownerStatementTransactionTypeLabels).sort()).toEqual(['expense', 'payment', 'settlement']);
    expect(getOwnerStatementTransactionTypeLabel('payment')).toBe('تحصيل إيجار');
    expect(getOwnerStatementTransactionTypeLabel('expense')).toBe('مصروف مُحمَّل على المالك');
    expect(getOwnerStatementTransactionTypeLabel('settlement')).toBe('تسوية / صرف');
    for (const type of Object.keys(ownerStatementTransactionTypeLabels)) {
      expect(getOwnerStatementTransactionTypeLabel(type)).not.toBe(OWNER_STATEMENT_GENERIC_TRANSACTION_LABEL);
    }
  });

  it('falls back to a truthful generic label for unknown or missing types instead of inventing one', () => {
    expect(getTenantStatementLineTypeLabel(null)).toBe(TENANT_STATEMENT_GENERIC_LINE_LABEL);
    expect(getTenantStatementLineTypeLabel('credit')).toBe(TENANT_STATEMENT_GENERIC_LINE_LABEL);
    expect(getOwnerStatementTransactionTypeLabel(undefined)).toBe(OWNER_STATEMENT_GENERIC_TRANSACTION_LABEL);
    expect(getOwnerStatementTransactionTypeLabel('receipt')).toBe(OWNER_STATEMENT_GENERIC_TRANSACTION_LABEL);
  });

  it('recovers the opening balance by reversing the first authoritative movement — never a hardcoded 0', () => {
    const invoiceFirst = tenantStatement([
      { date: '2026-01-01', description: 'فاتورة', type: 'invoice', debit: 350, credit: 0, balance: 1_250.5 },
      { date: '2026-01-05', description: 'سند قبض', type: 'receipt', debit: 0, credit: 350, balance: 900.5 },
    ], 900.5);
    expect(deriveTenantOpeningBalance(invoiceFirst)).toBe(900.5);

    const receiptFirst = tenantStatement([
      { date: '2026-01-05', description: 'سند قبض', type: 'receipt', debit: 0, credit: 200, balance: -50 },
    ], -50);
    expect(deriveTenantOpeningBalance(receiptFirst)).toBe(150);
  });

  it('uses the authoritative final balance when the statement carries no movements', () => {
    expect(deriveTenantOpeningBalance(tenantStatement([], 120.25))).toBe(120.25);
    expect(deriveTenantOpeningBalance(tenantStatement([], 0))).toBe(0);
  });
});

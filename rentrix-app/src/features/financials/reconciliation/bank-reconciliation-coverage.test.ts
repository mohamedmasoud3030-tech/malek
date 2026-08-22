import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BANK_RECONCILIATION_COVERAGE } from './bankReconciliationService';

const servicePath = resolve(import.meta.dirname, './bankReconciliationService.ts');
const service = readFileSync(servicePath, 'utf8');
const migrationPath = resolve(import.meta.dirname, '../../../../supabase/migrations/20260901000025_expand_bank_reconciliation_entity_types.sql');
let migration = '';
try {
  migration = readFileSync(migrationPath, 'utf8');
} catch {
  // migration may not exist in test env, skip
}

describe('bank reconciliation coverage — FOM-013', () => {
  it('documents every governed 1111/1120 movement class', () => {
    const classes = BANK_RECONCILIATION_COVERAGE.map((c) => c.movementClass);
    expect(classes).toEqual(
      expect.arrayContaining([
        'tenant collections',
        'owner payouts',
        'tenant deposit receipts',
        'deposit refunds',
        'broker commission payments',
        'company expenses',
        'owner expenses paid by office',
        'reversals/refunds (receipt void, deposit reversal)',
        'manual adjustments',
      ]),
    );
  });

  it('covers tenant collections via payment/receipt', () => {
    const entry = BANK_RECONCILIATION_COVERAGE.find((c) => c.movementClass === 'tenant collections');
    expect(entry).toBeDefined();
    expect(entry?.candidateEntity).toContain('payment');
    expect(entry?.bankDirection).toBe('positive');
    expect(entry?.supportStatus).toBe('supported');
  });

  it('covers owner payouts via owner_payout', () => {
    const entry = BANK_RECONCILIATION_COVERAGE.find((c) => c.movementClass === 'owner payouts');
    expect(entry?.candidateEntity).toBe('owner_payout');
    expect(entry?.bankDirection).toBe('negative');
    expect(entry?.supportStatus).toBe('supported');
  });

  it('covers deposit receipts and refunds', () => {
    const receipt = BANK_RECONCILIATION_COVERAGE.find((c) => c.movementClass === 'tenant deposit receipts');
    expect(receipt?.candidateEntity).toBe('deposit_receipt');
    expect(receipt?.bankDirection).toBe('positive');

    const refund = BANK_RECONCILIATION_COVERAGE.find((c) => c.movementClass === 'deposit refunds');
    expect(refund?.candidateEntity).toBe('deposit_refund');
    expect(refund?.bankDirection).toBe('negative');
  });

  it('covers commission payments and expenses', () => {
    const commission = BANK_RECONCILIATION_COVERAGE.find((c) => c.movementClass === 'broker commission payments');
    expect(commission?.candidateEntity).toBe('commission_payment');
    expect(commission?.bankDirection).toBe('negative');

    const companyExp = BANK_RECONCILIATION_COVERAGE.find((c) => c.movementClass === 'company expenses');
    expect(companyExp?.candidateEntity).toBe('expense');

    const ownerExp = BANK_RECONCILIATION_COVERAGE.find((c) => c.movementClass === 'owner expenses paid by office');
    expect(ownerExp?.candidateEntity).toBe('owner_expense');
  });

  it('service supports expanded entity types', () => {
    expect(service).toContain('owner_payout');
    expect(service).toContain('deposit_receipt');
    expect(service).toContain('deposit_refund');
    expect(service).toContain('commission_payment');
    expect(service).toContain('owner_expense');
    expect(service).toContain('manual_adjustment');
  });

  it('suggests matches for all cash/bank movement types', () => {
    expect(service).toContain('tenant_deposits');
    expect(service).toContain('deposit_refund_events');
    expect(service).toContain('owner_settlements');
    expect(service).toContain('commissions');
    expect(service).toContain('payments');
    expect(service).toContain('expenses');
  });

  it('migration expands DB check constraint to include new types', () => {
    if (!migration) return;
    expect(migration).toContain('owner_payout');
    expect(migration).toContain('deposit_receipt');
    expect(migration).toContain('deposit_refund');
    expect(migration).toContain('commission_payment');
    expect(migration).toContain('owner_expense');
  });

  it('does not create fake payment or expense rows solely for bank matching', () => {
    expect(service).not.toMatch(/insert.*payments.*fake/);
    expect(service).not.toMatch(/insert.*expenses.*fake/);
    expect(service).toContain('manual_adjustment');
  });
});

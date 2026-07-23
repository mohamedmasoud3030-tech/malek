import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('payment-backed receipt shared identity migration', () => {
  const migration = readFileSync(
    resolve(import.meta.dirname, '../../../../../supabase/migrations/20260723100000_enforce_payment_receipt_shared_identity.sql'),
    'utf8',
  );

  it('rejects historical mismatches instead of silently mutating financial history', () => {
    expect(migration).toContain('payment/receipt identity preflight failed');
    expect(migration).toContain('repair explicitly before applying this migration');
  });

  it('forces every payment write to use its receipt UUID as the payment UUID', () => {
    expect(migration).toContain('new.receipt_id is null');
    expect(migration).toContain('new.id := new.receipt_id');
    expect(migration).toContain('payments_enforce_receipt_shared_identity');
    expect(migration).toContain('before insert on public.payments');
    expect(migration).toContain('payments.id and payments.receipt_id are immutable after insert');
  });

  it('prevents multiple payments from being associated with one receipt', () => {
    expect(migration).toContain('payments_receipt_id_unique unique (receipt_id)');
    expect(migration).toContain('payments_receipt_id_fkey');
    expect(migration).toContain('payment_receipt_identity_preflight');
  });
});

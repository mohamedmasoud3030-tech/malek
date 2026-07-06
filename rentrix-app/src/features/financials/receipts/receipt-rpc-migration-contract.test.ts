import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(process.cwd(), '..', 'supabase', 'migrations', '20260706090000_fix_record_invoice_payment_void_receipt_shared_id.sql');

describe('void receipt shared id migration contract', () => {
  const migration = readFileSync(migrationPath, 'utf8');

  it('uses one generated UUID for payment and receipt ids in record_invoice_payment_atomic', () => {
    expect(migration).toContain('v_payment_id uuid := gen_random_uuid();');
    expect(migration).toContain('v_receipt_id uuid := v_payment_id;');
    expect(migration).toContain("'id', v_receipt_id,");
    expect(migration).toContain("WHEN 'id' THEN quote_literal(v_payment_id)");
  });

  it('persists the receipt linkage on payment rows when the column exists', () => {
    expect(migration).toContain("'receipt_id'");
    expect(migration).toContain("WHEN 'receipt_id' THEN quote_literal(v_receipt_id)");
    expect(migration).toContain("'receipt_id', coalesce(nullif(v_internal_result->>'receipt_id', '')::uuid, v_receipt_id)");
  });

  it('marks the payment row void when the receipt is voided', () => {
    expect(migration).toContain("UPDATE public.payments");
    expect(migration).toContain("SET status = 'VOID'");
    expect(migration).toContain("WHERE id::text = p_receipt_id OR receipt_id::text = p_receipt_id");
  });
});


describe('void receipt payment-backed facade migration contract', () => {
  const migration = readFileSync(
    join(process.cwd(), '..', 'supabase', 'migrations', '20260706100000_harden_void_receipt_facade_payment_id_resolution.sql'),
    'utf8',
  );

  it('resolves a payment-backed receipt id to the canonical receipts id before voiding', () => {
    expect(migration).toContain("v_requested_receipt_id text := nullif(payload->>'receipt_id', '');");
    expect(migration).toContain('FROM public.receipts r');
    expect(migration).toContain('WHERE r.id::text = v_requested_receipt_id');
    expect(migration).toContain('FROM public.payments p');
    expect(migration).toContain('WHERE p.id::text = v_requested_receipt_id');
    expect(migration).toContain('AND p.receipt_id IS NOT NULL');
    expect(migration).toContain('coalesce(v_resolved_receipt_id, v_requested_receipt_id)');
  });

  it('returns both the originally requested payment-backed id and resolved receipt id as end-to-end proof fields', () => {
    expect(migration).toContain("'requested_receipt_id', v_requested_receipt_id");
    expect(migration).toContain("'receipt_id', coalesce(v_resolved_receipt_id, v_requested_receipt_id)");
  });
});

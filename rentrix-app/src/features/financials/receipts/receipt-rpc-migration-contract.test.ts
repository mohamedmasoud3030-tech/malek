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

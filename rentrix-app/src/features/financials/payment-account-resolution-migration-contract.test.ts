import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../../../../supabase/migrations/20250101000003_functions_triggers_and_rpcs.sql', import.meta.url),
  'utf8',
);

describe('payment account resolution repair migration', () => {
  it('keeps account resolution text-based and avoids the previous uuid cast regression', () => {
    expect(migration).toContain('returns text');
    expect(migration).toContain('v_account_id text');
    expect(migration).toContain("when 'cash' then");
    expect(migration).toContain("v_target_no := '1111'");
    expect(migration).toContain("when 'receivable' then");
    expect(migration).toContain("v_target_no := '1201'");
    expect(migration).toContain('select a.id into v_account_id');
    expect(migration).not.toMatch(/id::uuid/i);
  });

  it('preserves the browser-facing payment RPC while keeping helper access internal', () => {
    expect(migration).toContain('create or replace function public.record_invoice_payment_atomic(payload jsonb)');
    expect(migration).toContain("public.find_payment_account_id('cash')");
    expect(migration).toContain("public.find_payment_account_id('receivable')");
    expect(migration).toContain("'payment_id', v_payment_id");
    expect(migration).toContain("'receipt_id', v_receipt_id");
    expect(migration).toContain('revoke all on function public.find_payment_account_id(text) from public, anon, authenticated');
    expect(migration).toContain('grant execute on function public.record_invoice_payment_atomic(jsonb) to authenticated');
  });

  it('documents the required post-apply live verification query targets', () => {
    expect(migration).toContain("public.find_payment_account_id('cash')");
    expect(migration).toContain("public.find_payment_account_id('receivable')");
    expect(migration).toContain("values ('record_invoice_payment_atomic', v_request_id, v_result)");
  });
});

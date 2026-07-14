import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260716000005_finalize_post_receipt_atomic_type_compatibility.sql',
  ),
  'utf8',
).toLowerCase();

describe('post receipt atomic identifier compatibility', () => {
  it('uses target-column types for every persisted identifier', () => {
    expect(migration).toContain('v_receipt_id public.receipts.id%type');
    expect(migration).toContain('v_receipt_contract_id public.receipts.contract_id%type');
    expect(migration).toContain('v_allocation_invoice_id public.receipt_allocations.invoice_id%type');
    expect(migration).toContain('v_journal_source_id public.journal_entries.source_id%type');
  });

  it('locks and updates invoices through identifier text parity', () => {
    expect(migration).toContain('invoice_record.id::text = v_invoice_id_text');
    expect(migration).toContain('invoice_record.id::text = allocation_totals.invoice_id');
  });

  it('preserves overpayment, idempotency, and privileged-role guards', () => {
    expect(migration).toContain('for update');
    expect(migration).toContain('قيمة السداد تتجاوز المتبقي على الفاتورة');
    expect(migration).toContain('receipt_record.request_id = v_request_id');
    expect(migration).toContain("app_user.role::text in ('admin', 'manager')");
  });

  it('keeps the RPC search-path pinned and unavailable to anon', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path to 'public', 'pg_temp'");
    expect(migration).toContain('from public, anon');
  });
});

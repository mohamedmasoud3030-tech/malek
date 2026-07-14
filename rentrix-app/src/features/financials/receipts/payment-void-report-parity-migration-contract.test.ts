import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const migrationPath = `${repoRoot}supabase/migrations/20260716000003_restore_payment_void_report_parity.sql`;
const migration = readFileSync(migrationPath, 'utf8');
const normalized = migration.toLowerCase();

describe('payment, receipt, void, and report parity migration contract', () => {
  it('makes payments the only daily-collection source and excludes void/deleted rows', () => {
    expect(normalized).toContain('from public.payments p');
    expect(normalized).toContain('p.deleted_at is null');
    expect(normalized).toContain("upper(coalesce(p.status, 'posted')) <> 'void'");
    expect(normalized).not.toContain('from public.receipts\n    where');
    expect(normalized).toContain("'source', 'payments'");
  });

  it('keeps report execution authenticated and removes anonymous access', () => {
    expect(normalized).toContain('auth.uid() is null or not coalesce(public.is_app_user(), false)');
    expect(normalized).toContain('revoke all on function public.rpt_daily_collection(date, date) from public, anon');
    expect(normalized).toContain('grant execute on function public.rpt_daily_collection(date, date) to authenticated, service_role');
  });

  it('requires a reason and idempotency key before voiding', () => {
    expect(normalized).toContain("nullif(btrim(payload->>'reason'), '')");
    expect(normalized).toContain("nullif(btrim(payload->>'request_id'), '')");
    expect(normalized).toContain("operation_name = 'void_receipt_atomic'");
    expect(normalized).toContain("'void_receipt_atomic', v_request_id, v_result");
    expect(normalized).toContain('pg_advisory_xact_lock');
  });

  it('resolves a payment-backed id to its linked receipt under row locks', () => {
    expect(normalized).toContain('where p.id::text = v_requested_id');
    expect(normalized).toContain("coalesce(nullif(v_payment.receipt_id::text, ''), v_payment.id::text)");
    expect(normalized).toContain('where p.receipt_id::text = v_receipt.id::text');
    expect(normalized.match(/for update;/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it('updates payment, receipt, and invoice state without deleting allocation history', () => {
    expect(normalized).toContain("update public.receipts\n  set status = 'void'");
    expect(normalized).toContain("update public.payments\n  set status = 'void'");
    expect(normalized).toContain('update public.invoices i');
    expect(normalized).toContain('greatest(0, coalesce(i.paid_amount, 0) - allocated.amount)');
    expect(normalized).not.toContain('delete from public.receipt_allocations');
  });

  it('blocks an unbalanced original journal and generates a balanced server-side reversal', () => {
    expect(normalized).toContain('original receipt journal is unbalanced; void aborted before mutation');
    expect(normalized).toContain("case upper(je.type) when 'debit' then 'credit' else 'debit' end");
    expect(normalized).toContain("v_reversal_request_id := 'void:' || v_receipt.id::text");
    expect(normalized).toContain('perform public.close_journal_batch(v_reversal_batch_id)');
    expect(normalized).toContain("'receipt_void'");
  });

  it('makes the jsonb facade the only authenticated void endpoint', () => {
    expect(normalized).toContain('revoke all on function public.void_receipt_atomic(jsonb) from public, anon');
    expect(normalized).toContain('grant execute on function public.void_receipt_atomic(jsonb) to authenticated, service_role');
    expect(normalized).toContain('revoke all on function public.void_receipt_atomic(text, bigint, jsonb, jsonb)');
    expect(normalized).toContain('from public, anon, authenticated, service_role');
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(process.cwd(), '..', 'supabase', 'migrations', '20260711000004_add_create_expense_with_journal_atomic.sql'),
  'utf8',
);

describe('create_expense_with_journal_atomic migration contract', () => {
  it('is a SECURITY DEFINER function with pinned search_path and no public/anon execute', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_expense_with_journal_atomic(p_payload jsonb)');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain("SET search_path TO 'public', 'pg_temp'");
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.create_expense_with_journal_atomic(jsonb) FROM public, anon;');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.create_expense_with_journal_atomic(jsonb) TO authenticated, service_role;');
  });

  it('enforces auth and app-user before any write', () => {
    expect(sql).toContain("IF auth.uid() IS NULL OR NOT coalesce(public.is_app_user(), false) THEN");
    expect(sql).toContain("RAISE EXCEPTION 'Authenticated app user is required.' USING ERRCODE = '42501';");
  });

  it('links expense, journal entry, and audit in one transaction', () => {
    expect(sql).toContain('INSERT INTO public.expenses (');
    expect(sql).toContain("INSERT INTO public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, created_at)");
    expect(sql).toContain("INSERT INTO public.audit_log (");
    expect(sql).toContain("'DEBIT'");
    expect(sql).toContain("'CREDIT'");
    expect(sql).toContain("'expense'");
  });

  it('guards on configured accounting accounts and is idempotent by request_id', () => {
    expect(sql).toContain("RAISE EXCEPTION 'Expense accounting accounts are not configured';");
    expect(sql).toContain("INSERT INTO public.financial_operation_idempotency (operation_name, request_id, response_payload)");
    expect(sql).toContain("operation_name = 'create_expense_with_journal_atomic' AND request_id = v_request_id");
    expect(sql).toContain("SELECT id FROM public.accounts WHERE no = '6100' LIMIT 1");
    expect(sql).toContain("INSERT INTO public.accounts (id, no, name)\nVALUES ('6100', '6100', 'Operating Expenses')");
  });
});

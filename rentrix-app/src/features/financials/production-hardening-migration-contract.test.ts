import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const hardeningSql = readFileSync(
  join(process.cwd(), '..', 'supabase', 'migrations', '20260711123000_bank_reconciliation_atomic_and_journal_status_hardening.sql'),
  'utf8',
);
const softDeleteSql = readFileSync(
  join(process.cwd(), '..', 'supabase', 'migrations', '20260712010000_soft_delete_contract_atomic.sql'),
  'utf8',
);
const paymentSql = readFileSync(
  join(process.cwd(), '..', 'supabase', 'migrations', '20260706090000_fix_record_invoice_payment_void_receipt_shared_id.sql'),
  'utf8',
);

describe('production hardening migration contract', () => {
  it('blocks updates/deletes only for posted journal entries', () => {
    expect(hardeningSql).toContain("ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'posted'");
    expect(hardeningSql).toContain("CHECK (status IN ('draft', 'posted'))");
    expect(hardeningSql).toContain("IF OLD.status = 'posted' THEN");
    expect(hardeningSql).toContain("Posted journal entries are immutable. Use reverse entry.");
    expect(hardeningSql).toContain("IF TG_OP = 'UPDATE' THEN\n    RETURN NEW;");
    expect(hardeningSql).toContain('RETURN OLD;');
  });

  it('audits posted journal inserts and keeps sensitive trigger functions non-callable from browser roles', () => {
    expect(hardeningSql).toContain("IF NEW.status = 'posted' THEN");
    expect(hardeningSql).toContain('INSERT INTO public.audit_log');
    expect(hardeningSql).toContain('old_value, new_value, action_timestamp');
    expect(hardeningSql).toContain('REVOKE ALL ON FUNCTION public.audit_journal_entry_insert() FROM PUBLIC, anon, authenticated;');
    expect(hardeningSql).toContain('REVOKE ALL ON FUNCTION public.prevent_posted_journal_entry_mutation() FROM PUBLIC, anon, authenticated;');
  });

  it('creates an atomic bank reconciliation RPC with permission validation and rollback-sensitive ordering', () => {
    expect(hardeningSql).toContain('CREATE OR REPLACE FUNCTION public.process_bank_reconciliation_match_atomic(payload jsonb)');
    expect(hardeningSql).toContain('SECURITY DEFINER');
    expect(hardeningSql).toContain('SET search_path = public, pg_temp');
    expect(hardeningSql).toContain("IF auth.uid() IS NULL OR NOT coalesce(public.is_app_user(), false) THEN");
    expect(hardeningSql).toContain("RAISE EXCEPTION 'Authenticated app user is required.' USING ERRCODE = '42501';");
    expect(hardeningSql).toContain('FOR UPDATE;');
    expect(hardeningSql).toContain("IF v_line.status <> 'unmatched' THEN");
    expect(hardeningSql).toContain('INSERT INTO public.bank_reconciliation_matches');
    expect(hardeningSql).toContain("SET status = 'matched', updated_at = now()");
    expect(hardeningSql).toContain("'PROCESS_BANK_RECONCILIATION_MATCH_ATOMIC'");
    expect(hardeningSql).toContain('REVOKE ALL ON FUNCTION public.process_bank_reconciliation_match_atomic(jsonb) FROM PUBLIC, anon;');
    expect(hardeningSql).toContain('GRANT EXECUTE ON FUNCTION public.process_bank_reconciliation_match_atomic(jsonb) TO authenticated, service_role;');
  });

  it('keeps recalculate_all_balances service-role only and pins audited SECURITY DEFINER search paths', () => {
    for (const signature of [
      'public.record_invoice_payment_atomic(jsonb)',
      'public.void_receipt_atomic(jsonb)',
      'public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text)',
      'public.renew_contract_atomic(text,jsonb)',
      'public.update_contract_atomic(text,text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text)',
      'public.terminate_contract_atomic(text,text)',
      'public.generate_invoices_from_active_contracts()',
      'public.recalculate_all_balances()',
      'public.rpt_cash_flow(date,date)',
      'public.rpt_vat_return(date,date)',
    ]) {
      expect(hardeningSql).toContain(`ALTER FUNCTION ${signature} SET search_path = public, pg_temp;`);
      expect(hardeningSql).toContain(`ALTER FUNCTION ${signature} OWNER TO postgres;`);
    }
    expect(hardeningSql).toContain('REVOKE ALL ON FUNCTION public.recalculate_all_balances() FROM PUBLIC, anon, authenticated;');
    expect(hardeningSql).toContain('GRANT EXECUTE ON FUNCTION public.recalculate_all_balances() TO service_role;');
  });

  it('payment recording creates receipt, allocation, journal entries, and balance updates in one RPC', () => {
    expect(paymentSql).toContain('CREATE OR REPLACE FUNCTION public.record_invoice_payment_atomic(payload jsonb)');
    expect(paymentSql).toContain('INSERT INTO public.payments');
    expect(paymentSql).toContain('v_internal_result := public.post_receipt_atomic(v_internal_payload);');
    expect(paymentSql).toContain("'allocations', jsonb_build_array");
    expect(paymentSql).toContain("'journal_entries', jsonb_build_array");
  });

  it('soft_delete_contract_atomic enforces role validation, blocks deletion when paid invoices or receipts exist, and cancels future unpaid invoices', () => {
    expect(softDeleteSql).toContain('CREATE OR REPLACE FUNCTION public.soft_delete_contract_atomic(');
    expect(softDeleteSql).toContain('SECURITY DEFINER');
    expect(softDeleteSql).toContain('SET search_path = public, pg_temp');
    expect(softDeleteSql).toContain('IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN');
    expect(softDeleteSql).toContain('COALESCE(paid_amount, 0) > 0');
    expect(softDeleteSql).toContain('SELECT 1 FROM public.receipts');
    expect(softDeleteSql).toContain("SET status = 'CANCELLED'");
    expect(softDeleteSql).toContain('SET deleted_at = now(),');
    expect(softDeleteSql).toContain('ALTER FUNCTION public.soft_delete_contract_atomic(text) OWNER TO postgres;');
    expect(softDeleteSql).toContain('REVOKE ALL ON FUNCTION public.soft_delete_contract_atomic(text) FROM PUBLIC, anon;');
    expect(softDeleteSql).toContain('GRANT EXECUTE ON FUNCTION public.soft_delete_contract_atomic(text) TO authenticated, service_role;');
  });
});

-- Production hardening pass (2026-07-11)
-- Scope: safe, reversible Supabase security/RLS/performance/accounting guards.
-- Rollback plan:
--   * Re-grant function EXECUTE privileges if a caller is found to need broader access.
--   * DROP TRIGGER IF EXISTS prevent_journal_entries_mutation_after_posting ON public.journal_entries;
--   * DROP FUNCTION IF EXISTS public.prevent_posted_journal_entry_mutation();
--   * DROP INDEX CONCURRENTLY IF EXISTS idx_bank_statement_lines_import_id;
--   * DROP INDEX CONCURRENTLY IF EXISTS idx_owner_agreements_owner_id;
--   * Remove the nullable audit_log columns with a follow-up migration only after readers stop using them.
-- Notes:
--   * This migration intentionally does not delete data, drop tables, or remove existing indexes.
--   * Organization isolation cannot be enforced in the local baseline because the audited tables
--     do not consistently expose organization_id columns. The accompanying audit report documents
--     this as a required follow-up before multi-organization production rollout.

-- -----------------------------------------------------------------------------
-- Phase 1: SECURITY DEFINER execute-surface hardening
-- -----------------------------------------------------------------------------
-- User-facing RPCs remain executable by authenticated users because the React app
-- calls them through PostgREST, but anon/public are removed and internal role
-- checks stay inside the function bodies. Maintenance-only recalculation is
-- restricted to service_role.

REVOKE ALL ON FUNCTION public.record_invoice_payment_atomic(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment_atomic(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.void_receipt_atomic(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_receipt_atomic(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.renew_contract_atomic(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_contract_atomic(text,jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_contract_atomic(text,text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_contract_atomic(text,text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.terminate_contract_atomic(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.terminate_contract_atomic(text,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.generate_invoices_from_active_contracts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_invoices_from_active_contracts() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.recalculate_all_balances() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_balances() TO service_role;

REVOKE ALL ON FUNCTION public.rpt_cash_flow(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpt_cash_flow(date,date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpt_vat_return(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpt_vat_return(date,date) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Phase 2: RLS posture refresh for audited tables
-- -----------------------------------------------------------------------------
-- Ensure RLS stays enabled on the requested table set. Policy rewrites are not
-- attempted here because organization_id is not present consistently in the
-- captured schema; replacing policies with org predicates would either fail at
-- apply time or lock out the existing single-office app.

ALTER TABLE IF EXISTS public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.owner_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.owner_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.maintenance_records ENABLE ROW LEVEL SECURITY;

-- Existing cost_centers/payment_terms_templates policies are intentionally left in
-- place. A safe organization-aware consolidation requires organization_id support
-- first; policy OR semantics can otherwise broaden write/delete access.

-- -----------------------------------------------------------------------------
-- Phase 3: requested FK indexes.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_import_id
  ON public.bank_statement_lines(import_id);

CREATE INDEX IF NOT EXISTS idx_owner_agreements_owner_id
  ON public.owner_agreements(owner_id);

-- -----------------------------------------------------------------------------
-- Phase 5: accounting protection and audit detail columns.
-- -----------------------------------------------------------------------------
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS old_value jsonb;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS new_value jsonb;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS action_timestamp timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.audit_journal_entry_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.audit_log (
    user_id,
    action,
    entity,
    entity_id,
    note,
    "table",
    old_value,
    new_value,
    action_timestamp,
    created_at,
    updated_at
  ) VALUES (
    auth.uid(),
    'INSERT_POSTED_JOURNAL_ENTRY',
    'journal_entry',
    NEW.id::text,
    'Posted journal entry created. Corrections must use reversing entries.',
    'journal_entries',
    NULL,
    to_jsonb(NEW),
    now(),
    now(),
    now()
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_posted_journal_entry_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Posted journal entries are immutable; create a reversing entry instead.'
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS audit_journal_entry_insert ON public.journal_entries;
CREATE TRIGGER audit_journal_entry_insert
  AFTER INSERT ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_journal_entry_insert();

DROP TRIGGER IF EXISTS prevent_journal_entries_mutation_after_posting ON public.journal_entries;
CREATE TRIGGER prevent_journal_entries_mutation_after_posting
  BEFORE UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_posted_journal_entry_mutation();

REVOKE ALL ON FUNCTION public.audit_journal_entry_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_journal_entry_insert() TO service_role;
REVOKE ALL ON FUNCTION public.prevent_posted_journal_entry_mutation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_posted_journal_entry_mutation() TO service_role;

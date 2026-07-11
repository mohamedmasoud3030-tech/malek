-- Follow-up hardening pass (2026-07-11)
-- Implements atomic bank-reconciliation matching and status-aware journal-entry immutability.
-- No data is deleted and no tables are dropped.
-- Rollback plan (forward-only): create a follow-up migration that restores the prior
-- journal trigger, revokes process_bank_reconciliation_match_atomic(), and routes the
-- frontend back to direct table writes if required.

-- -----------------------------------------------------------------------------
-- Phase 1: keep sensitive SECURITY DEFINER functions pinned and owned by a
-- database owner role, not by an application/authenticated user.
-- -----------------------------------------------------------------------------
ALTER FUNCTION public.record_invoice_payment_atomic(jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.void_receipt_atomic(jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) SET search_path = public, pg_temp;
ALTER FUNCTION public.renew_contract_atomic(text,jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_contract_atomic(text,text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) SET search_path = public, pg_temp;
ALTER FUNCTION public.terminate_contract_atomic(text,text) SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_invoices_from_active_contracts() SET search_path = public, pg_temp;
ALTER FUNCTION public.recalculate_all_balances() SET search_path = public, pg_temp;
ALTER FUNCTION public.rpt_cash_flow(date,date) SET search_path = public, pg_temp;
ALTER FUNCTION public.rpt_vat_return(date,date) SET search_path = public, pg_temp;

ALTER FUNCTION public.record_invoice_payment_atomic(jsonb) OWNER TO postgres;
ALTER FUNCTION public.void_receipt_atomic(jsonb) OWNER TO postgres;
ALTER FUNCTION public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) OWNER TO postgres;
ALTER FUNCTION public.renew_contract_atomic(text,jsonb) OWNER TO postgres;
ALTER FUNCTION public.update_contract_atomic(text,text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) OWNER TO postgres;
ALTER FUNCTION public.terminate_contract_atomic(text,text) OWNER TO postgres;
ALTER FUNCTION public.generate_invoices_from_active_contracts() OWNER TO postgres;
ALTER FUNCTION public.recalculate_all_balances() OWNER TO postgres;
ALTER FUNCTION public.rpt_cash_flow(date,date) OWNER TO postgres;
ALTER FUNCTION public.rpt_vat_return(date,date) OWNER TO postgres;

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
-- Phase 2: status-aware journal-entry immutability.
-- Existing rows are operationally posted. Draft rows can be edited/deleted until
-- they are posted.
-- -----------------------------------------------------------------------------
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'posted';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'journal_entries_status_chk'
      AND conrelid = 'public.journal_entries'::regclass
  ) THEN
    ALTER TABLE public.journal_entries
      ADD CONSTRAINT journal_entries_status_chk CHECK (status IN ('draft', 'posted'));
  END IF;
END $$;

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
  IF NEW.status = 'posted' THEN
    INSERT INTO public.audit_log (
      user_id, action, entity, entity_id, note, "table",
      old_value, new_value, action_timestamp, created_at, updated_at
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
  END IF;
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
  IF OLD.status = 'posted' THEN
    RAISE EXCEPTION 'Posted journal entries are immutable. Use reverse entry.'
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;

ALTER FUNCTION public.audit_journal_entry_insert() OWNER TO postgres;
ALTER FUNCTION public.prevent_posted_journal_entry_mutation() OWNER TO postgres;

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

-- -----------------------------------------------------------------------------
-- Phase 3: atomic bank reconciliation match RPC.
-- PostgreSQL functions execute in the caller's transaction. If any statement
-- below raises, the match insert, line update, and audit insert are rolled back.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_bank_reconciliation_match_atomic(payload jsonb)
RETURNS public.bank_reconciliation_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_statement_line_id uuid := nullif(payload->>'statement_line_id', '')::uuid;
  v_matched_entity_type text := nullif(payload->>'matched_entity_type', '');
  v_matched_entity_id text := nullif(payload->>'matched_entity_id', '');
  v_matched_amount numeric := nullif(payload->>'matched_amount', '')::numeric;
  v_notes text := nullif(payload->>'notes', '');
  v_line public.bank_statement_lines%ROWTYPE;
  v_match public.bank_reconciliation_matches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_app_user(), false) THEN
    RAISE EXCEPTION 'Authenticated app user is required.' USING ERRCODE = '42501';
  END IF;

  IF v_statement_line_id IS NULL THEN
    RAISE EXCEPTION 'statement_line_id is required.' USING ERRCODE = '22023';
  END IF;
  IF v_matched_entity_type NOT IN ('payment', 'receipt', 'expense', 'manual_adjustment') THEN
    RAISE EXCEPTION 'Invalid matched_entity_type.' USING ERRCODE = '22023';
  END IF;
  IF v_matched_entity_id IS NULL THEN
    RAISE EXCEPTION 'matched_entity_id is required.' USING ERRCODE = '22023';
  END IF;
  IF v_matched_amount IS NULL OR v_matched_amount = 0 THEN
    RAISE EXCEPTION 'matched_amount must be non-zero.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_line
  FROM public.bank_statement_lines
  WHERE id = v_statement_line_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank statement line was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_line.status <> 'unmatched' THEN
    RAISE EXCEPTION 'Bank statement line is already processed.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.bank_reconciliation_matches (
    statement_line_id,
    matched_entity_type,
    matched_entity_id,
    matched_amount,
    notes,
    matched_by
  ) VALUES (
    v_statement_line_id,
    v_matched_entity_type,
    v_matched_entity_id,
    v_matched_amount,
    v_notes,
    auth.uid()
  )
  RETURNING * INTO v_match;

  UPDATE public.bank_statement_lines
  SET status = 'matched', updated_at = now()
  WHERE id = v_statement_line_id;

  INSERT INTO public.audit_log (
    user_id, action, entity, entity_id, note, "table",
    old_value, new_value, action_timestamp, created_at, updated_at
  ) VALUES (
    auth.uid(),
    'PROCESS_BANK_RECONCILIATION_MATCH_ATOMIC',
    'bank_reconciliation_match',
    v_match.id::text,
    'Bank statement line matched atomically through RPC.',
    'bank_reconciliation_matches',
    to_jsonb(v_line),
    jsonb_build_object('match', to_jsonb(v_match), 'statement_line_status', 'matched'),
    now(),
    now(),
    now()
  );

  RETURN v_match;
END;
$$;

ALTER FUNCTION public.process_bank_reconciliation_match_atomic(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.process_bank_reconciliation_match_atomic(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_bank_reconciliation_match_atomic(jsonb) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Phase 4/5: RLS and indexes remain enabled/available without deleting indexes.
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.owner_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.owner_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.maintenance_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_import_id
  ON public.bank_statement_lines(import_id);
CREATE INDEX IF NOT EXISTS idx_owner_agreements_owner_id
  ON public.owner_agreements(owner_id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_status_date
  ON public.bank_statement_lines(status, transaction_date DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_report_date_status
  ON public.payments(payment_date, status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_report_due_status
  ON public.invoices(due_date, status)
  WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- Phase 6: dashboard KPI database aggregation RPC.
-- Replaces multiple dashboard count queries with one database-side aggregation.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpt_dashboard_overview(
  p_from date,
  p_to date,
  p_as_of date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_financial record;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_app_user(), false) THEN
    RAISE EXCEPTION 'Authenticated app user is required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_financial FROM public.rpt_financial_summary(p_from, p_to);

  SELECT jsonb_build_object(
    'financial', jsonb_build_object(
      'total_collected', coalesce(v_financial.collected, 0),
      'total_overdue_invoices', coalesce(v_financial.overdue_amount, 0),
      'total_expenses', coalesce(v_financial.expenses, 0),
      'net_revenue', coalesce(v_financial.net, 0)
    ),
    'operational', jsonb_build_object(
      'properties', (SELECT count(*) FROM public.properties WHERE deleted_at IS NULL),
      'units', (SELECT count(*) FROM public.units WHERE deleted_at IS NULL),
      'activeContracts', (SELECT count(*) FROM public.contracts WHERE deleted_at IS NULL AND status = 'ACTIVE'),
      'expiringContracts30Days', (
        SELECT count(*)
        FROM public.contracts
        WHERE deleted_at IS NULL
          AND status = 'ACTIVE'
          AND end_date >= p_as_of
          AND end_date <= (p_as_of + interval '30 days')::date
      ),
      'vacantUnits', (SELECT count(*) FROM public.units WHERE deleted_at IS NULL AND status = 'available'),
      'overdueInvoices', (SELECT count(*) FROM public.invoices WHERE deleted_at IS NULL AND status = 'OVERDUE')
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.rpt_dashboard_overview(date,date,date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpt_dashboard_overview(date,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpt_dashboard_overview(date,date,date) TO authenticated, service_role;

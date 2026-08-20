-- Migration: add_create_expense_with_journal_atomic
-- Description: Expense financial hardening.
--
-- A single atomic RPC that records an expense together with its journal entry
-- and an audit-log row, so an expense can never exist without its accounting
-- and audit trail. It mirrors the existing payment atomic (record_invoice_
-- payment_atomic) in shape: SECURITY DEFINER, pinned search_path, auth + app
-- user checks, account configuration guard, and request-level idempotency.
--
-- User-facing behavior is unchanged vs. the prior direct insert: same fields,
-- same result (a POSTED expense). The difference is server-side integrity.

-- Ensure an operating-expense account exists so journal posting can reference it.
INSERT INTO public.accounts (id, no, name)
VALUES ('6100', '6100', 'Operating Expenses')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_expense_with_journal_atomic(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_property_id uuid := nullif(p_payload->>'property_id', '')::uuid;
  v_category text := nullif(p_payload->>'category', '');
  v_amount numeric := nullif(p_payload->>'amount', '')::numeric;
  v_expense_date date := nullif(p_payload->>'expense_date', '')::date;
  v_description text := nullif(p_payload->>'description', '');
  v_cost_center_id uuid := nullif(p_payload->>'cost_center_id', '')::uuid;
  v_contract_id uuid := nullif(p_payload->>'contract_id', '')::uuid;
  v_charged_to text := nullif(p_payload->>'charged_to', '');
  v_attachment_url text := nullif(p_payload->>'attachment_url', '');
  v_expense_id uuid;
  v_expense_no text;
  v_expense_account_id text;
  v_cash_account_id text;
  v_result jsonb;
  v_cached jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_app_user(), false) THEN
    RAISE EXCEPTION 'Authenticated app user is required.' USING ERRCODE = '42501';
  END IF;

  IF v_request_id IS NULL OR v_request_id = '' THEN
    v_request_id := gen_random_uuid()::text;
  END IF;

  -- Idempotency: return the prior result when the same request_id was processed.
  SELECT response_payload INTO v_cached
  FROM public.financial_operation_idempotency
  WHERE operation_name = 'create_expense_with_journal_atomic' AND request_id = v_request_id;
  IF v_cached IS NOT NULL THEN
    RETURN v_cached || jsonb_build_object('idempotent', true);
  END IF;

  IF v_property_id IS NULL THEN
    RAISE EXCEPTION 'property_id is required.';
  END IF;
  IF v_category IS NULL OR length(trim(v_category)) = 0 THEN
    RAISE EXCEPTION 'category is required.';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be greater than zero.';
  END IF;
  IF v_expense_date IS NULL THEN
    RAISE EXCEPTION 'expense_date is required.';
  END IF;

  v_expense_account_id := (SELECT id FROM public.accounts WHERE no = '6100' LIMIT 1);
  v_cash_account_id := (SELECT id FROM public.accounts WHERE no = '1111' LIMIT 1);
  IF v_expense_account_id IS NULL OR v_cash_account_id IS NULL THEN
    RAISE EXCEPTION 'Expense accounting accounts are not configured';
  END IF;

  v_expense_id := gen_random_uuid();
  v_expense_no := 'EXP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_request_id, '-', ''), 1, 6);

  INSERT INTO public.expenses (
    id, property_id, category, amount, expense_date, description,
    cost_center_id, contract_id, charged_to, attachment_url, status, date_time, no
  ) VALUES (
    v_expense_id, v_property_id, v_category, v_amount, v_expense_date, v_description,
    v_cost_center_id, v_contract_id, v_charged_to, v_attachment_url, 'POSTED', now(), v_expense_no
  );

  -- Journal entry: Debit the expense account, Credit cash.
  INSERT INTO public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, created_at)
  VALUES
    (gen_random_uuid(), v_expense_no || '-D', v_expense_date, v_expense_account_id, v_amount, 'DEBIT', v_expense_id, 'expense', v_expense_id::text, now()),
    (gen_random_uuid(), v_expense_no || '-C', v_expense_date, v_cash_account_id, v_amount, 'CREDIT', v_expense_id, 'expense', v_expense_id::text, now());

  -- Audit trail for the financial mutation.
  INSERT INTO public.audit_log (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  VALUES (
    gen_random_uuid(),
    extract(epoch from now())::bigint,
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'CREATE', 'expenses', v_expense_id::text, 'Expense recorded with journal entry',
    'expenses', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'expense_id', v_expense_id,
    'expense_no', v_expense_no,
    'request_id', v_request_id
  );

  INSERT INTO public.financial_operation_idempotency (operation_name, request_id, response_payload)
  VALUES ('create_expense_with_journal_atomic', v_request_id, v_result)
  ON CONFLICT (operation_name, request_id) DO NOTHING;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_expense_with_journal_atomic(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_expense_with_journal_atomic(jsonb) TO authenticated, service_role;

-- =============================================================================
-- Migration: fix_expense_rpc_role_check
-- Date: 2026-07-13
-- Phase: 1B — Financial Safety Lock
-- Risk: LOW (tightens permission check, no data changes)
--
-- Problem:
--   create_expense_with_journal_atomic checks is_app_user() which only
--   verifies the caller is authenticated. This allows USER role (the most
--   restricted role in the app) to create expenses with journal entries by
--   calling the RPC directly, bypassing the frontend route guards that
--   restrict expense management to ADMIN/MANAGER.
--
--   All other financial RPCs (record_invoice_payment_atomic,
--   void_receipt_atomic, create_contract_atomic, etc.) check
--   is_admin_or_manager(). This RPC was the exception.
--
-- Fix:
--   Replace the is_app_user() check with is_admin_or_manager() to match
--   the project's security baseline.
--
-- Rollback:
--   Change the auth check back to:
--     IF auth.uid() IS NULL OR NOT coalesce(public.is_app_user(), false) THEN
--       RAISE EXCEPTION 'Authenticated app user is required.' USING ERRCODE = '42501';
--     END IF;
--
-- Validation (post-apply):
--   SELECT prosrc FROM pg_proc
--   WHERE proname = 'create_expense_with_journal_atomic';
--   -- Expected: contains 'is_admin_or_manager' instead of 'is_app_user'
-- =============================================================================

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
  -- CHANGED: was is_app_user(), now is_admin_or_manager()
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to create expenses.' USING ERRCODE = '42501';
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

-- Preserve grants (unchanged)
ALTER FUNCTION public.create_expense_with_journal_atomic(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_expense_with_journal_atomic(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_expense_with_journal_atomic(jsonb) TO authenticated, service_role;

-- Post-flight: verify the role check was updated
DO $$
DECLARE
  v_src text;
BEGIN
  SELECT prosrc INTO v_src
  FROM pg_proc
  WHERE proname = 'create_expense_with_journal_atomic'
    AND pronamespace = 'public'::regnamespace;

  IF v_src NOT LIKE '%is_admin_or_manager%' THEN
    RAISE EXCEPTION 'Post-flight check failed: function does not contain is_admin_or_manager check';
  END IF;

  IF v_src LIKE '%is_app_user%' THEN
    RAISE EXCEPTION 'Post-flight check failed: function still contains is_app_user check';
  END IF;

  RAISE NOTICE 'create_expense_with_journal_atomic role check successfully updated to is_admin_or_manager()';
END $$;

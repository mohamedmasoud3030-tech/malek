-- =============================================================================
-- Migration: add_update_expense_with_journal_atomic
-- Date: 2026-07-13
-- Phase: 1C — Financial Safety Lock
-- Risk: MEDIUM (new RPC, new code path)
--
-- Problem:
--   expenseService.ts uses a direct supabase.from('expenses').update() to edit
--   expenses. When an expense amount is changed, the corresponding journal
--   entries (created by create_expense_with_journal_atomic) are NOT updated.
--   This creates a journal/expense mismatch — the trial balance, income
--   statement, and balance sheet all read from the expenses table for expense
--   totals, but the journal entries still reflect the original amount.
--
-- Fix:
--   Add update_expense_with_journal_atomic() — an atomic RPC that:
--   1. Updates the expense row
--   2. If the amount changed, creates reversing journal entries for the old
--      amount and new journal entries for the new amount
--   3. Logs the change in the audit_log
--   4. Supports idempotent retries via request_id
--
-- Accounting approach:
--   When amount changes from old_amount to new_amount:
--   - Create 2 reversing entries: CREDIT expense account (old), DEBIT cash (old)
--   - Create 2 new entries: DEBIT expense account (new), CREDIT cash (new)
--   This preserves the complete audit trail rather than mutating existing entries.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.update_expense_with_journal_atomic(jsonb);
--
-- Validation (post-apply):
--   SELECT proname FROM pg_proc
--   WHERE proname = 'update_expense_with_journal_atomic'
--     AND pronamespace = 'public'::regnamespace;
--   -- Expected: 1 row
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_expense_with_journal_atomic(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_expense_id uuid := nullif(p_payload->>'expense_id', '')::uuid;
  v_new_amount numeric := nullif(p_payload->>'amount', '')::numeric;
  v_new_category text := nullif(p_payload->>'category', '');
  v_new_description text := p_payload->>'description';
  v_new_attachment_url text := p_payload->>'attachment_url';
  v_expense record;
  v_old_amount numeric;
  v_amount_diff numeric;
  v_expense_account_id text;
  v_cash_account_id text;
  v_result jsonb;
  v_cached jsonb;
  v_reversal_no text;
  v_new_entry_no text;
BEGIN
  -- Auth check: ADMIN or MANAGER only
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to update expenses.' USING ERRCODE = '42501';
  END IF;

  -- Input validation
  IF v_expense_id IS NULL THEN
    RAISE EXCEPTION 'expense_id is required.';
  END IF;

  -- Idempotency: return cached result for duplicate request_id
  IF v_request_id IS NOT NULL AND v_request_id <> '' THEN
    SELECT response_payload INTO v_cached
    FROM public.financial_operation_idempotency
    WHERE operation_name = 'update_expense_with_journal_atomic'
      AND request_id = v_request_id;
    IF v_cached IS NOT NULL THEN
      RETURN v_cached || jsonb_build_object('idempotent', true);
    END IF;
  ELSE
    v_request_id := gen_random_uuid()::text;
  END IF;

  -- Advisory lock to prevent concurrent updates to the same expense
  PERFORM pg_advisory_xact_lock(hashtextextended('update_expense:' || v_expense_id::text, 0));

  -- Lock the expense row
  SELECT * INTO v_expense
  FROM public.expenses
  WHERE id = v_expense_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found or has been deleted.';
  END IF;

  v_old_amount := v_expense.amount;

  -- Use new_amount if provided, otherwise keep existing
  IF v_new_amount IS NULL THEN
    v_new_amount := v_old_amount;
  END IF;

  IF v_new_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be greater than zero.';
  END IF;

  v_amount_diff := v_new_amount - v_old_amount;

  -- Update the expense row
  UPDATE public.expenses
  SET amount = v_new_amount,
      category = COALESCE(NULLIF(v_new_category, ''), category),
      description = COALESCE(v_new_description, description),
      attachment_url = COALESCE(v_new_attachment_url, attachment_url),
      updated_at = now()
  WHERE id = v_expense_id;

  -- If amount changed, create reversing + new journal entries
  IF v_amount_diff <> 0 THEN
    v_expense_account_id := (SELECT id FROM public.accounts WHERE no = '6100' LIMIT 1);
    v_cash_account_id := (SELECT id FROM public.accounts WHERE no = '1111' LIMIT 1);

    IF v_expense_account_id IS NULL OR v_cash_account_id IS NULL THEN
      RAISE EXCEPTION 'Expense accounting accounts are not configured';
    END IF;

    v_reversal_no := 'EXP-REV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_expense_id::text, '-', ''), 1, 6);
    v_new_entry_no := 'EXP-UPD-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_expense_id::text, '-', ''), 1, 6);

    -- Reversing entries: reverse the original journal entries
    -- Original was: DEBIT expense (6100), CREDIT cash (1111)
    -- Reversal is:  CREDIT expense (6100), DEBIT cash (1111)
    INSERT INTO public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, created_at)
    VALUES
      (gen_random_uuid(), v_reversal_no || '-D', v_expense.expense_date, v_expense_account_id, v_old_amount, 'CREDIT', v_expense_id, 'expense_reversal', v_expense_id::text, now()),
      (gen_random_uuid(), v_reversal_no || '-C', v_expense.expense_date, v_cash_account_id, v_old_amount, 'DEBIT', v_expense_id, 'expense_reversal', v_expense_id::text, now());

    -- New entries: record the updated amount
    INSERT INTO public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, created_at)
    VALUES
      (gen_random_uuid(), v_new_entry_no || '-D', v_expense.expense_date, v_expense_account_id, v_new_amount, 'DEBIT', v_expense_id, 'expense_update', v_expense_id::text, now()),
      (gen_random_uuid(), v_new_entry_no || '-C', v_expense.expense_date, v_cash_account_id, v_new_amount, 'CREDIT', v_expense_id, 'expense_update', v_expense_id::text, now());
  END IF;

  -- Audit trail
  INSERT INTO public.audit_log (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  VALUES (
    gen_random_uuid(),
    extract(epoch from now())::bigint,
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'UPDATE', 'expenses', v_expense_id::text,
    CASE
      WHEN v_amount_diff <> 0 THEN format('Expense amount updated from %s to %s with journal adjustment', v_old_amount, v_new_amount)
      ELSE 'Expense updated (no amount change)'
    END,
    'expenses', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'expense_id', v_expense_id,
    'amount_changed', v_amount_diff <> 0,
    'old_amount', v_old_amount,
    'new_amount', v_new_amount,
    'request_id', v_request_id
  );

  -- Store idempotency record
  INSERT INTO public.financial_operation_idempotency (operation_name, request_id, response_payload)
  VALUES ('update_expense_with_journal_atomic', v_request_id, v_result)
  ON CONFLICT (operation_name, request_id) DO NOTHING;

  RETURN v_result;
END;
$$;

-- Set ownership and grants
ALTER FUNCTION public.update_expense_with_journal_atomic(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_expense_with_journal_atomic(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_expense_with_journal_atomic(jsonb) TO authenticated, service_role;

-- Post-flight: verify function was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_expense_with_journal_atomic'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'Post-flight check failed: update_expense_with_journal_atomic not found';
  END IF;

  RAISE NOTICE 'update_expense_with_journal_atomic successfully created';
END $$;

-- 0005_pending_future.sql
-- Pending migrations intentionally kept isolated and unapplied. This file is a packaging artifact only; do not merge its contents into the applied production baseline.

-- ============================================================================
-- SOURCE: 20260713000002_fix_owner_balances_cascade.sql
-- ============================================================================

-- =============================================================================
-- Migration: fix_owner_balances_cascade
-- Date: 2026-07-13
-- Phase: 1A — Financial Safety Lock
-- Risk: LOW (constraint tightening only, no data changes)
--
-- Problem:
--   owner_balances.owner_id references owners(id) ON DELETE CASCADE.
--   If an owner is hard-deleted, all financial summary data (total_income,
--   total_expenses, commission, net_balance) is silently destroyed — losing
--   the complete financial history for that owner without any audit trail.
--
-- Fix:
--   Change the foreign key from ON DELETE CASCADE to ON DELETE RESTRICT.
--   The application uses soft-delete (deleted_at) and never hard-deletes
--   owners, so this change has zero impact on normal operations.
--
-- Rollback:
--   ALTER TABLE public.owner_balances
--     DROP CONSTRAINT IF EXISTS owner_balances_owner_id_fkey;
--   ALTER TABLE public.owner_balances
--     ADD CONSTRAINT owner_balances_owner_id_fkey
--     FOREIGN KEY (owner_id) REFERENCES public.owners(id)
--     ON DELETE CASCADE;
--
-- Validation (post-apply):
--   SELECT conname, confdeltype
--   FROM pg_constraint
--   WHERE conrelid = 'public.owner_balances'::regclass
--     AND confrelid = 'public.owners'::regclass;
--   -- Expected: confdeltype = 'r' (RESTRICT)
-- =============================================================================

-- Pre-flight: verify no orphaned owner_balances rows exist
DO $$
DECLARE
  v_orphan_count integer;
BEGIN
  SELECT count(*)
    INTO v_orphan_count
    FROM public.owner_balances ob
    LEFT JOIN public.owners o ON o.id = ob.owner_id
    WHERE o.id IS NULL;

  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'Cannot apply migration: found % orphan row(s) in owner_balances with no matching owner. Manual cleanup required before applying.', v_orphan_count;
  END IF;
END $$;

-- Drop existing CASCADE constraint
ALTER TABLE public.owner_balances
  DROP CONSTRAINT IF EXISTS owner_balances_owner_id_fkey;

-- Re-add with RESTRICT
ALTER TABLE public.owner_balances
  ADD CONSTRAINT owner_balances_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.owners(id)
  ON DELETE RESTRICT;

-- Post-flight: verify constraint was created correctly
DO $$
DECLARE
  v_del_type char;
BEGIN
  SELECT confdeltype INTO v_del_type
  FROM pg_constraint
  WHERE conname = 'owner_balances_owner_id_fkey'
    AND conrelid = 'public.owner_balances'::regclass;

  IF v_del_type IS NULL THEN
    RAISE EXCEPTION 'Post-flight check failed: constraint owner_balances_owner_id_fkey not found';
  END IF;

  IF v_del_type <> 'r' THEN
    RAISE EXCEPTION 'Post-flight check failed: expected RESTRICT (r), got %', v_del_type;
  END IF;

  RAISE NOTICE 'owner_balances.owner_id FK successfully changed to ON DELETE RESTRICT';
END $$;

-- ============================================================================
-- SOURCE: 20260713000003_fix_receipt_allocations_cascade.sql
-- ============================================================================

-- =============================================================================
-- Migration: fix_receipt_allocations_cascade
-- Date: 2026-07-13
-- Phase: 1A — Financial Safety Lock
-- Risk: LOW (constraint tightening only, no data changes)
--
-- Problem:
--   receipt_allocations.receipt_id references receipts(id) ON DELETE CASCADE.
--   If a receipt is hard-deleted, all allocation records are silently destroyed
--   — losing the complete audit trail of which invoices were paid and how much.
--   This is the most dangerous CASCADE in the financial schema because
--   allocations are the link between cash received and invoices settled.
--
-- Fix:
--   Change the foreign key from ON DELETE CASCADE to ON DELETE RESTRICT.
--   The application uses void_receipt_atomic() which explicitly deletes
--   allocations BEFORE voiding the receipt, so this change does not affect
--   normal void operations. It only protects against direct hard-deletes.
--
-- Important:
--   void_receipt_atomic() does:
--     1. DELETE FROM receipt_allocations WHERE receipt_id = p_receipt_id
--     2. UPDATE receipts SET status = 'VOID' WHERE id = p_receipt_id
--   This sequence works correctly with RESTRICT because allocations are
--   deleted first, then the receipt is updated (not deleted).
--
-- Rollback:
--   ALTER TABLE public.receipt_allocations
--     DROP CONSTRAINT IF EXISTS receipt_allocations_receipt_id_fkey;
--   ALTER TABLE public.receipt_allocations
--     ADD CONSTRAINT receipt_allocations_receipt_id_fkey
--     FOREIGN KEY (receipt_id) REFERENCES public.receipts(id)
--     ON DELETE CASCADE;
--
-- Validation (post-apply):
--   SELECT conname, confdeltype
--   FROM pg_constraint
--   WHERE conrelid = 'public.receipt_allocations'::regclass
--     AND confrelid = 'public.receipts'::regclass;
--   -- Expected: confdeltype = 'r' (RESTRICT)
-- =============================================================================

-- Pre-flight: verify no orphaned receipt_allocations rows exist
DO $$
DECLARE
  v_orphan_count integer;
BEGIN
  SELECT count(*)
    INTO v_orphan_count
    FROM public.receipt_allocations ra
    LEFT JOIN public.receipts r ON r.id = ra.receipt_id
    WHERE r.id IS NULL;

  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'Cannot apply migration: found % orphan row(s) in receipt_allocations with no matching receipt. Manual cleanup required before applying.', v_orphan_count;
  END IF;
END $$;

-- Drop existing CASCADE constraint
ALTER TABLE public.receipt_allocations
  DROP CONSTRAINT IF EXISTS receipt_allocations_receipt_id_fkey;

-- Re-add with RESTRICT
ALTER TABLE public.receipt_allocations
  ADD CONSTRAINT receipt_allocations_receipt_id_fkey
  FOREIGN KEY (receipt_id) REFERENCES public.receipts(id)
  ON DELETE RESTRICT;

-- Post-flight: verify constraint was created correctly
DO $$
DECLARE
  v_del_type char;
BEGIN
  SELECT confdeltype INTO v_del_type
  FROM pg_constraint
  WHERE conname = 'receipt_allocations_receipt_id_fkey'
    AND conrelid = 'public.receipt_allocations'::regclass;

  IF v_del_type IS NULL THEN
    RAISE EXCEPTION 'Post-flight check failed: constraint receipt_allocations_receipt_id_fkey not found';
  END IF;

  IF v_del_type <> 'r' THEN
    RAISE EXCEPTION 'Post-flight check failed: expected RESTRICT (r), got %', v_del_type;
  END IF;

  RAISE NOTICE 'receipt_allocations.receipt_id FK successfully changed to ON DELETE RESTRICT';
END $$;

-- Post-flight: verify void_receipt_atomic will still work
-- (allocations are deleted before receipt is updated, not deleted)
DO $$
BEGIN
  -- Check that void_receipt_atomic function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'void_receipt_atomic'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE WARNING 'void_receipt_atomic function not found — verify void receipt flow manually';
  ELSE
    RAISE NOTICE 'void_receipt_atomic function exists — verify it deletes allocations before updating receipt';
  END IF;
END $$;

-- ============================================================================
-- SOURCE: 20260713000004_fix_expense_rpc_role_check.sql
-- ============================================================================

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

-- ============================================================================
-- SOURCE: 20260713000005_fix_void_receipt_anon_grant.sql
-- ============================================================================

-- =============================================================================
-- Migration: fix_void_receipt_anon_grant
-- Date: 2026-07-13
-- Phase: 1B — Financial Safety Lock
-- Risk: LOW (tightens grant, no data changes)
--
-- Problem:
--   void_receipt_atomic(jsonb) grants EXECUTE to anon, allowing unauthenticated
--   users to attempt void operations. While the function's internal auth check
--   will reject them, this is a defense-in-depth violation. All other financial
--   RPCs revoke execute from anon and only grant to authenticated + service_role.
--
-- Fix:
--   Revoke EXECUTE from anon, preserving grants for authenticated and service_role.
--
-- Rollback:
--   GRANT EXECUTE ON FUNCTION public.void_receipt_atomic(jsonb) TO anon;
--
-- Validation (post-apply):
--   SELECT has_function_privilege('anon', 'public.void_receipt_atomic(jsonb)', 'execute');
--   -- Expected: false
-- =============================================================================

-- Revoke anon access (defense-in-depth)
REVOKE ALL ON FUNCTION public.void_receipt_atomic(jsonb) FROM anon;

-- Preserve authenticated and service_role access
GRANT EXECUTE ON FUNCTION public.void_receipt_atomic(jsonb) TO authenticated, service_role;

-- Post-flight: verify grants
DO $$
DECLARE
  v_anon_has_execute boolean;
  v_auth_has_execute boolean;
BEGIN
  SELECT has_function_privilege('anon', 'public.void_receipt_atomic(jsonb)', 'execute')
    INTO v_anon_has_execute;

  SELECT has_function_privilege('authenticated', 'public.void_receipt_atomic(jsonb)', 'execute')
    INTO v_auth_has_execute;

  IF v_anon_has_execute THEN
    RAISE EXCEPTION 'Post-flight check failed: anon still has execute privilege';
  END IF;

  IF NOT v_auth_has_execute THEN
    RAISE EXCEPTION 'Post-flight check failed: authenticated lost execute privilege';
  END IF;

  RAISE NOTICE 'void_receipt_atomic(jsonb) grants successfully updated: anon revoked, authenticated preserved';
END $$;

-- ============================================================================
-- SOURCE: 20260713000006_fix_report_rpcs_security_definer.sql
-- ============================================================================

-- =============================================================================
-- Migration: fix_report_rpcs_security_definer
-- Date: 2026-07-13
-- Phase: 1B — Financial Safety Lock
-- Risk: LOW (changes security context, no data changes)
--
-- Problem:
--   rpt_owner_statement and rpt_tenant_statement are SECURITY INVOKER, running
--   with the caller's privileges instead of the definer's. All other financial
--   RPCs use SECURITY DEFINER with pinned search_path. This inconsistency means:
--   1. If RLS policies change, these functions may break or expose unexpected data
--   2. They don't match the project's security baseline
--   3. They're vulnerable to search_path manipulation attacks
--
-- Fix:
--   Convert both functions to SECURITY DEFINER with pinned search_path.
--
-- Rollback:
--   ALTER FUNCTION public.rpt_owner_statement(uuid,date,date) SECURITY INVOKER;
--   ALTER FUNCTION public.rpt_tenant_statement(uuid) SECURITY INVOKER;
--
-- Validation (post-apply):
--   SELECT proname, prosecdef
--   FROM pg_proc
--   WHERE proname IN ('rpt_owner_statement', 'rpt_tenant_statement')
--     AND pronamespace = 'public'::regnamespace;
--   -- Expected: prosecdef = true for both
-- =============================================================================

-- Convert rpt_owner_statement to SECURITY DEFINER
ALTER FUNCTION public.rpt_owner_statement(uuid,date,date) SECURITY DEFINER;
ALTER FUNCTION public.rpt_owner_statement(uuid,date,date) SET search_path = public, pg_temp;

-- Convert rpt_tenant_statement to SECURITY DEFINER
ALTER FUNCTION public.rpt_tenant_statement(uuid) SECURITY DEFINER;
ALTER FUNCTION public.rpt_tenant_statement(uuid) SET search_path = public, pg_temp;

-- Preserve grants (ensure they match project baseline)
REVOKE ALL ON FUNCTION public.rpt_owner_statement(uuid,date,date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_owner_statement(uuid,date,date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpt_tenant_statement(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_tenant_statement(uuid) TO authenticated, service_role;

-- Set ownership to postgres (matching other financial RPCs)
ALTER FUNCTION public.rpt_owner_statement(uuid,date,date) OWNER TO postgres;
ALTER FUNCTION public.rpt_tenant_statement(uuid) OWNER TO postgres;

-- Post-flight: verify security context was updated
DO $$
DECLARE
  v_owner_def boolean;
  v_tenant_def boolean;
BEGIN
  SELECT prosecdef INTO v_owner_def
  FROM pg_proc
  WHERE proname = 'rpt_owner_statement'
    AND pronamespace = 'public'::regnamespace;

  SELECT prosecdef INTO v_tenant_def
  FROM pg_proc
  WHERE proname = 'rpt_tenant_statement'
    AND pronamespace = 'public'::regnamespace;

  IF NOT v_owner_def THEN
    RAISE EXCEPTION 'Post-flight check failed: rpt_owner_statement is not SECURITY DEFINER';
  END IF;

  IF NOT v_tenant_def THEN
    RAISE EXCEPTION 'Post-flight check failed: rpt_tenant_statement is not SECURITY DEFINER';
  END IF;

  RAISE NOTICE 'rpt_owner_statement and rpt_tenant_statement successfully converted to SECURITY DEFINER';
END $$;

-- ============================================================================
-- SOURCE: 20260713000007_add_update_expense_with_journal_atomic.sql
-- ============================================================================

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

-- ============================================================================
-- SOURCE: 20260713000008_add_journal_batch_balance_check.sql
-- ============================================================================

-- =============================================================================
-- Migration: add_journal_batch_balance_check
-- Date: 2026-07-13
-- Phase: 1D — Financial Safety Lock
-- Risk: LOW (additive only, nullable column, warning-only trigger)
--
-- Problem:
--   Journal entries can be created with unbalanced DEBITs/CREDITs. There is no
--   constraint ensuring that for a given transaction (e.g., a payment), the
--   total DEBITs equal total CREDITs. While current RPCs create balanced
--   entries, a bug or direct database manipulation could create unbalanced
--   entries that break the accounting equation.
--
-- Fix:
--   1. Add a nullable batch_id column to journal_entries to group related entries
--   2. Add a trigger that logs warnings when a batch is unbalanced
--   3. Add close_journal_batch() function to explicitly validate and close a batch
--
-- Design decisions:
--   - batch_id is nullable: existing entries and current RPCs don't use it
--   - Trigger logs warnings but doesn't block: allows batch insertion to complete
--     before validation (entries are inserted one at a time)
--   - close_journal_batch() is the explicit validation point: called after all
--     entries in a batch are inserted
--
-- Future enhancement:
--   Update post_receipt_atomic, create_expense_with_journal_atomic, and
--   update_expense_with_journal_atomic to generate and use batch_id, then
--   call close_journal_batch() at the end of each RPC.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS validate_journal_batch_balance ON public.journal_entries;
--   DROP FUNCTION IF EXISTS public.validate_journal_batch_balance();
--   DROP FUNCTION IF EXISTS public.close_journal_batch(uuid);
--   ALTER TABLE public.journal_entries DROP COLUMN IF EXISTS batch_id;
--
-- Validation (post-apply):
--   SELECT column_name, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'journal_entries' AND column_name = 'batch_id';
--   -- Expected: batch_id, YES
-- =============================================================================

-- Add batch_id column (nullable for backward compatibility)
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS batch_id uuid;

-- Add index for batch lookups
CREATE INDEX IF NOT EXISTS idx_journal_entries_batch_id
  ON public.journal_entries(batch_id)
  WHERE batch_id IS NOT NULL;

-- Create trigger function to log imbalance warnings
CREATE OR REPLACE FUNCTION public.validate_journal_batch_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch_total numeric;
  v_entry_count integer;
BEGIN
  -- Only validate if batch_id is provided
  IF NEW.batch_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate current batch balance
  SELECT 
    SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE -amount END),
    COUNT(*)
  INTO v_batch_total, v_entry_count
  FROM public.journal_entries
  WHERE batch_id = NEW.batch_id;

  -- Log warning if imbalanced (batch may still be inserting)
  IF v_batch_total <> 0 AND v_entry_count >= 2 THEN
    INSERT INTO public.audit_log (
      id, user_id, action, entity, entity_id, note, "table", details, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      auth.uid(),
      'JOURNAL_BATCH_IMBALANCE_WARNING',
      'journal_batch',
      NEW.batch_id::text,
      format('Batch %s has imbalance of %s after %s entries. Call close_journal_batch() to validate.', 
             NEW.batch_id, v_batch_total, v_entry_count),
      'journal_entries',
      jsonb_build_object('batch_id', NEW.batch_id, 'imbalance', v_batch_total, 'entry_count', v_entry_count)::text,
      now(),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger (fires after each INSERT when batch_id is not null)
DROP TRIGGER IF EXISTS validate_journal_batch_balance ON public.journal_entries;
CREATE TRIGGER validate_journal_batch_balance
  AFTER INSERT ON public.journal_entries
  FOR EACH ROW
  WHEN (NEW.batch_id IS NOT NULL)
  EXECUTE FUNCTION public.validate_journal_batch_balance();

-- Create explicit batch validation function
CREATE OR REPLACE FUNCTION public.close_journal_batch(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch_total numeric;
  v_entry_count integer;
  v_debit_total numeric;
  v_credit_total numeric;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role required to close journal batches' USING ERRCODE = '42501';
  END IF;

  IF p_batch_id IS NULL THEN
    RAISE EXCEPTION 'batch_id is required';
  END IF;

  -- Calculate batch totals
  SELECT 
    SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END),
    SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END),
    COUNT(*)
  INTO v_debit_total, v_credit_total, v_entry_count
  FROM public.journal_entries
  WHERE batch_id = p_batch_id;

  IF v_entry_count = 0 THEN
    RAISE EXCEPTION 'Batch % not found or has no entries', p_batch_id;
  END IF;

  v_batch_total := v_debit_total - v_credit_total;

  -- Validate balance
  IF v_batch_total <> 0 THEN
    RAISE EXCEPTION 'Batch % is unbalanced: DEBITs (%) - CREDITs (%) = %. Cannot close.',
      p_batch_id, v_debit_total, v_credit_total, v_batch_total;
  END IF;

  -- Log successful close
  INSERT INTO public.audit_log (
    id, user_id, action, entity, entity_id, note, "table", details, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    auth.uid(),
    'JOURNAL_BATCH_CLOSED',
    'journal_batch',
    p_batch_id::text,
    format('Batch %s closed: %s entries, %s DEBIT, %s CREDIT', 
           p_batch_id, v_entry_count, v_debit_total, v_credit_total),
    'journal_entries',
    jsonb_build_object(
      'batch_id', p_batch_id,
      'entry_count', v_entry_count,
      'debit_total', v_debit_total,
      'credit_total', v_credit_total,
      'balanced', true
    )::text,
    now(),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'entry_count', v_entry_count,
    'debit_total', v_debit_total,
    'credit_total', v_credit_total,
    'balanced', true
  );
END;
$$;

-- Set ownership and grants
ALTER FUNCTION public.validate_journal_batch_balance() OWNER TO postgres;
ALTER FUNCTION public.close_journal_batch(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.validate_journal_batch_balance() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_journal_batch_balance() TO service_role;

REVOKE ALL ON FUNCTION public.close_journal_batch(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.close_journal_batch(uuid) TO authenticated, service_role;

-- Post-flight: verify column and functions were created
DO $$
DECLARE
  v_column_exists boolean;
  v_trigger_exists boolean;
  v_close_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'journal_entries'
      AND column_name = 'batch_id'
  ) INTO v_column_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'validate_journal_batch_balance'
      AND tgrelid = 'public.journal_entries'::regclass
  ) INTO v_trigger_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'close_journal_batch'
      AND pronamespace = 'public'::regnamespace
  ) INTO v_close_exists;

  IF NOT v_column_exists THEN
    RAISE EXCEPTION 'Post-flight check failed: batch_id column not found';
  END IF;

  IF NOT v_trigger_exists THEN
    RAISE EXCEPTION 'Post-flight check failed: validate_journal_batch_balance trigger not found';
  END IF;

  IF NOT v_close_exists THEN
    RAISE EXCEPTION 'Post-flight check failed: close_journal_batch function not found';
  END IF;

  RAISE NOTICE 'Journal batch balance check successfully added (column, trigger, and close function)';
END $$;

-- ============================================================================
-- SOURCE: 20260714000001_seed_revenue_account.sql
-- ============================================================================

-- =============================================================================
-- Migration: Seed Revenue and VAT Payable Accounts
-- Phase: 2 (Wave 1 - Double-Entry Accounting Completion)
-- Date: 2026-07-13
-- 
-- Purpose:
-- Add missing accounts required for invoice journal entries:
--   - 4000: Rental Revenue (credit when invoice created)
--   - 2100: VAT Payable (credit when invoice has tax)
--
-- Current chart of accounts (before this migration):
--   1111 = Cash
--   1201 = Tenant Receivables
--   6100 = Operating Expenses
--
-- Chart of accounts (after this migration):
--   1111 = Cash
--   1201 = Tenant Receivables
--   2100 = VAT Payable (NEW)
--   4000 = Rental Revenue (NEW)
--   6100 = Operating Expenses
--
-- Risk: LOW - additive only, uses ON CONFLICT DO NOTHING
-- Rollback: DELETE FROM accounts WHERE id IN ('4000', '2100');
-- =============================================================================

BEGIN;

-- Seed Rental Revenue account
INSERT INTO public.accounts (id, no, name)
VALUES ('4000', '4000', 'Rental Revenue')
ON CONFLICT (id) DO NOTHING;

-- Seed VAT Payable account
INSERT INTO public.accounts (id, no, name)
VALUES ('2100', '2100', 'VAT Payable')
ON CONFLICT (id) DO NOTHING;

-- Validation: verify both accounts exist
DO $$
DECLARE
  v_revenue_exists boolean;
  v_vat_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.accounts WHERE id = '4000') INTO v_revenue_exists;
  SELECT EXISTS(SELECT 1 FROM public.accounts WHERE id = '2100') INTO v_vat_exists;
  
  IF NOT v_revenue_exists THEN
    RAISE EXCEPTION 'Migration failed: account 4000 (Rental Revenue) not created';
  END IF;
  
  IF NOT v_vat_exists THEN
    RAISE EXCEPTION 'Migration failed: account 2100 (VAT Payable) not created';
  END IF;
  
  RAISE NOTICE '✓ Accounts 4000 (Rental Revenue) and 2100 (VAT Payable) seeded successfully';
END $$;

COMMIT;

-- ============================================================================
-- SOURCE: 20260714000002_hardened_invoice_generation.sql
-- ============================================================================

-- =============================================================================
-- Migration: Hardened Invoice Generation with Journal Entries
-- Phase: 2 (Wave 1 - Double-Entry Accounting Completion)
-- Date: 2026-07-13
--
-- Purpose:
-- Rewrite generate_invoices_from_active_contracts() to:
--   1. Create journal entries for each invoice (Dr AR, Cr Revenue, Cr VAT)
--   2. Add payment_cycle awareness (monthly/quarterly/semi_annual/annual)
--   3. Add advisory locking to prevent race conditions
--   4. Add batch_id for journal entry grouping
--   5. Add audit log entry
--   6. Use unique partial index for dedup (added in migration 9)
--
-- Fixes: A-01, A-01b, A-01c, D-09
--
-- Risk: MEDIUM - rewrites core financial function
-- Rollback: See ORIGINAL FUNCTION BODY below
--
-- =============================================================================
-- ORIGINAL FUNCTION BODY (for rollback):
-- =============================================================================
-- create or replace function public.generate_invoices_from_active_contracts()
-- returns integer
-- language plpgsql
-- security definer
-- set search_path = public, pg_temp
-- as $$
-- declare
--   v_count integer;
-- begin
--   if auth.uid() is null or not public.is_admin_or_manager() then
--     raise exception 'ADMIN or MANAGER role is required to generate invoices' using errcode = '42501';
--   end if;
--
--   insert into public.invoices (contract_id, issue_date, due_date, amount, status)
--   select c.id, current_date, current_date, c.rent_amount, 'UNPAID'
--   from public.contracts c
--   where c.deleted_at is null
--     and lower(c.status) = 'active'
--     and not exists (
--       select 1
--       from public.invoices i
--       where i.contract_id = c.id
--         and i.issue_date = current_date
--         and i.deleted_at is null
--     );
--
--   get diagnostics v_count = row_count;
--   return v_count;
-- end;
-- $$;
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Add unique partial index for invoice dedup (prevents race conditions)
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS invoices_contract_issue_date_unique
  ON public.invoices (contract_id, issue_date)
  WHERE deleted_at IS NULL;

-- =============================================================================
-- STEP 2: Rewrite generate_invoices_from_active_contracts
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_invoices_from_active_contracts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract record;
  v_invoice_id uuid;
  v_batch_id uuid;
  v_tax_rate numeric;
  v_tax_amount numeric;
  v_total_amount numeric;
  v_ar_account_id text;
  v_revenue_account_id text;
  v_vat_account_id text;
  v_count integer := 0;
  v_period_start date;
  v_period_end date;
  v_invoice_exists boolean;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to generate invoices' USING ERRCODE = '42501';
  END IF;

  -- Get account IDs
  SELECT id INTO v_ar_account_id FROM public.accounts WHERE no = '1201' LIMIT 1;
  SELECT id INTO v_revenue_account_id FROM public.accounts WHERE no = '4000' LIMIT 1;
  SELECT id INTO v_vat_account_id FROM public.accounts WHERE no = '2100' LIMIT 1;

  IF v_ar_account_id IS NULL OR v_revenue_account_id IS NULL THEN
    RAISE EXCEPTION 'Required accounts not configured (1201 or 4000)';
  END IF;

  -- Get VAT rate from company_settings (if VAT enabled)
  SELECT CASE WHEN vat_enabled THEN COALESCE(vat_rate, 0) ELSE 0 END
    INTO v_tax_rate
    FROM public.company_settings
    LIMIT 1;

  IF v_tax_rate IS NULL THEN
    v_tax_rate := 0;
  END IF;

  -- Loop through active contracts with advisory lock
  FOR v_contract IN
    SELECT c.id, c.rent_amount, c.payment_cycle, c.start_date
    FROM public.contracts c
    WHERE c.deleted_at IS NULL
      AND lower(c.status) = 'active'
    ORDER BY c.id
  LOOP
    -- Advisory lock on contract_id to prevent concurrent invoice generation
    PERFORM pg_advisory_xact_lock(hashtext('invoice_generation:' || v_contract.id::text));

    -- Calculate current billing period based on payment_cycle
    CASE v_contract.payment_cycle
      WHEN 'monthly' THEN
        v_period_start := date_trunc('month', current_date)::date;
        v_period_end := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
      WHEN 'quarterly' THEN
        v_period_start := date_trunc('quarter', current_date)::date;
        v_period_end := (date_trunc('quarter', current_date) + interval '3 months' - interval '1 day')::date;
      WHEN 'semi_annual' THEN
        -- 6-month periods: Jan-Jun, Jul-Dec
        IF EXTRACT(MONTH FROM current_date) <= 6 THEN
          v_period_start := make_date(EXTRACT(YEAR FROM current_date)::int, 1, 1);
          v_period_end := make_date(EXTRACT(YEAR FROM current_date)::int, 6, 30);
        ELSE
          v_period_start := make_date(EXTRACT(YEAR FROM current_date)::int, 7, 1);
          v_period_end := make_date(EXTRACT(YEAR FROM current_date)::int, 12, 31);
        END IF;
      WHEN 'annual' THEN
        v_period_start := date_trunc('year', current_date)::date;
        v_period_end := (date_trunc('year', current_date) + interval '1 year' - interval '1 day')::date;
      ELSE
        -- Default to monthly if unknown
        v_period_start := date_trunc('month', current_date)::date;
        v_period_end := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
    END CASE;

    -- Check if invoice already exists for this period
    SELECT EXISTS(
      SELECT 1 FROM public.invoices i
      WHERE i.contract_id = v_contract.id
        AND i.issue_date >= v_period_start
        AND i.issue_date <= v_period_end
        AND i.deleted_at IS NULL
    ) INTO v_invoice_exists;

    IF v_invoice_exists THEN
      -- Already invoiced this period, skip
      CONTINUE;
    END IF;

    -- Calculate tax
    v_tax_amount := round(v_contract.rent_amount * v_tax_rate / 100, 2);
    v_total_amount := v_contract.rent_amount + v_tax_amount;

    -- Generate batch_id for this invoice's journal entries
    v_batch_id := gen_random_uuid();

    -- Create invoice
    INSERT INTO public.invoices (
      contract_id, issue_date, due_date, amount, tax_amount, tax_rate, status
    ) VALUES (
      v_contract.id,
      current_date,
      current_date + interval '30 days',
      v_contract.rent_amount,
      v_tax_amount,
      v_tax_rate,
      'UNPAID'
    )
    RETURNING id INTO v_invoice_id;

    -- Create journal entries (double-entry accounting)
    -- Debit: Tenant Receivables (1201) for total amount
    INSERT INTO public.journal_entries (
      id, no, date, account_id, amount, type, source_id, entity_type, entity_id, batch_id, created_at
    ) VALUES (
      gen_random_uuid(),
      'INV-' || v_invoice_id::text || '-DR',
      current_date,
      v_ar_account_id,
      v_total_amount,
      'DEBIT',
      v_invoice_id,
      'invoice',
      v_invoice_id::text,
      v_batch_id,
      now()
    );

    -- Credit: Rental Revenue (4000) for base amount
    INSERT INTO public.journal_entries (
      id, no, date, account_id, amount, type, source_id, entity_type, entity_id, batch_id, created_at
    ) VALUES (
      gen_random_uuid(),
      'INV-' || v_invoice_id::text || '-CR-REV',
      current_date,
      v_revenue_account_id,
      v_contract.rent_amount,
      'CREDIT',
      v_invoice_id,
      'invoice',
      v_invoice_id::text,
      v_batch_id,
      now()
    );

    -- Credit: VAT Payable (2100) for tax amount (if tax > 0)
    IF v_tax_amount > 0 AND v_vat_account_id IS NOT NULL THEN
      INSERT INTO public.journal_entries (
        id, no, date, account_id, amount, type, source_id, entity_type, entity_id, batch_id, created_at
      ) VALUES (
        gen_random_uuid(),
        'INV-' || v_invoice_id::text || '-CR-VAT',
        current_date,
        v_vat_account_id,
        v_tax_amount,
        'CREDIT',
        v_invoice_id,
        'invoice',
        v_invoice_id::text,
        v_batch_id,
        now()
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  -- Audit log
  IF v_count > 0 THEN
    INSERT INTO public.audit_log (
      ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
    ) VALUES (
      extract(epoch from now())::bigint,
      auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'GENERATE',
      'invoices',
      'batch',
      format('Generated %s invoices from active contracts', v_count),
      'invoices',
      jsonb_build_object('count', v_count, 'tax_rate', v_tax_rate)::text,
      now()
    );
  END IF;

  RETURN v_count;
END;
$$;

-- Preserve grants
REVOKE ALL ON FUNCTION public.generate_invoices_from_active_contracts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.generate_invoices_from_active_contracts() TO authenticated, service_role;

-- Validation
DO $$
BEGIN
  -- Verify unique index exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'invoices' AND indexname = 'invoices_contract_issue_date_unique'
  ) THEN
    RAISE EXCEPTION 'Migration failed: unique index not created';
  END IF;

  -- Verify function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'generate_invoices_from_active_contracts'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'Migration failed: function not created';
  END IF;

  RAISE NOTICE '✓ Invoice generation hardened: journal entries + payment_cycle + locking + dedup';
END $$;

COMMIT;

-- ============================================================================
-- SOURCE: 20260714000003_contract_balances_triggers.sql
-- ============================================================================

-- =============================================================================
-- Migration: Contract Balances Triggers
-- Phase: 2 (Wave 1 - Double-Entry Accounting Completion)
-- Date: 2026-07-13
--
-- Purpose:
-- Maintain contract_balances incrementally via triggers instead of relying
-- solely on recalculate_all_balances(). This ensures balances are always
-- current without manual intervention.
--
-- Triggers:
--   1. invoices INSERT/UPDATE/DELETE → update total_invoiced and balance_due
--   2. receipt_allocations INSERT/DELETE → update total_paid and balance_due
--
-- Fixes: A-03
--
-- Risk: MEDIUM - adds trigger overhead to invoice/payment paths
-- Rollback: See DROP statements at end of file
--
-- =============================================================================
-- ROLLBACK SCRIPT:
-- =============================================================================
-- DROP TRIGGER IF EXISTS trg_invoices_update_contract_balance ON public.invoices;
-- DROP TRIGGER IF EXISTS trg_receipt_allocations_update_contract_balance ON public.receipt_allocations;
-- DROP FUNCTION IF EXISTS public.update_contract_balance_from_invoice();
-- DROP FUNCTION IF EXISTS public.update_contract_balance_from_allocation();
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Create function to update contract_balances from invoice changes
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_contract_balance_from_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract_id uuid;
  v_total_invoiced numeric;
  v_total_paid numeric;
  v_tenant_id uuid;
  v_unit_id uuid;
BEGIN
  -- Determine which contract_id to update
  IF TG_OP = 'DELETE' THEN
    v_contract_id := OLD.contract_id;
  ELSE
    v_contract_id := NEW.contract_id;
  END IF;

  -- Calculate totals for this contract
  SELECT 
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0),
    COALESCE(SUM(i.paid_amount), 0),
    c.tenant_id,
    c.unit_id
  INTO v_total_invoiced, v_total_paid, v_tenant_id, v_unit_id
  FROM public.contracts c
  LEFT JOIN public.invoices i ON i.contract_id = c.id AND i.deleted_at IS NULL
  WHERE c.id = v_contract_id
  GROUP BY c.tenant_id, c.unit_id;

  -- Upsert contract_balances
  INSERT INTO public.contract_balances (
    contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at
  ) VALUES (
    v_contract_id,
    v_tenant_id,
    v_unit_id,
    v_total_invoiced,
    v_total_paid,
    v_total_invoiced - v_total_paid,
    now()
  )
  ON CONFLICT (contract_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    unit_id = EXCLUDED.unit_id,
    total_invoiced = EXCLUDED.total_invoiced,
    total_paid = EXCLUDED.total_paid,
    balance_due = EXCLUDED.balance_due,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- =============================================================================
-- STEP 2: Create function to update contract_balances from allocation changes
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_contract_balance_from_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract_id uuid;
  v_total_invoiced numeric;
  v_total_paid numeric;
  v_tenant_id uuid;
  v_unit_id uuid;
BEGIN
  -- Get contract_id from the invoice referenced by this allocation
  IF TG_OP = 'DELETE' THEN
    SELECT i.contract_id INTO v_contract_id
    FROM public.invoices i
    WHERE i.id = OLD.invoice_id;
  ELSE
    SELECT i.contract_id INTO v_contract_id
    FROM public.invoices i
    WHERE i.id = NEW.invoice_id;
  END IF;

  IF v_contract_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate totals for this contract
  SELECT 
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0),
    COALESCE(SUM(i.paid_amount), 0),
    c.tenant_id,
    c.unit_id
  INTO v_total_invoiced, v_total_paid, v_tenant_id, v_unit_id
  FROM public.contracts c
  LEFT JOIN public.invoices i ON i.contract_id = c.id AND i.deleted_at IS NULL
  WHERE c.id = v_contract_id
  GROUP BY c.tenant_id, c.unit_id;

  -- Upsert contract_balances
  INSERT INTO public.contract_balances (
    contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at
  ) VALUES (
    v_contract_id,
    v_tenant_id,
    v_unit_id,
    v_total_invoiced,
    v_total_paid,
    v_total_invoiced - v_total_paid,
    now()
  )
  ON CONFLICT (contract_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    unit_id = EXCLUDED.unit_id,
    total_invoiced = EXCLUDED.total_invoiced,
    total_paid = EXCLUDED.total_paid,
    balance_due = EXCLUDED.balance_due,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- =============================================================================
-- STEP 3: Create triggers
-- =============================================================================
DROP TRIGGER IF EXISTS trg_invoices_update_contract_balance ON public.invoices;
CREATE TRIGGER trg_invoices_update_contract_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contract_balance_from_invoice();

DROP TRIGGER IF EXISTS trg_receipt_allocations_update_contract_balance ON public.receipt_allocations;
CREATE TRIGGER trg_receipt_allocations_update_contract_balance
  AFTER INSERT OR DELETE ON public.receipt_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contract_balance_from_allocation();

-- =============================================================================
-- STEP 4: Backfill existing contract_balances
-- =============================================================================
INSERT INTO public.contract_balances (
  contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at
)
SELECT
  c.id,
  c.tenant_id,
  c.unit_id,
  COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0),
  COALESCE(SUM(i.paid_amount), 0),
  COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0) - COALESCE(SUM(i.paid_amount), 0),
  now()
FROM public.contracts c
LEFT JOIN public.invoices i ON i.contract_id = c.id AND i.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.tenant_id, c.unit_id
ON CONFLICT (contract_id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  unit_id = EXCLUDED.unit_id,
  total_invoiced = EXCLUDED.total_invoiced,
  total_paid = EXCLUDED.total_paid,
  balance_due = EXCLUDED.balance_due,
  updated_at = now();

-- =============================================================================
-- STEP 5: Set ownership and grants
-- =============================================================================
ALTER FUNCTION public.update_contract_balance_from_invoice() OWNER TO postgres;
ALTER FUNCTION public.update_contract_balance_from_allocation() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.update_contract_balance_from_invoice() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_contract_balance_from_invoice() TO service_role;

REVOKE ALL ON FUNCTION public.update_contract_balance_from_allocation() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_contract_balance_from_allocation() TO service_role;

-- =============================================================================
-- STEP 6: Validation
-- =============================================================================
DO $$
DECLARE
  v_invoice_trigger_exists boolean;
  v_allocation_trigger_exists boolean;
  v_balance_count integer;
BEGIN
  -- Verify triggers exist
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_invoices_update_contract_balance'
      AND tgrelid = 'public.invoices'::regclass
  ) INTO v_invoice_trigger_exists;

  SELECT EXISTS(
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_receipt_allocations_update_contract_balance'
      AND tgrelid = 'public.receipt_allocations'::regclass
  ) INTO v_allocation_trigger_exists;

  IF NOT v_invoice_trigger_exists THEN
    RAISE EXCEPTION 'Migration failed: invoice trigger not created';
  END IF;

  IF NOT v_allocation_trigger_exists THEN
    RAISE EXCEPTION 'Migration failed: allocation trigger not created';
  END IF;

  -- Verify backfill
  SELECT COUNT(*) INTO v_balance_count FROM public.contract_balances;
  
  RAISE NOTICE '✓ Contract balances triggers created and % existing contracts backfilled', v_balance_count;
END $$;

COMMIT;

-- ============================================================================
-- SOURCE: 20260714000004_fix_rpt_cash_flow_void_filter.sql
-- ============================================================================

-- Migration: Fix rpt_cash_flow VOID payment filter
-- Phase: 2 Wave 2 - Report Accuracy
-- Finding: A-06
--
-- Problem:
-- rpt_cash_flow includes VOID payments in the receipts total, which overstates
-- cash collections. The function only filters deleted_at IS NULL but doesn't
-- check payment status.
--
-- Solution:
-- Add filter to exclude payments where status = 'VOID'
--
-- Risk: LOW - additive filter, no schema changes
-- Rollback: Revert to original function (see ORIGINAL FUNCTION below)

-- ============================================================================
-- ORIGINAL FUNCTION (for rollback reference)
-- ============================================================================
-- CREATE OR REPLACE FUNCTION public.rpt_cash_flow(
--   p_from_date date,
--   p_to_date date
-- ) RETURNS jsonb
-- LANGUAGE plpgsql SECURITY DEFINER
-- SET search_path TO 'public', 'pg_temp' AS $$
-- DECLARE
--   v_operating jsonb;
--   v_investing jsonb;
--   v_financing jsonb;
--   v_receipts numeric;
--   v_expenses numeric;
-- BEGIN
--   SELECT COALESCE(SUM(amount), 0) INTO v_receipts
--   FROM public.payments
--   WHERE payment_date BETWEEN p_from_date AND p_to_date
--     AND deleted_at IS NULL;
--
--   SELECT COALESCE(SUM(amount), 0) INTO v_expenses
--   FROM public.expenses
--   WHERE expense_date BETWEEN p_from_date AND p_to_date
--     AND deleted_at IS NULL;
--
--   v_operating := jsonb_build_object(
--     'receipts', v_receipts,
--     'expenses', v_expenses,
--     'net_operating', v_receipts - v_expenses
--   );
--
--   v_investing := jsonb_build_object('note', 'not_applicable_single_office', 'amount', 0);
--   v_financing := jsonb_build_object('note', 'not_applicable_single_office', 'amount', 0);
--
--   RETURN jsonb_build_object(
--     'period', jsonb_build_object('from', p_from_date, 'to', p_to_date),
--     'operating', v_operating,
--     'investing', v_investing,
--     'financing', v_financing,
--     'net_change', v_receipts - v_expenses
--   );
-- END;
-- $$;
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpt_cash_flow(
  p_from_date date,
  p_to_date date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_operating jsonb;
  v_investing jsonb;
  v_financing jsonb;
  v_receipts numeric;
  v_expenses numeric;
BEGIN
  -- FIX: Added COALESCE(UPPER(status), 'POSTED') <> 'VOID' filter
  SELECT COALESCE(SUM(amount), 0) INTO v_receipts
  FROM public.payments
  WHERE payment_date BETWEEN p_from_date AND p_to_date
    AND deleted_at IS NULL
    AND COALESCE(UPPER(status), 'POSTED') <> 'VOID';

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM public.expenses
  WHERE expense_date BETWEEN p_from_date AND p_to_date
    AND deleted_at IS NULL;

  v_operating := jsonb_build_object(
    'receipts', v_receipts,
    'expenses', v_expenses,
    'net_operating', v_receipts - v_expenses
  );

  v_investing := jsonb_build_object('note', 'not_applicable_single_office', 'amount', 0);
  v_financing := jsonb_build_object('note', 'not_applicable_single_office', 'amount', 0);

  RETURN jsonb_build_object(
    'period', jsonb_build_object('from', p_from_date, 'to', p_to_date),
    'operating', v_operating,
    'investing', v_investing,
    'financing', v_financing,
    'net_change', v_receipts - v_expenses
  );
END;
$$;

-- Preserve grants
REVOKE ALL ON FUNCTION public.rpt_cash_flow(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_cash_flow(date, date) TO authenticated, service_role;

-- ============================================================================
-- SOURCE: 20260714000005_fix_rpt_vat_return_void_filter.sql
-- ============================================================================

-- Migration: Fix rpt_vat_return VOID/CANCELLED invoice filter
-- Phase: 2 Wave 2 - Report Accuracy
-- Finding: A-07
--
-- Problem:
-- rpt_vat_return includes VOID and CANCELLED invoices in the VAT calculation,
-- which inflates the VAT liability. The function only filters deleted_at IS NULL
-- but doesn't check invoice status.
--
-- Solution:
-- Add filter to exclude invoices where status IN ('VOID', 'CANCELLED')
--
-- Risk: LOW - additive filter, no schema changes
-- Rollback: Revert to original function (see ORIGINAL FUNCTION below)

-- ============================================================================
-- ORIGINAL FUNCTION (for rollback reference)
-- ============================================================================
-- CREATE OR REPLACE FUNCTION public.rpt_vat_return(
--   p_from_date date,
--   p_to_date date
-- ) RETURNS jsonb
-- LANGUAGE plpgsql SECURITY DEFINER
-- SET search_path TO 'public', 'pg_temp' AS $$
-- DECLARE
--   v_result jsonb;
-- BEGIN
--   SELECT jsonb_build_object(
--     'period', jsonb_build_object('from', p_from_date, 'to', p_to_date),
--     'total_sales_amount', COALESCE(SUM(amount), 0),
--     'total_tax_amount', COALESCE(SUM(tax_amount), 0),
--     'invoice_count', COUNT(*)
--   ) INTO v_result
--   FROM public.invoices
--   WHERE issue_date BETWEEN p_from_date AND p_to_date
--     AND deleted_at IS NULL;
--
--   RETURN v_result;
-- END;
-- $$;
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpt_vat_return(
  p_from_date date,
  p_to_date date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- FIX: Added COALESCE(UPPER(status), '') NOT IN ('VOID', 'CANCELLED') filter
  SELECT jsonb_build_object(
    'period', jsonb_build_object('from', p_from_date, 'to', p_to_date),
    'total_sales_amount', COALESCE(SUM(amount), 0),
    'total_tax_amount', COALESCE(SUM(tax_amount), 0),
    'invoice_count', COUNT(*)
  ) INTO v_result
  FROM public.invoices
  WHERE issue_date BETWEEN p_from_date AND p_to_date
    AND deleted_at IS NULL
    AND COALESCE(UPPER(status), '') NOT IN ('VOID', 'CANCELLED');

  RETURN v_result;
END;
$$;

-- Preserve grants
REVOKE ALL ON FUNCTION public.rpt_vat_return(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_vat_return(date, date) TO authenticated, service_role;

-- ============================================================================
-- SOURCE: 20260714000006_fix_rpt_financial_summary_status.sql
-- ============================================================================

-- Migration: Fix rpt_financial_summary VOID/CANCELLED filters and status staleness
-- Phase: 2 Wave 2 - Report Accuracy
-- Finding: A-08
--
-- Problem:
-- 1. Revenue calculation includes VOID and CANCELLED invoices
-- 2. Pending invoices count includes VOID and CANCELLED invoices
-- 3. Overdue calculation may include invoices with stale status
--
-- Solution:
-- 1. Add filter to exclude VOID/CANCELLED invoices from revenue calculation
-- 2. Add filter to exclude VOID/CANCELLED invoices from pending_invoices count
-- 3. Keep overdue logic as-is (checks both status AND due_date, which is correct)
--
-- Risk: LOW - additive filters, no schema changes
-- Rollback: Revert to original function (see ORIGINAL FUNCTION below)

-- ============================================================================
-- ORIGINAL FUNCTION (for rollback reference)
-- ============================================================================
-- create or replace function public.rpt_financial_summary(p_from date, p_to date)
-- returns table (
--   collected numeric,
--   expenses numeric,
--   net numeric,
--   revenue numeric,
--   net_income numeric,
--   overdue_amount numeric,
--   overdue_count bigint,
--   active_contracts bigint,
--   total_units bigint,
--   occupied_units bigint,
--   occupancy_rate numeric,
--   pending_invoices bigint,
--   period_from date,
--   period_to date
-- )
-- language sql
-- stable
-- security definer
-- set search_path = public, pg_temp
-- as $$
--   with totals as (
--     select
--       coalesce((select sum(amount) from public.payments where deleted_at is null and payment_date between p_from and p_to and coalesce(status, 'POSTED') <> 'VOID'), 0) as collected,
--       coalesce((select sum(amount) from public.expenses where deleted_at is null and expense_date between p_from and p_to), 0) as expenses,
--       coalesce((select sum(amount + coalesce(tax_amount, 0)) from public.invoices where deleted_at is null and issue_date between p_from and p_to), 0) as revenue,
--       coalesce((select sum(amount + coalesce(tax_amount, 0) - paid_amount) from public.invoices where deleted_at is null and status in ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE') and due_date < current_date), 0) as overdue_amount,
--       coalesce((select count(*) from public.invoices where deleted_at is null and status in ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE') and due_date < current_date), 0) as overdue_count,
--       coalesce((select count(*) from public.contracts where deleted_at is null and lower(status) = 'active'), 0) as active_contracts,
--       coalesce((select count(*) from public.units where deleted_at is null), 0) as total_units,
--       coalesce((select count(*) from public.units where deleted_at is null and status = 'occupied'), 0) as occupied_units,
--       coalesce((select count(*) from public.invoices where deleted_at is null and status in ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE')), 0) as pending_invoices
--   )
--   select
--     collected,
--     expenses,
--     collected - expenses as net,
--     revenue,
--     collected - expenses as net_income,
--     overdue_amount,
--     overdue_count,
--     active_contracts,
--     total_units,
--     occupied_units,
--     case when total_units = 0 then 0 else round((occupied_units::numeric / total_units::numeric) * 100, 2) end as occupancy_rate,
--     pending_invoices,
--     p_from,
--     p_to
--   from totals
-- $$;
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpt_financial_summary(p_from date, p_to date)
RETURNS TABLE (
  collected numeric,
  expenses numeric,
  net numeric,
  revenue numeric,
  net_income numeric,
  overdue_amount numeric,
  overdue_count bigint,
  active_contracts bigint,
  total_units bigint,
  occupied_units bigint,
  occupancy_rate numeric,
  pending_invoices bigint,
  period_from date,
  period_to date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH totals AS (
    SELECT
      -- Collected: already has VOID filter (correct)
      COALESCE((
        SELECT SUM(amount) 
        FROM public.payments 
        WHERE deleted_at IS NULL 
          AND payment_date BETWEEN p_from AND p_to 
          AND COALESCE(status, 'POSTED') <> 'VOID'
      ), 0) AS collected,
      
      -- Expenses: no change needed
      COALESCE((
        SELECT SUM(amount) 
        FROM public.expenses 
        WHERE deleted_at IS NULL 
          AND expense_date BETWEEN p_from AND p_to
      ), 0) AS expenses,
      
      -- FIX: Revenue: exclude VOID and CANCELLED invoices
      COALESCE((
        SELECT SUM(amount + COALESCE(tax_amount, 0)) 
        FROM public.invoices 
        WHERE deleted_at IS NULL 
          AND issue_date BETWEEN p_from AND p_to
          AND COALESCE(UPPER(status), '') NOT IN ('VOID', 'CANCELLED')
      ), 0) AS revenue,
      
      -- Overdue: keep existing logic (checks both status AND due_date)
      COALESCE((
        SELECT SUM(amount + COALESCE(tax_amount, 0) - paid_amount) 
        FROM public.invoices 
        WHERE deleted_at IS NULL 
          AND status IN ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE') 
          AND due_date < current_date
          AND COALESCE(UPPER(status), '') NOT IN ('VOID', 'CANCELLED')
      ), 0) AS overdue_amount,
      
      COALESCE((
        SELECT COUNT(*) 
        FROM public.invoices 
        WHERE deleted_at IS NULL 
          AND status IN ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE') 
          AND due_date < current_date
          AND COALESCE(UPPER(status), '') NOT IN ('VOID', 'CANCELLED')
      ), 0) AS overdue_count,
      
      -- Active contracts: no change needed
      COALESCE((
        SELECT COUNT(*) 
        FROM public.contracts 
        WHERE deleted_at IS NULL 
          AND LOWER(status) = 'active'
      ), 0) AS active_contracts,
      
      -- Units: no change needed
      COALESCE((
        SELECT COUNT(*) 
        FROM public.units 
        WHERE deleted_at IS NULL
      ), 0) AS total_units,
      
      COALESCE((
        SELECT COUNT(*) 
        FROM public.units 
        WHERE deleted_at IS NULL 
          AND status = 'occupied'
      ), 0) AS occupied_units,
      
      -- FIX: Pending invoices: exclude VOID and CANCELLED
      COALESCE((
        SELECT COUNT(*) 
        FROM public.invoices 
        WHERE deleted_at IS NULL 
          AND status IN ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE')
          AND COALESCE(UPPER(status), '') NOT IN ('VOID', 'CANCELLED')
      ), 0) AS pending_invoices
  )
  SELECT
    collected,
    expenses,
    collected - expenses AS net,
    revenue,
    collected - expenses AS net_income,
    overdue_amount,
    overdue_count,
    active_contracts,
    total_units,
    occupied_units,
    CASE WHEN total_units = 0 THEN 0 ELSE ROUND((occupied_units::numeric / total_units::numeric) * 100, 2) END AS occupancy_rate,
    pending_invoices,
    p_from,
    p_to
  FROM totals
$$;

-- Preserve grants
REVOKE ALL ON FUNCTION public.rpt_financial_summary(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_financial_summary(date, date) TO authenticated, service_role;

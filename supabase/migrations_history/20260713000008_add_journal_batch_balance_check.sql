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

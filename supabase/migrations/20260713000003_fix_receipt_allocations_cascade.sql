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

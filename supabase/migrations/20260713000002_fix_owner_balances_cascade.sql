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

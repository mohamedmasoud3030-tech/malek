-- =============================================================================
-- Migration: fix_contract_balances_cascade
-- Date: 2026-07-13
-- Phase: 1A — Financial Safety Lock
-- Risk: LOW (constraint tightening only, no data changes)
--
-- Problem:
--   contract_balances.contract_id references contracts(id) ON DELETE CASCADE.
--   If a contract is hard-deleted (via direct SQL, admin tool, or future bug),
--   the corresponding contract_balances row is silently destroyed — losing all
--   financial summary data (total_invoiced, total_paid, balance_due) without
--   any audit trail or error.
--
-- Fix:
--   Change the foreign key from ON DELETE CASCADE to ON DELETE RESTRICT.
--   The application uses soft-delete (deleted_at) and never hard-deletes
--   contracts, so this change has zero impact on normal operations. It only
--   protects against accidental or malicious hard-deletes.
--
-- Rollback:
--   ALTER TABLE public.contract_balances
--     DROP CONSTRAINT IF EXISTS contract_balances_contract_id_fkey;
--   ALTER TABLE public.contract_balances
--     ADD CONSTRAINT contract_balances_contract_id_fkey
--     FOREIGN KEY (contract_id) REFERENCES public.contracts(id)
--     ON DELETE CASCADE;
--
-- Validation (post-apply):
--   SELECT conname, confdeltype
--   FROM pg_constraint
--   WHERE conrelid = 'public.contract_balances'::regclass
--     AND confrelid = 'public.contracts'::regclass;
--   -- Expected: confdeltype = 'r' (RESTRICT)
-- =============================================================================

-- Pre-flight: verify no orphaned contract_balances rows exist
DO $$
DECLARE
  v_orphan_count integer;
BEGIN
  SELECT count(*)
    INTO v_orphan_count
    FROM public.contract_balances cb
    LEFT JOIN public.contracts c ON c.id = cb.contract_id
    WHERE c.id IS NULL;

  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'Cannot apply migration: found % orphan row(s) in contract_balances with no matching contract. Manual cleanup required before applying.', v_orphan_count;
  END IF;
END $$;

-- Drop existing CASCADE constraint
ALTER TABLE public.contract_balances
  DROP CONSTRAINT IF EXISTS contract_balances_contract_id_fkey;

-- Re-add with RESTRICT
ALTER TABLE public.contract_balances
  ADD CONSTRAINT contract_balances_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES public.contracts(id)
  ON DELETE RESTRICT;

-- Post-flight: verify constraint was created correctly
DO $$
DECLARE
  v_del_type char;
BEGIN
  SELECT confdeltype INTO v_del_type
  FROM pg_constraint
  WHERE conname = 'contract_balances_contract_id_fkey'
    AND conrelid = 'public.contract_balances'::regclass;

  IF v_del_type IS NULL THEN
    RAISE EXCEPTION 'Post-flight check failed: constraint contract_balances_contract_id_fkey not found';
  END IF;

  IF v_del_type <> 'r' THEN
    RAISE EXCEPTION 'Post-flight check failed: expected RESTRICT (r), got %', v_del_type;
  END IF;

  RAISE NOTICE 'contract_balances.contract_id FK successfully changed to ON DELETE RESTRICT';
END $$;

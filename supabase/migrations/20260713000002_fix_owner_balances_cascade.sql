-- =============================================================================
-- Migration: fix_owner_balances_cascade
-- Date: 2026-07-13
-- Phase: 1A — Financial Safety Lock
-- Risk: LOW/MEDIUM (hard-delete guard, no data changes)
--
-- Production schema note:
--   public.owner_balances.owner_id is text, while public.owners.id is uuid.
--   PostgreSQL cannot create a normal FK from text to uuid. The earlier FK
--   rewrite approach would fail with `operator does not exist: uuid = text` and
--   must not be deployed.
--
-- Chosen fix:
--   Do NOT introduce an invalid FK. Instead, install a BEFORE DELETE trigger on
--   public.owners that implements RESTRICT semantics for owner balance rows by
--   comparing OLD.id::text to owner_balances.owner_id. This preserves financial
--   summary data from accidental owner hard-deletes while staying compatible
--   with the live mixed text/uuid schema.
--
-- Safety:
--   - No INSERT/UPDATE/DELETE of business data.
--   - Existing orphan owner_balances rows are checked with an explicit cast.
--   - Existing invalid/mismatched FK with this name is dropped if present.
--   - The application uses soft-delete, so normal operations are unaffected.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_prevent_owner_delete_with_balances ON public.owners;
--   DROP FUNCTION IF EXISTS public.prevent_owner_delete_with_balances();
-- =============================================================================

-- Pre-flight: verify no orphaned owner_balances rows exist, using an explicit
-- uuid->text cast to match the production schema.
DO $$
DECLARE
  v_orphan_count integer;
BEGIN
  SELECT count(*)
    INTO v_orphan_count
    FROM public.owner_balances ob
    LEFT JOIN public.owners o ON o.id::text = ob.owner_id::text
    WHERE o.id IS NULL;

  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'Cannot apply migration: found % orphan row(s) in owner_balances with no matching owner. Manual cleanup required before applying.', v_orphan_count;
  END IF;
END $$;

-- If a previous environment has a same-named FK, remove it before installing
-- the compatible trigger-based guard. This is safe when the constraint does not
-- exist and avoids keeping CASCADE behavior where it is present.
ALTER TABLE public.owner_balances
  DROP CONSTRAINT IF EXISTS owner_balances_owner_id_fkey;

CREATE OR REPLACE FUNCTION public.prevent_owner_delete_with_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.owner_balances ob
    WHERE ob.owner_id::text = OLD.id::text
  ) THEN
    RAISE EXCEPTION 'Cannot hard-delete owner % because owner_balances rows exist; use soft-delete/archive to preserve financial history.', OLD.id
      USING ERRCODE = '23503';
  END IF;

  RETURN OLD;
END;
$$;

ALTER FUNCTION public.prevent_owner_delete_with_balances() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.prevent_owner_delete_with_balances() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_owner_delete_with_balances() TO service_role;

DROP TRIGGER IF EXISTS trg_prevent_owner_delete_with_balances ON public.owners;
CREATE TRIGGER trg_prevent_owner_delete_with_balances
  BEFORE DELETE ON public.owners
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_owner_delete_with_balances();

-- Post-flight: verify the compatible guard exists and no invalid FK was added.
DO $$
DECLARE
  v_trigger_exists boolean;
  v_fk_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_prevent_owner_delete_with_balances'
      AND tgrelid = 'public.owners'::regclass
      AND NOT tgisinternal
  ) INTO v_trigger_exists;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'owner_balances_owner_id_fkey'
      AND conrelid = 'public.owner_balances'::regclass
      AND contype = 'f'
  ) INTO v_fk_exists;

  IF NOT v_trigger_exists THEN
    RAISE EXCEPTION 'Post-flight check failed: owner hard-delete protection trigger not found';
  END IF;

  IF v_fk_exists THEN
    RAISE EXCEPTION 'Post-flight check failed: invalid owner_balances FK should not exist in mixed text/uuid schema';
  END IF;

  RAISE NOTICE 'owner_balances hard-delete protection installed via trigger; no invalid FK created';
END $$;

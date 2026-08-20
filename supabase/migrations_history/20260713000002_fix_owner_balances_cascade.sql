-- =============================================================================
-- Migration: fix_owner_balances_cascade
-- Date: 2026-07-13
-- Phase: 1A — Financial Safety Lock
-- Risk: LOW/MEDIUM (hard-delete guard, no data changes)
--
-- Supported schema layouts:
--   - clean baseline: owners.id uuid, owner_balances.owner_id uuid
--   - historical production: owners.id uuid, owner_balances.owner_id text
--
-- A normal FK cannot be retained in the mixed text/uuid layout. This migration
-- therefore replaces any same-named FK with a trigger-based RESTRICT guard and
-- compares both identifier columns through an explicit text representation.
-- =============================================================================

DO $$
DECLARE
  v_owner_id_type text;
  v_balance_owner_id_type text;
  v_orphan_count bigint;
BEGIN
  IF to_regclass('public.owners') IS NULL THEN
    RAISE EXCEPTION 'Cannot protect owner balances: public.owners was not found';
  END IF;

  IF to_regclass('public.owner_balances') IS NULL THEN
    RAISE EXCEPTION 'Cannot protect owner balances: public.owner_balances was not found';
  END IF;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_owner_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation
    ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'owners'
    AND attribute.attname = 'id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_balance_owner_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation
    ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'owner_balances'
    AND attribute.attname = 'owner_id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_owner_id_type IS NULL THEN
    RAISE EXCEPTION 'Cannot protect owner balances: public.owners(id) was not found';
  END IF;

  IF v_balance_owner_id_type IS NULL THEN
    RAISE EXCEPTION 'Cannot protect owner balances: public.owner_balances(owner_id) was not found';
  END IF;

  IF v_owner_id_type NOT IN ('uuid', 'text') THEN
    RAISE EXCEPTION
      'Cannot protect owner balances: unsupported public.owners(id) type %',
      v_owner_id_type;
  END IF;

  IF v_balance_owner_id_type NOT IN ('uuid', 'text') THEN
    RAISE EXCEPTION
      'Cannot protect owner balances: unsupported public.owner_balances(owner_id) type %',
      v_balance_owner_id_type;
  END IF;

  SELECT count(*)
    INTO v_orphan_count
  FROM public.owner_balances AS owner_balance
  LEFT JOIN public.owners AS owner_record
    ON owner_record.id::text = owner_balance.owner_id::text
  WHERE owner_record.id IS NULL;

  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION
      'Cannot apply migration: found % orphan row(s) in owner_balances with no matching owner. Manual cleanup required before applying.',
      v_orphan_count;
  END IF;
END
$$;

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
    FROM public.owner_balances AS owner_balance
    WHERE owner_balance.owner_id::text = OLD.id::text
  ) THEN
    RAISE EXCEPTION
      'Cannot hard-delete owner % because owner_balances rows exist; use soft-delete/archive to preserve financial history.',
      OLD.id
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
    RAISE EXCEPTION 'Post-flight check failed: owner_balances FK should be replaced by the cross-layout trigger guard';
  END IF;

  RAISE NOTICE 'owner_balances hard-delete protection installed via trigger; no incompatible FK retained';
END
$$;

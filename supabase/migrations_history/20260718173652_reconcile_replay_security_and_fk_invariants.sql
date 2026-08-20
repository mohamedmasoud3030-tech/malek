-- Production preflight on 2026-07-18 returned zero findings for both
-- invariants. This migration repairs clean historical replay, where legacy
-- function defaults and FK/index drift can otherwise violate the current
-- global security and performance contract.

DO $revoke_anon_security_definers$
DECLARE
  function_record record;
BEGIN
  FOR function_record IN
    SELECT p.oid::regprocedure::text AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND (
        has_function_privilege('public', p.oid, 'EXECUTE')
        OR has_function_privilege('anon', p.oid, 'EXECUTE')
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',
      function_record.signature
    );
  END LOOP;
END
$revoke_anon_security_definers$;

DO $index_core_foreign_keys$
DECLARE
  foreign_key_record record;
  index_name text;
BEGIN
  FOR foreign_key_record IN
    SELECT
      rel.relname AS table_name,
      attribute.attname AS column_name
    FROM pg_constraint constraint_record
    JOIN pg_class rel ON rel.oid = constraint_record.conrelid
    JOIN pg_namespace namespace_record ON namespace_record.oid = rel.relnamespace
    JOIN pg_class referenced_rel ON referenced_rel.oid = constraint_record.confrelid
    JOIN pg_attribute attribute
      ON attribute.attrelid = constraint_record.conrelid
     AND attribute.attnum = (constraint_record.conkey::int[])[1]
    WHERE namespace_record.nspname = 'public'
      AND constraint_record.contype = 'f'
      AND referenced_rel.relname IN ('owners', 'contracts', 'properties', 'units', 'tenants', 'people')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index index_record
        WHERE index_record.indrelid = constraint_record.conrelid
          AND (constraint_record.conkey::int[])[1] = ANY(index_record.indkey::int[])
      )
  LOOP
    index_name := left(
      format('idx_%s_%s_core_fk', foreign_key_record.table_name, foreign_key_record.column_name),
      63
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)',
      index_name,
      foreign_key_record.table_name,
      foreign_key_record.column_name
    );
  END LOOP;
END
$index_core_foreign_keys$;

DO $verify_replay_invariants$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'Replay invariant failed: anon can execute a public SECURITY DEFINER function';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint constraint_record
    JOIN pg_class rel ON rel.oid = constraint_record.conrelid
    JOIN pg_namespace namespace_record ON namespace_record.oid = rel.relnamespace
    JOIN pg_class referenced_rel ON referenced_rel.oid = constraint_record.confrelid
    WHERE namespace_record.nspname = 'public'
      AND constraint_record.contype = 'f'
      AND referenced_rel.relname IN ('owners', 'contracts', 'properties', 'units', 'tenants', 'people')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index index_record
        WHERE index_record.indrelid = constraint_record.conrelid
          AND (constraint_record.conkey::int[])[1] = ANY(index_record.indkey::int[])
      )
  ) THEN
    RAISE EXCEPTION 'Replay invariant failed: a core foreign key lacks a supporting index';
  END IF;
END
$verify_replay_invariants$;

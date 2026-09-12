-- Units direct-write ACL restore.
--
-- 20260901000001_restore_dump_acl_lock revoked INSERT/UPDATE/DELETE/TRUNCATE
-- from authenticated on every public table, and
-- 20260901000036_frontend_backend_contract_acl_storage_fix restored the
-- minimum direct PostgREST write surface for properties only. The frontend
-- performs the same governed direct INSERT/UPDATE operations on units
-- (create, edit, and soft-delete archive — unit-service.ts createUnit /
-- updateUnit / softDeleteUnit), so units is missing the same outer
-- PostgreSQL gate: every unit mutation from the UI fails with
-- 42501 "permission denied for table units" before RLS even runs.
--
-- This forward-only correction mirrors 000036 for units:
--   * table privileges are only the outer PostgreSQL gate;
--   * existing RLS policies (manager_write_units, p0_tenant_isolation
--     restrictive, p50_units_action_update, units_no_hard_delete) and the
--     guard triggers (trg_units_granular_update_guard, units_archive_guard,
--     enforce_unit_operational_status, units_normalize_status_contract) keep
--     enforcing company isolation, ADMIN/MANAGER authority, per-action
--     permissions, and archive preconditions;
--   * hard DELETE stays denied: units_no_hard_delete is restrictive(false)
--     and no DELETE privilege is granted, so archival remains the soft
--     deleted_at UPDATE only.
--
-- People (people-service.ts createPerson / updatePerson / softDeletePerson)
-- is broken by the identical root cause and is tracked as the deferred
-- sibling finding for the next phase; it is intentionally NOT touched here.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'units'
      AND c.relkind = 'r'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'public.units must have RLS enabled before restoring authenticated write privileges';
  END IF;
END
$$;

GRANT INSERT, UPDATE ON TABLE public.units TO authenticated;

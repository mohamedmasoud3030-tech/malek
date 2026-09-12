-- People direct-write ACL restore.
--
-- 20260901000001_restore_dump_acl_lock revoked INSERT/UPDATE/DELETE/TRUNCATE
-- from authenticated on every public table, and
-- 20260901000036_frontend_backend_contract_acl_storage_fix restored the
-- minimum direct PostgREST write surface for properties only. The frontend
-- performs the same governed direct INSERT/UPDATE operations on people
-- (create, edit, and soft-delete archive — people-service.ts createPerson /
-- updatePerson / softDeletePerson), so people is missing the same outer
-- PostgreSQL gate: every person mutation from the UI fails with
-- 42501 "permission denied for table people" before RLS even runs.
--
-- This is the same defect class fixed for units in
-- 20260912000001_units_direct_write_acl_restore (reproduced there as the
-- deferred sibling finding, PHASE 3 report §7). This forward-only
-- correction mirrors 000036 for people:
--   * table privileges are only the outer PostgreSQL gate;
--   * existing RLS policies (manager_write_people, p0_tenant_isolation
--     restrictive) keep enforcing company isolation and ADMIN/MANAGER
--     authority;
--   * hard DELETE stays denied: no DELETE privilege is granted, so archival
--     remains the soft deleted_at UPDATE only.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'people'
      AND c.relkind = 'r'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'public.people must have RLS enabled before restoring authenticated write privileges';
  END IF;
END
$$;

GRANT INSERT, UPDATE ON TABLE public.people TO authenticated;

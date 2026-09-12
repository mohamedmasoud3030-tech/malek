-- Complete direct-write ACL surface restore.
--
-- 20260901000001_restore_dump_acl_lock revoked INSERT/UPDATE/DELETE/TRUNCATE
-- from authenticated on every public table. 20260901000036 then restored the
-- minimum direct PostgREST write surface for properties only; 20260912000001
-- and 20260912000002 completed it for units and people.
--
-- A systematic inventory of every table the frontend writes to directly
-- (.insert/.update chains in the service layer) shows 15 further live write
-- surfaces that were never restored, so they all fail at the authorization
-- layer with 42501 "permission denied for table …" before RLS runs:
--
--   leads, lands, owners, property_owners, communication_records,
--   company_settings, cost_centers, payment_terms_templates,
--   service_provider_categories, utility_meters, utility_bills,
--   vault_documents, automation_rules, maintenance_records (updates only),
--
-- while every one of them ALREADY carries the correct RLS write policies
-- (manager_write_* / admin_write_company_settings / cost_centers_company_
-- manage / service-provider action policies / p50 action policies, plus the
-- restrictive p0_tenant_isolation company match where the table is
-- company-scoped). The RLS design is complete; only the outer PostgreSQL
-- gate is missing.
--
-- This forward-only correction completes the 000036 pattern:
--   * each table must have RLS enabled before any grant (fail closed);
--   * table privileges are only the outer gate — the existing RLS policies
--     keep enforcing company isolation and admin/manager (or per-action)
--     authority;
--   * maintenance_records gets UPDATE only: creation is the governed
--     create_maintenance_atomic RPC and maintenance_rpc_only_insert stays
--     restrictive(false), so a raw INSERT remains blocked even with the
--     outer gate present;
--   * hard DELETE is never granted: the frontend archives via soft
--     deleted_at UPDATEs, and no DELETE privilege is added;
--   * contracts remain RPC-only by design (000054 restrictive(false));
--     the attachments table is Storage-API-only (no Postgres writes).
--
-- Canonical anchors: PHASE 5 core-data-operations matrix,
-- docs/execution/PHASE5_CORE_DATA_OPERATIONS_MATRIX.md.

do $complete_direct_write_surface$
declare
  v_table text;
begin
  -- INSERT + UPDATE: full direct-write surfaces.
  foreach v_table in array array[
    'automation_rules', 'communication_records', 'company_settings',
    'cost_centers', 'lands', 'leads', 'owners',
    'payment_terms_templates', 'property_owners',
    'service_provider_categories', 'utility_bills', 'utility_meters',
    'vault_documents'
  ] loop
    if to_regclass('public.' || v_table) is null then
      continue;
    end if;
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table
        and c.relkind = 'r' and c.relrowsecurity
    ) then
      raise exception 'public.% must have RLS enabled before restoring authenticated write privileges', v_table
        using errcode = '42501';
    end if;
    execute format('grant insert, update on table public.%I to authenticated', v_table);
  end loop;

  -- UPDATE only: creation stays on the governed RPC boundary.
  if to_regclass('public.maintenance_records') is not null then
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'maintenance_records'
        and c.relkind = 'r' and c.relrowsecurity
    ) then
      raise exception 'public.maintenance_records must have RLS enabled before restoring authenticated write privileges'
        using errcode = '42501';
    end if;
    execute 'grant update on table public.maintenance_records to authenticated';
  end if;
end
$complete_direct_write_surface$;

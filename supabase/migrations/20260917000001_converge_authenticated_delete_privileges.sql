-- Converge the authenticated DELETE privilege surface to the documented invariant.
--
-- WHY THIS EXISTS (repository evidence, not assumption)
--
-- The canonical design of this system is explicit that durable business records
-- are never hard-deleted by the browser role: archival is a soft `deleted_at`
-- UPDATE. Three independent pieces of repository evidence agree:
--
--   1. `20260912000003_complete_direct_write_acl_surface_restore.sql:37` —
--      "hard DELETE is never granted: the frontend archives via soft
--      deleted_at UPDATEs, and no DELETE privilege is added".
--   2. The frontend never issues one: 16 occurrences of `.delete(` exist in
--      `rentrix-app/src`, all of them `Map`/`Set` operations or negated
--      assertions; there is no `method: 'DELETE'` anywhere in `src/` or `e2e/`;
--      and `deleted_at` is referenced 697 times.
--   3. The repository pins that absence with tests:
--      `rentrix-app/src/features/owners/services/owner-service.test.ts:156`
--      asserts `not.toContain('.delete()')`.
--
-- Against that invariant, two repository facts are inconsistent with it:
--
--   * `20260901000001_restore_dump_acl_lock.sql:20` grants
--     `insert, update, delete on table public.audit_log to authenticated`.
--     The DELETE half of that grant is not required by any application path.
--     It is currently INERT — `audit_log` has RLS enabled
--     (`20260901000000_canonical_baseline.sql:31994`) and its only policy is
--     `admin_read_audit_log ... FOR SELECT`, so no DELETE policy exists and RLS
--     denies the operation. It is nonetheless a latent hazard: the outer
--     PostgreSQL gate is open on a tamper-evident audit trail, so any future
--     permissive policy (or a `FOR ALL` policy) would immediately expose
--     audit-log deletion to the browser role.
--   * Production additionally received an out-of-band grant
--     (`20260912065042_fix_missing_authenticated_write_grants`, applied
--     directly to the live database and never present in this repository, per
--     `20260913030547_fix_authenticated_acl_delete_and_spc_grants.sql:4-5`)
--     that granted INSERT, UPDATE *and DELETE* on 41 tables. Only 16 of those
--     tables had their DELETE privilege revoked afterwards. The remaining
--     surface cannot be measured from this repository and must not be assumed
--     clean.
--
-- WHAT THIS MIGRATION DOES
--
-- It computes the end state instead of replaying either history. Rather than
-- enumerating the tables some unknown earlier grant may or may not have touched,
-- it removes the privilege class entirely: `authenticated`, `anon` and `PUBLIC`
-- end this migration holding no DELETE or TRUNCATE on any table in `public`,
-- now or for tables created later. The end state is therefore identical whether
-- the out-of-band grant ran, did not run, or ran with a different table list.
--
-- WHY THIS IS SAFE FOR PRODUCTION DATA
--
--   * It is revoke-only. No row is read, written, moved or deleted; no table,
--     column, policy, function or trigger is altered. Reversing it is a
--     re-grant.
--   * It cannot break a working path: no application code issues a hard DELETE
--     (evidence above), and every affected table's RLS already denies DELETE
--     for the lack of a DELETE policy.
--   * It is idempotent. Re-running it against an already-converged database is
--     a no-op, so a partial or repeated application cannot corrupt state.
--   * It cannot silently over-revoke. The post-condition block below re-asserts
--     that the intended INSERT/UPDATE write surface is still intact and raises
--     if this migration ever removed more than the DELETE/TRUNCATE class.
--
-- After applying, production is expected to show: no DELETE or TRUNCATE grant
-- for authenticated/anon/PUBLIC on any public table; INSERT+UPDATE intact on the
-- 16 direct-write tables and UPDATE on maintenance_records. The read-only probe
-- `scripts/verify-supabase-live-readiness.sh` asserts exactly that.

begin;

-- 1. Remove the DELETE and TRUNCATE privilege class from the browser roles on
--    every existing table in the public schema. TRUNCATE is included because it
--    is a strictly more destructive form of the same removal and the canonical
--    baseline already revoked it; keeping it revoked is a no-op where it holds.
revoke delete, truncate on all tables in schema public from authenticated;
revoke delete, truncate on all tables in schema public from anon;
revoke delete, truncate on all tables in schema public from public;

-- 2. Make the invariant hold for tables created after this migration too.
--    Without this, a future `create table` would fall back to the schema's
--    default privileges and the drift would reappear unobserved.
alter default privileges in schema public revoke delete, truncate on tables from authenticated;
alter default privileges in schema public revoke delete, truncate on tables from anon;
alter default privileges in schema public revoke delete, truncate on tables from public;

-- 3. Post-condition: prove the converged end state, and prove that this
--    migration did not over-revoke the write surface the application needs.
do $converge_authenticated_delete$
declare
  v_offenders text;
  v_missing   text;
begin
  -- 3a. No browser-facing role may hold DELETE on any public table.
  select string_agg(distinct g.table_name || '(' || g.grantee || ')', ', ' order by g.table_name || '(' || g.grantee || ')')
    into v_offenders
  from information_schema.role_table_grants g
  join information_schema.tables t
    on t.table_schema = g.table_schema
   and t.table_name = g.table_name
   and t.table_type = 'BASE TABLE'
  where g.table_schema = 'public'
    and g.privilege_type = 'DELETE'
    and lower(g.grantee) in ('authenticated', 'anon', 'public');

  if v_offenders is not null then
    raise exception 'authenticated DELETE privilege convergence failed; remaining: %', v_offenders
      using errcode = '42501';
  end if;

  -- 3b. The intended direct-write surface must still be writable, otherwise
  --     this migration removed too much and the UI would fail with 42501.
  with expected(table_name) as (
    values
      ('properties'), ('units'), ('people'), ('leads'), ('lands'), ('owners'),
      ('property_owners'), ('communication_records'), ('company_settings'),
      ('cost_centers'), ('payment_terms_templates'), ('automation_rules'),
      ('utility_bills'), ('utility_meters'), ('vault_documents'),
      ('service_provider_categories')
  )
  select string_agg(e.table_name || ':' || missing.privilege, ', ' order by e.table_name || ':' || missing.privilege)
    into v_missing
  from expected e
  cross join (values ('INSERT'), ('UPDATE')) as missing(privilege)
  where to_regclass('public.' || e.table_name) is not null
    and not exists (
      select 1
      from information_schema.role_table_grants g
      where g.table_schema = 'public'
        and g.table_name = e.table_name
        and g.grantee = 'authenticated'
        and g.privilege_type = missing.privilege
    );

  if v_missing is not null then
    raise exception 'direct-write surface was over-revoked; missing privileges: %', v_missing
      using errcode = '42501';
  end if;

  -- 3c. maintenance_records is UPDATE-only by design: creation goes through
  --     create_maintenance_atomic and the restrictive policy
  --     maintenance_rpc_only_insert stays false, so a raw INSERT must stay
  --     blocked at the outer gate as well.
  if to_regclass('public.maintenance_records') is not null then
    if exists (
      select 1
      from information_schema.role_table_grants g
      where g.table_schema = 'public'
        and g.table_name = 'maintenance_records'
        and g.grantee = 'authenticated'
        and g.privilege_type in ('DELETE', 'INSERT')
    ) then
      raise exception 'maintenance_records must remain UPDATE-only for authenticated'
        using errcode = '42501';
    end if;

    if not exists (
      select 1
      from information_schema.role_table_grants g
      where g.table_schema = 'public'
        and g.table_name = 'maintenance_records'
        and g.grantee = 'authenticated'
        and g.privilege_type = 'UPDATE'
    ) then
      raise exception 'maintenance_records must keep authenticated UPDATE'
        using errcode = '42501';
    end if;
  end if;
end
$converge_authenticated_delete$;

commit;

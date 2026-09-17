#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  cat >&2 <<'MSG'
Supabase live readiness check skipped: SUPABASE_DB_URL is not set.
Provide an approved read-only database URL in an operator or CI environment.
MSG
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Supabase live readiness check skipped: psql is not installed." >&2
  exit 2
fi

psql "$SUPABASE_DB_URL" \
  --set=ON_ERROR_STOP=1 \
  --set=VERBOSITY=terse \
  --no-align \
  --tuples-only <<'SQL'
\echo 'Rentrix live Supabase readiness check (read-only)'
BEGIN READ ONLY;

select 'server_timestamp_utc=' || now() at time zone 'utc';

select 'migration_count=' || count(*)
from supabase_migrations.schema_migrations;

with required_tables(table_name) as (
  -- 'sessions' was removed from this list: no migration in supabase/migrations
  -- ever created a public.sessions table (verified: zero `create table ... sessions`
  -- hits across all 100 canonical migrations), the generated types expose no such
  -- table, and no app code references it. Session state lives in Supabase Auth
  -- (auth.sessions), which is not part of the public schema contract. Keeping the
  -- entry made this check report a permanent false gap against the live database.
  values
    ('users'),
    ('properties'),
    ('units'),
    ('contracts'),
    ('invoices'),
    ('payments'),
    ('receipts'),
    ('expenses'),
    ('bank_accounts'),
    ('bank_statement_imports'),
    ('bank_statement_lines'),
    ('bank_reconciliation_matches')
), missing_tables as (
  select required_tables.table_name
  from required_tables
  left join information_schema.tables t
    on t.table_schema = 'public'
   and t.table_name = required_tables.table_name
  where t.table_name is null
)
select case
  when exists(select 1 from missing_tables)
    then 'missing_required_tables=' || string_agg(table_name, ', ' order by table_name)
  else 'missing_required_tables=none'
end
from missing_tables;

with required_functions(function_name) as (
  values
    ('record_invoice_payment_atomic'),
    ('void_receipt_atomic'),
    ('find_payment_account_id'),
    ('rpt_owner_statement'),
    ('rpt_tenant_statement'),
    ('rpt_cash_flow'),
    ('rpt_vat_return')
), missing_functions as (
  select required_functions.function_name
  from required_functions
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = required_functions.function_name
  )
)
select case
  when exists(select 1 from missing_functions)
    then 'missing_required_functions=' || string_agg(function_name, ', ' order by function_name)
  else 'missing_required_functions=none'
end
from missing_functions;

select 'rls_enabled_public_tables_without_policy=' || count(*)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity
  and not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = c.relname
  );

select 'payment_receipt_rpc_overloads=' || string_agg(
  p.proname || '(' || pg_get_function_arguments(p.oid) || ')',
  '; '
  order by p.proname, pg_get_function_arguments(p.oid)
)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('record_invoice_payment_atomic', 'void_receipt_atomic', 'find_payment_account_id');

-- ===========================================================================
-- Security-critical ACL convergence probes (added 2026-09-17)
--
-- These assert the end state that
-- `20260917000001_converge_authenticated_delete_privileges.sql` establishes and
-- that the canonical migrations document. They are READ-ONLY and RAISE on
-- violation, so a drifted production database turns this check red instead of
-- printing a reassuring line.
-- ===========================================================================

-- P1. No browser-facing role may hold DELETE or TRUNCATE on any public table.
--     Hard deletion of business records is never granted to the browser role;
--     archival is a soft `deleted_at` UPDATE. This also covers the tables an
--     out-of-band production grant (20260912065042) touched and that the
--     repository could not enumerate.
do $live_delete_absence$
declare
  v_offenders text;
begin
  select string_agg(distinct g.table_name || '(' || g.grantee || ':' || g.privilege_type || ')', ', ' order by g.table_name || '(' || g.grantee || ':' || g.privilege_type || ')')
    into v_offenders
  from information_schema.role_table_grants g
  join information_schema.tables t
    on t.table_schema = g.table_schema
   and t.table_name = g.table_name
   and t.table_type = 'BASE TABLE'
  where g.table_schema = 'public'
    and g.privilege_type in ('DELETE', 'TRUNCATE')
    and lower(g.grantee) in ('authenticated', 'anon', 'public');

  if v_offenders is not null then
    raise exception 'ACL DRIFT: browser roles still hold DELETE/TRUNCATE on public tables: %', v_offenders
      using errcode = '42501';
  end if;
end
$live_delete_absence$;

select 'p1_delete_truncate_absence=pass';

-- P2. The intended direct-write surface must still be writable, so a future
--     revoke cannot silently break every UI mutation with 42501.
do $live_direct_write_surface$
declare
  v_missing text;
begin
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
    raise exception 'ACL DRIFT: direct-write surface missing privileges: %', v_missing
      using errcode = '42501';
  end if;
end
$live_direct_write_surface$;

select 'p2_direct_write_surface=pass';

-- P3. maintenance_records stays UPDATE-only for authenticated: creation is the
--     governed create_maintenance_atomic RPC and maintenance_rpc_only_insert is
--     restrictive(false).
do $live_maintenance_boundary$
begin
  if to_regclass('public.maintenance_records') is not null then
    if exists (
      select 1
      from information_schema.role_table_grants g
      where g.table_schema = 'public'
        and g.table_name = 'maintenance_records'
        and g.grantee = 'authenticated'
        and g.privilege_type in ('DELETE', 'INSERT')
    ) then
      raise exception 'ACL DRIFT: maintenance_records must be UPDATE-only for authenticated'
        using errcode = '42501';
    end if;
  end if;
end
$live_maintenance_boundary$;

select 'p3_maintenance_update_only=pass';

-- P4. RLS must be enabled on every public base table. A table without RLS is
--     readable/writable by any role holding a grant, whatever the policies say.
do $live_rls_enabled$
declare
  v_unprotected text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_unprotected
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if v_unprotected is not null then
    raise exception 'RLS DRIFT: public base tables without row level security: %', v_unprotected
      using errcode = '42501';
  end if;
end
$live_rls_enabled$;

select 'p4_rls_enabled_on_all_public_tables=pass';

-- P5. SECURITY DEFINER functions must pin search_path. An unpinned definer
--     function is a privilege-escalation primitive.
do $live_definer_search_path$
declare
  v_unpinned text;
begin
  select string_agg(p.proname || '(' || pg_get_function_arguments(p.oid) || ')', ', ' order by p.proname)
    into v_unpinned
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and (p.proconfig is null or not exists (
      select 1 from unnest(p.proconfig) cfg where cfg like 'search_path=%'
    ));

  if v_unpinned is not null then
    raise exception 'DEFINER DRIFT: SECURITY DEFINER functions without search_path: %', v_unpinned
      using errcode = '42501';
  end if;
end
$live_definer_search_path$;

select 'p5_definer_search_path_pinned=pass';

-- P6. Internal never-exposed helpers must not be executable by browser roles.
select 'p6_internal_rpc_execute_grantees=' || coalesce(string_agg(distinct grantee, ', ' order by grantee), 'none')
from information_schema.routine_privileges
where routine_schema = 'public'
  and privilege_type = 'EXECUTE'
  and lower(grantee) in ('authenticated', 'anon')
  and routine_name in (
    'custom_access_token_hook',
    'provision_company_chart_of_accounts',
    'ensure_company_account',
    'gl_ml_insert_schedule_rows'
  );

ROLLBACK;
SQL

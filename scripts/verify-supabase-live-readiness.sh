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
  values
    ('users'),
    ('sessions'),
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

ROLLBACK;
SQL

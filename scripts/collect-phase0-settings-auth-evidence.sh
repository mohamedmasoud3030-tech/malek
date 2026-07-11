#!/usr/bin/env bash
set -euo pipefail

# Read-only Phase 0 evidence collector for Settings + Auth.
# Requires SUPABASE_DB_URL and psql in an operator environment.
# This script intentionally runs only SELECT statements.

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required for live Phase 0 evidence collection." >&2
  exit 2
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL is required for live Phase 0 evidence collection." >&2
  exit 2
fi

psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
\pset pager off
\echo '== Phase 0 table columns =='
select table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('company_settings', 'cost_centers', 'payment_terms_templates', 'users', 'profiles')
order by table_name, ordinal_position;

\echo '== Phase 0 RLS policies =='
select schemaname, table_name, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and table_name in ('company_settings', 'cost_centers', 'payment_terms_templates', 'users', 'profiles')
order by table_name, policyname;

\echo '== Phase 0 function definitions =='
select p.proname,
       pg_get_function_arguments(p.oid) as args,
       pg_get_function_result(p.oid) as result_type,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('custom_access_token_hook', 'is_app_user', 'is_admin_or_manager', 'update_updated_at', 'touch_updated_at')
order by p.proname, args;

\echo '== Phase 0 migration ledger presence =='
select version, name
from supabase_migrations.schema_migrations
where name in (
  'add_cost_centers',
  'add_vat_support',
  'add_payment_terms',
  'fix_company_settings_missing_columns_and_invoice_tax_default',
  'fix_company_settings_notification_columns'
)
   or version in (
    '20260628000100',
    '20260628000200',
    '20260628000300',
    '20260628000500',
    '20260628000600'
   )
order by version, name;
SQL

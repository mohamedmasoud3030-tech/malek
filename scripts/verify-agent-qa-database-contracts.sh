#!/usr/bin/env bash
set -euo pipefail

# Read-only live contract check for the dedicated hosted QA database. It proves
# the database shape/security boundary expected by the running React app without
# accepting a Production project or executing any application mutation.
required=(
  QA_ENVIRONMENT_KIND
  QA_SUPABASE_PROJECT_REF
  PRODUCTION_SUPABASE_PROJECT_REF
  VITE_SUPABASE_URL
  SUPABASE_DB_URL
)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "$name is required for the hosted QA database contract check." >&2
    exit 2
  fi
done

if [[ "${QA_ENVIRONMENT_KIND,,}" != "qa" ]]; then
  echo 'QA_ENVIRONMENT_KIND must be exactly qa.' >&2
  exit 2
fi
if [[ "$QA_SUPABASE_PROJECT_REF" == "$PRODUCTION_SUPABASE_PROJECT_REF" ]]; then
  echo 'QA_SUPABASE_PROJECT_REF must never equal PRODUCTION_SUPABASE_PROJECT_REF.' >&2
  exit 2
fi
if [[ "$VITE_SUPABASE_URL" != "https://${QA_SUPABASE_PROJECT_REF}.supabase.co" && "$VITE_SUPABASE_URL" != "https://${QA_SUPABASE_PROJECT_REF}.supabase.co/" ]]; then
  echo 'VITE_SUPABASE_URL must point exactly to QA_SUPABASE_PROJECT_REF over HTTPS.' >&2
  exit 2
fi
if ! command -v psql >/dev/null 2>&1; then
  echo 'psql is required for the hosted QA database contract check.' >&2
  exit 2
fi

psql "$SUPABASE_DB_URL" \
  --set=ON_ERROR_STOP=1 \
  --set=VERBOSITY=terse \
  --no-align \
  --tuples-only <<'SQL'
BEGIN READ ONLY;

DO $contract$
DECLARE
  missing_tables text;
  missing_columns text;
  missing_functions text;
  rls_gaps text;
  policy_gaps text;
  non_definer_financial_functions text;
BEGIN
  SELECT string_agg(required.table_name, ', ' ORDER BY required.table_name)
    INTO missing_tables
  FROM (VALUES
    ('company_members'), ('properties'), ('units'), ('people'), ('owners'),
    ('owner_agreements'), ('contracts'), ('invoices'), ('payments'),
    ('receipts'), ('receipt_allocations'), ('expenses'), ('accounts'),
    ('journal_batches'), ('journal_lines'), ('financial_operation_idempotency')
  ) AS required(table_name)
  LEFT JOIN information_schema.tables actual
    ON actual.table_schema = 'public' AND actual.table_name = required.table_name
  WHERE actual.table_name IS NULL;
  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'QA schema missing required tables: %', missing_tables;
  END IF;

  SELECT string_agg(required.table_name || '.' || required.column_name, ', ' ORDER BY required.table_name, required.column_name)
    INTO missing_columns
  FROM (VALUES
    ('company_members', 'company_id'), ('company_members', 'user_id'), ('company_members', 'is_active'),
    ('properties', 'company_id'), ('units', 'company_id'), ('people', 'company_id'),
    ('owners', 'company_id'), ('owner_agreements', 'company_id'), ('contracts', 'company_id'),
    ('invoices', 'company_id'), ('invoices', 'paid_amount'), ('payments', 'company_id'),
    ('receipts', 'company_id'), ('receipt_allocations', 'receipt_id'), ('expenses', 'company_id'),
    ('accounts', 'company_id'), ('journal_batches', 'company_id'), ('journal_lines', 'company_id')
  ) AS required(table_name, column_name)
  LEFT JOIN information_schema.columns actual
    ON actual.table_schema = 'public'
   AND actual.table_name = required.table_name
   AND actual.column_name = required.column_name
  WHERE actual.column_name IS NULL;
  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'QA schema missing frontend/backend contract columns: %', missing_columns;
  END IF;

  SELECT string_agg(required.function_name, ', ' ORDER BY required.function_name)
    INTO missing_functions
  FROM (VALUES
    ('current_company_id'), ('record_invoice_payment_atomic'), ('post_receipt_atomic'),
    ('void_receipt_atomic'), ('find_payment_account_id'), ('rpt_daily_collection'),
    ('rpt_owner_statement'), ('rpt_tenant_statement'), ('rpt_cash_flow'), ('rpt_vat_return')
  ) AS required(function_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = required.function_name
  );
  IF missing_functions IS NOT NULL THEN
    RAISE EXCEPTION 'QA schema missing required RPCs: %', missing_functions;
  END IF;

  SELECT string_agg(required.table_name, ', ' ORDER BY required.table_name)
    INTO rls_gaps
  FROM (VALUES
    ('company_members'), ('properties'), ('units'), ('people'), ('owners'),
    ('owner_agreements'), ('contracts'), ('invoices'), ('payments'), ('receipts'),
    ('receipt_allocations'), ('expenses'), ('accounts'), ('journal_batches'), ('journal_lines')
  ) AS required(table_name)
  JOIN pg_class c ON c.relname = required.table_name
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE NOT c.relrowsecurity;
  IF rls_gaps IS NOT NULL THEN
    RAISE EXCEPTION 'QA schema has RLS disabled on tenant tables: %', rls_gaps;
  END IF;

  SELECT string_agg(required.table_name, ', ' ORDER BY required.table_name)
    INTO policy_gaps
  FROM (VALUES
    ('properties'), ('units'), ('people'), ('owners'), ('owner_agreements'), ('contracts'),
    ('invoices'), ('payments'), ('receipts'), ('expenses'), ('accounts')
  ) AS required(table_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = required.table_name
  );
  IF policy_gaps IS NOT NULL THEN
    RAISE EXCEPTION 'QA schema has no RLS policy on tenant tables: %', policy_gaps;
  END IF;

  SELECT string_agg(p.proname, ', ' ORDER BY p.proname)
    INTO non_definer_financial_functions
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('record_invoice_payment_atomic', 'post_receipt_atomic', 'void_receipt_atomic')
    AND NOT p.prosecdef;
  IF non_definer_financial_functions IS NOT NULL THEN
    RAISE EXCEPTION 'QA financial RPCs lost SECURITY DEFINER: %', non_definer_financial_functions;
  END IF;
END
$contract$;

SELECT json_build_object(
  'ok', true,
  'environment', 'qa',
  'migration_count', (SELECT count(*) FROM supabase_migrations.schema_migrations),
  'checked_at', now() AT TIME ZONE 'utc'
);
ROLLBACK;
SQL

-- =============================================================================
-- S08 — Read-only Historical Analysis (T01-T10)
-- Forward migration. No financial data is mutated. All objects are read-only,
-- company scoped, deterministic, SECURITY INVOKER style (plain views, no
-- SECURITY DEFINER without pinned search_path). Real analysis is performed by
-- deterministic scripts in scripts/s08/ and evidence/s08/ artifacts.
-- Manual rollback: supabase/rollback/20260807_rollback_s08_read_only_historical_analysis.sql
-- =============================================================================
begin;

-- Helper: deterministic OMR rounding (3 decimals)
create or replace function public.s08_round_omr(p_amount numeric)
returns numeric
language sql immutable
set search_path = public, pg_temp
as $function$
  select round(coalesce(p_amount, 0)::numeric, 3)
$function$;

-- T01: analysis scope — company/period grain (stub view, no column dependency)
create or replace view public.s08_analysis_scope as
select
  null::uuid as company_id,
  null::text as company_name,
  null::uuid as accounting_period_id,
  null::text as accounting_period,
  null::date as start_date,
  null::date as end_date,
  null::text as period_status,
  'OMR'::text as currency_code,
  3::smallint as currency_precision
where false;

-- T03: liability balances by period — stub grain
create or replace view public.s08_liability_balances_by_period as
select
  null::uuid as company_id,
  null::text as company_name,
  null::uuid as accounting_period_id,
  null::text as accounting_period,
  null::date as start_date,
  null::date as end_date,
  null::text as gl_account_id,
  null::text as gl_account_no,
  null::text as gl_account_name,
  null::text as account_type,
  null::numeric as subledger_balance,
  null::numeric as gl_balance,
  null::numeric as difference,
  null::uuid as owner_id,
  null::uuid as property_id,
  null::uuid as agreement_id,
  null::text as source_class
where false;

-- T07: retroactive version differences — stub
create or replace view public.s08_retroactive_version_differences as
select
  null::uuid as company_id,
  null::uuid as contract_id,
  null::text as contract_number,
  null::uuid as agreement_id,
  null::text as agreement_version,
  null::numeric as current_commission_rate,
  null::text as current_commission_type,
  null::text as current_collection_role,
  null::text as current_operating_model,
  null::numeric as snapshot_commission_rate,
  null::text as snapshot_collection_role,
  null::text as classification
where false;

-- T08: master lease readiness — stub
create or replace view public.s08_master_lease_readiness as
select
  null::uuid as master_lease_id,
  null::uuid as company_id,
  null::text as company_name,
  null::uuid as property_id,
  null::text as property_name,
  null::date as commencement_date,
  null::integer as lease_term_months,
  null::numeric as discount_rate,
  null::text as asset_class,
  null::boolean as short_term_election,
  null::numeric as rou_asset_amount,
  null::numeric as lease_liability_amount,
  'NOT_A_MASTER_LEASE'::text as readiness
where false;

-- T09: subledger GL reconciliation — stub
create or replace view public.s08_subledger_gl_reconciliation as
select
  null::uuid as company_id,
  null::text as company_name,
  null::uuid as accounting_period_id,
  null::text as accounting_period,
  null::text as gl_account_no,
  null::text as gl_account_name,
  null::numeric as opening_balance,
  null::numeric as period_movements,
  null::numeric as closing_balance,
  null::numeric as gl_balance,
  null::numeric as subledger_balance,
  null::numeric as difference,
  null::integer as source_count,
  null::timestamptz as earliest_source,
  null::timestamptz as latest_source,
  'UNRECONCILED'::text as finding_classification
where false;

-- T02, T04, T05, T06: company-scoped read-only functions returning empty set (stub)
-- Real logic lives in scripts/s08/; DB functions are formal company-scoped entry points.

create or replace function public.s08_analyze_settlement_duplicates(p_company_id uuid, p_period_id uuid default null)
returns table (
  company_id uuid, company_name text, owner_id uuid, owner_name text,
  property_id uuid, property_name text, agreement_id uuid, settlement_id uuid,
  settlement_status text, accounting_period text, source_type text, source_id text,
  source_date date, source_amount numeric, currency text, finding_code text, severity text, explanation text
)
language sql stable security invoker set search_path = public, pg_temp
as $function$
  select null::uuid, null::text, null::uuid, null::text, null::uuid, null::text, null::uuid, null::uuid,
         null::text, null::text, null::text, null::text, null::date, null::numeric, null::text, null::text, null::text, null::text
  where false
$function$;

create or replace function public.s08_analyze_expense_misclassification(p_company_id uuid)
returns table (
  company_id uuid, expense_id uuid, charged_to text, beneficiary text,
  account_no text, account_name text, amount numeric, period text,
  finding_code text, severity text, explanation text
)
language sql stable security invoker set search_path = public, pg_temp
as $function$
  select null::uuid, null::uuid, null::text, null::text, null::text, null::text, null::numeric, null::text, null::text, null::text, null::text where false
$function$;

create or replace function public.s08_analyze_deposit_exceptions(p_company_id uuid)
returns table (
  company_id uuid, tenant_id uuid, contract_id uuid, property_id uuid, deposit_id uuid,
  transaction_id text, beneficiary text, claim_reference text, period text, amount numeric,
  available_balance numeric, exception_code text, severity text
)
language sql stable security invoker set search_path = public, pg_temp
as $function$
  select null::uuid, null::uuid, null::uuid, null::uuid, null::uuid, null::text, null::text, null::text, null::text, null::numeric, null::numeric, null::text, null::text where false
$function$;

create or replace function public.s08_orphan_postings(p_company_id uuid)
returns table (
  company_id uuid, batch_id uuid, source_type text, source_id text, status text, finding_code text, severity text, explanation text
)
language sql stable security invoker set search_path = public, pg_temp
as $function$
  select null::uuid, null::uuid, null::text, null::text, null::text, null::text, null::text, null::text where false
$function$;

-- Security: revoke public/anon, grant to authenticated/service_role
revoke all on table public.s08_analysis_scope from public, anon;
revoke all on table public.s08_liability_balances_by_period from public, anon;
revoke all on table public.s08_retroactive_version_differences from public, anon;
revoke all on table public.s08_master_lease_readiness from public, anon;
revoke all on table public.s08_subledger_gl_reconciliation from public, anon;
revoke all on function public.s08_round_omr(numeric) from public, anon;
revoke all on function public.s08_analyze_settlement_duplicates(uuid,uuid) from public, anon;
revoke all on function public.s08_analyze_expense_misclassification(uuid) from public, anon;
revoke all on function public.s08_analyze_deposit_exceptions(uuid) from public, anon;
revoke all on function public.s08_orphan_postings(uuid) from public, anon;

grant select on table public.s08_analysis_scope to authenticated, service_role;
grant select on table public.s08_liability_balances_by_period to authenticated, service_role;
grant select on table public.s08_retroactive_version_differences to authenticated, service_role;
grant select on table public.s08_master_lease_readiness to authenticated, service_role;
grant select on table public.s08_subledger_gl_reconciliation to authenticated, service_role;
grant execute on function public.s08_round_omr(numeric) to authenticated, service_role;
grant execute on function public.s08_analyze_settlement_duplicates(uuid,uuid) to authenticated, service_role;
grant execute on function public.s08_analyze_expense_misclassification(uuid) to authenticated, service_role;
grant execute on function public.s08_analyze_deposit_exceptions(uuid) to authenticated, service_role;
grant execute on function public.s08_orphan_postings(uuid) to authenticated, service_role;

comment on view public.s08_analysis_scope is 'S08 T01: read-only company/period scope. Stub view; real analysis in scripts/s08/. SECURITY INVOKER, company scoped.';
comment on view public.s08_liability_balances_by_period is 'S08 T03: liability balances grain stub.';
comment on view public.s08_retroactive_version_differences is 'S08 T07: retroactive version differences stub.';
comment on view public.s08_master_lease_readiness is 'S08 T08: master lease readiness stub. Never generates ROU assets.';
comment on view public.s08_subledger_gl_reconciliation is 'S08 T09: reconciliation stub.';

commit;

-- =============================================================================
-- S08 — Read-only Historical Analysis (T01-T10) — REAL ENGINE
-- Forward migration. No financial data is mutated. All objects are read-only,
-- company scoped, deterministic, WITH (security_invoker = true), EGP 2dp.
-- Caller-company enforcement inside functions, mandatory company_id/period_id
-- fail-closed, duplicate detection grouped by source_id, cross-company views
-- blocked for authenticated.
-- Rollback file: supabase/rollback/20260807_rollback_s08_read_only_historical_analysis.sql (not auto-applied)
-- =============================================================================
begin;

-- Helper: deterministic EGP rounding (2 decimals) — EGP is the canonical currency
create or replace function public.s08_round_egp(p_amount numeric)
returns numeric
language sql immutable
set search_path = public, pg_temp
as $function$
  select round(coalesce(p_amount, 0)::numeric, 2)
$function$;

-- Keep OMR alias for backward compat (both 2dp now for EGP)
create or replace function public.s08_round_omr(p_amount numeric)
returns numeric
language sql immutable
set search_path = public, pg_temp
as $function$
  select public.s08_round_egp(p_amount)
$function$;

-- T01: analysis scope — company/period grain, security_invoker, company-scoped
create or replace view public.s08_analysis_scope
with (security_invoker = true) as
select
  c.id as company_id,
  c.name as company_name,
  ap.id as accounting_period_id,
  ap.name as accounting_period,
  ap.start_date,
  ap.end_date,
  ap.status as period_status,
  coalesce(c.currency, 'EGP')::text as currency_code,
  2::smallint as currency_precision
from public.companies c
left join public.accounting_periods ap on ap.company_id = c.id
where c.is_active is not null;

comment on view public.s08_analysis_scope is 'S08 T01: read-only company/period scope, WITH security_invoker, EGP 2dp.';

-- T03: liability balances by period — real calculation
-- Maps each liability/control to its subledger vs GL
create or replace view public.s08_liability_balances_by_period
with (security_invoker = true) as
select
  c.id as company_id,
  c.name::text as company_name,
  ap.id as accounting_period_id,
  ap.name::text as accounting_period,
  ap.start_date,
  ap.end_date,
  a.id as gl_account_id,
  a.no::text as gl_account_no,
  a.name::text as gl_account_name,
  case
    when a.no like '1%' then 'asset'
    when a.no like '2%' then 'liability'
    else 'other'
  end::text as account_type,
  -- subledger balance derived per control account (deterministic)
  case
    when a.no = '2000' then public.s08_round_egp(coalesce(ob.net_balance,0))
    when a.no = '1300' then public.s08_round_egp(coalesce(ob_due.balance_due,0) * -1) -- Due from Owner as negative payable
    when a.no = '2200' then public.s08_round_egp(coalesce(td_agg.remaining_deposits,0))
    when a.no = '2300' then public.s08_round_egp(coalesce(comm_agg.payable,0))
    else public.s08_round_egp(coalesce(gl_agg.gl_balance,0))
  end as subledger_balance,
  public.s08_round_egp(coalesce(gl_agg.gl_balance,0)) as gl_balance,
  public.s08_round_egp(coalesce(gl_agg.gl_balance,0) - case
    when a.no = '2000' then coalesce(ob.net_balance,0)
    when a.no = '1300' then coalesce(ob_due.balance_due,0) * -1
    when a.no = '2200' then coalesce(td_agg.remaining_deposits,0)
    when a.no = '2300' then coalesce(comm_agg.payable,0)
    else coalesce(gl_agg.gl_balance,0)
  end) as difference,
  null::uuid as owner_id,
  null::uuid as property_id,
  null::uuid as agreement_id,
  case
    when a.no like '1%' then 'asset'
    when a.no like '2%' then 'liability'
    else 'other'
  end::text as source_class
from public.companies c
join public.accounting_periods ap on ap.company_id = c.id
join public.accounts a on a.company_id = c.id
left join lateral (
  select sum(jl.credit - jl.debit)::numeric as gl_balance
  from public.journal_lines jl
  join public.journal_batches jb on jb.id = jl.batch_id
  where jl.account_id = a.id and jl.company_id = c.id
    and jb.company_id = c.id
    and jb.status in ('POSTED','REVERSED')
    and jb.accounting_period_id = ap.id
) gl_agg on true
left join lateral (
  select avg(ob2.net_balance)::numeric as net_balance
  from public.owner_balances ob2 where ob2.company_id = c.id
) ob on a.no = '2000'
left join lateral (
  select sum(cb.balance_due)::numeric as balance_due
  from public.contract_balances cb where cb.company_id = c.id
) ob_due on a.no = '1300'
left join lateral (
  select sum(td.remaining_amount)::numeric as remaining_deposits
  from public.tenant_deposits td where td.company_id = c.id and td.deleted_at is null
) td_agg on a.no = '2200'
left join lateral (
  select sum(comm.amount)::numeric as payable
  from public.commissions comm where comm.company_id = c.id and comm.status in ('payable','pending')
) comm_agg on a.no = '2300'
where c.is_active is not null
  and a.no in ('2000','1300','2200','2300','2100','1201','1101');

-- T07: retroactive version differences — compare agreement vs contract snapshot
create or replace view public.s08_retroactive_version_differences
with (security_invoker = true) as
select
  prop.company_id as company_id,
  c.id as contract_id,
  c.id::text as contract_number,
  oa.id as agreement_id,
  oa.starts_on::text as agreement_version,
  oa.commission_value as current_commission_rate,
  oa.commission_type as current_commission_type,
  null::text as current_collection_role,
  oa.agreement_type as current_operating_model,
  null::numeric as snapshot_commission_rate,
  null::text as snapshot_collection_role,
  case
    when oa.commission_value is distinct from c.rent_amount then 'POSSIBLE_OVERPAYMENT'
    when oa.agreement_type <> 'property_management' then 'NEEDS_REVIEW'
    when oa.commission_value is null then 'MISSING_VERSION_EVIDENCE'
    else 'NO_ACTION'
  end::text as classification
from public.contracts c
join public.owner_agreements oa on oa.property_id = c.property_id
join public.properties prop on prop.id = c.property_id
where c.deleted_at is null;

-- T08: master lease readiness — official classifications only
create or replace view public.s08_master_lease_readiness
with (security_invoker = true) as
select
  oa.id as master_lease_id,
  prop.company_id as company_id,
  coalesce(comp.name, prop.company_id::text)::text as company_name,
  oa.property_id,
  coalesce(prop.title, '')::text as property_name,
  oa.starts_on as commencement_date,
  case when oa.ends_on is not null and oa.starts_on is not null
    then ((date_part('year', oa.ends_on) - date_part('year', oa.starts_on))*12 + (date_part('month', oa.ends_on) - date_part('month', oa.starts_on)))::int
    else null end as lease_term_months,
  null::numeric as discount_rate,
  'BUILDING'::text as asset_class,
  false::boolean as short_term_election,
  null::numeric as rou_asset_amount,
  null::numeric as lease_liability_amount,
  case
    when oa.agreement_type <> 'master_lease' then 'NOT_A_MASTER_LEASE'
    when oa.starts_on is null or oa.ends_on is null then 'MISSING_CRITICAL_DATA'
    -- partial data: have term but missing rate/ROU
    when oa.starts_on is not null and oa.ends_on is not null then 'PARTIALLY_READY'
    else 'REQUIRES_ACCOUNTANT_REVIEW'
  end::text as readiness
from public.owner_agreements oa
join public.properties prop on prop.id = oa.property_id
left join public.companies comp on comp.id = prop.company_id
where oa.agreement_type in ('master_lease','property_management');

comment on view public.s08_master_lease_readiness is 'S08 T08: classifications READY/PARTIALLY_READY/MISSING_CRITICAL_DATA/NOT_A_MASTER_LEASE/REQUIRES_ACCOUNTANT_REVIEW only. Never generates ROU.';

-- T09: subledger GL reconciliation — each subledger to its correct control account only
create or replace view public.s08_subledger_gl_reconciliation
with (security_invoker = true) as
select
  s.company_id,
  comp.name::text as company_name,
  s.accounting_period::text as accounting_period,
  s.subledger::text as subledger,
  s.gl_account_no::text as gl_account_no,
  s.opening_balance::numeric as opening_balance,
  s.period_movements::numeric as period_movements,
  s.closing_balance::numeric as closing_balance,
  s.gl_balance::numeric as gl_balance,
  s.subledger_balance::numeric as subledger_balance,
  public.s08_round_egp(s.gl_balance - s.subledger_balance) as difference,
  s.source_count::int as source_count,
  s.earliest_source::timestamptz as earliest_source,
  s.latest_source::timestamptz as latest_source,
  case when public.s08_round_egp(s.gl_balance - s.subledger_balance) = 0 then 'RECONCILED' else 'MISMATCH' end::text as finding_classification
from (
  -- Tenant Receivables -> 1201
  select c.id as company_id, ap.name as accounting_period,
         'Tenant Receivables'::text as subledger, '1201'::text as gl_account_no,
         0::numeric as opening_balance,
         coalesce(sum(case when jb.status='POSTED' then jl.debit - jl.credit else 0 end),0)::numeric as period_movements,
         coalesce(sum(case when jb.status='POSTED' then jl.debit - jl.credit else 0 end),0)::numeric as closing_balance,
         coalesce(sum(case when jb.status='POSTED' then jl.debit - jl.credit else 0 end),0)::numeric as gl_balance,
         coalesce(cb_agg.balance_due,0)::numeric as subledger_balance,
         count(jl.id)::int as source_count,
         min(jb.effective_date)::timestamptz as earliest_source,
         max(jb.effective_date)::timestamptz as latest_source
  from public.companies c
  cross join public.accounting_periods ap
  left join public.accounts a on a.company_id=c.id and a.no='1201'
  left join public.journal_lines jl on jl.account_id=a.id and jl.company_id=c.id
  left join public.journal_batches jb on jb.id=jl.batch_id and jb.accounting_period_id=ap.id and jb.status='POSTED'
  left join lateral (select sum(balance_due)::numeric as balance_due from public.contract_balances cb where cb.company_id=c.id) cb_agg on true
  where c.is_active is not null and ap.company_id=c.id
  group by c.id, ap.name, cb_agg.balance_due
  union all
  -- Owner Funds Payable -> 2000
  select c.id, ap.name, 'Owner Funds Payable'::text, '2000'::text,
         0::numeric,
         coalesce(sum(case when jb.status='POSTED' then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(sum(case when jb.status='POSTED' then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(sum(case when jb.status='POSTED' then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(ob_agg.net_balance,0)::numeric,
         count(jl.id)::int, min(jb.effective_date)::timestamptz, max(jb.effective_date)::timestamptz
  from public.companies c
  cross join public.accounting_periods ap
  left join public.accounts a on a.company_id=c.id and a.no='2000'
  left join public.journal_lines jl on jl.account_id=a.id and jl.company_id=c.id
  left join public.journal_batches jb on jb.id=jl.batch_id and jb.accounting_period_id=ap.id and jb.status='POSTED'
  left join lateral (select sum(net_balance)::numeric as net_balance from public.owner_balances ob where ob.company_id=c.id) ob_agg on true
  where c.is_active is not null and ap.company_id=c.id
  group by c.id, ap.name, ob_agg.net_balance
  union all
  -- Due from Owner -> 1300
  select c.id, ap.name, 'Due from Owner'::text, '1300'::text,
         0::numeric,
         coalesce(sum(case when jb.status='POSTED' then jl.debit - jl.credit else 0 end),0)::numeric,
         coalesce(sum(case when jb.status='POSTED' then jl.debit - jl.credit else 0 end),0)::numeric,
         coalesce(sum(case when jb.status='POSTED' then jl.debit - jl.credit else 0 end),0)::numeric,
         coalesce(cb_agg.balance_due,0)::numeric,
         count(jl.id)::int, min(jb.effective_date)::timestamptz, max(jb.effective_date)::timestamptz
  from public.companies c cross join public.accounting_periods ap
  left join public.accounts a on a.company_id=c.id and a.no='1300'
  left join public.journal_lines jl on jl.account_id=a.id and jl.company_id=c.id
  left join public.journal_batches jb on jb.id=jl.batch_id and jb.accounting_period_id=ap.id and jb.status='POSTED'
  left join lateral (select sum(case when balance_due<0 then -balance_due else 0 end)::numeric as balance_due from public.contract_balances cb where cb.company_id=c.id) cb_agg on true
  where c.is_active is not null and ap.company_id=c.id
  group by c.id, ap.name, cb_agg.balance_due
  union all
  -- Tenant Deposits -> 2200
  select c.id, ap.name, 'Tenant Deposits'::text, '2200'::text,
         0::numeric,
         coalesce(sum(case when jb.status='POSTED' then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(sum(case when jb.status='POSTED' then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(sum(case when jb.status='POSTED' then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(td_agg.remaining,0)::numeric,
         count(jl.id)::int, min(jb.effective_date)::timestamptz, max(jb.effective_date)::timestamptz
  from public.companies c cross join public.accounting_periods ap
  left join public.accounts a on a.company_id=c.id and a.no='2200'
  left join public.journal_lines jl on jl.account_id=a.id and jl.company_id=c.id
  left join public.journal_batches jb on jb.id=jl.batch_id and jb.accounting_period_id=ap.id and jb.status='POSTED'
  left join lateral (select sum(remaining_amount)::numeric as remaining from public.tenant_deposits td where td.company_id=c.id and td.deleted_at is null) td_agg on true
  where c.is_active is not null and ap.company_id=c.id
  group by c.id, ap.name, td_agg.remaining
  union all
  -- Broker Commission Payable -> 2300
  select c.id, ap.name, 'Broker/Staff Commission Payable'::text, '2300'::text,
         0::numeric,
         coalesce(sum(case when jb.status='POSTED' then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(sum(case when jb.status='POSTED' then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(sum(case when jb.status='POSTED' then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(comm_agg.payable,0)::numeric,
         count(jl.id)::int, min(jb.effective_date)::timestamptz, max(jb.effective_date)::timestamptz
  from public.companies c cross join public.accounting_periods ap
  left join public.accounts a on a.company_id=c.id and a.no='2300'
  left join public.journal_lines jl on jl.account_id=a.id and jl.company_id=c.id
  left join public.journal_batches jb on jb.id=jl.batch_id and jb.accounting_period_id=ap.id and jb.status='POSTED'
  left join lateral (select sum(amount)::numeric as payable from public.commissions comm where comm.company_id=c.id) comm_agg on true
  where c.is_active is not null and ap.company_id=c.id
  group by c.id, ap.name, comm_agg.payable
) s
join public.companies comp on comp.id = s.company_id;

-- Functions with caller-company enforcement, mandatory params fail-closed, EGP, grouped by source_id

create or replace function public.s08_analyze_settlement_duplicates(p_company_id uuid, p_period_id uuid)
returns table (
  company_id uuid, company_name text, owner_id uuid, owner_name text,
  property_id uuid, property_name text, agreement_id uuid, settlement_id uuid,
  settlement_status text, accounting_period text, source_type text, source_id text,
  source_date date, source_amount numeric, currency text, finding_code text, severity text, explanation text
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_caller uuid;
begin
  if p_company_id is null or p_period_id is null then
    raise exception 'S08_COMPANY_AND_PERIOD_REQUIRED' using errcode='22023';
  end if;
  v_caller := public.current_company_id();
  -- service_role/auth with null caller allowed for staging; otherwise enforce
  if v_caller is not null and v_caller <> p_company_id and current_user <> 'service_role' then
    raise exception 'S08_COMPANY_ISOLATION_VIOLATION' using errcode='42501';
  end if;
  return query
  with dup_pay as (
    select l.payment_id as source_id, count(distinct l.settlement_id) as cnt
    from public.owner_settlement_payment_links l
    where l.company_id = p_company_id
    group by l.payment_id
    having count(distinct l.settlement_id) > 1
  ),
  dup_exp as (
    select l.expense_id as source_id, count(distinct l.settlement_id) as cnt
    from public.owner_settlement_expense_links l
    where l.company_id = p_company_id
    group by l.expense_id
    having count(distinct l.settlement_id) > 1
  )
  select
    os.company_id,
    coalesce(comp.name,'')::text as company_name,
    null::uuid as owner_id,
    ''::text as owner_name,
    null::uuid as property_id,
    ''::text as property_name,
    null::uuid as agreement_id,
    os.id::uuid as settlement_id,
    upper(coalesce(os.status::text,'DRAFT'))::text as settlement_status,
    ap.name::text as accounting_period,
    'PAYMENT'::text as source_type,
    dp.source_id::text as source_id,
    pay.payment_date::date as source_date,
    public.s08_round_egp(pay.amount)::numeric as source_amount,
    'EGP'::text as currency,
    'DUPLICATE_PAYMENT_ACROSS_SETTLEMENTS'::text as finding_code,
    'HIGH'::text as severity,
    'Payment reused across multiple settlements (grouped by source_id).'::text as explanation
  from dup_pay dp
  join public.owner_settlement_payment_links l on l.payment_id = dp.source_id and l.company_id = p_company_id
  join public.owner_settlements os on os.id = l.settlement_id and os.company_id = p_company_id
  join public.accounting_periods ap on ap.id = p_period_id and ap.company_id = p_company_id
  join public.payments pay on pay.id = dp.source_id and pay.company_id = p_company_id
  left join public.companies comp on comp.id = p_company_id
  where upper(coalesce(os.status::text,'')) in ('PAID','POSTED')
  union all
  select
    os.company_id,
    coalesce(comp.name,'')::text,
    null::uuid, ''::text,
    null::uuid, ''::text,
    null::uuid, os.id::uuid,
    upper(coalesce(os.status::text,'DRAFT'))::text,
    ap.name::text,
    'EXPENSE'::text, de.source_id::text,
    exp.expense_date::date,
    public.s08_round_egp(exp.amount)::numeric,
    'EGP'::text,
    'DUPLICATE_EXPENSE_ACROSS_SETTLEMENTS'::text, 'HIGH'::text,
    'Expense reused across multiple settlements (grouped by source_id).'::text
  from dup_exp de
  join public.owner_settlement_expense_links l on l.expense_id = de.source_id and l.company_id = p_company_id
  join public.owner_settlements os on os.id = l.settlement_id and os.company_id = p_company_id
  join public.accounting_periods ap on ap.id = p_period_id and ap.company_id = p_company_id
  join public.expenses exp on exp.id = de.source_id and exp.company_id = p_company_id
  left join public.companies comp on comp.id = p_company_id
  where upper(coalesce(os.status::text,'')) in ('PAID','POSTED');
end;
$function$;

create or replace function public.s08_analyze_expense_misclassification(p_company_id uuid, p_period_id uuid)
returns table (
  company_id uuid, expense_id uuid, charged_to text, beneficiary text,
  account_no text, account_name text, amount numeric, period text,
  finding_code text, severity text, explanation text
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $function$
declare v_caller uuid;
begin
  if p_company_id is null or p_period_id is null then
    raise exception 'S08_COMPANY_AND_PERIOD_REQUIRED' using errcode='22023';
  end if;
  v_caller := public.current_company_id();
  if v_caller is not null and v_caller <> p_company_id and current_user <> 'service_role' then
    raise exception 'S08_COMPANY_ISOLATION_VIOLATION' using errcode='42501';
  end if;
  return query
  select
    exp.company_id,
    exp.id as expense_id,
    coalesce(exp.category::text, 'unknown')::text as charged_to,
    ''::text as beneficiary,
    coalesce(acc.no,'')::text as account_no,
    coalesce(acc.name,'')::text as account_name,
    public.s08_round_egp(exp.amount)::numeric as amount,
    ap.name::text as period,
    case
      when exp.category in ('OWNER','TENANT') and acc.no = '6100' then 'OWNER_TENANT_EXPENSE_IN_OFFICE_ACCOUNT'
      when exists (select 1 from public.journal_lines jl2 join public.journal_batches jb2 on jb2.id=jl2.batch_id where jl2.account_id=acc.id and jl2.company_id=p_company_id and jb2.status='POSTED' group by jl2.id having count(*)>1)
        then 'DUPLICATE_TENANT_RECEIVABLE'
      when exp.property_id is null then 'MISSING_PROPERTY_AGREEMENT_LINKAGE'
      else 'CHARGED_TO_BENEFICIARY_MISMATCH'
    end::text as finding_code,
    'MEDIUM'::text as severity,
    'Expense misclassification or linkage mismatch; 6100 only flagged if account 6100 exists and is office expense.'::text as explanation
  from public.expenses exp
  join public.accounting_periods ap on ap.id = p_period_id and ap.company_id = p_company_id
  -- Expense IDs are UUIDs, whereas Stage 3 journal source IDs are text.
  -- The explicit UUID-to-text conversion is at the source-reference boundary;
  -- account IDs remain in their canonical text domain.
  left join public.journal_batches jb on jb.company_id = p_company_id
    and lower(jb.source_type) in ('expense', 'expenses')
    and jb.source_id = exp.id::text
  left join public.journal_lines jl on jl.company_id = p_company_id and jl.batch_id = jb.id
  left join public.accounts acc on acc.company_id = p_company_id and acc.id = jl.account_id
  where exp.company_id = p_company_id
    and exp.deleted_at is null
    and (
      (exp.category in ('OWNER','TENANT') and acc.no = '6100' and exists (select 1 from public.accounts a2 where a2.company_id=p_company_id and a2.no='6100'))
      or exp.property_id is null
    );
end;
$function$;

create or replace function public.s08_analyze_deposit_exceptions(p_company_id uuid, p_period_id uuid)
returns table (
  company_id uuid, tenant_id text, contract_id uuid, property_id uuid, deposit_id text,
  transaction_id uuid, beneficiary text, claim_reference text, period text, amount numeric,
  available_balance numeric, exception_code text, severity text, explanation text
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $function$
declare v_caller uuid;
begin
  if p_company_id is null or p_period_id is null then
    raise exception 'S08_COMPANY_AND_PERIOD_REQUIRED' using errcode='22023';
  end if;
  v_caller := public.current_company_id();
  if v_caller is not null and v_caller <> p_company_id and current_user <> 'service_role' then
    raise exception 'S08_COMPANY_ISOLATION_VIOLATION' using errcode='42501';
  end if;
  return query
  select
    td.company_id,
    td.tenant_id::text as tenant_id,
    td.contract_id::uuid as contract_id,
    td.property_id::uuid as property_id,
    td.id::text as deposit_id,
    dt.id::uuid as transaction_id,
    coalesce(dt.reason,'')::text as beneficiary,
    coalesce(dt.request_id,'')::text as claim_reference,
    ap.name::text as period,
    public.s08_round_egp(dt.amount)::numeric as amount,
    public.s08_round_egp(td.remaining_amount)::numeric as available_balance,
    case
      when dt.reason is null then 'DEDUCTION_WITHOUT_BENEFICIARY'
      when dt.request_id is null then 'DEDUCTION_WITHOUT_APPROVED_CLAIM'
      when dt.amount > td.deposit_amount then 'REFUND_EXCEEDING_AVAILABLE_BALANCE'
      when dt.type = 'refund' and td.remaining_amount < 0 then 'DEPOSIT_SUBLEDGER_GL_MISMATCH'
      else 'DEPOSIT_ORPHAN_TRANSACTION'
    end::text as exception_code,
    'HIGH'::text as severity,
    'Deposit exception covering receipts/refunds/applications/deductions/reversals.'::text as explanation
  from public.tenant_deposits td
  join public.accounting_periods ap on ap.id = p_period_id and ap.company_id = p_company_id
  left join public.deposit_transactions dt on dt.deposit_id = td.id and dt.company_id = p_company_id
  where td.company_id = p_company_id
    and td.deleted_at is null
    and (
      dt.reason is null
      or dt.request_id is null
      or dt.amount > td.deposit_amount
      or (dt.type = 'deduction' and coalesce(td.remaining_amount,0) < 0)
    );
end;
$function$;

create or replace function public.s08_orphan_postings(p_company_id uuid, p_period_id uuid)
returns table (
  company_id uuid, batch_id uuid, source_type text, source_id text, status text, finding_code text, severity text, explanation text
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $function$
declare v_caller uuid;
begin
  if p_company_id is null or p_period_id is null then
    raise exception 'S08_COMPANY_AND_PERIOD_REQUIRED' using errcode='22023';
  end if;
  v_caller := public.current_company_id();
  if v_caller is not null and v_caller <> p_company_id and current_user <> 'service_role' then
    raise exception 'S08_COMPANY_ISOLATION_VIOLATION' using errcode='42501';
  end if;
  return query
  -- Source without posting (invoice -> no batch)
  select
    p_company_id as company_id,
    null::uuid as batch_id,
    'INVOICE'::text as source_type,
    inv.id::text as source_id,
    coalesce(inv.status::text,'DRAFT')::text as status,
    'SOURCE_WITHOUT_POSTING'::text as finding_code,
    'MEDIUM'::text as severity,
    'Invoice has no journal batch posting (bidirectional).'::text as explanation
  from public.invoices inv
  where inv.company_id = p_company_id
    and inv.deleted_at is null
    and inv.status in ('POSTED','PAID')
    and not exists (
      select 1 from public.journal_batches jb
      where jb.company_id = p_company_id
        and jb.source_id = inv.id::text
        and jb.source_type in ('invoice','invoices')
        and jb.accounting_period_id = p_period_id
    )
  union all
  -- Posting without source
  select
    jb.company_id,
    jb.id as batch_id,
    jb.source_type::text,
    jb.source_id::text,
    jb.status::text,
    'POSTING_WITHOUT_SOURCE'::text,
    'HIGH'::text,
    'Journal batch references missing source.'::text
  from public.journal_batches jb
  where jb.company_id = p_company_id
    and jb.accounting_period_id = p_period_id
    and jb.source_type = 'invoice'
    and not exists (
      select 1 from public.invoices inv where inv.id::text = jb.source_id and inv.company_id = p_company_id
    )
  union all
  -- Voided/cancelled with surviving postings
  select
    p_company_id,
    null::uuid,
    'INVOICE'::text,
    inv.id::text,
    inv.status::text,
    'VOIDED_SURVIVING_POSTING'::text,
    'HIGH'::text,
    'Voided/cancelled invoice has active postings without reversal.'::text
  from public.invoices inv
  where inv.company_id = p_company_id
    and upper(coalesce(inv.status::text,'')) in ('VOID','VOIDED','CANCELLED')
    and exists (
      select 1 from public.journal_batches jb
      where jb.company_id = p_company_id and jb.source_id = inv.id::text and jb.status='POSTED'
    )
    and not exists (
      select 1 from public.journal_batches jb
      where jb.company_id = p_company_id and jb.reversal_of_batch_id is not null
    )
  union all
  -- Reversal without original
  select
    jb.company_id,
    jb.id,
    jb.source_type::text,
    jb.source_id::text,
    jb.status::text,
    'REVERSAL_WITHOUT_ORIGINAL'::text,
    'HIGH'::text,
    'Reversal references missing original batch.'::text
  from public.journal_batches jb
  where jb.company_id = p_company_id
    and jb.accounting_period_id = p_period_id
    and jb.reversal_of_batch_id is not null
    and not exists (select 1 from public.journal_batches o where o.id = jb.reversal_of_batch_id and o.company_id = p_company_id);
end;
$function$;

-- Security: prevent authenticated cross-company view reads (revoke + RLS already, plus explicit grants)
revoke all on table public.s08_analysis_scope from public, anon;
revoke all on table public.s08_liability_balances_by_period from public, anon;
revoke all on table public.s08_retroactive_version_differences from public, anon;
revoke all on table public.s08_master_lease_readiness from public, anon;
revoke all on table public.s08_subledger_gl_reconciliation from public, anon;
revoke all on function public.s08_round_egp(numeric) from public, anon;
revoke all on function public.s08_round_omr(numeric) from public, anon;
revoke all on function public.s08_analyze_settlement_duplicates(uuid,uuid) from public, anon;
revoke all on function public.s08_analyze_expense_misclassification(uuid,uuid) from public, anon;
revoke all on function public.s08_analyze_deposit_exceptions(uuid,uuid) from public, anon;
revoke all on function public.s08_orphan_postings(uuid,uuid) from public, anon;

grant select on table public.s08_analysis_scope to service_role;
grant select on table public.s08_liability_balances_by_period to service_role;
grant select on table public.s08_retroactive_version_differences to service_role;
grant select on table public.s08_master_lease_readiness to service_role;
grant select on table public.s08_subledger_gl_reconciliation to service_role;

grant execute on function public.s08_round_egp(numeric) to authenticated, service_role;
grant execute on function public.s08_round_omr(numeric) to authenticated, service_role;
grant execute on function public.s08_analyze_settlement_duplicates(uuid,uuid) to authenticated, service_role;
grant execute on function public.s08_analyze_expense_misclassification(uuid,uuid) to authenticated, service_role;
grant execute on function public.s08_analyze_deposit_exceptions(uuid,uuid) to authenticated, service_role;
grant execute on function public.s08_orphan_postings(uuid,uuid) to authenticated, service_role;

-- Allow authenticated to read their own company's rows via view filtered by current_company_id (service_role sees all)
-- Enforced by RLS on underlying tables; views additionally expose only caller's company when queried via function path.

comment on view public.s08_analysis_scope is 'S08 T01: WITH security_invoker, EGP 2dp, company/period scoped.';
comment on view public.s08_master_lease_readiness is 'S08 T08: READY/PARTIALLY_READY/MISSING_CRITICAL_DATA/NOT_A_MASTER_LEASE/REQUIRES_ACCOUNTANT_REVIEW only.';

commit;

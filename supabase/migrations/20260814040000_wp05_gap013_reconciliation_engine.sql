-- =============================================================================
-- WP-05 GAP-013 — Deterministic subledger ↔ GL reconciliation (OMR 3dp, 0.001)
-- Replaces stale S08 EGP 2dp / 0.01 tolerance behavior.
-- Additive migration: supersedes old S08 views/functions without editing history.
-- =============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. OMR canonical rounding helpers (3 decimals) — supersede EGP 2dp
-- ---------------------------------------------------------------------------
create or replace function public.wp05_round_omr(p_amount numeric)
returns numeric
language sql immutable
set search_path = public, pg_temp
as $$
  select round(coalesce(p_amount, 0)::numeric, 3)
$$;

comment on function public.wp05_round_omr(numeric) is 'WP-05 GAP-013: OMR canonical rounding to 3 decimals, exact decimal.';

-- Supersede stale S08 helpers: both now round to 3dp OMR
create or replace function public.s08_round_egp(p_amount numeric)
returns numeric
language sql immutable
set search_path = public, pg_temp
as $$
  select public.wp05_round_omr(p_amount)
$$;

create or replace function public.s08_round_omr(p_amount numeric)
returns numeric
language sql immutable
set search_path = public, pg_temp
as $$
  select public.wp05_round_omr(p_amount)
$$;

-- ---------------------------------------------------------------------------
-- 2. GL balance helper — authoritative GL, POSTED+REVERSED, OMR 3dp
--    Returns net balance in normal direction (asset: debit-credit, liability: credit-debit)
-- ---------------------------------------------------------------------------
create or replace function public.wp05_gl_balance(
  p_company_id uuid,
  p_account_no text,
  p_as_of date default current_date
)
returns numeric
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_bal numeric;
begin
  if p_company_id is null or p_account_no is null then
    raise exception 'WP05_GL_BALANCE_REQUIRED: company_id and account_no required' using errcode='22023';
  end if;

  select public.wp05_round_omr(coalesce(sum(
    case
      when a.no in ('1201','1300','1111','1120','1600') then (jl.debit - jl.credit)
      when a.no in ('2000','2100','2200','2300','2500') then (jl.credit - jl.debit)
      when a.account_type = 'asset' or a.account_type = 'expense' then (jl.debit - jl.credit)
      else (jl.credit - jl.debit)
    end
  ),0))
  into v_bal
  from public.journal_lines jl
  join public.journal_batches jb on jb.id = jl.batch_id
  join public.accounts a on a.id = jl.account_id and a.company_id = jl.company_id
  where jl.company_id = p_company_id
    and a.no = p_account_no
    and a.company_id = p_company_id
    and jb.company_id = p_company_id
    and jb.status in ('POSTED','REVERSED')
    and jb.effective_date <= p_as_of
    and jl.deleted_at is null;

  return coalesce(v_bal, 0);
end;
$$;

create or replace function public.wp05_gl_line_count(
  p_company_id uuid,
  p_account_no text,
  p_as_of date default current_date
)
returns bigint
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_cnt bigint;
begin
  if p_company_id is null or p_account_no is null then
    raise exception 'WP05_GL_COUNT_REQUIRED: company_id and account_no required' using errcode='22023';
  end if;

  select count(*)::bigint into v_cnt
  from public.journal_lines jl
  join public.journal_batches jb on jb.id = jl.batch_id
  join public.accounts a on a.id = jl.account_id and a.company_id = jl.company_id
  where jl.company_id = p_company_id
    and a.no = p_account_no
    and a.company_id = p_company_id
    and jb.company_id = p_company_id
    and jb.status in ('POSTED','REVERSED')
    and jb.effective_date <= p_as_of
    and jl.deleted_at is null;

  return coalesce(v_cnt,0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Subledger balance helpers — structural IDs, company scoped, OMR 3dp
--    Each returns (balance numeric(18,3), count bigint)
-- ---------------------------------------------------------------------------

-- Tenant receivables → 1201 (asset, OFFICE_IS_CREDITOR path, outstanding invoices)
create or replace function public.wp05_subledger_tenant_receivables(p_company_id uuid, p_as_of date default current_date)
returns table (balance numeric, cnt bigint)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_bal numeric;
  v_cnt bigint;
begin
  if p_company_id is null then
    raise exception 'WP05_SUBLEDGER_TENANT_REQUIRED: company_id required' using errcode='22023';
  end if;

  select
    public.wp05_round_omr(coalesce(sum(
      greatest((i.amount + coalesce(i.tax_amount,0) - coalesce(i.paid_amount,0)), 0)
    ),0)),
    count(*) filter (where greatest((i.amount + coalesce(i.tax_amount,0) - coalesce(i.paid_amount,0)),0) > 0.0005)::bigint
  into v_bal, v_cnt
  from public.invoices i
  where i.company_id = p_company_id
    and i.deleted_at is null
    and coalesce(upper(i.status::text),'') not in ('VOID','VOIDED','CANCELLED')
    and i.issue_date <= p_as_of
    and (i.amount + coalesce(i.tax_amount,0) - coalesce(i.paid_amount,0)) > 0.0005;

  return query select coalesce(v_bal,0)::numeric, coalesce(v_cnt,0)::bigint;
end;
$$;

-- Owner payables / liabilities → 2000 (liability)
-- Using owner_balances net_balance >0 as authoritative owner payable subledger
create or replace function public.wp05_subledger_owner_payables(p_company_id uuid, p_as_of date default current_date)
returns table (balance numeric, cnt bigint)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_bal numeric;
  v_cnt bigint;
begin
  if p_company_id is null then
    raise exception 'WP05_SUBLEDGER_OWNER_REQUIRED: company_id required' using errcode='22023';
  end if;

  -- owner_balances table is company-scoped and maintained via triggers
  if to_regclass('public.owner_balances') is not null then
    select
      public.wp05_round_omr(coalesce(sum(case when ob.net_balance > 0 then ob.net_balance else 0 end),0)),
      count(*) filter (where ob.net_balance > 0.0005)::bigint
    into v_bal, v_cnt
    from public.owner_balances ob
    where ob.company_id = p_company_id;
  else
    v_bal := 0; v_cnt := 0;
  end if;

  -- Fallback: if owner_balances empty, use owner_settlements PENDING/APPROVED as alternative source
  if coalesce(v_cnt,0) = 0 then
    if to_regclass('public.owner_settlements') is not null then
      select
        public.wp05_round_omr(coalesce(sum(s.net_payable),0)),
        count(*)::bigint
      into v_bal, v_cnt
      from public.owner_settlements s
      where s.company_id = p_company_id
        and upper(coalesce(s.status::text,'')) in ('PENDING','APPROVED','PENDING_APPROVAL')
        and public._safe_date(s.date) <= p_as_of
        and coalesce(s.net_payable,0) > 0.0005;
    end if;
  end if;

  return query select coalesce(v_bal,0)::numeric, coalesce(v_cnt,0)::bigint;
end;
$$;

-- Security deposits → 2200 (liability)
create or replace function public.wp05_subledger_security_deposits(p_company_id uuid, p_as_of date default current_date)
returns table (balance numeric, cnt bigint)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_bal numeric;
  v_cnt bigint;
begin
  if p_company_id is null then
    raise exception 'WP05_SUBLEDGER_DEPOSIT_REQUIRED: company_id required' using errcode='22023';
  end if;

  if to_regclass('public.tenant_deposits') is null then
    return query select 0::numeric, 0::bigint;
  end if;

  select
    public.wp05_round_omr(coalesce(sum(td.remaining_amount),0)),
    count(*)::bigint
  into v_bal, v_cnt
  from public.tenant_deposits td
  where td.company_id = p_company_id
    and td.deleted_at is null
    and td.remaining_amount > 0.0005;

  return query select coalesce(v_bal,0)::numeric, coalesce(v_cnt,0)::bigint;
end;
$$;

-- Due-from-owner balances → 1300 (asset)
-- Using expenses charged_to OWNER as subledger
create or replace function public.wp05_subledger_due_from_owner(p_company_id uuid, p_as_of date default current_date)
returns table (balance numeric, cnt bigint)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_bal numeric;
  v_cnt bigint;
begin
  if p_company_id is null then
    raise exception 'WP05_SUBLEDGER_DUE_FROM_OWNER_REQUIRED: company_id required' using errcode='22023';
  end if;

  if to_regclass('public.expenses') is null then
    return query select 0::numeric, 0::bigint;
  end if;

  select
    public.wp05_round_omr(coalesce(sum(e.amount),0)),
    count(*)::bigint
  into v_bal, v_cnt
  from public.expenses e
  where e.company_id = p_company_id
    and e.deleted_at is null
    and e.expense_date <= p_as_of
    and (
      upper(coalesce(e.charged_to::text,'')) = 'OWNER'
      or upper(coalesce(e.category::text,'')) = 'OWNER'
    )
    and e.amount > 0.0005;

  return query select coalesce(v_bal,0)::numeric, coalesce(v_cnt,0)::bigint;
end;
$$;

-- Commission balances → 2300 (liability)
create or replace function public.wp05_subledger_commission(p_company_id uuid, p_as_of date default current_date)
returns table (balance numeric, cnt bigint)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_bal numeric;
  v_cnt bigint;
begin
  if p_company_id is null then
    raise exception 'WP05_SUBLEDGER_COMMISSION_REQUIRED: company_id required' using errcode='22023';
  end if;

  if to_regclass('public.commissions') is null then
    return query select 0::numeric, 0::bigint;
  end if;

  select
    public.wp05_round_omr(coalesce(sum(c.amount),0)),
    count(*)::bigint
  into v_bal, v_cnt
  from public.commissions c
  where c.company_id = p_company_id
    and upper(coalesce(c.status::text,'')) in ('PENDING','APPROVED','PAYABLE')
    and coalesce(c.amount,0) > 0.0005;

  return query select coalesce(v_bal,0)::numeric, coalesce(v_cnt,0)::bigint;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Unified deterministic reconciliation function
--    Covers: TENANT_RECEIVABLES, OWNER_PAYABLES, SECURITY_DEPOSITS, DUE_FROM_OWNER, COMMISSION
--    Returns explicit fields required by GAP-013
-- ---------------------------------------------------------------------------
create or replace function public.wp05_reconcile_all(
  p_company_id uuid,
  p_as_of date default current_date
)
returns table (
  reconciliation_class text,
  account_no text,
  account_name text,
  subledger_balance numeric,
  gl_balance numeric,
  variance numeric,
  abs_variance numeric,
  currency text,
  reconciliation_status text,
  subledger_count bigint,
  gl_count bigint
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_tenant_bal numeric; v_tenant_cnt bigint; v_tenant_gl numeric; v_tenant_gl_cnt bigint;
  v_owner_bal numeric; v_owner_cnt bigint; v_owner_gl numeric; v_owner_gl_cnt bigint;
  v_dep_bal numeric; v_dep_cnt bigint; v_dep_gl numeric; v_dep_gl_cnt bigint;
  v_due_bal numeric; v_due_cnt bigint; v_due_gl numeric; v_due_gl_cnt bigint;
  v_comm_bal numeric; v_comm_cnt bigint; v_comm_gl numeric; v_comm_gl_cnt bigint;
begin
  if p_company_id is null then
    raise exception 'WP05_RECONCILE_COMPANY_REQUIRED: company_id required' using errcode='22023';
  end if;

  -- Company isolation: if caller has a company claim different from p_company_id, fail closed
  if public.current_company_id() is not null and public.current_company_id() <> p_company_id then
    if current_user not in ('service_role','postgres','supabase_admin') then
      raise exception 'WP05_COMPANY_ISOLATION_VIOLATION: caller company does not match requested company' using errcode='42501';
    end if;
  end if;

  select balance, cnt into v_tenant_bal, v_tenant_cnt from public.wp05_subledger_tenant_receivables(p_company_id, p_as_of);
  v_tenant_gl := public.wp05_gl_balance(p_company_id, '1201', p_as_of);
  v_tenant_gl_cnt := public.wp05_gl_line_count(p_company_id, '1201', p_as_of);

  select balance, cnt into v_owner_bal, v_owner_cnt from public.wp05_subledger_owner_payables(p_company_id, p_as_of);
  v_owner_gl := public.wp05_gl_balance(p_company_id, '2000', p_as_of);
  v_owner_gl_cnt := public.wp05_gl_line_count(p_company_id, '2000', p_as_of);

  select balance, cnt into v_dep_bal, v_dep_cnt from public.wp05_subledger_security_deposits(p_company_id, p_as_of);
  v_dep_gl := public.wp05_gl_balance(p_company_id, '2200', p_as_of);
  v_dep_gl_cnt := public.wp05_gl_line_count(p_company_id, '2200', p_as_of);

  select balance, cnt into v_due_bal, v_due_cnt from public.wp05_subledger_due_from_owner(p_company_id, p_as_of);
  v_due_gl := public.wp05_gl_balance(p_company_id, '1300', p_as_of);
  v_due_gl_cnt := public.wp05_gl_line_count(p_company_id, '1300', p_as_of);

  select balance, cnt into v_comm_bal, v_comm_cnt from public.wp05_subledger_commission(p_company_id, p_as_of);
  v_comm_gl := public.wp05_gl_balance(p_company_id, '2300', p_as_of);
  v_comm_gl_cnt := public.wp05_gl_line_count(p_company_id, '2300', p_as_of);

  return query
  select 'TENANT_RECEIVABLES'::text, '1201'::text, 'Tenant Receivable'::text,
         public.wp05_round_omr(v_tenant_bal), public.wp05_round_omr(v_tenant_gl),
         public.wp05_round_omr(v_tenant_bal - v_tenant_gl),
         public.wp05_round_omr(abs(v_tenant_bal - v_tenant_gl)),
         'OMR'::text,
         case when abs(v_tenant_bal - v_tenant_gl) <= 0.001 then 'PASS' else 'FAIL' end::text,
         v_tenant_cnt, v_tenant_gl_cnt
  union all
  select 'OWNER_PAYABLES'::text, '2000'::text, 'Owner Funds Payable'::text,
         public.wp05_round_omr(v_owner_bal), public.wp05_round_omr(v_owner_gl),
         public.wp05_round_omr(v_owner_bal - v_owner_gl),
         public.wp05_round_omr(abs(v_owner_bal - v_owner_gl)),
         'OMR'::text,
         case when abs(v_owner_bal - v_owner_gl) <= 0.001 then 'PASS' else 'FAIL' end::text,
         v_owner_cnt, v_owner_gl_cnt
  union all
  select 'SECURITY_DEPOSITS'::text, '2200'::text, 'Tenant Deposits Payable'::text,
         public.wp05_round_omr(v_dep_bal), public.wp05_round_omr(v_dep_gl),
         public.wp05_round_omr(v_dep_bal - v_dep_gl),
         public.wp05_round_omr(abs(v_dep_bal - v_dep_gl)),
         'OMR'::text,
         case when abs(v_dep_bal - v_dep_gl) <= 0.001 then 'PASS' else 'FAIL' end::text,
         v_dep_cnt, v_dep_gl_cnt
  union all
  select 'DUE_FROM_OWNER'::text, '1300'::text, 'Due from Owners'::text,
         public.wp05_round_omr(v_due_bal), public.wp05_round_omr(v_due_gl),
         public.wp05_round_omr(v_due_bal - v_due_gl),
         public.wp05_round_omr(abs(v_due_bal - v_due_gl)),
         'OMR'::text,
         case when abs(v_due_bal - v_due_gl) <= 0.001 then 'PASS' else 'FAIL' end::text,
         v_due_cnt, v_due_gl_cnt
  union all
  select 'COMMISSION'::text, '2300'::text, 'Broker Commissions Payable'::text,
         public.wp05_round_omr(v_comm_bal), public.wp05_round_omr(v_comm_gl),
         public.wp05_round_omr(v_comm_bal - v_comm_gl),
         public.wp05_round_omr(abs(v_comm_bal - v_comm_gl)),
         'OMR'::text,
         case when abs(v_comm_bal - v_comm_gl) <= 0.001 then 'PASS' else 'FAIL' end::text,
         v_comm_cnt, v_comm_gl_cnt;
end;
$$;

comment on function public.wp05_reconcile_all(uuid,date) is 'GAP-013 deterministic subledger ↔ GL reconciliation OMR 3dp tolerance 0.001 with explicit counts.';

-- Gate function that fails closed on any variance >0.001
create or replace function public.wp05_assert_reconciliation(
  p_company_id uuid,
  p_as_of date default current_date
)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_failures int;
  v_details jsonb;
begin
  if p_company_id is null then
    raise exception 'WP05_ASSERT_COMPANY_REQUIRED: company_id required' using errcode='22023';
  end if;

  if public.current_company_id() is not null and public.current_company_id() <> p_company_id
     and current_user not in ('service_role','postgres','supabase_admin') then
    raise exception 'WP05_COMPANY_ISOLATION_VIOLATION' using errcode='42501';
  end if;

  select count(*)::int into v_failures
  from public.wp05_reconcile_all(p_company_id, p_as_of)
  where reconciliation_status = 'FAIL';

  select jsonb_agg(to_jsonb(r)) into v_details
  from public.wp05_reconcile_all(p_company_id, p_as_of) r;

  if v_failures > 0 then
    raise exception 'WP05_RECONCILIATION_FAILED: % class(es) exceed tolerance 0.001 OMR: %', v_failures, v_details::text using errcode='P0001';
  end if;

  return jsonb_build_object('success', true, 'company_id', p_company_id, 'as_of', p_as_of, 'details', v_details);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Supersede stale S08 reconciliation views with OMR 3dp / 0.001 tolerance
-- ---------------------------------------------------------------------------

-- Drop dependent views first (order matters)
drop view if exists public.s08_subledger_gl_reconciliation cascade;
drop view if exists public.s08_liability_balances_by_period cascade;

-- Recreate s08_liability_balances_by_period with OMR 3dp
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
  case when a.no like '1%' then 'asset' when a.no like '2%' then 'liability' else 'other' end::text as account_type,
  case
    when a.no = '2000' then public.wp05_round_omr(coalesce(ob.net_balance,0))
    when a.no = '1300' then public.wp05_round_omr(coalesce(ob_due.balance_due,0) * -1)
    when a.no = '2200' then public.wp05_round_omr(coalesce(td_agg.remaining_deposits,0))
    when a.no = '2300' then public.wp05_round_omr(coalesce(comm_agg.payable,0))
    else public.wp05_round_omr(coalesce(gl_agg.gl_balance,0))
  end as subledger_balance,
  public.wp05_round_omr(coalesce(gl_agg.gl_balance,0)) as gl_balance,
  public.wp05_round_omr(coalesce(gl_agg.gl_balance,0) - case
    when a.no = '2000' then coalesce(ob.net_balance,0)
    when a.no = '1300' then coalesce(ob_due.balance_due,0) * -1
    when a.no = '2200' then coalesce(td_agg.remaining_deposits,0)
    when a.no = '2300' then coalesce(comm_agg.payable,0)
    else coalesce(gl_agg.gl_balance,0)
  end) as difference,
  null::uuid as owner_id,
  null::uuid as property_id,
  null::uuid as agreement_id,
  case when a.no like '1%' then 'asset' when a.no like '2%' then 'liability' else 'other' end::text as source_class
from public.companies c
join public.accounting_periods ap on ap.company_id = c.id
join public.accounts a on a.company_id = c.id
left join lateral (
  select sum(
    case when a.no in ('1201','1300','1111','1120','1600') then jl.debit - jl.credit else jl.credit - jl.debit end
  )::numeric as gl_balance
  from public.journal_lines jl
  join public.journal_batches jb on jb.id = jl.batch_id
  where jl.account_id = a.id and jl.company_id = c.id
    and jb.company_id = c.id
    and jb.status in ('POSTED','REVERSED')
    and jb.effective_date <= ap.end_date
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
  from public.commissions comm where comm.company_id = c.id and upper(comm.status::text) in ('PENDING','APPROVED','PAYABLE')
) comm_agg on a.no = '2300'
where c.is_active is not null
  and a.no in ('2000','1300','2200','2300','2100','1201','1101');

comment on view public.s08_liability_balances_by_period is 'S08 T03: liability balances by period, OMR 3dp, superseded from EGP 2dp (WP-05 GAP-013).';

-- Recreate s08_subledger_gl_reconciliation with OMR 3dp and 0.001 tolerance
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
  public.wp05_round_omr(s.gl_balance - s.subledger_balance) as difference,
  s.source_count::int as source_count,
  s.earliest_source::timestamptz as earliest_source,
  s.latest_source::timestamptz as latest_source,
  case when abs(public.wp05_round_omr(s.gl_balance - s.subledger_balance)) <= 0.001 then 'RECONCILED' else 'MISMATCH' end::text as finding_classification
from (
  select c.id as company_id, ap.name as accounting_period,
         'Tenant Receivables'::text as subledger, '1201'::text as gl_account_no,
         0::numeric as opening_balance,
         coalesce(sum(case when jb.status in ('POSTED','REVERSED') then jl.debit - jl.credit else 0 end),0)::numeric as period_movements,
         coalesce(sum(case when jb.status in ('POSTED','REVERSED') then jl.debit - jl.credit else 0 end),0)::numeric as closing_balance,
         coalesce(sum(case when jb.status in ('POSTED','REVERSED') then jl.debit - jl.credit else 0 end),0)::numeric as gl_balance,
         coalesce(cb_agg.balance_due,0)::numeric as subledger_balance,
         count(jl.id)::int as source_count,
         min(jb.effective_date)::timestamptz as earliest_source,
         max(jb.effective_date)::timestamptz as latest_source
  from public.companies c
  cross join public.accounting_periods ap
  left join public.accounts a on a.company_id=c.id and a.no='1201'
  left join public.journal_lines jl on jl.account_id=a.id and jl.company_id=c.id
  left join public.journal_batches jb on jb.id=jl.batch_id and jb.accounting_period_id=ap.id and jb.status in ('POSTED','REVERSED')
  left join lateral (select sum(balance_due)::numeric as balance_due from public.contract_balances cb where cb.company_id=c.id) cb_agg on true
  where c.is_active is not null and ap.company_id=c.id
  group by c.id, ap.name, cb_agg.balance_due
  union all
  select c.id, ap.name, 'Owner Funds Payable'::text, '2000'::text,
         0::numeric,
         coalesce(sum(case when jb.status in ('POSTED','REVERSED') then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(sum(case when jb.status in ('POSTED','REVERSED') then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(sum(case when jb.status in ('POSTED','REVERSED') then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(ob_agg.net_balance,0)::numeric,
         count(jl.id)::int, min(jb.effective_date)::timestamptz, max(jb.effective_date)::timestamptz
  from public.companies c
  cross join public.accounting_periods ap
  left join public.accounts a on a.company_id=c.id and a.no='2000'
  left join public.journal_lines jl on jl.account_id=a.id and jl.company_id=c.id
  left join public.journal_batches jb on jb.id=jl.batch_id and jb.accounting_period_id=ap.id and jb.status in ('POSTED','REVERSED')
  left join lateral (select sum(net_balance)::numeric as net_balance from public.owner_balances ob where ob.company_id=c.id) ob_agg on true
  where c.is_active is not null and ap.company_id=c.id
  group by c.id, ap.name, ob_agg.net_balance
  union all
  select c.id, ap.name, 'Due from Owner'::text, '1300'::text,
         0::numeric,
         coalesce(sum(case when jb.status in ('POSTED','REVERSED') then jl.debit - jl.credit else 0 end),0)::numeric,
         coalesce(sum(case when jb.status in ('POSTED','REVERSED') then jl.debit - jl.credit else 0 end),0)::numeric,
         coalesce(sum(case when jb.status in ('POSTED','REVERSED') then jl.debit - jl.credit else 0 end),0)::numeric,
         coalesce(cb_agg.balance_due,0)::numeric,
         count(jl.id)::int, min(jb.effective_date)::timestamptz, max(jb.effective_date)::timestamptz
  from public.companies c cross join public.accounting_periods ap
  left join public.accounts a on a.company_id=c.id and a.no='1300'
  left join public.journal_lines jl on jl.account_id=a.id and jl.company_id=c.id
  left join public.journal_batches jb on jb.id=jl.batch_id and jb.accounting_period_id=ap.id and jb.status in ('POSTED','REVERSED')
  left join lateral (select sum(case when balance_due<0 then -balance_due else 0 end)::numeric as balance_due from public.contract_balances cb where cb.company_id=c.id) cb_agg on true
  where c.is_active is not null and ap.company_id=c.id
  group by c.id, ap.name, cb_agg.balance_due
  union all
  select c.id, ap.name, 'Tenant Deposits'::text, '2200'::text,
         0::numeric,
         coalesce(sum(case when jb.status in ('POSTED','REVERSED') then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(sum(case when jb.status in ('POSTED','REVERSED') then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(sum(case when jb.status in ('POSTED','REVERSED') then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(td_agg.remaining,0)::numeric,
         count(jl.id)::int, min(jb.effective_date)::timestamptz, max(jb.effective_date)::timestamptz
  from public.companies c cross join public.accounting_periods ap
  left join public.accounts a on a.company_id=c.id and a.no='2200'
  left join public.journal_lines jl on jl.account_id=a.id and jl.company_id=c.id
  left join public.journal_batches jb on jb.id=jl.batch_id and jb.accounting_period_id=ap.id and jb.status in ('POSTED','REVERSED')
  left join lateral (select sum(remaining_amount)::numeric as remaining from public.tenant_deposits td where td.company_id=c.id and td.deleted_at is null) td_agg on true
  where c.is_active is not null and ap.company_id=c.id
  group by c.id, ap.name, td_agg.remaining
  union all
  select c.id, ap.name, 'Broker/Staff Commission Payable'::text, '2300'::text,
         0::numeric,
         coalesce(sum(case when jb.status in ('POSTED','REVERSED') then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(sum(case when jb.status in ('POSTED','REVERSED') then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(sum(case when jb.status in ('POSTED','REVERSED') then jl.credit - jl.debit else 0 end),0)::numeric,
         coalesce(comm_agg.payable,0)::numeric,
         count(jl.id)::int, min(jb.effective_date)::timestamptz, max(jb.effective_date)::timestamptz
  from public.companies c cross join public.accounting_periods ap
  left join public.accounts a on a.company_id=c.id and a.no='2300'
  left join public.journal_lines jl on jl.account_id=a.id and jl.company_id=c.id
  left join public.journal_batches jb on jb.id=jl.batch_id and jb.accounting_period_id=ap.id and jb.status in ('POSTED','REVERSED')
  left join lateral (select sum(amount)::numeric as payable from public.commissions comm where comm.company_id=c.id and upper(comm.status::text) in ('PENDING','APPROVED','PAYABLE')) comm_agg on true
  where c.is_active is not null and ap.company_id=c.id
  group by c.id, ap.name, comm_agg.payable
) s
join public.companies comp on comp.id = s.company_id;

comment on view public.s08_subledger_gl_reconciliation is 'S08 T09: subledger→GL reconciliation OMR 3dp tolerance 0.001, superseded from EGP 2dp (WP-05 GAP-013).';

-- Re-grant security (same as old migration)
revoke all on table public.s08_liability_balances_by_period from public, anon;
revoke all on table public.s08_subledger_gl_reconciliation from public, anon;
grant select on table public.s08_liability_balances_by_period to service_role;
grant select on table public.s08_subledger_gl_reconciliation to service_role;

-- Grant execute on new WP-05 functions
revoke all on function public.wp05_round_omr(numeric) from public, anon;
grant execute on function public.wp05_round_omr(numeric) to authenticated, service_role;

revoke all on function public.wp05_gl_balance(uuid,text,date) from public, anon;
grant execute on function public.wp05_gl_balance(uuid,text,date) to authenticated, service_role;

revoke all on function public.wp05_gl_line_count(uuid,text,date) from public, anon;
grant execute on function public.wp05_gl_line_count(uuid,text,date) to authenticated, service_role;

revoke all on function public.wp05_subledger_tenant_receivables(uuid,date) from public, anon;
grant execute on function public.wp05_subledger_tenant_receivables(uuid,date) to authenticated, service_role;

revoke all on function public.wp05_subledger_owner_payables(uuid,date) from public, anon;
grant execute on function public.wp05_subledger_owner_payables(uuid,date) to authenticated, service_role;

revoke all on function public.wp05_subledger_security_deposits(uuid,date) from public, anon;
grant execute on function public.wp05_subledger_security_deposits(uuid,date) to authenticated, service_role;

revoke all on function public.wp05_subledger_due_from_owner(uuid,date) from public, anon;
grant execute on function public.wp05_subledger_due_from_owner(uuid,date) to authenticated, service_role;

revoke all on function public.wp05_subledger_commission(uuid,date) from public, anon;
grant execute on function public.wp05_subledger_commission(uuid,date) to authenticated, service_role;

revoke all on function public.wp05_reconcile_all(uuid,date) from public, anon;
grant execute on function public.wp05_reconcile_all(uuid,date) to authenticated, service_role;

revoke all on function public.wp05_assert_reconciliation(uuid,date) from public, anon;
grant execute on function public.wp05_assert_reconciliation(uuid,date) to authenticated, service_role;

commit;

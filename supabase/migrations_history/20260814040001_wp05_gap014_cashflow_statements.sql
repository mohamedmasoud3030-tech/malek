-- =============================================================================
-- WP-05 GAP-014 — Complete financial statements and Cash Flow (GL-backed, OMR 3dp)
-- Replaces operational rpt_* reports with GL authority, adds cash flow classification
-- =============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Cash flow account classification (company-scoped, explicit, not inferred)
-- ---------------------------------------------------------------------------
create table if not exists public.gl_cash_flow_classifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  account_id text not null,
  account_no text not null,
  classification text not null check (classification in ('OPERATING','INVESTING','FINANCING')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  constraint gl_cash_flow_classifications_company_account_key unique (company_id, account_id),
  constraint gl_cash_flow_classifications_company_no_key unique (company_id, account_no)
);

comment on table public.gl_cash_flow_classifications is 'WP-05 GAP-014: explicit GL account → cash flow classification, company-scoped, fail-closed on missing mapping (UNCLASSIFIED).';

create index if not exists gl_cash_flow_classifications_company_idx on public.gl_cash_flow_classifications (company_id);
create index if not exists gl_cash_flow_classifications_account_idx on public.gl_cash_flow_classifications (account_id);

-- RLS
alter table public.gl_cash_flow_classifications enable row level security;
alter table public.gl_cash_flow_classifications alter column company_id set default public.current_company_id();

drop policy if exists p0_tenant_isolation on public.gl_cash_flow_classifications;
create policy p0_tenant_isolation on public.gl_cash_flow_classifications as restrictive
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists gl_cash_flow_class_read on public.gl_cash_flow_classifications;
create policy gl_cash_flow_class_read on public.gl_cash_flow_classifications
  for select to authenticated using (public.is_app_user());

drop policy if exists gl_cash_flow_class_write on public.gl_cash_flow_classifications;
create policy gl_cash_flow_class_write on public.gl_cash_flow_classifications
  for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

revoke all on public.gl_cash_flow_classifications from public, anon;
grant select on public.gl_cash_flow_classifications to authenticated;
grant insert, update on public.gl_cash_flow_classifications to authenticated;
-- service_role can manage
grant all on public.gl_cash_flow_classifications to service_role;

-- Updated_at trigger
drop trigger if exists trg_gl_cash_flow_classifications_updated_at on public.gl_cash_flow_classifications;
create trigger trg_gl_cash_flow_classifications_updated_at
  before update on public.gl_cash_flow_classifications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Helper to provision default classifications per company (explicit, not guessed from text)
--    Defaults are governed, company-scoped, can be overridden by admin.
-- ---------------------------------------------------------------------------
create or replace function public.wp05_provision_default_cashflow_classifications(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_created int := 0;
begin
  if p_company_id is null then
    raise exception 'WP05_CASHFLOW_CLASSIFICATION_COMPANY_REQUIRED' using errcode='22023';
  end if;

  -- Map known canonical accounts to classifications (explicit, not inferred from memo)
  -- Operating: revenue, expenses, receivables, payables related to operations
  -- Investing: ROU asset, etc.
  -- Financing: lease liability, owner funds payable payouts, etc.
  insert into public.gl_cash_flow_classifications (company_id, account_id, account_no, classification)
  select p_company_id, a.id, a.no,
    case
      when a.no in ('1201','1300','2100','2200','2300','4000','4100','4200','4300','6100','6110','6200') then 'OPERATING'
      when a.no in ('1600') then 'INVESTING'
      when a.no in ('2000','2500','6300') then 'FINANCING'
      else 'OPERATING'
    end
  from public.accounts a
  where a.company_id = p_company_id
    and a.no in ('1201','1300','1600','2000','2100','2200','2300','2500','4000','4100','4200','4300','6100','6110','6200','6300')
    and not exists (
      select 1 from public.gl_cash_flow_classifications c
      where c.company_id = p_company_id and c.account_id = a.id
    )
  on conflict (company_id, account_id) do nothing;

  get diagnostics v_created = row_count;

  return jsonb_build_object('company_id', p_company_id, 'created', v_created);
end;
$$;

revoke all on function public.wp05_provision_default_cashflow_classifications(uuid) from public, anon;
grant execute on function public.wp05_provision_default_cashflow_classifications(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. GL-backed Trial Balance (POSTED+REVERSED, OMR 3dp, no operational totals)
-- ---------------------------------------------------------------------------
create or replace function public.wp05_rpt_trial_balance_gl(p_as_of date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_accounts jsonb;
  v_total_debits numeric := 0;
  v_total_credits numeric := 0;
begin
  if p_as_of is null then
    raise exception 'WP05_TB_AS_OF_REQUIRED: p_as_of date required' using errcode='22023';
  end if;

  with balances as (
    select
      a.no as code,
      a.name,
      a.account_type as type,
      a.normal_balance as balance_type,
      public.wp05_round_omr(coalesce(sum(case when a.normal_balance = 'debit' then jl.debit - jl.credit else jl.credit - jl.debit end),0)) as balance,
      public.wp05_round_omr(coalesce(sum(jl.debit),0)) as debits,
      public.wp05_round_omr(coalesce(sum(jl.credit),0)) as credits
    from public.accounts a
    left join (
      public.journal_lines jl
      join public.journal_batches jb
        on jb.id = jl.batch_id
       and jb.company_id = v_company_id
       and jb.status in ('POSTED','REVERSED')
       and jb.effective_date <= p_as_of
    ) on jl.account_id = a.id
      and jl.company_id = v_company_id
      and jl.deleted_at is null
    where a.company_id = v_company_id and a.is_active = true
    group by a.no, a.name, a.account_type, a.normal_balance
    having coalesce(sum(jl.debit),0) <> 0 or coalesce(sum(jl.credit),0) <> 0
  )
  select jsonb_agg(jsonb_build_object('code', code, 'name', name, 'type', type, 'balance_type', balance_type, 'balance', balance) order by code),
         public.wp05_round_omr(coalesce(sum(debits),0)),
         public.wp05_round_omr(coalesce(sum(credits),0))
  into v_accounts, v_total_debits, v_total_credits
  from balances;

  return jsonb_build_object(
    'as_of', p_as_of,
    'accounts', coalesce(v_accounts, '[]'::jsonb),
    'total_debits', v_total_debits,
    'total_credits', v_total_credits,
    'is_balanced', (abs(v_total_debits - v_total_credits) <= 0.001)
  );
end;
$$;

-- Legacy wrapper for compatibility: delegate to GL version
create or replace function public.rpt_trial_balance(p_as_of date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.wp05_rpt_trial_balance_gl(p_as_of);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. GL-backed Balance Sheet (POSTED+REVERSED, OMR 3dp)
-- ---------------------------------------------------------------------------
create or replace function public.wp05_rpt_balance_sheet_gl(p_as_of date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_assets numeric := 0;
  v_liabilities numeric := 0;
  v_equity numeric := 0;
  v_asset_rows jsonb;
  v_liability_rows jsonb;
  v_equity_rows jsonb;
begin
  if p_as_of is null then
    raise exception 'WP05_BS_AS_OF_REQUIRED' using errcode='22023';
  end if;

  with balances as (
    select
      a.no,
      a.name,
      a.account_type,
      public.wp05_round_omr(coalesce(sum(
        case
          when a.account_type = 'asset' then jl.debit - jl.credit
          else jl.credit - jl.debit
        end
      ),0)) as bal
    from public.accounts a
    left join (
      public.journal_lines jl
      join public.journal_batches jb
        on jb.id = jl.batch_id
       and jb.company_id = v_company_id
       and jb.status in ('POSTED','REVERSED')
       and jb.effective_date <= p_as_of
    ) on jl.account_id = a.id
      and jl.company_id = v_company_id
      and jl.deleted_at is null
    where a.company_id = v_company_id and a.is_active = true
    group by a.no, a.name, a.account_type
  )
  select
    public.wp05_round_omr(coalesce(sum(case when account_type = 'asset' then bal else 0 end),0)),
    public.wp05_round_omr(coalesce(sum(case when account_type = 'liability' then bal else 0 end),0)),
    public.wp05_round_omr(coalesce(sum(case when account_type in ('equity','revenue','expense') then bal else 0 end),0)),
    jsonb_agg(jsonb_build_object('code', no, 'name', name, 'amount', bal) order by no)
      filter (where account_type = 'asset' and abs(bal) > 0.0005),
    jsonb_agg(jsonb_build_object('code', no, 'name', name, 'amount', bal) order by no)
      filter (where account_type = 'liability' and abs(bal) > 0.0005),
    jsonb_agg(jsonb_build_object('code', no, 'name', name, 'amount', bal) order by no)
      filter (where account_type in ('equity','revenue','expense') and abs(bal) > 0.0005)
  into v_assets, v_liabilities, v_equity, v_asset_rows, v_liability_rows, v_equity_rows
  from balances;

  return jsonb_build_object(
    'as_of', p_as_of,
    'assets', coalesce(v_asset_rows, '[]'::jsonb),
    'liabilities', coalesce(v_liability_rows, '[]'::jsonb),
    'equity', coalesce(v_equity_rows, '[]'::jsonb),
    'total_assets', v_assets,
    'total_liabilities', v_liabilities,
    'total_equity', v_equity,
    'is_balanced', (abs(v_assets - (v_liabilities + v_equity)) <= 0.001)
  );
end;
$$;

create or replace function public.rpt_balance_sheet(p_as_of date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.wp05_rpt_balance_sheet_gl(p_as_of);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. GL-backed Profit & Loss (POSTED+REVERSED, OMR 3dp, period)
-- ---------------------------------------------------------------------------
create or replace function public.wp05_rpt_profit_loss_gl(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_revenue numeric := 0;
  v_expenses numeric := 0;
  v_net numeric := 0;
  v_rev_rows jsonb;
  v_exp_rows jsonb;
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'WP05_PL_PERIOD_REQUIRED: valid p_from and p_to required' using errcode='22023';
  end if;

  with period_lines as (
    select
      a.no,
      a.name,
      a.account_type,
      public.wp05_round_omr(coalesce(sum(case when a.account_type in ('revenue') then jl.credit - jl.debit when a.account_type in ('expense') then jl.debit - jl.credit else 0 end),0)) as amount
    from public.accounts a
    join public.journal_lines jl on jl.account_id = a.id and jl.company_id = v_company_id and jl.deleted_at is null
    join public.journal_batches jb on jb.id = jl.batch_id and jb.company_id = v_company_id and jb.status in ('POSTED','REVERSED') and jb.effective_date between p_from and p_to
    where a.company_id = v_company_id and a.is_active = true
      and (a.account_type = 'revenue' or a.account_type = 'expense')
    group by a.no, a.name, a.account_type
    having abs(coalesce(sum(case when a.account_type = 'revenue' then jl.credit - jl.debit else jl.debit - jl.credit end),0)) > 0.0005
  )
  select
    public.wp05_round_omr(coalesce(sum(case when account_type = 'revenue' then amount else 0 end),0)),
    public.wp05_round_omr(coalesce(sum(case when account_type = 'expense' then amount else 0 end),0)),
    jsonb_agg(jsonb_build_object('label', name, 'code', no, 'amount', amount) order by no)
      filter (where account_type = 'revenue'),
    jsonb_agg(jsonb_build_object('label', name, 'code', no, 'amount', amount) order by no)
      filter (where account_type = 'expense')
  into v_revenue, v_expenses, v_rev_rows, v_exp_rows
  from period_lines;

  v_net := public.wp05_round_omr(v_revenue - v_expenses);

  return jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'revenue', coalesce(v_rev_rows, '[]'::jsonb),
    'total_revenue', v_revenue,
    'expenses', coalesce(v_exp_rows, '[]'::jsonb),
    'total_expenses', v_expenses,
    'net_income', v_net
  );
end;
$$;

create or replace function public.rpt_income_statement(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.wp05_rpt_profit_loss_gl(p_from, p_to);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. GL-backed General Ledger (POSTED+REVERSED, OMR 3dp, drillthrough)
-- ---------------------------------------------------------------------------
create or replace function public.wp05_rpt_general_ledger_gl(p_from date, p_to date, p_account_no text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_lines jsonb;
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'WP05_GL_PERIOD_REQUIRED' using errcode='22023';
  end if;

  select jsonb_agg(jsonb_build_object(
    'batch_id', jb.id,
    'account_no', a.no,
    'account_name', a.name,
    'effective_date', jb.effective_date,
    'posted_at', jb.posted_at,
    'status', jb.status,
    'source_type', jb.source_type,
    'source_id', jb.source_id,
    'event_id', jb.event_id,
    'debit', public.wp05_round_omr(jl.debit),
    'credit', public.wp05_round_omr(jl.credit),
    'line_description', jl.line_description,
    'ref_source_id', jl.ref_source_id,
    'ref_entity_type', jl.ref_entity_type,
    'ref_entity_id', jl.ref_entity_id
  ) order by jb.effective_date, jb.created_at, jl.created_at)
  into v_lines
  from public.journal_lines jl
  join public.journal_batches jb on jb.id = jl.batch_id and jb.company_id = v_company_id and jb.status in ('POSTED','REVERSED') and jb.effective_date between p_from and p_to
  join public.accounts a on a.id = jl.account_id and a.company_id = v_company_id
  where jl.company_id = v_company_id
    and jl.deleted_at is null
    and (p_account_no is null or a.no = p_account_no);

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'account_no', p_account_no,
    'lines', coalesce(v_lines, '[]'::jsonb)
  );
end;
$$;

create or replace function public.rpt_general_ledger(p_from date, p_to date)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.wp05_rpt_general_ledger_gl(p_from, p_to, null);
$$;

-- ---------------------------------------------------------------------------
-- 7. GL-backed Cash Flow — core logic
--    Distinguishes OPERATING, INVESTING, FINANCING, UNCLASSIFIED
--    Satisfies: Closing Cash = Opening + Operating + Investing + Financing + Unclassified (±0.001)
-- ---------------------------------------------------------------------------

-- Helper: cash accounts list
create or replace function public.wp05_cash_accounts()
returns text[]
language sql immutable
as $$
  select array['1111','1120']::text[];
$$;

-- Core cash flow calculation returning jsonb
create or replace function public.wp05_rpt_cash_flow_gl(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_opening_cash numeric := 0;
  v_closing_cash numeric := 0;
  v_operating numeric := 0;
  v_investing numeric := 0;
  v_financing numeric := 0;
  v_unclassified numeric := 0;
  v_total_change numeric := 0;
  v_variance numeric := 0;
  v_opening_details jsonb;
  v_closing_details jsonb;
  v_period_from date := p_from;
  v_period_to date := p_to;
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'WP05_CASHFLOW_PERIOD_REQUIRED: valid p_from and p_to required' using errcode='22023';
  end if;

  -- Company isolation enforced by require_company_id and RLS, but double-check
  if public.current_company_id() is not null and public.current_company_id() <> v_company_id then
    if current_user not in ('service_role','postgres','supabase_admin') then
      raise exception 'WP05_COMPANY_ISOLATION_VIOLATION' using errcode='42501';
    end if;
  end if;

  -- Opening cash: balance of cash accounts as of day before p_from
  select public.wp05_round_omr(coalesce(sum(
    case when a.normal_balance = 'debit' then jl.debit - jl.credit else jl.credit - jl.debit end
  ),0))
  into v_opening_cash
  from public.journal_lines jl
  join public.journal_batches jb on jb.id = jl.batch_id and jb.company_id = v_company_id and jb.status in ('POSTED','REVERSED') and jb.effective_date < p_from
  join public.accounts a on a.id = jl.account_id and a.company_id = v_company_id
  where jl.company_id = v_company_id and a.no = any(public.wp05_cash_accounts()) and jl.deleted_at is null;

  -- Closing cash: balance as of p_to inclusive
  select public.wp05_round_omr(coalesce(sum(
    case when a.normal_balance = 'debit' then jl.debit - jl.credit else jl.credit - jl.debit end
  ),0))
  into v_closing_cash
  from public.journal_lines jl
  join public.journal_batches jb on jb.id = jl.batch_id and jb.company_id = v_company_id and jb.status in ('POSTED','REVERSED') and jb.effective_date <= p_to
  join public.accounts a on a.id = jl.account_id and a.company_id = v_company_id
  where jl.company_id = v_company_id and a.no = any(public.wp05_cash_accounts()) and jl.deleted_at is null;

  -- Cash movements in period: for each batch with cash lines, attribute to classification via non-cash lines
  -- Contribution = credit - debit for non-cash? Actually cash change = sum_cash(debit-credit). And contribution per non-cash = credit - debit (which equals cash change portion)
  -- For batches without cash lines, ignore
  with batches_with_cash as (
    select distinct jb.id
    from public.journal_batches jb
    join public.journal_lines jl on jl.batch_id = jb.id and jl.company_id = v_company_id
    join public.accounts a on a.id = jl.account_id and a.company_id = v_company_id
    where jb.company_id = v_company_id
      and jb.status in ('POSTED','REVERSED')
      and jb.effective_date between p_from and p_to
      and a.no = any(public.wp05_cash_accounts())
      and jl.deleted_at is null
  ),
  cash_movements as (
    -- For each batch, sum non-cash lines grouped by classification
    select
      jb.id as batch_id,
      coalesce(cfc.classification, 'UNCLASSIFIED') as classification,
      public.wp05_round_omr(sum(jl.credit - jl.debit)) as amount
    from public.journal_batches jb
    join batches_with_cash bwc on bwc.id = jb.id
    join public.journal_lines jl on jl.batch_id = jb.id and jl.company_id = v_company_id and jl.deleted_at is null
    join public.accounts a on a.id = jl.account_id and a.company_id = v_company_id
    left join public.gl_cash_flow_classifications cfc on cfc.company_id = v_company_id and cfc.account_id = a.id and cfc.is_active = true
    where jb.company_id = v_company_id
      and a.no <> all(public.wp05_cash_accounts())
    group by jb.id, coalesce(cfc.classification, 'UNCLASSIFIED')
  )
  select
    public.wp05_round_omr(coalesce(sum(case when classification = 'OPERATING' then amount else 0 end),0)),
    public.wp05_round_omr(coalesce(sum(case when classification = 'INVESTING' then amount else 0 end),0)),
    public.wp05_round_omr(coalesce(sum(case when classification = 'FINANCING' then amount else 0 end),0)),
    public.wp05_round_omr(coalesce(sum(case when classification = 'UNCLASSIFIED' then amount else 0 end),0))
  into v_operating, v_investing, v_financing, v_unclassified
  from cash_movements;

  v_total_change := public.wp05_round_omr(v_operating + v_investing + v_financing + v_unclassified);
  v_variance := public.wp05_round_omr(v_closing_cash - (v_opening_cash + v_total_change));

  -- Fail-closed: if variance >0.001, this is financial exception, but we still return details
  -- For gate, we provide assert function

  return jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'company_id', v_company_id,
    'opening_cash', v_opening_cash,
    'operating', v_operating,
    'investing', v_investing,
    'financing', v_financing,
    'unclassified', v_unclassified,
    'total_change', v_total_change,
    'closing_cash', v_closing_cash,
    'variance', v_variance,
    'is_balanced', (abs(v_variance) <= 0.001),
    'currency', 'OMR',
    'precision', 3
  );
end;
$$;

-- Legacy wrapper: old rpt_cash_flow used payments/expenses, now delegate to GL version
create or replace function public.rpt_cash_flow(p_from_date date, p_to_date date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gl jsonb;
begin
  v_gl := public.wp05_rpt_cash_flow_gl(p_from_date, p_to_date);
  return jsonb_build_object(
    'period', v_gl->'period',
    'operating', jsonb_build_object('receipts', 0, 'expenses', 0, 'net_operating', v_gl->'operating'),
    'investing', jsonb_build_object('amount', v_gl->'investing', 'note', null),
    'financing', jsonb_build_object('amount', v_gl->'financing', 'note', null),
    'unclassified', v_gl->'unclassified',
    'opening_cash', v_gl->'opening_cash',
    'closing_cash', v_gl->'closing_cash',
    'variance', v_gl->'variance',
    'is_balanced', v_gl->'is_balanced',
    'net_change', v_gl->'total_change',
    'detail', v_gl
  );
end;
$$;

-- Cash flow assert gate: fails if variance >0.001 or unclassified present without exception
create or replace function public.wp05_assert_cash_flow(
  p_from date,
  p_to date,
  p_allow_unclassified boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_report jsonb;
  v_variance numeric;
  v_unclassified numeric;
begin
  v_report := public.wp05_rpt_cash_flow_gl(p_from, p_to);
  v_variance := (v_report->>'variance')::numeric;
  v_unclassified := (v_report->>'unclassified')::numeric;

  if abs(coalesce(v_variance,0)) > 0.001 then
    raise exception 'WP05_CASHFLOW_VARIANCE_EXCEEDED: variance % exceeds tolerance 0.001 OMR, report %', v_variance, v_report::text using errcode='P0001';
  end if;

  if not p_allow_unclassified and abs(coalesce(v_unclassified,0)) > 0.001 then
    raise exception 'WP05_CASHFLOW_UNCLASSIFIED_PRESENT: unclassified cash movement % must be zero unless explicit governed exception exists, report %', v_unclassified, v_report::text using errcode='P0001';
  end if;

  return v_report;
end;
$$;

-- Drillthrough: Financial Statement → Account → Journal Batch → Source
create or replace function public.wp05_cash_flow_drillthrough(
  p_from date,
  p_to date,
  p_classification text default null
)
returns table (
  classification text,
  account_id text,
  account_no text,
  account_name text,
  batch_id uuid,
  source_type text,
  source_id text,
  event_id text,
  effective_date date,
  posted_at timestamptz,
  debit numeric,
  credit numeric,
  amount numeric,
  line_description text,
  ref_source_id text,
  ref_entity_type text,
  ref_entity_id text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
begin
  if p_from is null or p_to is null then
    raise exception 'WP05_DRILLTHROUGH_PERIOD_REQUIRED' using errcode='22023';
  end if;

  return query
  with batches_with_cash as (
    select distinct jb.id
    from public.journal_batches jb
    join public.journal_lines jl on jl.batch_id = jb.id and jl.company_id = v_company_id
    join public.accounts a on a.id = jl.account_id and a.company_id = v_company_id
    where jb.company_id = v_company_id
      and jb.status in ('POSTED','REVERSED')
      and jb.effective_date between p_from and p_to
      and a.no = any(public.wp05_cash_accounts())
      and jl.deleted_at is null
  )
  select
    coalesce(cfc.classification, 'UNCLASSIFIED')::text as classification,
    a.id::text as account_id,
    a.no::text as account_no,
    a.name::text as account_name,
    jb.id as batch_id,
    jb.source_type::text,
    jb.source_id::text,
    jb.event_id::text,
    jb.effective_date,
    jb.posted_at,
    public.wp05_round_omr(jl.debit) as debit,
    public.wp05_round_omr(jl.credit) as credit,
    public.wp05_round_omr(jl.credit - jl.debit) as amount,
    jl.line_description::text,
    jl.ref_source_id::text,
    jl.ref_entity_type::text,
    jl.ref_entity_id::text
  from public.journal_batches jb
  join batches_with_cash bwc on bwc.id = jb.id
  join public.journal_lines jl on jl.batch_id = jb.id and jl.company_id = v_company_id and jl.deleted_at is null
  join public.accounts a on a.id = jl.account_id and a.company_id = v_company_id
  left join public.gl_cash_flow_classifications cfc on cfc.company_id = v_company_id and cfc.account_id = a.id and cfc.is_active = true
  where jb.company_id = v_company_id
    and a.no <> all(public.wp05_cash_accounts())
    and (p_classification is null or coalesce(cfc.classification, 'UNCLASSIFIED') = upper(p_classification))
  order by jb.effective_date, jb.created_at, jl.created_at;
end;
$$;

-- General GL drillthrough: Account → Batch → Source
create or replace function public.wp05_gl_drillthrough(
  p_from date,
  p_to date,
  p_account_no text default null
)
returns table (
  account_no text,
  account_name text,
  batch_id uuid,
  source_type text,
  source_id text,
  event_id text,
  effective_date date,
  posted_at timestamptz,
  status text,
  debit numeric,
  credit numeric,
  line_description text,
  ref_source_id text,
  ref_entity_type text,
  ref_entity_id text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
begin
  return query
  select
    a.no::text,
    a.name::text,
    jb.id,
    jb.source_type::text,
    jb.source_id::text,
    jb.event_id::text,
    jb.effective_date,
    jb.posted_at,
    jb.status::text,
    public.wp05_round_omr(jl.debit),
    public.wp05_round_omr(jl.credit),
    jl.line_description::text,
    jl.ref_source_id::text,
    jl.ref_entity_type::text,
    jl.ref_entity_id::text
  from public.journal_lines jl
  join public.journal_batches jb on jb.id = jl.batch_id and jb.company_id = v_company_id and jb.status in ('POSTED','REVERSED') and jb.effective_date between p_from and p_to
  join public.accounts a on a.id = jl.account_id and a.company_id = v_company_id
  where jl.company_id = v_company_id
    and jl.deleted_at is null
    and (p_account_no is null or a.no = p_account_no)
  order by jb.effective_date, jb.created_at, jl.created_at;
end;
$$;

-- Grants
revoke all on function public.wp05_provision_default_cashflow_classifications(uuid) from public, anon;
grant execute on function public.wp05_provision_default_cashflow_classifications(uuid) to authenticated, service_role;

revoke all on function public.wp05_rpt_trial_balance_gl(date) from public, anon;
grant execute on function public.wp05_rpt_trial_balance_gl(date) to authenticated, service_role;

revoke all on function public.wp05_rpt_balance_sheet_gl(date) from public, anon;
grant execute on function public.wp05_rpt_balance_sheet_gl(date) to authenticated, service_role;

revoke all on function public.wp05_rpt_profit_loss_gl(date,date) from public, anon;
grant execute on function public.wp05_rpt_profit_loss_gl(date,date) to authenticated, service_role;

revoke all on function public.wp05_rpt_general_ledger_gl(date,date,text) from public, anon;
grant execute on function public.wp05_rpt_general_ledger_gl(date,date,text) to authenticated, service_role;

revoke all on function public.wp05_rpt_cash_flow_gl(date,date) from public, anon;
grant execute on function public.wp05_rpt_cash_flow_gl(date,date) to authenticated, service_role;

revoke all on function public.wp05_assert_cash_flow(date,date,boolean) from public, anon;
grant execute on function public.wp05_assert_cash_flow(date,date,boolean) to authenticated, service_role;

revoke all on function public.wp05_cash_flow_drillthrough(date,date,text) from public, anon;
grant execute on function public.wp05_cash_flow_drillthrough(date,date,text) to authenticated, service_role;

revoke all on function public.wp05_gl_drillthrough(date,date,text) from public, anon;
grant execute on function public.wp05_gl_drillthrough(date,date,text) to authenticated, service_role;

-- Keep old RPC grants for compatibility
revoke all on function public.rpt_trial_balance(date) from public, anon;
grant execute on function public.rpt_trial_balance(date) to authenticated, service_role;
revoke all on function public.rpt_balance_sheet(date) from public, anon;
grant execute on function public.rpt_balance_sheet(date) to authenticated, service_role;
revoke all on function public.rpt_income_statement(date,date) from public, anon;
grant execute on function public.rpt_income_statement(date,date) to authenticated, service_role;
revoke all on function public.rpt_general_ledger(date,date) from public, anon;
grant execute on function public.rpt_general_ledger(date,date) to authenticated, service_role;
revoke all on function public.rpt_cash_flow(date,date) from public, anon;
grant execute on function public.rpt_cash_flow(date,date) to authenticated, service_role;

commit;

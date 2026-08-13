-- WP-02 / GAP-007: FIXED_MONTHLY owner-agency fees recognized by economic day.
--
-- Financial invariants:
--   * terms come only from frozen owner_agreement_versions;
--   * one immutable source row per company/version/economic day;
--   * OMR is posted at three decimals, with full-month rounding residue spread
--     deterministically as +0.001 over the earliest calendar days;
--   * partial service months receive only their eligible calendar-day shares;
--   * tax is explicitly outside this slice until an authoritative, versioned
--     tax configuration can be resolved for the economic date (tax_amount=0,
--     no 2100 line, and no caller-supplied tax input);
--   * journal creation is delegated exclusively to post_journal_event();
--   * corrections append an immutable reversal record and use the canonical
--     equal-and-opposite reverse_journal_batch() path.

begin;

-- WP-01 established the six-role policy/check surface, while the replay-safe
-- baseline can still carry the older enum labels. Add the one label required
-- by this slice so ACCOUNTANT authority is representable in public.users.
-- PostgreSQL enum values are intentionally never removed.
alter type public.user_role add value if not exists 'ACCOUNTANT';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Immutable daily source ledger and append-only reversal linkage
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.fixed_monthly_daily_accruals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  owner_agreement_id uuid not null references public.owner_agreements(id) on delete restrict,
  agreement_version_id uuid not null references public.owner_agreement_versions(id) on delete restrict,
  owner_id uuid not null,
  property_id text not null,
  accrual_date date not null,
  agreement_starts_on date not null,
  agreement_ends_on date,
  version_effective_from date not null,
  version_effective_to date,
  monthly_contract_amount numeric(14,4) not null check (monthly_contract_amount >= 0),
  monthly_amount_omr numeric(14,3) not null check (monthly_amount_omr >= 0),
  calendar_days smallint not null check (calendar_days between 28 and 31),
  calendar_day smallint not null check (calendar_day between 1 and 31 and calendar_day <= calendar_days),
  rounding_rule text not null check (rounding_rule = 'EARLIEST_DAYS_PLUS_ONE_BAISA'),
  net_amount numeric(14,3) not null check (net_amount >= 0),
  tax_amount numeric(14,3) not null check (tax_amount = 0),
  gross_amount numeric(14,3) not null check (gross_amount = net_amount + tax_amount),
  tax_authority_status text not null check (
    tax_authority_status = 'OUT_OF_SCOPE_NO_VERSIONED_AUTHORITY'
  ),
  journal_batch_id uuid unique references public.journal_batches(id) on delete restrict,
  source_fingerprint text not null,
  executed_by uuid,
  created_at timestamptz not null default now(),
  constraint fixed_monthly_daily_accrual_identity_uq
    unique (company_id, agreement_version_id, accrual_date),
  constraint fixed_monthly_daily_accrual_batch_required_chk
    check ((net_amount = 0 and journal_batch_id is null) or (net_amount > 0 and journal_batch_id is not null)),
  constraint fixed_monthly_daily_accrual_agreement_dates_chk
    check (agreement_ends_on is null or agreement_ends_on >= agreement_starts_on),
  constraint fixed_monthly_daily_accrual_version_dates_chk
    check (version_effective_to is null or version_effective_to >= version_effective_from),
  constraint fixed_monthly_daily_accrual_date_in_service_chk
    check (
      accrual_date >= agreement_starts_on
      and accrual_date <= coalesce(agreement_ends_on, 'infinity'::date)
      and accrual_date >= version_effective_from
      and accrual_date <= coalesce(version_effective_to, 'infinity'::date)
    )
);

create index if not exists fixed_monthly_daily_accruals_company_date_idx
  on public.fixed_monthly_daily_accruals(company_id, accrual_date desc, id);
create index if not exists fixed_monthly_daily_accruals_agreement_idx
  on public.fixed_monthly_daily_accruals(company_id, owner_agreement_id, accrual_date desc);

create table if not exists public.fixed_monthly_daily_accrual_reversals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  accrual_id uuid not null unique references public.fixed_monthly_daily_accruals(id) on delete restrict,
  original_journal_batch_id uuid references public.journal_batches(id) on delete restrict,
  reversal_journal_batch_id uuid unique references public.journal_batches(id) on delete restrict,
  original_economic_date date not null,
  reason text not null check (length(btrim(reason)) between 3 and 1000),
  reversed_by uuid,
  created_at timestamptz not null default now(),
  constraint fixed_monthly_daily_reversal_batch_pair_chk check (
    (original_journal_batch_id is null and reversal_journal_batch_id is null)
    or (original_journal_batch_id is not null and reversal_journal_batch_id is not null)
  )
);

create index if not exists fixed_monthly_daily_reversals_company_date_idx
  on public.fixed_monthly_daily_accrual_reversals(company_id, original_economic_date desc);

comment on table public.fixed_monthly_daily_accruals is
  'Immutable GAP-007 source ledger: one server-derived FIXED_MONTHLY accrual per frozen agreement version and economic day.';
comment on column public.fixed_monthly_daily_accruals.rounding_rule is
  'Full-month OMR residue is allocated as one extra baisa to each earliest calendar day until the rounded monthly total is exact.';
comment on column public.fixed_monthly_daily_accruals.tax_authority_status is
  'Tax is not inferred from mutable company settings. It remains outside GAP-007 until authoritative versioned tax terms exist.';
comment on table public.fixed_monthly_daily_accrual_reversals is
  'Append-only compensating reversal link; original daily accrual amounts are never edited or deleted.';

create or replace function public.guard_fixed_monthly_daily_ledger_immutable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  raise exception 'FIXED_MONTHLY_ACCRUAL_IMMUTABLE: financial history cannot be updated or deleted; use the governed compensating reversal.'
    using errcode = '42501';
end;
$function$;

alter function public.guard_fixed_monthly_daily_ledger_immutable() owner to postgres;
revoke all on function public.guard_fixed_monthly_daily_ledger_immutable() from public, anon, authenticated, service_role;

drop trigger if exists guard_fixed_monthly_daily_accruals_immutable on public.fixed_monthly_daily_accruals;
create trigger guard_fixed_monthly_daily_accruals_immutable
  before update or delete on public.fixed_monthly_daily_accruals
  for each row execute function public.guard_fixed_monthly_daily_ledger_immutable();

drop trigger if exists guard_fixed_monthly_daily_reversals_immutable on public.fixed_monthly_daily_accrual_reversals;
create trigger guard_fixed_monthly_daily_reversals_immutable
  before update or delete on public.fixed_monthly_daily_accrual_reversals
  for each row execute function public.guard_fixed_monthly_daily_ledger_immutable();

alter table public.fixed_monthly_daily_accruals enable row level security;
alter table public.fixed_monthly_daily_accrual_reversals enable row level security;

create policy fixed_monthly_daily_accruals_company_read
  on public.fixed_monthly_daily_accruals
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (public.is_admin_or_manager() or public.is_accountant())
  );

create policy fixed_monthly_daily_reversals_company_read
  on public.fixed_monthly_daily_accrual_reversals
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (public.is_admin_or_manager() or public.is_accountant())
  );

-- The browser reads through a bounded RPC and never writes the source tables.
revoke all on table public.fixed_monthly_daily_accruals from public, anon, authenticated, service_role;
revoke all on table public.fixed_monthly_daily_accrual_reversals from public, anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Deterministic OMR allocator
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fixed_monthly_daily_amount_omr(
  p_monthly_amount numeric,
  p_economic_date date
)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $function$
declare
  v_monthly_omr numeric;
  v_days integer;
  v_day integer;
  v_target_baisa bigint;
  v_base_baisa bigint;
  v_residue_days integer;
begin
  if p_monthly_amount is null or p_economic_date is null then
    raise exception 'FIXED_MONTHLY_ALLOCATOR_INPUT_REQUIRED' using errcode = '22023';
  end if;
  if p_monthly_amount::text in ('NaN', 'Infinity', '-Infinity') or p_monthly_amount < 0 then
    raise exception 'FIXED_MONTHLY_ALLOCATOR_AMOUNT_INVALID' using errcode = '22023';
  end if;

  v_monthly_omr := round(p_monthly_amount, 3);
  v_days := extract(day from (date_trunc('month', p_economic_date)::date + interval '1 month - 1 day'))::integer;
  v_day := extract(day from p_economic_date)::integer;
  v_target_baisa := round(v_monthly_omr * 1000)::bigint;
  v_base_baisa := floor(v_target_baisa::numeric / v_days)::bigint;
  v_residue_days := (v_target_baisa - (v_base_baisa * v_days))::integer;

  return ((v_base_baisa + case when v_day <= v_residue_days then 1 else 0 end)::numeric / 1000)::numeric(14,3);
end;
$function$;

alter function public.fixed_monthly_daily_amount_omr(numeric, date) owner to postgres;
revoke all on function public.fixed_monthly_daily_amount_omr(numeric, date) from public, anon, authenticated;
grant execute on function public.fixed_monthly_daily_amount_omr(numeric, date) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trusted one-day engine. The source UUID is generated before posting and
--    is used as the canonical GL source_id/ref_source_id. The ledger insert and
--    GL post share one transaction, so neither can commit without the other.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_accrue_fixed_monthly_day(
  p_company_id uuid,
  p_agreement_version_id uuid,
  p_economic_date date,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_owner_agreement_id uuid;
  v_owner_id uuid;
  v_property_id text;
  v_operating_model text;
  v_commission_type text;
  v_recognition_basis text;
  v_monthly_contract numeric;
  v_agreement_start date;
  v_agreement_end date;
  v_version_start date;
  v_version_end date;
  v_calendar_days integer;
  v_calendar_day integer;
  v_monthly_omr numeric(14,3);
  v_net numeric(14,3);
  v_tax numeric(14,3) := 0;
  v_gross numeric(14,3);
  v_accrual_id uuid;
  v_due_from_owner_id text;
  v_revenue_id text;
  v_post_result jsonb;
  v_batch_id uuid;
  v_fingerprint text;
  v_existing public.fixed_monthly_daily_accruals%rowtype;
  v_reversal public.fixed_monthly_daily_accrual_reversals%rowtype;
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'FIXED_MONTHLY_ENGINE_SERVER_ONLY' using errcode = '42501';
  end if;
  if p_company_id is null or p_agreement_version_id is null or p_economic_date is null then
    raise exception 'FIXED_MONTHLY_DAY_INPUT_REQUIRED' using errcode = '22023';
  end if;

  select
    v.owner_agreement_id,
    oa.owner_id,
    oa.property_id::text,
    v.operating_model,
    v.commission_type,
    v.commission_recognition_basis,
    v.commission_value,
    oa.starts_on,
    oa.ends_on,
    v.effective_from,
    v.effective_to
  into
    v_owner_agreement_id,
    v_owner_id,
    v_property_id,
    v_operating_model,
    v_commission_type,
    v_recognition_basis,
    v_monthly_contract,
    v_agreement_start,
    v_agreement_end,
    v_version_start,
    v_version_end
  from public.owner_agreement_versions v
  join public.owner_agreements oa
    on oa.id = v.owner_agreement_id
   and oa.company_id = v.company_id
  where v.id = p_agreement_version_id
    and v.company_id = p_company_id
    and oa.agreement_type = 'property_management';

  if not found then
    raise exception 'FIXED_MONTHLY_VERSION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  if v_operating_model <> 'OWNER_AGENCY'
     or v_commission_type <> 'FIXED_MONTHLY'
     or v_recognition_basis <> 'DAILY_ACCRUAL'
     or v_monthly_contract is null
     or v_monthly_contract::text in ('NaN', 'Infinity', '-Infinity')
     or v_monthly_contract < 0 then
    raise exception 'FIXED_MONTHLY_TERMS_INVALID' using errcode = '22023';
  end if;

  if p_economic_date < greatest(v_agreement_start, v_version_start)
     or p_economic_date > least(
       coalesce(v_agreement_end, 'infinity'::date),
       coalesce(v_version_end, 'infinity'::date)
     ) then
    raise exception 'FIXED_MONTHLY_DATE_OUTSIDE_SERVICE_INTERVAL' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'fixed_monthly_day:' || p_company_id::text || ':' || p_agreement_version_id::text || ':' || p_economic_date::text,
    0
  ));

  v_calendar_days := extract(day from (date_trunc('month', p_economic_date)::date + interval '1 month - 1 day'))::integer;
  v_calendar_day := extract(day from p_economic_date)::integer;
  v_monthly_omr := round(v_monthly_contract, 3);
  v_net := public.fixed_monthly_daily_amount_omr(v_monthly_contract, p_economic_date);
  v_gross := v_net + v_tax;

  v_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'company_id', p_company_id,
    'agreement_version_id', p_agreement_version_id,
    'owner_agreement_id', v_owner_agreement_id,
    'economic_date', p_economic_date,
    'monthly_contract_amount', v_monthly_contract,
    'monthly_amount_omr', v_monthly_omr,
    'calendar_days', v_calendar_days,
    'calendar_day', v_calendar_day,
    'net_amount', v_net,
    'tax_amount', v_tax,
    'tax_authority_status', 'OUT_OF_SCOPE_NO_VERSIONED_AUTHORITY'
  )::text, 'UTF8')), 'hex');

  select * into v_existing
  from public.fixed_monthly_daily_accruals a
  where a.company_id = p_company_id
    and a.agreement_version_id = p_agreement_version_id
    and a.accrual_date = p_economic_date;

  if found then
    if v_existing.source_fingerprint <> v_fingerprint
       or v_existing.net_amount <> v_net
       or v_existing.tax_amount <> 0
       or v_existing.gross_amount <> v_gross then
      raise exception 'FIXED_MONTHLY_ACCRUAL_SOURCE_CONFLICT' using errcode = '23505';
    end if;

    select * into v_reversal
    from public.fixed_monthly_daily_accrual_reversals r
    where r.accrual_id = v_existing.id;

    return jsonb_build_object(
      'success', true,
      'created', false,
      'idempotent', true,
      'accrual_id', v_existing.id,
      'agreement_version_id', v_existing.agreement_version_id,
      'accrual_date', v_existing.accrual_date,
      'net_amount', v_existing.net_amount,
      'tax_amount', v_existing.tax_amount,
      'gross_amount', v_existing.gross_amount,
      'journal_batch_id', v_existing.journal_batch_id,
      'status', case
        when v_reversal.id is not null then 'REVERSED'
        when v_existing.journal_batch_id is null then 'ZERO_AMOUNT'
        else 'POSTED'
      end,
      'reversal_batch_id', v_reversal.reversal_journal_batch_id
    );
  end if;

  v_accrual_id := gen_random_uuid();

  if v_net > 0 then
    v_due_from_owner_id := public.gl_pm_require_account(p_company_id, '1300');
    v_revenue_id := public.gl_pm_require_account(p_company_id, '4100');

    v_post_result := public.post_journal_event(jsonb_build_object(
      'company_id', p_company_id,
      'source_type', 'pm_fixed_monthly_daily_accrual',
      'source_id', v_accrual_id::text,
      'event_id', 'DAILY-ACCRUAL',
      'effective_date', p_economic_date,
      'description', 'FIXED_MONTHLY daily accrual for frozen agreement version ' || p_agreement_version_id::text,
      'lines', jsonb_build_array(
        jsonb_build_object(
          'account_id', v_due_from_owner_id,
          'debit', v_gross,
          'credit', 0,
          'line_description', 'Daily management fee due from owner',
          'ref_source_id', v_accrual_id::text,
          'ref_entity_type', 'fixed_monthly_daily_accrual',
          'ref_entity_id', v_accrual_id::text
        ),
        jsonb_build_object(
          'account_id', v_revenue_id,
          'debit', 0,
          'credit', v_net,
          'line_description', 'Daily management fee revenue',
          'ref_source_id', v_accrual_id::text,
          'ref_entity_type', 'fixed_monthly_daily_accrual',
          'ref_entity_id', v_accrual_id::text
        )
      )
    ));
    v_batch_id := (v_post_result->>'batch_id')::uuid;
  end if;

  insert into public.fixed_monthly_daily_accruals (
    id, company_id, owner_agreement_id, agreement_version_id, owner_id, property_id,
    accrual_date, agreement_starts_on, agreement_ends_on,
    version_effective_from, version_effective_to,
    monthly_contract_amount, monthly_amount_omr, calendar_days, calendar_day,
    rounding_rule, net_amount, tax_amount, gross_amount, tax_authority_status,
    journal_batch_id, source_fingerprint, executed_by
  ) values (
    v_accrual_id, p_company_id, v_owner_agreement_id, p_agreement_version_id, v_owner_id, v_property_id,
    p_economic_date, v_agreement_start, v_agreement_end,
    v_version_start, v_version_end,
    v_monthly_contract, v_monthly_omr, v_calendar_days, v_calendar_day,
    'EARLIEST_DAYS_PLUS_ONE_BAISA', v_net, v_tax, v_gross,
    'OUT_OF_SCOPE_NO_VERSIONED_AUTHORITY',
    v_batch_id, v_fingerprint, p_actor_id
  );

  return jsonb_build_object(
    'success', true,
    'created', true,
    'idempotent', false,
    'accrual_id', v_accrual_id,
    'agreement_version_id', p_agreement_version_id,
    'accrual_date', p_economic_date,
    'net_amount', v_net,
    'tax_amount', v_tax,
    'gross_amount', v_gross,
    'journal_batch_id', v_batch_id,
    'status', case when v_batch_id is null then 'ZERO_AMOUNT' else 'POSTED' end,
    'period_resolution_reason', v_post_result->>'period_resolution_reason'
  );
end;
$function$;

alter function public.gl_accrue_fixed_monthly_day(uuid, uuid, date, uuid) owner to postgres;
revoke all on function public.gl_accrue_fixed_monthly_day(uuid, uuid, date, uuid) from public, anon, authenticated;
grant execute on function public.gl_accrue_fixed_monthly_day(uuid, uuid, date, uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Bounded catch-up engine. It invokes the exact same one-day function used
--    for a single-day execution, so execution shape cannot alter allocation.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_run_fixed_monthly_accruals(
  p_company_id uuid,
  p_date_from date,
  p_date_to date,
  p_agreement_version_id uuid default null,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_version record;
  v_day record;
  v_version_check record;
  v_result jsonb;
  v_attempted integer := 0;
  v_created integer := 0;
  v_idempotent integer := 0;
  v_reversed integer := 0;
  v_zero integer := 0;
  v_net numeric := 0;
  v_tax numeric := 0;
  v_gross numeric := 0;
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'FIXED_MONTHLY_ENGINE_SERVER_ONLY' using errcode = '42501';
  end if;
  if p_company_id is null or p_date_from is null or p_date_to is null then
    raise exception 'FIXED_MONTHLY_RUN_RANGE_REQUIRED' using errcode = '22023';
  end if;
  if p_date_from > p_date_to then
    raise exception 'FIXED_MONTHLY_RUN_RANGE_INVALID' using errcode = '22023';
  end if;
  if (p_date_to - p_date_from) > 91 then
    raise exception 'FIXED_MONTHLY_CATCH_UP_LIMIT_EXCEEDED: maximum range is 92 days.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.companies c where c.id = p_company_id and c.is_active) then
    raise exception 'FIXED_MONTHLY_COMPANY_NOT_FOUND_OR_INACTIVE' using errcode = '42501';
  end if;

  if p_agreement_version_id is not null then
    select
      v.operating_model,
      v.commission_type,
      v.commission_recognition_basis,
      v.commission_value,
      oa.agreement_type,
      oa.company_id as agreement_company_id
    into v_version_check
    from public.owner_agreement_versions v
    join public.owner_agreements oa on oa.id = v.owner_agreement_id
    where v.id = p_agreement_version_id
      and v.company_id = p_company_id
      and oa.company_id = p_company_id;

    if not found then
      raise exception 'FIXED_MONTHLY_VERSION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
    end if;
    if v_version_check.operating_model <> 'OWNER_AGENCY'
       or v_version_check.commission_type <> 'FIXED_MONTHLY'
       or v_version_check.commission_recognition_basis <> 'DAILY_ACCRUAL'
       or v_version_check.agreement_type <> 'property_management'
       or v_version_check.commission_value is null
       or v_version_check.commission_value::text in ('NaN', 'Infinity', '-Infinity')
       or v_version_check.commission_value < 0 then
      raise exception 'FIXED_MONTHLY_TERMS_INVALID' using errcode = '22023';
    end if;
  end if;

  -- Two qualifying frozen versions for the same agreement must never charge
  -- the same economic day. Fail closed if historical data is malformed rather
  -- than silently double-accruing under two distinct version identities.
  if exists (
    select 1
    from public.owner_agreement_versions v1
    join public.owner_agreement_versions v2
      on v2.owner_agreement_id = v1.owner_agreement_id
     and v2.id > v1.id
     and v2.company_id = v1.company_id
    join public.owner_agreements oa
      on oa.id = v1.owner_agreement_id
     and oa.company_id = v1.company_id
    where v1.company_id = p_company_id
      and (p_agreement_version_id is null or v1.id = p_agreement_version_id or v2.id = p_agreement_version_id)
      and v1.operating_model = 'OWNER_AGENCY'
      and v2.operating_model = 'OWNER_AGENCY'
      and v1.commission_type = 'FIXED_MONTHLY'
      and v2.commission_type = 'FIXED_MONTHLY'
      and v1.commission_recognition_basis = 'DAILY_ACCRUAL'
      and v2.commission_recognition_basis = 'DAILY_ACCRUAL'
      and greatest(v1.effective_from, v2.effective_from, oa.starts_on, p_date_from)
          <= least(
            coalesce(v1.effective_to, 'infinity'::date),
            coalesce(v2.effective_to, 'infinity'::date),
            coalesce(oa.ends_on, 'infinity'::date),
            p_date_to
          )
  ) then
    raise exception 'FIXED_MONTHLY_VERSION_INTERVAL_OVERLAP' using errcode = '22023';
  end if;

  for v_version in
    select
      v.id,
      greatest(v.effective_from, oa.starts_on, p_date_from) as run_from,
      least(
        coalesce(v.effective_to, 'infinity'::date),
        coalesce(oa.ends_on, 'infinity'::date),
        p_date_to
      ) as run_to
    from public.owner_agreement_versions v
    join public.owner_agreements oa
      on oa.id = v.owner_agreement_id
     and oa.company_id = v.company_id
    where v.company_id = p_company_id
      and (p_agreement_version_id is null or v.id = p_agreement_version_id)
      and oa.agreement_type = 'property_management'
      and v.operating_model = 'OWNER_AGENCY'
      and v.commission_type = 'FIXED_MONTHLY'
      and v.commission_recognition_basis = 'DAILY_ACCRUAL'
      and v.commission_value >= 0
      and v.effective_from <= p_date_to
      and coalesce(v.effective_to, 'infinity'::date) >= p_date_from
      and oa.starts_on <= p_date_to
      and coalesce(oa.ends_on, 'infinity'::date) >= p_date_from
    order by v.id
  loop
    for v_day in
      select d::date as economic_date
      from generate_series(v_version.run_from, v_version.run_to, interval '1 day') d
      order by d
    loop
      v_result := public.gl_accrue_fixed_monthly_day(
        p_company_id,
        v_version.id,
        v_day.economic_date,
        p_actor_id
      );
      v_attempted := v_attempted + 1;
      v_created := v_created + case when coalesce((v_result->>'created')::boolean, false) then 1 else 0 end;
      v_idempotent := v_idempotent + case when coalesce((v_result->>'idempotent')::boolean, false) then 1 else 0 end;
      v_reversed := v_reversed + case when v_result->>'status' = 'REVERSED' then 1 else 0 end;
      v_zero := v_zero + case when v_result->>'status' = 'ZERO_AMOUNT' then 1 else 0 end;
      v_net := v_net + coalesce((v_result->>'net_amount')::numeric, 0);
      v_tax := v_tax + coalesce((v_result->>'tax_amount')::numeric, 0);
      v_gross := v_gross + coalesce((v_result->>'gross_amount')::numeric, 0);
    end loop;
  end loop;

  return jsonb_build_object(
    'success', true,
    'company_id', p_company_id,
    'date_from', p_date_from,
    'date_to', p_date_to,
    'agreement_version_id', p_agreement_version_id,
    'attempted_days', v_attempted,
    'created_days', v_created,
    'idempotent_days', v_idempotent,
    'already_reversed_days', v_reversed,
    'zero_amount_days', v_zero,
    'net_amount', round(v_net, 3),
    'tax_amount', round(v_tax, 3),
    'gross_amount', round(v_gross, 3),
    'tax_authority_status', 'OUT_OF_SCOPE_NO_VERSIONED_AUTHORITY'
  );
end;
$function$;

alter function public.gl_run_fixed_monthly_accruals(uuid, date, date, uuid, uuid) owner to postgres;
revoke all on function public.gl_run_fixed_monthly_accruals(uuid, date, date, uuid, uuid) from public, anon, authenticated;
grant execute on function public.gl_run_fixed_monthly_accruals(uuid, date, date, uuid, uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Trusted compensating reversal engine
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_reverse_fixed_monthly_accrual(
  p_company_id uuid,
  p_accrual_id uuid,
  p_reason text,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_accrual public.fixed_monthly_daily_accruals%rowtype;
  v_existing public.fixed_monthly_daily_accrual_reversals%rowtype;
  v_reversal_id uuid;
  v_reversal_result jsonb;
  v_reversal_batch_id uuid;
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'FIXED_MONTHLY_ENGINE_SERVER_ONLY' using errcode = '42501';
  end if;
  if p_company_id is null or p_accrual_id is null then
    raise exception 'FIXED_MONTHLY_REVERSAL_INPUT_REQUIRED' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null or length(btrim(p_reason)) < 3 then
    raise exception 'FIXED_MONTHLY_REVERSAL_REASON_REQUIRED' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'fixed_monthly_reverse:' || p_company_id::text || ':' || p_accrual_id::text,
    0
  ));

  select * into v_accrual
  from public.fixed_monthly_daily_accruals a
  where a.id = p_accrual_id
    and a.company_id = p_company_id;

  if not found then
    raise exception 'FIXED_MONTHLY_ACCRUAL_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_existing
  from public.fixed_monthly_daily_accrual_reversals r
  where r.accrual_id = p_accrual_id;

  if found then
    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'accrual_id', p_accrual_id,
      'reversal_id', v_existing.id,
      'original_batch_id', v_existing.original_journal_batch_id,
      'reversal_batch_id', v_existing.reversal_journal_batch_id,
      'status', 'REVERSED'
    );
  end if;

  if v_accrual.journal_batch_id is not null then
    v_reversal_result := public.reverse_journal_batch(v_accrual.journal_batch_id);
    v_reversal_batch_id := (v_reversal_result->>'reversal_batch_id')::uuid;
  end if;

  v_reversal_id := gen_random_uuid();
  insert into public.fixed_monthly_daily_accrual_reversals (
    id, company_id, accrual_id, original_journal_batch_id,
    reversal_journal_batch_id, original_economic_date, reason, reversed_by
  ) values (
    v_reversal_id, p_company_id, p_accrual_id, v_accrual.journal_batch_id,
    v_reversal_batch_id, v_accrual.accrual_date, btrim(p_reason), p_actor_id
  );

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid()::text,
    extract(epoch from now())::bigint,
    p_actor_id,
    p_actor_id::text,
    'REVERSE',
    'fixed_monthly_daily_accrual',
    p_accrual_id::text,
    'Compensating reversal of FIXED_MONTHLY daily accrual.',
    'fixed_monthly_daily_accrual_reversals',
    jsonb_build_object(
      'company_id', p_company_id,
      'accrual_id', p_accrual_id,
      'original_economic_date', v_accrual.accrual_date,
      'original_batch_id', v_accrual.journal_batch_id,
      'reversal_batch_id', v_reversal_batch_id,
      'reason', btrim(p_reason)
    )::text,
    now()
  );

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'accrual_id', p_accrual_id,
    'reversal_id', v_reversal_id,
    'original_batch_id', v_accrual.journal_batch_id,
    'reversal_batch_id', v_reversal_batch_id,
    'status', 'REVERSED',
    'reversal_period_reason', v_reversal_result->>'reversal_period_reason'
  );
end;
$function$;

alter function public.gl_reverse_fixed_monthly_accrual(uuid, uuid, text, uuid) owner to postgres;
revoke all on function public.gl_reverse_fixed_monthly_accrual(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.gl_reverse_fixed_monthly_accrual(uuid, uuid, text, uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Browser-governed execute, reverse and bounded status RPCs. Company and
--    financial terms are never accepted from the browser.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.execute_fixed_monthly_accruals_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id', '')), '');
  v_date_from date := nullif(p_payload->>'date_from', '')::date;
  v_date_to date := nullif(p_payload->>'date_to', '')::date;
  v_version_id uuid := nullif(p_payload->>'agreement_version_id', '')::uuid;
  v_company_today date;
  v_fingerprint text;
  v_cached jsonb;
  v_result jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'FIXED_MONTHLY_ROLE_REQUIRED: ADMIN, MANAGER or ACCOUNTANT is required.' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if not public.is_company_member(v_company_id, v_actor) then
    raise exception 'FIXED_MONTHLY_ACTIVE_COMPANY_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;

  if p_payload ?| array['company_id','monthly_amount','commission_value','net_amount','tax_amount','tax_rate','gross_amount','lines'] then
    raise exception 'FIXED_MONTHLY_CLIENT_FINANCIAL_INPUT_FORBIDDEN' using errcode = '22023';
  end if;
  if v_request_id is null or length(v_request_id) > 200 then
    raise exception 'FIXED_MONTHLY_REQUEST_ID_REQUIRED' using errcode = '22023';
  end if;
  if v_date_from is null or v_date_to is null then
    raise exception 'FIXED_MONTHLY_RUN_RANGE_REQUIRED' using errcode = '22023';
  end if;

  select (now() at time zone c.timezone)::date into v_company_today
  from public.companies c
  where c.id = v_company_id and c.is_active;
  if v_company_today is null then
    raise exception 'FIXED_MONTHLY_COMPANY_NOT_FOUND_OR_INACTIVE' using errcode = '42501';
  end if;
  if v_date_to > v_company_today then
    raise exception 'FIXED_MONTHLY_FUTURE_ACCRUAL_FORBIDDEN' using errcode = '22023';
  end if;

  v_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'date_from', v_date_from,
    'date_to', v_date_to,
    'agreement_version_id', v_version_id
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    'execute_fixed_monthly_accruals_atomic:' || v_company_id::text || ':' || v_request_id,
    0
  ));

  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = 'execute_fixed_monthly_accruals_atomic:' || v_company_id::text
    and request_id = v_request_id
  for update;

  if v_cached is not null then
    if v_cached->>'_request_fingerprint' is distinct from v_fingerprint
       or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode = '22023';
    end if;
    return v_cached->'response';
  end if;

  v_result := public.gl_run_fixed_monthly_accruals(
    v_company_id,
    v_date_from,
    v_date_to,
    v_version_id,
    v_actor
  );

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid()::text,
    extract(epoch from now())::bigint,
    v_actor,
    v_actor::text,
    'EXECUTE',
    'fixed_monthly_daily_accrual',
    v_request_id,
    'Bounded FIXED_MONTHLY daily accrual run.',
    'fixed_monthly_daily_accruals',
    jsonb_build_object(
      'company_id', v_company_id,
      'date_from', v_date_from,
      'date_to', v_date_to,
      'agreement_version_id', v_version_id,
      'result', v_result
    )::text,
    now()
  );

  insert into public.financial_operation_idempotency(operation_name, request_id, response_payload)
  values (
    'execute_fixed_monthly_accruals_atomic:' || v_company_id::text,
    v_request_id,
    jsonb_build_object('_request_fingerprint', v_fingerprint, 'response', v_result)
  );

  return v_result;
end;
$function$;

alter function public.execute_fixed_monthly_accruals_atomic(jsonb) owner to postgres;
revoke all on function public.execute_fixed_monthly_accruals_atomic(jsonb) from public, anon;
grant execute on function public.execute_fixed_monthly_accruals_atomic(jsonb) to authenticated;

create or replace function public.reverse_fixed_monthly_accrual_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id', '')), '');
  v_accrual_id uuid := nullif(p_payload->>'accrual_id', '')::uuid;
  v_reason text := nullif(btrim(coalesce(p_payload->>'reason', '')), '');
  v_fingerprint text;
  v_cached jsonb;
  v_result jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'FIXED_MONTHLY_ROLE_REQUIRED: ADMIN, MANAGER or ACCOUNTANT is required.' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if not public.is_company_member(v_company_id, v_actor) then
    raise exception 'FIXED_MONTHLY_ACTIVE_COMPANY_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;
  if p_payload ?| array['company_id','amount','tax_amount','lines','journal_batch_id'] then
    raise exception 'FIXED_MONTHLY_CLIENT_FINANCIAL_INPUT_FORBIDDEN' using errcode = '22023';
  end if;
  if v_request_id is null or length(v_request_id) > 200 then
    raise exception 'FIXED_MONTHLY_REQUEST_ID_REQUIRED' using errcode = '22023';
  end if;
  if v_accrual_id is null then
    raise exception 'FIXED_MONTHLY_ACCRUAL_ID_REQUIRED' using errcode = '22023';
  end if;
  if v_reason is null or length(v_reason) < 3 or length(v_reason) > 1000 then
    raise exception 'FIXED_MONTHLY_REVERSAL_REASON_REQUIRED' using errcode = '22023';
  end if;

  v_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'accrual_id', v_accrual_id,
    'reason', v_reason
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    'reverse_fixed_monthly_accrual_atomic:' || v_company_id::text || ':' || v_request_id,
    0
  ));

  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = 'reverse_fixed_monthly_accrual_atomic:' || v_company_id::text
    and request_id = v_request_id
  for update;

  if v_cached is not null then
    if v_cached->>'_request_fingerprint' is distinct from v_fingerprint
       or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode = '22023';
    end if;
    return v_cached->'response';
  end if;

  v_result := public.gl_reverse_fixed_monthly_accrual(
    v_company_id,
    v_accrual_id,
    v_reason,
    v_actor
  );

  insert into public.financial_operation_idempotency(operation_name, request_id, response_payload)
  values (
    'reverse_fixed_monthly_accrual_atomic:' || v_company_id::text,
    v_request_id,
    jsonb_build_object('_request_fingerprint', v_fingerprint, 'response', v_result)
  );

  return v_result;
end;
$function$;

alter function public.reverse_fixed_monthly_accrual_atomic(jsonb) owner to postgres;
revoke all on function public.reverse_fixed_monthly_accrual_atomic(jsonb) from public, anon;
grant execute on function public.reverse_fixed_monthly_accrual_atomic(jsonb) to authenticated;

create or replace function public.list_fixed_monthly_accruals(p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_date_from date := coalesce(nullif(p_payload->>'date_from', '')::date, date_trunc('month', current_date)::date);
  v_date_to date := coalesce(nullif(p_payload->>'date_to', '')::date, current_date);
  v_total integer;
  v_net numeric;
  v_tax numeric;
  v_gross numeric;
  v_reversed integer;
  v_rows jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'FIXED_MONTHLY_ROLE_REQUIRED: ADMIN, MANAGER or ACCOUNTANT is required.' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if not public.is_company_member(v_company_id, v_actor) then
    raise exception 'FIXED_MONTHLY_ACTIVE_COMPANY_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;
  if v_date_from > v_date_to then
    raise exception 'FIXED_MONTHLY_LIST_RANGE_INVALID' using errcode = '22023';
  end if;
  if (v_date_to - v_date_from) > 365 then
    raise exception 'FIXED_MONTHLY_LIST_LIMIT_EXCEEDED: maximum range is 366 days.' using errcode = '22023';
  end if;

  select
    count(*)::integer,
    coalesce(sum(a.net_amount), 0),
    coalesce(sum(a.tax_amount), 0),
    coalesce(sum(a.gross_amount), 0),
    count(r.id)::integer
  into v_total, v_net, v_tax, v_gross, v_reversed
  from public.fixed_monthly_daily_accruals a
  left join public.fixed_monthly_daily_accrual_reversals r on r.accrual_id = a.id
  where a.company_id = v_company_id
    and a.accrual_date between v_date_from and v_date_to;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.accrual_date desc, x.id), '[]'::jsonb)
  into v_rows
  from (
    select
      a.id,
      a.owner_agreement_id,
      a.agreement_version_id,
      v.version_no,
      a.owner_id,
      coalesce(o.full_name, o.name, a.owner_id::text) as owner_name,
      a.property_id,
      coalesce(p.title, p.name, a.property_id) as property_name,
      a.accrual_date,
      a.monthly_contract_amount,
      a.monthly_amount_omr,
      a.net_amount,
      a.tax_amount,
      a.gross_amount,
      a.tax_authority_status,
      a.rounding_rule,
      case
        when r.id is not null then 'REVERSED'
        when a.journal_batch_id is null then 'ZERO_AMOUNT'
        else coalesce(b.status, 'SOURCE_ERROR')
      end as status,
      a.journal_batch_id,
      b.accounting_period_id,
      b.period_resolution_reason,
      b.posting_date,
      b.late_posting,
      r.id as reversal_id,
      r.reversal_journal_batch_id,
      r.reason as reversal_reason,
      r.created_at as reversed_at,
      a.created_at
    from public.fixed_monthly_daily_accruals a
    join public.owner_agreement_versions v on v.id = a.agreement_version_id
    left join public.owners o on o.id = a.owner_id and o.company_id = a.company_id
    left join public.properties p on p.id::text = a.property_id and p.company_id = a.company_id
    left join public.journal_batches b on b.id = a.journal_batch_id and b.company_id = a.company_id
    left join public.fixed_monthly_daily_accrual_reversals r on r.accrual_id = a.id and r.company_id = a.company_id
    where a.company_id = v_company_id
      and a.accrual_date between v_date_from and v_date_to
    order by a.accrual_date desc, a.id
    limit 500
  ) x;

  return jsonb_build_object(
    'success', true,
    'company_id', v_company_id,
    'date_from', v_date_from,
    'date_to', v_date_to,
    'total_count', v_total,
    'returned_count', jsonb_array_length(v_rows),
    'truncated', v_total > 500,
    'net_amount', round(v_net, 3),
    'tax_amount', round(v_tax, 3),
    'gross_amount', round(v_gross, 3),
    'reversed_count', v_reversed,
    'tax_authority_status', 'OUT_OF_SCOPE_NO_VERSIONED_AUTHORITY',
    'accruals', v_rows
  );
end;
$function$;

alter function public.list_fixed_monthly_accruals(jsonb) owner to postgres;
revoke all on function public.list_fixed_monthly_accruals(jsonb) from public, anon;
grant execute on function public.list_fixed_monthly_accruals(jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Semantic permission catalog parity for the browser affordances.
--    RPC role checks above remain authoritative and do not trust the browser.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.app_permission_catalog(permission, label_ar, admin_only, requestable) values
  ('financial.fixed_monthly_accruals.view', 'عرض الاستحقاقات اليومية للعمولة الشهرية', false, true),
  ('financial.fixed_monthly_accruals.execute', 'تنفيذ الاستحقاقات اليومية للعمولة الشهرية', false, true),
  ('financial.fixed_monthly_accruals.reverse', 'عكس استحقاق يومي للعمولة الشهرية', false, true)
on conflict (permission) do update set
  label_ar = excluded.label_ar,
  admin_only = excluded.admin_only,
  requestable = excluded.requestable;

create or replace function public.role_has_app_permission(p_role text, p_permission text)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select case upper(coalesce(p_role, ''))
    when 'ADMIN' then
      exists(select 1 from public.app_permission_catalog c where c.permission = p_permission)
    when 'MANAGER' then
      p_permission = any(array[
        'app.dashboard.view','maintenance.view','permission_requests.review','cost_centers.manage','documents.write',
        'owners.hub.view','owners.detail.view','lands.view','leads.view','commissions.view','communication.view',
        'automation.view','auth.password.change','properties.write','contracts.write','expenses.view','expenses.write',
        'arrears.view','financial.deposits.view','financial.invoices.generate','financial.invoices.export',
        'financial.payments.create','financial.receipts.void','financial.reports.export',
        'financial.bank_reconciliation.view','financial.bank_reconciliation.match','financial.owner_settlements.view',
        'service_providers.view','service_providers.write',
        'financial.fixed_monthly_accruals.view','financial.fixed_monthly_accruals.execute',
        'financial.fixed_monthly_accruals.reverse'
      ]::text[])
    when 'ACCOUNTANT' then
      p_permission = any(array[
        'app.dashboard.view','audit.view','expenses.view','arrears.view',
        'financial.deposits.view','financial.invoices.generate','financial.invoices.export',
        'financial.reports.export','financial.bank_reconciliation.view','financial.bank_reconciliation.match',
        'financial.owner_settlements.view','auth.password.change',
        'financial.fixed_monthly_accruals.view','financial.fixed_monthly_accruals.execute',
        'financial.fixed_monthly_accruals.reverse'
      ]::text[])
    when 'OPERATIONS' then
      p_permission = any(array[
        'app.dashboard.view','maintenance.view','service_providers.view','service_providers.write',
        'cost_centers.manage','documents.write','owners.hub.view','owners.detail.view','lands.view',
        'leads.view','communication.view','automation.view','auth.password.change','properties.write',
        'contracts.write','expenses.view','expenses.write','arrears.view'
      ]::text[])
    when 'USER' then
      p_permission = any(array['app.dashboard.view','auth.password.change']::text[])
    when 'VIEWER' then
      p_permission = any(array[
        'app.dashboard.view','maintenance.view','service_providers.view',
        'owners.hub.view','owners.detail.view','lands.view','leads.view','commissions.view',
        'communication.view','automation.view','expenses.view','arrears.view',
        'financial.deposits.view','financial.owner_settlements.view',
        'financial.bank_reconciliation.view','auth.password.change'
      ]::text[])
    else false
  end
$$;

revoke all on function public.role_has_app_permission(text, text) from public, anon;
grant execute on function public.role_has_app_permission(text, text) to authenticated, service_role;

commit;

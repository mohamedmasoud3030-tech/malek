-- ============================================================================
-- RC1 follow-up — cutover-safe 2000 control, fee-tax authority and fail-closed
-- ============================================================================
-- Independent review findings after the initial RC1 correction:
--   1. owner_funds_events must not discard a pre-cutover 2000 opening balance;
--   2. management-fee tax requires its own versioned treatment, not an implicit
--      zero rate from rent tax or absence of a setting;
--   3. legacy/null invoice payment and reversal idempotency must fail closed.
--
-- This is forward-only. It neither backfills nor rewrites posted history.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Approved owner-funds cutover baseline.
-- ---------------------------------------------------------------------------
create table if not exists public.owner_funds_event_cutovers (
  company_id uuid primary key references public.companies(id) on delete restrict,
  cutover_date date not null,
  opening_balance numeric(18,3) not null check (opening_balance = round(opening_balance, 3)),
  gl_line_count bigint not null check (gl_line_count >= 0),
  source_fingerprint text not null,
  s08_review_id uuid not null references public.s08_frozen_reviews(id) on delete restrict,
  status text not null default 'DRAFT' check (status in ('DRAFT','APPROVED','REJECTED')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  approval_request_id text,
  reason text not null check (length(btrim(reason)) between 3 and 1000),
  constraint owner_funds_cutover_approval_shape check (
    status <> 'APPROVED'
    or (approved_by is not null and approved_at is not null and approved_by <> created_by and approval_request_id is not null)
  )
);

alter table public.owner_funds_event_cutovers enable row level security;
drop policy if exists owner_funds_event_cutovers_company_read on public.owner_funds_event_cutovers;
create policy owner_funds_event_cutovers_company_read on public.owner_funds_event_cutovers
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (public.is_admin_or_manager() or public.is_accountant())
  );
revoke all on table public.owner_funds_event_cutovers from public, anon, authenticated;
grant select on table public.owner_funds_event_cutovers to authenticated;

create or replace function public.guard_owner_funds_cutover_immutable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'OWNER_FUNDS_CUTOVER_DELETE_BLOCKED' using errcode='42501';
  end if;
  if old.status = 'APPROVED' then
    raise exception 'OWNER_FUNDS_CUTOVER_APPROVED_IMMUTABLE' using errcode='42501';
  end if;
  if old.company_id is distinct from new.company_id
     or old.cutover_date is distinct from new.cutover_date
     or old.opening_balance is distinct from new.opening_balance
     or old.gl_line_count is distinct from new.gl_line_count
     or old.source_fingerprint is distinct from new.source_fingerprint
     or old.s08_review_id is distinct from new.s08_review_id
     or old.created_by is distinct from new.created_by
     or old.created_at is distinct from new.created_at
     or old.reason is distinct from new.reason then
    raise exception 'OWNER_FUNDS_CUTOVER_IMMUTABLE_FIELDS' using errcode='42501';
  end if;
  if old.status <> 'DRAFT' or new.status not in ('DRAFT','APPROVED','REJECTED') then
    raise exception 'OWNER_FUNDS_CUTOVER_STATUS_INVALID' using errcode='42501';
  end if;
  return new;
end;
$function$;

alter function public.guard_owner_funds_cutover_immutable() owner to postgres;
revoke all on function public.guard_owner_funds_cutover_immutable() from public, anon, authenticated;
drop trigger if exists trg_owner_funds_cutover_immutable on public.owner_funds_event_cutovers;
create trigger trg_owner_funds_cutover_immutable
before update or delete on public.owner_funds_event_cutovers
for each row execute function public.guard_owner_funds_cutover_immutable();

create or replace function public.create_owner_funds_cutover_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid := public.require_company_id();
  v_cutover_date date := nullif(p_payload->>'cutover_date','')::date;
  v_review_id uuid := nullif(p_payload->>'s08_review_id','')::uuid;
  v_reason text := nullif(btrim(coalesce(p_payload->>'reason','')), '');
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_balance numeric;
  v_count bigint;
  v_fingerprint text;
  v_existing jsonb;
  v_result jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'OWNER_FUNDS_CUTOVER_ROLE_REQUIRED' using errcode='42501';
  end if;
  if p_payload ? 'company_id' then
    raise exception 'OWNER_FUNDS_CUTOVER_COMPANY_SERVER_DERIVED' using errcode='22023';
  end if;
  if v_cutover_date is null or v_review_id is null or v_reason is null or v_request_id is null then
    raise exception 'OWNER_FUNDS_CUTOVER_INPUT_REQUIRED' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.s08_frozen_reviews r
     where r.id = v_review_id and r.company_id = v_company_id and r.reviewer_decision = 'APPROVED'
  ) then
    raise exception 'OWNER_FUNDS_CUTOVER_S08_APPROVAL_REQUIRED' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('owner_funds_cutover:' || v_company_id::text, 0));
  select public.wp05_gl_balance(v_company_id, '2000', v_cutover_date),
         public.wp05_gl_line_count(v_company_id, '2000', v_cutover_date)
    into v_balance, v_count;
  v_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'company_id', v_company_id,
    'cutover_date', v_cutover_date,
    'opening_balance', public.wp05_round_omr(v_balance),
    'gl_line_count', v_count,
    's08_review_id', v_review_id
  )::text, 'UTF8')), 'hex');

  select jsonb_build_object(
    'company_id', company_id, 'cutover_date', cutover_date,
    'opening_balance', opening_balance, 'status', status,
    'source_fingerprint', source_fingerprint
  ) into v_existing
  from public.owner_funds_event_cutovers
  where company_id = v_company_id
  for update;
  if v_existing is not null then
    return jsonb_build_object('success', true, 'idempotent', true, 'cutover', v_existing);
  end if;

  insert into public.owner_funds_event_cutovers (
    company_id, cutover_date, opening_balance, gl_line_count, source_fingerprint,
    s08_review_id, status, created_by, reason
  ) values (
    v_company_id, v_cutover_date, public.wp05_round_omr(v_balance), v_count, v_fingerprint,
    v_review_id, 'DRAFT', v_actor, v_reason
  );

  v_result := jsonb_build_object(
    'success', true, 'idempotent', false, 'company_id', v_company_id,
    'cutover_date', v_cutover_date, 'opening_balance', public.wp05_round_omr(v_balance),
    'source_fingerprint', v_fingerprint, 'status', 'DRAFT', 'request_id', v_request_id
  );
  insert into public.financial_operation_idempotency(operation_name, request_id, response_payload)
  values ('create_owner_funds_cutover:' || v_company_id::text, v_request_id, v_result)
  on conflict do nothing;
  return v_result;
end;
$function$;

create or replace function public.approve_owner_funds_cutover_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid := public.require_company_id();
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_cutover public.owner_funds_event_cutovers%rowtype;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'OWNER_FUNDS_CUTOVER_APPROVER_ROLE_REQUIRED' using errcode='42501';
  end if;
  if v_request_id is null then
    raise exception 'OWNER_FUNDS_CUTOVER_APPROVAL_REQUEST_REQUIRED' using errcode='22023';
  end if;
  select * into v_cutover from public.owner_funds_event_cutovers
   where company_id = v_company_id for update;
  if not found then
    raise exception 'OWNER_FUNDS_CUTOVER_NOT_FOUND' using errcode='P0002';
  end if;
  if v_cutover.status = 'APPROVED' then
    if v_cutover.approval_request_id <> v_request_id then
      raise exception 'OWNER_FUNDS_CUTOVER_ALREADY_APPROVED' using errcode='22023';
    end if;
    return jsonb_build_object('success', true, 'idempotent', true, 'status', 'APPROVED');
  end if;
  if v_cutover.status <> 'DRAFT' or v_cutover.created_by = v_actor then
    raise exception 'OWNER_FUNDS_CUTOVER_MAKER_CHECKER_REQUIRED' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.s08_frozen_reviews r
     where r.id = v_cutover.s08_review_id and r.company_id = v_company_id and r.reviewer_decision = 'APPROVED'
  ) then
    raise exception 'OWNER_FUNDS_CUTOVER_S08_APPROVAL_REQUIRED' using errcode='42501';
  end if;
  update public.owner_funds_event_cutovers
     set status = 'APPROVED', approved_by = v_actor, approved_at = now(), approval_request_id = v_request_id
   where company_id = v_company_id;
  return jsonb_build_object('success', true, 'idempotent', false, 'status', 'APPROVED');
end;
$function$;

create or replace function public.assert_owner_funds_event_cutover(
  p_company_id uuid,
  p_effective_date date,
  p_current_batch_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_cutover public.owner_funds_event_cutovers%rowtype;
begin
  if p_company_id is null or p_effective_date is null then
    raise exception 'OWNER_FUNDS_CUTOVER_INPUT_REQUIRED' using errcode='22023';
  end if;
  select * into v_cutover from public.owner_funds_event_cutovers where company_id = p_company_id;
  if found and v_cutover.status = 'APPROVED' then
    if p_effective_date <= v_cutover.cutover_date then
      raise exception 'OWNER_FUNDS_EVENT_PRE_CUTOVER_REVIEW_REQUIRED' using errcode='23514';
    end if;
    return;
  end if;

  -- A clean/new company has no pre-existing 2000 source batch and may begin
  -- with a zero opening position. A company with historical 2000 history must
  -- freeze and approve an S08-backed baseline before its first RC1 event.
  if exists (
    select 1
      from public.journal_lines jl
      join public.accounts a on a.id = jl.account_id and a.company_id = p_company_id
      join public.journal_batches jb on jb.id = jl.batch_id and jb.company_id = p_company_id
     where jl.company_id = p_company_id
       and a.no = '2000'
       and jl.batch_id is distinct from p_current_batch_id
       and not exists (
         select 1 from public.owner_funds_events e
          where e.company_id = p_company_id and e.journal_batch_id = jl.batch_id
       )
  ) then
    raise exception 'OWNER_FUNDS_CUTOVER_REVIEW_REQUIRED: historical 2000 position requires an approved S08-backed cutover baseline before RC1 owner-funds events.'
      using errcode='23514';
  end if;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Versioned management-fee tax treatment.
-- ---------------------------------------------------------------------------
create table if not exists public.company_fee_tax_treatments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  fee_kind text not null check (fee_kind in ('RATE_MANAGEMENT_FEE','FIXED_MONTHLY')),
  version_no integer not null,
  -- Fee treatment is event-specific. It intentionally does not reuse the
  -- single rent profile because RATE/FIXED service tax may differ from rent.
  tax_code text not null references public.tax_code_catalog(code),
  tax_rate numeric(6,3) not null check(tax_rate >= 0 and tax_rate <= 100),
  effective_from date not null,
  effective_to date,
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','SUPERSEDED','VOID')),
  created_by uuid not null,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_fee_tax_treatments_version_uq unique(company_id, fee_kind, version_no),
  constraint company_fee_tax_treatments_date_chk check(effective_to is null or effective_to >= effective_from),
  constraint company_fee_tax_treatments_approval_chk check(status <> 'ACTIVE' or (approved_by is not null and approved_at is not null and approved_by <> created_by))
);
create index if not exists company_fee_tax_treatments_resolution_idx
  on public.company_fee_tax_treatments(company_id, fee_kind, status, effective_from desc);
alter table public.company_fee_tax_treatments enable row level security;
drop policy if exists company_fee_tax_treatments_company_read on public.company_fee_tax_treatments;
create policy company_fee_tax_treatments_company_read on public.company_fee_tax_treatments
  for select to authenticated
  using (company_id = public.current_company_id() and (public.is_admin_or_manager() or public.is_accountant()));
revoke all on table public.company_fee_tax_treatments from public, anon, authenticated;
grant select on table public.company_fee_tax_treatments to authenticated;

create table if not exists public.management_fee_tax_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  receipt_id uuid not null references public.receipts(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  fee_kind text not null check (fee_kind = 'RATE_MANAGEMENT_FEE'),
  treatment_id uuid not null references public.company_fee_tax_treatments(id) on delete restrict,
  tax_profile_id uuid references public.company_tax_profiles(id) on delete restrict,
  tax_code text not null,
  tax_rate numeric(6,3) not null,
  net_amount numeric(18,3) not null check(net_amount >= 0 and net_amount = round(net_amount,3)),
  tax_amount numeric(18,3) not null check(tax_amount >= 0 and tax_amount = round(tax_amount,3)),
  effective_date date not null,
  journal_batch_id uuid references public.journal_batches(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint management_fee_tax_snapshot_receipt_uq unique(receipt_id, invoice_id)
);
alter table public.management_fee_tax_snapshots enable row level security;
drop policy if exists management_fee_tax_snapshots_company_read on public.management_fee_tax_snapshots;
create policy management_fee_tax_snapshots_company_read on public.management_fee_tax_snapshots
  for select to authenticated
  using (company_id = public.current_company_id() and (public.is_admin_or_manager() or public.is_accountant()));
revoke all on table public.management_fee_tax_snapshots from public, anon, authenticated;
grant select on table public.management_fee_tax_snapshots to authenticated;

create or replace function public.guard_fee_tax_rows_immutable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if tg_table_name = 'management_fee_tax_snapshots' and tg_op in ('UPDATE','DELETE') then
    raise exception 'MANAGEMENT_FEE_TAX_SNAPSHOT_IMMUTABLE' using errcode='42501';
  end if;
  if tg_table_name = 'company_fee_tax_treatments' and tg_op = 'DELETE' then
    raise exception 'FEE_TAX_TREATMENT_DELETE_BLOCKED' using errcode='42501';
  end if;
  return new;
end;
$function$;
alter function public.guard_fee_tax_rows_immutable() owner to postgres;
revoke all on function public.guard_fee_tax_rows_immutable() from public, anon, authenticated;
drop trigger if exists trg_management_fee_tax_snapshot_immutable on public.management_fee_tax_snapshots;
create trigger trg_management_fee_tax_snapshot_immutable before update or delete on public.management_fee_tax_snapshots
for each row execute function public.guard_fee_tax_rows_immutable();
drop trigger if exists trg_company_fee_tax_treatment_delete_guard on public.company_fee_tax_treatments;
create trigger trg_company_fee_tax_treatment_delete_guard before delete on public.company_fee_tax_treatments
for each row execute function public.guard_fee_tax_rows_immutable();

create or replace function public.resolve_active_fee_tax_treatment(
  p_company_id uuid,
  p_fee_kind text,
  p_effective_date date
)
returns table(treatment_id uuid, tax_profile_id uuid, tax_code text, tax_rate numeric, effective_from date, effective_to date)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if p_company_id is null or p_fee_kind not in ('RATE_MANAGEMENT_FEE','FIXED_MONTHLY') or p_effective_date is null then
    raise exception 'FEE_TAX_TREATMENT_RESOLVE_INPUT_REQUIRED' using errcode='22023';
  end if;
  return query
  select t.id, null::uuid, t.tax_code, t.tax_rate, t.effective_from, t.effective_to
    from public.company_fee_tax_treatments t
   where t.company_id = p_company_id
     and t.fee_kind = p_fee_kind
     and t.status = 'ACTIVE'
     and t.effective_from <= p_effective_date
     and (t.effective_to is null or p_effective_date <= t.effective_to)
   order by t.effective_from desc, t.version_no desc
   limit 1;
  if not found then
    raise exception 'FEE_TAX_TREATMENT_MISSING: no active fee tax treatment covers % for company %, fee kind %.', p_effective_date, p_company_id, p_fee_kind
      using errcode='P0001';
  end if;
end;
$function$;

create or replace function public.create_fee_tax_treatment_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid := public.require_company_id();
  v_kind text := nullif(btrim(p_payload->>'fee_kind'),'');
  v_tax_code text := nullif(btrim(p_payload->>'tax_code'),'');
  v_tax_rate numeric := nullif(p_payload->>'tax_rate','')::numeric;
  v_from date := nullif(p_payload->>'effective_from','')::date;
  v_to date := nullif(p_payload->>'effective_to','')::date;
  v_request_id text := nullif(btrim(p_payload->>'request_id'),'');
  v_version integer;
  v_id uuid := gen_random_uuid();
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'FEE_TAX_TREATMENT_ROLE_REQUIRED' using errcode='42501';
  end if;
  if p_payload ? 'company_id' or v_kind not in ('RATE_MANAGEMENT_FEE','FIXED_MONTHLY') or v_tax_code is null or v_tax_rate is null or v_tax_rate < 0 or v_tax_rate > 100 or v_from is null or v_request_id is null or (v_to is not null and v_to < v_from) then
    raise exception 'FEE_TAX_TREATMENT_INPUT_REQUIRED' using errcode='22023';
  end if;
  if not exists(select 1 from public.tax_code_catalog c where c.code=v_tax_code and c.is_active) then
    raise exception 'FEE_TAX_TREATMENT_CODE_FORBIDDEN' using errcode='42501';
  end if;
  select coalesce(max(version_no),0)+1 into v_version from public.company_fee_tax_treatments where company_id=v_company_id and fee_kind=v_kind;
  insert into public.company_fee_tax_treatments(id,company_id,fee_kind,version_no,tax_code,tax_rate,effective_from,effective_to,status,created_by)
  values(v_id,v_company_id,v_kind,v_version,v_tax_code,v_tax_rate,v_from,v_to,'DRAFT',v_actor);
  return jsonb_build_object('success',true,'treatment_id',v_id,'status','DRAFT','request_id',v_request_id);
end;
$function$;

create or replace function public.approve_fee_tax_treatment_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid := public.require_company_id();
  v_id uuid := nullif(p_payload->>'treatment_id','')::uuid;
  v_request_id text := nullif(btrim(p_payload->>'request_id'),'');
  v_t public.company_fee_tax_treatments%rowtype;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'FEE_TAX_TREATMENT_APPROVER_ROLE_REQUIRED' using errcode='42501';
  end if;
  if v_id is null or v_request_id is null then raise exception 'FEE_TAX_TREATMENT_APPROVAL_INPUT_REQUIRED' using errcode='22023'; end if;
  select * into v_t from public.company_fee_tax_treatments where id=v_id and company_id=v_company_id for update;
  if not found then raise exception 'FEE_TAX_TREATMENT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  if v_t.status='ACTIVE' then return jsonb_build_object('success',true,'idempotent',true,'treatment_id',v_id,'status','ACTIVE'); end if;
  if v_t.status <> 'DRAFT' or v_t.created_by=v_actor then raise exception 'FEE_TAX_TREATMENT_MAKER_CHECKER_REQUIRED' using errcode='42501'; end if;
  update public.company_fee_tax_treatments
     set status='SUPERSEDED', updated_at=now(), effective_to=least(coalesce(effective_to, v_t.effective_from - 1), v_t.effective_from - 1)
   where company_id=v_company_id and fee_kind=v_t.fee_kind and status='ACTIVE'
     and effective_from < v_t.effective_from;
  update public.company_fee_tax_treatments set status='ACTIVE',approved_by=v_actor,approved_at=now(),updated_at=now() where id=v_id;
  return jsonb_build_object('success',true,'idempotent',false,'treatment_id',v_id,'status','ACTIVE');
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Fixed-monthly rows can now retain a versioned fee tax snapshot. Historical
-- rows retain their old status and are never rewritten.
-- ---------------------------------------------------------------------------
alter table public.fixed_monthly_daily_accruals
  add column if not exists fee_tax_treatment_id uuid references public.company_fee_tax_treatments(id) on delete restrict,
  add column if not exists fee_tax_profile_id uuid references public.company_tax_profiles(id) on delete restrict,
  add column if not exists fee_tax_code text,
  add column if not exists fee_tax_rate numeric(6,3);
alter table public.fixed_monthly_daily_accruals drop constraint if exists fixed_monthly_daily_accruals_tax_amount_check;
alter table public.fixed_monthly_daily_accruals add constraint fixed_monthly_daily_accruals_tax_amount_check check(tax_amount >= 0 and tax_amount = round(tax_amount,3));
alter table public.fixed_monthly_daily_accruals drop constraint if exists fixed_monthly_daily_accruals_tax_authority_status_check;
alter table public.fixed_monthly_daily_accruals add constraint fixed_monthly_daily_accruals_tax_authority_status_check check(tax_authority_status in ('OUT_OF_SCOPE_NO_VERSIONED_AUTHORITY','VERSIONED_FEE_TREATMENT'));

create or replace function public.guard_owner_funds_event_cutover()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform public.assert_owner_funds_event_cutover(new.company_id, new.effective_date, new.journal_batch_id);
  return new;
end;
$function$;
alter function public.guard_owner_funds_event_cutover() owner to postgres;
revoke all on function public.guard_owner_funds_event_cutover() from public, anon, authenticated;
drop trigger if exists trg_owner_funds_event_cutover on public.owner_funds_events;
create trigger trg_owner_funds_event_cutover
before insert on public.owner_funds_events
for each row execute function public.guard_owner_funds_event_cutover();

-- Function redefinitions that consume the new cutover and fee-tax authority
-- follow in this same forward migration.

create or replace function public.reverse_invoice_credit_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_credit_id uuid;
  v_reason text;
  v_request_id text;
  v_credit public.invoice_credits%rowtype;
  v_invoice public.invoices%rowtype;
  v_reversal_result jsonb;
  v_result jsonb;
  v_existing jsonb;
  v_period_id uuid;
  v_owner_id uuid;
  v_fingerprint text;
  v_cached_fingerprint text;
  v_cached_target text;
begin
  if v_actor is null then
    raise exception 'Authentication is required to reverse invoice credits.' using errcode='42501';
  end if;
  if not coalesce(public.is_admin_or_manager(), false) and not coalesce(public.is_accountant(), false) then
    raise exception 'CREDIT_REVERSAL_ROLE_REQUIRED: ADMIN, MANAGER or ACCOUNTANT role is required.' using errcode='42501';
  end if;
  v_company_id := public.require_company_id();
  v_credit_id := nullif(p_payload->>'credit_id', '')::uuid;
  v_reason := nullif(btrim(coalesce(p_payload->>'reason', '')), '');
  v_request_id := nullif(p_payload->>'request_id', '');
  if v_credit_id is null or v_reason is null or v_request_id is null then
    raise exception 'CREDIT_REVERSAL_REQUIRED: credit_id, reason and request_id are required.' using errcode='22023';
  end if;
  v_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'credit_id', v_credit_id::text,
    'reason', v_reason
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtextextended('invoice_credit_reversal:' || v_company_id::text || ':' || v_request_id, 0));

  select response_payload into v_existing
    from public.financial_operation_idempotency
   where operation_name = 'invoice_credit_reversal:' || v_company_id::text
     and request_id = v_request_id
   for update;
  if v_existing is not null then
    v_cached_fingerprint := v_existing->>'_fingerprint';
    v_cached_target := v_existing->>'_target';
    if v_cached_fingerprint is null or v_cached_target is null or not (v_existing ? 'response') then
      raise exception 'CREDIT_REVERSAL_IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED' using errcode='22023';
    end if;
    if v_cached_fingerprint <> v_fingerprint or v_cached_target <> v_credit_id::text then
      raise exception 'CREDIT_REVERSAL_IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode='22023';
    end if;
    return v_existing->'response';
  end if;

  select * into v_credit
    from public.invoice_credits
   where id = v_credit_id
     and company_id = v_company_id
   for update;
  if not found then
    raise exception 'CREDIT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;
  if v_credit.status <> 'POSTED' then
    raise exception 'CREDIT_ALREADY_REVERSED: only POSTED credits can be reversed.' using errcode='22023';
  end if;

  select * into v_invoice
    from public.invoices
   where id = v_credit.invoice_id
     and company_id = v_company_id
   for update;
  if not found then
    raise exception 'CREDIT_INVOICE_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;
  if v_invoice.credited_amount < v_credit.amount then
    raise exception 'CREDIT_REVERSAL_BALANCE_INVALID: credited balance is less than the credit amount.' using errcode='22023';
  end if;

  select oa.owner_id into v_owner_id
    from public.owner_agreement_versions av
    join public.owner_agreements oa
      on oa.id = av.owner_agreement_id
     and oa.company_id = av.company_id
   where av.id = v_invoice.invoice_agreement_version_id
     and av.company_id = v_company_id;

  perform public.gl_ensure_initial_open_period(v_company_id, coalesce(v_credit.effective_date, current_date));
  select period_id into v_period_id
    from public.gl_resolve_accounting_period(v_company_id, coalesce(v_credit.effective_date, current_date));
  if v_period_id is null then
    raise exception 'CREDIT_REVERSAL_ACCOUNTING_PERIOD_UNAVAILABLE' using errcode='P0001';
  end if;

  if v_credit.journal_batch_id is not null then
    v_reversal_result := public.reverse_journal_batch(v_credit.journal_batch_id);
  else
    v_reversal_result := jsonb_build_object('reversal_batch_id', null);
  end if;

  update public.invoices
     set credited_amount = public.gl_pm_round_omr(credited_amount - v_credit.amount),
         updated_at = now()
   where id = v_credit.invoice_id
     and company_id = v_company_id;
  perform public.recalculate_invoice_status(v_credit.invoice_id);

  update public.invoice_credits
     set status = 'REVERSED',
         reversal_request_id = v_request_id,
         reversal_journal_batch_id = nullif(v_reversal_result->>'reversal_batch_id', '')::uuid,
         reversal_reason = v_reason,
         reversed_by = v_actor,
         reversed_at = now()
   where id = v_credit_id;

  if v_credit.accounting_classification = 'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS' then
    if v_owner_id is null then
      raise exception 'CREDIT_REVERSAL_OWNER_FUNDS_OWNER_REQUIRED' using errcode='23514';
    end if;
    insert into public.owner_funds_events (
      company_id, owner_id, contract_id, invoice_id, source_type, source_id,
      event_id, amount_delta, effective_date, journal_batch_id
    ) values (
      v_company_id, v_owner_id, v_invoice.contract_id, v_invoice.id,
      'INVOICE_CREDIT_REVERSAL', v_credit_id::text, v_request_id,
      v_credit.net_amount, v_credit.effective_date,
      nullif(v_reversal_result->>'reversal_batch_id', '')::uuid
    );
  end if;

  v_result := jsonb_build_object(
    'success', true,
    'credit_id', v_credit_id::text,
    'reversal_request_id', v_request_id,
    'reversal_batch_id', v_reversal_result->>'reversal_batch_id'
  );

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values (
    'invoice_credit_reversal:' || v_company_id::text,
    v_request_id,
    jsonb_build_object('_fingerprint', v_fingerprint, '_target', v_credit_id::text, 'response', v_result)
  );

  return v_result;
end;
$function$;

create or replace function public.rpt_rc1_owner_agency_invoice_mapping_diagnostics(
  p_from date default null,
  p_to date default null
)
returns table (
  company_id uuid,
  invoice_id uuid,
  contract_id text,
  issue_date date,
  collection_role text,
  invoice_accounting_classification text,
  source_batch_id uuid,
  source_type text,
  source_account_numbers text[],
  affected_reason text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid := public.require_company_id();
begin
  if auth.uid() is null
     or not (coalesce(public.is_admin_or_manager(), false) or coalesce(public.is_accountant(), false)) then
    raise exception 'RC1_INVOICE_DIAGNOSTIC_ROLE_REQUIRED' using errcode = '42501';
  end if;

  return query
  select
    i.company_id,
    i.id,
    i.contract_id::text,
    i.issue_date,
    c.collection_role_snapshot,
    i.invoice_accounting_classification,
    b.id,
    b.source_type,
    coalesce(array_agg(distinct a.no order by a.no) filter (where a.no is not null), '{}'::text[]),
    case
      when bool_or(a.no = '4000') then 'OWNER_AGENCY_RENT_CREDITED_TO_4000_REVIEW_REQUIRED'
      when c.operating_model_snapshot is null then 'PRE_RC1_OWNER_AGENCY_SNAPSHOT_MISSING_REVIEW_REQUIRED'
      when i.invoice_accounting_classification is null then 'PRE_RC1_INVOICE_LINEAGE_UNCLASSIFIED_REVIEW_REQUIRED'
      else 'NO_RC1_MAPPING_ANOMALY'
    end
  from public.invoices i
  join public.contracts c
    on c.id = i.contract_id
   and c.company_id = i.company_id
  left join public.owner_agreements oa
    on oa.id = c.agreement_id
   and oa.company_id = c.company_id
  left join lateral (
    select jb.*
      from public.journal_batches jb
     where jb.company_id = i.company_id
       and jb.source_type = 'invoice'
       and jb.source_id = i.id::text
     order by jb.created_at asc, jb.id
     limit 1
  ) b on true
  left join public.journal_lines jl
    on jl.batch_id = b.id
   and jl.company_id = i.company_id
  left join public.accounts a
    on a.id = jl.account_id
   and a.company_id = i.company_id
  where i.company_id = v_company_id
    and (
      c.operating_model_snapshot = 'OWNER_AGENCY'
      or (c.operating_model_snapshot is null and oa.agreement_type = 'property_management')
    )
    and (p_from is null or i.issue_date >= p_from)
    and (p_to is null or i.issue_date <= p_to)
    and (
      i.invoice_accounting_classification is null
      or exists (
        select 1
          from public.journal_lines xjl
          join public.accounts xa on xa.id = xjl.account_id and xa.company_id = i.company_id
         where xjl.batch_id = b.id
           and xjl.company_id = i.company_id
           and xa.no = '4000'
      )
    )
  group by i.company_id, i.id, i.contract_id, i.issue_date,
           c.collection_role_snapshot, c.operating_model_snapshot, i.invoice_accounting_classification,
           b.id, b.source_type
  order by i.issue_date, i.id;
end;
$function$;

create or replace function public.reverse_invoice_credit_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_credit_id uuid;
  v_reason text;
  v_request_id text;
  v_credit public.invoice_credits%rowtype;
  v_invoice public.invoices%rowtype;
  v_reversal_result jsonb;
  v_result jsonb;
  v_existing jsonb;
  v_period_id uuid;
  v_owner_id uuid;
  v_fingerprint text;
  v_cached_fingerprint text;
  v_cached_target text;
begin
  if v_actor is null then
    raise exception 'Authentication is required to reverse invoice credits.' using errcode='42501';
  end if;
  if not coalesce(public.is_admin_or_manager(), false) and not coalesce(public.is_accountant(), false) then
    raise exception 'CREDIT_REVERSAL_ROLE_REQUIRED: ADMIN, MANAGER or ACCOUNTANT role is required.' using errcode='42501';
  end if;
  v_company_id := public.require_company_id();
  v_credit_id := nullif(p_payload->>'credit_id', '')::uuid;
  v_reason := nullif(btrim(coalesce(p_payload->>'reason', '')), '');
  v_request_id := nullif(p_payload->>'request_id', '');
  if v_credit_id is null or v_reason is null or v_request_id is null then
    raise exception 'CREDIT_REVERSAL_REQUIRED: credit_id, reason and request_id are required.' using errcode='22023';
  end if;
  v_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'credit_id', v_credit_id::text,
    'reason', v_reason
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtextextended('invoice_credit_reversal:' || v_company_id::text || ':' || v_request_id, 0));

  select response_payload into v_existing
    from public.financial_operation_idempotency
   where operation_name = 'invoice_credit_reversal:' || v_company_id::text
     and request_id = v_request_id
   for update;
  if v_existing is not null then
    v_cached_fingerprint := v_existing->>'_fingerprint';
    v_cached_target := v_existing->>'_target';
    if v_cached_fingerprint is null or v_cached_target is null or not (v_existing ? 'response') then
      raise exception 'CREDIT_REVERSAL_IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED' using errcode='22023';
    end if;
    if v_cached_fingerprint <> v_fingerprint or v_cached_target <> v_credit_id::text then
      raise exception 'CREDIT_REVERSAL_IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode='22023';
    end if;
    return v_existing->'response';
  end if;

  select * into v_credit
    from public.invoice_credits
   where id = v_credit_id
     and company_id = v_company_id
   for update;
  if not found then
    raise exception 'CREDIT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;
  if v_credit.status <> 'POSTED' then
    raise exception 'CREDIT_ALREADY_REVERSED: only POSTED credits can be reversed.' using errcode='22023';
  end if;

  select * into v_invoice
    from public.invoices
   where id = v_credit.invoice_id
     and company_id = v_company_id
   for update;
  if not found then
    raise exception 'CREDIT_INVOICE_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;
  if v_invoice.credited_amount < v_credit.amount then
    raise exception 'CREDIT_REVERSAL_BALANCE_INVALID: credited balance is less than the credit amount.' using errcode='22023';
  end if;

  select oa.owner_id into v_owner_id
    from public.owner_agreement_versions av
    join public.owner_agreements oa
      on oa.id = av.owner_agreement_id
     and oa.company_id = av.company_id
   where av.id = v_invoice.invoice_agreement_version_id
     and av.company_id = v_company_id;

  perform public.gl_ensure_initial_open_period(v_company_id, coalesce(v_credit.effective_date, current_date));
  select period_id into v_period_id
    from public.gl_resolve_accounting_period(v_company_id, coalesce(v_credit.effective_date, current_date));
  if v_period_id is null then
    raise exception 'CREDIT_REVERSAL_ACCOUNTING_PERIOD_UNAVAILABLE' using errcode='P0001';
  end if;

  if v_credit.journal_batch_id is not null then
    v_reversal_result := public.reverse_journal_batch(v_credit.journal_batch_id);
  else
    v_reversal_result := jsonb_build_object('reversal_batch_id', null);
  end if;

  update public.invoices
     set credited_amount = public.gl_pm_round_omr(credited_amount - v_credit.amount),
         updated_at = now()
   where id = v_credit.invoice_id
     and company_id = v_company_id;
  perform public.recalculate_invoice_status(v_credit.invoice_id);

  update public.invoice_credits
     set status = 'REVERSED',
         reversal_request_id = v_request_id,
         reversal_journal_batch_id = nullif(v_reversal_result->>'reversal_batch_id', '')::uuid,
         reversal_reason = v_reason,
         reversed_by = v_actor,
         reversed_at = now()
   where id = v_credit_id;

  if v_credit.accounting_classification = 'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS' then
    if v_owner_id is null then
      raise exception 'CREDIT_REVERSAL_OWNER_FUNDS_OWNER_REQUIRED' using errcode='23514';
    end if;
    insert into public.owner_funds_events (
      company_id, owner_id, contract_id, invoice_id, source_type, source_id,
      event_id, amount_delta, effective_date, journal_batch_id
    ) values (
      v_company_id, v_owner_id, v_invoice.contract_id, v_invoice.id,
      'INVOICE_CREDIT_REVERSAL', v_credit_id::text, v_request_id,
      v_credit.net_amount, v_credit.effective_date,
      nullif(v_reversal_result->>'reversal_batch_id', '')::uuid
    );
  end if;

  v_result := jsonb_build_object(
    'success', true,
    'credit_id', v_credit_id::text,
    'reversal_request_id', v_request_id,
    'reversal_batch_id', v_reversal_result->>'reversal_batch_id'
  );

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values (
    'invoice_credit_reversal:' || v_company_id::text,
    v_request_id,
    jsonb_build_object('_fingerprint', v_fingerprint, '_target', v_credit_id::text, 'response', v_result)
  );

  return v_result;
end;
$function$;

create or replace function public.rpt_rc1_owner_agency_invoice_mapping_diagnostics(
  p_from date default null,
  p_to date default null
)
returns table (
  company_id uuid,
  invoice_id uuid,
  contract_id text,
  issue_date date,
  collection_role text,
  invoice_accounting_classification text,
  source_batch_id uuid,
  source_type text,
  source_account_numbers text[],
  affected_reason text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid := public.require_company_id();
begin
  if auth.uid() is null
     or not (coalesce(public.is_admin_or_manager(), false) or coalesce(public.is_accountant(), false)) then
    raise exception 'RC1_INVOICE_DIAGNOSTIC_ROLE_REQUIRED' using errcode = '42501';
  end if;

  return query
  select
    i.company_id,
    i.id,
    i.contract_id::text,
    i.issue_date,
    c.collection_role_snapshot,
    i.invoice_accounting_classification,
    b.id,
    b.source_type,
    coalesce(array_agg(distinct a.no order by a.no) filter (where a.no is not null), '{}'::text[]),
    case
      when bool_or(a.no = '4000') then 'OWNER_AGENCY_RENT_CREDITED_TO_4000_REVIEW_REQUIRED'
      when c.operating_model_snapshot is null then 'PRE_RC1_OWNER_AGENCY_SNAPSHOT_MISSING_REVIEW_REQUIRED'
      when i.invoice_accounting_classification is null then 'PRE_RC1_INVOICE_LINEAGE_UNCLASSIFIED_REVIEW_REQUIRED'
      else 'NO_RC1_MAPPING_ANOMALY'
    end
  from public.invoices i
  join public.contracts c
    on c.id = i.contract_id
   and c.company_id = i.company_id
  left join public.owner_agreements oa
    on oa.id = c.agreement_id
   and oa.company_id = c.company_id
  left join lateral (
    select jb.*
      from public.journal_batches jb
     where jb.company_id = i.company_id
       and jb.source_type = 'invoice'
       and jb.source_id = i.id::text
     order by jb.created_at asc, jb.id
     limit 1
  ) b on true
  left join public.journal_lines jl
    on jl.batch_id = b.id
   and jl.company_id = i.company_id
  left join public.accounts a
    on a.id = jl.account_id
   and a.company_id = i.company_id
  where i.company_id = v_company_id
    and (
      c.operating_model_snapshot = 'OWNER_AGENCY'
      or (c.operating_model_snapshot is null and oa.agreement_type = 'property_management')
    )
    and (p_from is null or i.issue_date >= p_from)
    and (p_to is null or i.issue_date <= p_to)
    and (
      i.invoice_accounting_classification is null
      or exists (
        select 1
          from public.journal_lines xjl
          join public.accounts xa on xa.id = xjl.account_id and xa.company_id = i.company_id
         where xjl.batch_id = b.id
           and xjl.company_id = i.company_id
           and xa.no = '4000'
      )
    )
  group by i.company_id, i.id, i.contract_id, i.issue_date,
           c.collection_role_snapshot, c.operating_model_snapshot, i.invoice_accounting_classification,
           b.id, b.source_type
  order by i.issue_date, i.id;
end;
$function$;

create or replace function public.record_invoice_payment_atomic(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_invoice_id uuid;
  v_amount numeric;
  v_method text;
  v_date date;
  v_reference text;
  v_request_id text;
  v_invoice public.invoices%rowtype;
  v_contract public.contracts%rowtype;
  v_agreement_version public.owner_agreement_versions%rowtype;
  v_total_due numeric;
  v_paid_amount numeric;
  v_credited_amount numeric;
  v_outstanding numeric;
  v_receipt_id uuid := gen_random_uuid();
  v_allocation_id uuid := gen_random_uuid();
  v_cash_account_no text;
  v_cash_account_id text;
  v_receivable_account_id text;
  v_owner_payable_account_id text;
  v_fee_revenue_account_id text;
  v_vat_account_id text;
  v_internal_payload jsonb;
  v_internal_result jsonb;
  v_existing_result jsonb;
  v_result jsonb;
  v_company_id uuid;
  v_request_fingerprint text;
  v_cached_fingerprint text;
  v_cached_target_id text;
  v_operating_model text;
  v_collection_role text;
  v_commission_type text;
  v_commission_value numeric;
  v_commission_net numeric := 0;
  v_journal_entries jsonb;
  v_is_owner_creditor boolean := false;
  v_taxable boolean := false;
  v_prior_receipt_tax numeric := 0;
  v_prior_credit_tax numeric := 0;
  v_prior_credit_unclassified integer := 0;
  v_remaining_tax numeric := 0;
  v_collection_tax numeric := 0;
  v_collection_net numeric;
  v_tax_snapshot public.taxable_line_tax_snapshots%rowtype;
  v_tax_allocation_receipt_id uuid;
  v_actual_receipt_id uuid;
  v_owner_funds_batch_id uuid;
  v_owner_id uuid;
  v_fee_treatment_id uuid;
  v_fee_tax_profile_id uuid;
  v_fee_tax_code text;
  v_fee_tax_rate numeric := 0;
  v_fee_tax numeric := 0;
  v_fee_gross numeric := 0;
  v_historical_4000 boolean := false;
begin
  if v_actor is null then
    raise exception 'Authentication is required to record invoice payments' using errcode='42501';
  end if;
  if not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'ADMIN or MANAGER role is required to record invoice payments' using errcode='42501';
  end if;

  v_company_id := public.require_company_id();
  if payload ?| array['company_id','account_id','cash_account_id','journal_entries','tax_rate','tax_code','tax_amount'] then
    raise exception 'PAYMENT_SERVER_OWNED_ACCOUNTING_FIELDS_FORBIDDEN' using errcode='22023';
  end if;

  v_request_id := nullif(btrim(coalesce(payload->>'request_id', '')), '');
  v_invoice_id := nullif(payload->>'invoice_id', '')::uuid;
  v_amount := public.gl_pm_round_omr(coalesce((payload->>'amount')::numeric, 0));
  v_method := lower(coalesce(nullif(payload->>'method', ''), nullif(payload->>'channel', ''), nullif(payload->>'payment_method', ''), 'cash'));
  v_date := coalesce(nullif(payload->>'date', '')::date, current_date);
  v_reference := nullif(payload->>'reference', '');

  if v_request_id is null or v_invoice_id is null then
    raise exception 'PAYMENT_REQUEST_AND_INVOICE_REQUIRED' using errcode='22023';
  end if;
  if v_amount <= 0 then
    raise exception 'PAYMENT_AMOUNT_MUST_BE_POSITIVE' using errcode='22023';
  end if;

  case v_method
    when 'cash' then v_cash_account_no := '1111';
    when 'bank_transfer', 'bank' then v_cash_account_no := '1120';
    else
      raise exception 'PAYMENT_METHOD_ACCOUNTING_UNAVAILABLE: RC1 supports only cash or bank_transfer until a controlled clearing-account policy is approved.'
        using errcode='22023';
  end case;

  v_request_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'invoice_id', v_invoice_id::text,
    'amount', trim_scale(v_amount),
    'method', v_method,
    'date', nullif(payload->>'date', '')::date,
    'reference', v_reference
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(
    hashtextextended('record_invoice_payment_atomic:' || v_company_id::text || ':' || v_request_id, 0)
  );

  select response_payload into v_existing_result
    from public.financial_operation_idempotency
   where operation_name = 'record_invoice_payment_atomic:' || v_company_id::text
     and request_id = v_request_id
   for update;
  if v_existing_result is not null then
    v_cached_fingerprint := v_existing_result->>'_request_fingerprint';
    v_cached_target_id := v_existing_result->>'_target_id';
    if v_cached_fingerprint is null
       or v_cached_target_id is null
       or not (v_existing_result ? 'response') then
      raise exception 'IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED' using errcode='22023';
    end if;
    if v_cached_fingerprint <> v_request_fingerprint
       or v_cached_target_id <> v_invoice_id::text then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode='22023';
    end if;
    return v_existing_result->'response';
  end if;

  select * into v_invoice
    from public.invoices
   where id = v_invoice_id
     and company_id = v_company_id
     and deleted_at is null
   for update;
  if not found then
    raise exception 'PAYMENT_INVOICE_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;
  if v_invoice.document_status <> 'POSTED' then
    raise exception 'PAYMENT_INVOICE_NOT_POSTED' using errcode='22023';
  end if;

  select * into v_contract
    from public.contracts
   where id = v_invoice.contract_id
     and company_id = v_company_id
     and deleted_at is null
   for update;
  if not found then
    raise exception 'PAYMENT_CONTRACT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;

  -- RC1 accepts only a fully classified immutable owner-agency invoice.
  -- Historical/null/other models are not guessed into 1201: review the source
  -- under S08 and use a governed correction where approved.
  if v_invoice.invoice_accounting_classification not in (
       'OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL',
       'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS'
     )
     or v_invoice.invoice_operating_model is distinct from 'OWNER_AGENCY'
     or v_invoice.invoice_collection_role not in ('OWNER_IS_CREDITOR','OFFICE_IS_CREDITOR')
     or v_invoice.invoice_agreement_version_id is null then
    raise exception 'HISTORICAL_INVOICE_ACCOUNTING_REVIEW_REQUIRED: payment requires immutable RC1 owner-agency accounting lineage.'
      using errcode='23514';
  end if;

  select * into v_agreement_version
    from public.owner_agreement_versions av
   where av.id = v_invoice.invoice_agreement_version_id
     and av.company_id = v_company_id;
  if not found then
    raise exception 'OWNER_AGENCY_COLLECTION_TERMS_MISSING' using errcode='23514';
  end if;

  select oa.owner_id into v_owner_id
    from public.owner_agreements oa
   where oa.id = v_agreement_version.owner_agreement_id
     and oa.company_id = v_company_id;
  if v_owner_id is null
     or v_invoice.invoice_operating_model is distinct from v_contract.operating_model_snapshot
     or v_invoice.invoice_collection_role is distinct from v_contract.collection_role_snapshot then
    raise exception 'PAYMENT_INVOICE_CONTRACT_LINEAGE_MISMATCH' using errcode='23514';
  end if;

  v_operating_model := v_invoice.invoice_operating_model;
  v_collection_role := v_invoice.invoice_collection_role;
  v_commission_type := v_agreement_version.commission_type;
  v_commission_value := v_agreement_version.commission_value;

  v_total_due := public.gl_pm_round_omr(v_invoice.amount + coalesce(v_invoice.tax_amount, 0));
  v_paid_amount := coalesce(v_invoice.paid_amount, 0);
  v_credited_amount := coalesce(v_invoice.credited_amount, 0);
  v_outstanding := public.gl_pm_round_omr(v_total_due - v_paid_amount - v_credited_amount);
  if v_amount > v_outstanding + 0.001 then
    raise exception 'PAYMENT_EXCEEDS_OUTSTANDING: payment % exceeds invoice outstanding % after credits.', v_amount, v_outstanding
      using errcode='22023';
  end if;

  -- Tax allocation is based on the invoice's immutable snapshot and active
  -- prior credit/payment components; no current profile is consulted here.
  if v_invoice.tax_treatment = 'TAXABLE' then
    select * into v_tax_snapshot
      from public.taxable_line_tax_snapshots s
     where s.id = v_invoice.tax_snapshot_id
       and s.company_id = v_company_id
       and s.source_type = 'invoice'
       and s.source_id = v_invoice.id::text;
    if not found
       or v_invoice.tax_profile_id is null
       or v_tax_snapshot.tax_code is distinct from v_invoice.tax_code
       or v_tax_snapshot.tax_rate is distinct from v_invoice.tax_rate
       or v_tax_snapshot.tax_amount is distinct from v_invoice.tax_amount then
      raise exception 'PAYMENT_TAX_LINEAGE_MISSING' using errcode='23514';
    end if;
    v_taxable := true;

    select coalesce(sum(pta.tax_amount), 0)
      into v_prior_receipt_tax
      from public.invoice_payment_tax_allocations pta
      join public.receipts r on r.id = pta.receipt_id and r.company_id = v_company_id
     where pta.company_id = v_company_id
       and pta.invoice_id = v_invoice.id
       and upper(coalesce(r.status,'')) <> 'VOID'
       and r.deleted_at is null;

    select
      coalesce(sum(ic.tax_amount) filter (where ic.status = 'POSTED'), 0),
      count(*) filter (where ic.status = 'POSTED' and ic.tax_amount is null)
    into v_prior_credit_tax, v_prior_credit_unclassified
    from public.invoice_credits ic
    where ic.company_id = v_company_id
      and ic.invoice_id = v_invoice.id;

    if v_prior_credit_unclassified > 0 then
      raise exception 'PAYMENT_EXISTING_CREDIT_TAX_LINEAGE_REVIEW_REQUIRED' using errcode='23514';
    end if;
    if v_paid_amount > 0 and v_prior_receipt_tax = 0 and v_invoice.tax_amount > 0 then
      raise exception 'PAYMENT_HISTORICAL_TAX_ALLOCATION_REVIEW_REQUIRED: prior taxable collections have no immutable component lineage.'
        using errcode='23514';
    end if;

    v_remaining_tax := public.gl_pm_round_omr(v_invoice.tax_amount - v_prior_credit_tax - v_prior_receipt_tax);
    if v_remaining_tax < -0.001 then
      raise exception 'PAYMENT_TAX_LINEAGE_BALANCE_INVALID' using errcode='23514';
    end if;
    if v_amount >= v_outstanding - 0.001 then
      v_collection_tax := greatest(v_remaining_tax, 0);
    elsif v_outstanding > 0 then
      v_collection_tax := public.gl_pm_round_omr(v_amount * greatest(v_remaining_tax, 0) / v_outstanding);
    end if;
  elsif v_invoice.tax_treatment = 'NON_TAXABLE' then
    if coalesce(v_invoice.tax_amount, 0) <> 0 then
      raise exception 'PAYMENT_NON_TAXABLE_INVOICE_TAX_INVALID' using errcode='23514';
    end if;
  elsif coalesce(v_invoice.tax_amount, 0) > 0 then
    raise exception 'PAYMENT_LEGACY_TAX_LINEAGE_REVIEW_REQUIRED' using errcode='23514';
  end if;

  v_collection_net := public.gl_pm_round_omr(v_amount - v_collection_tax);
  v_is_owner_creditor := v_operating_model = 'OWNER_AGENCY' and v_collection_role = 'OWNER_IS_CREDITOR';

  if v_commission_type = 'RATE' then
    if v_commission_value is null or v_commission_value < 0 or v_commission_value > 100 then
      raise exception 'OWNER_AGENCY_RATE_TERMS_INVALID' using errcode='23514';
    end if;
    v_commission_net := public.gl_pm_round_omr(v_collection_net * v_commission_value / 100);
    if v_commission_net > 0 then
      select treatment_id, tax_profile_id, tax_code, tax_rate
        into v_fee_treatment_id, v_fee_tax_profile_id, v_fee_tax_code, v_fee_tax_rate
        from public.resolve_active_fee_tax_treatment(v_company_id, 'RATE_MANAGEMENT_FEE', v_date);
      v_fee_tax := public.compute_tax_amount(v_commission_net, v_fee_tax_rate);
      v_fee_gross := public.gl_pm_round_omr(v_commission_net + v_fee_tax);
    end if;
  end if;

  v_cash_account_id := public.require_company_account_id(v_company_id, v_cash_account_no);
  v_receivable_account_id := public.require_company_account_id(v_company_id, '1201');
  v_owner_payable_account_id := public.require_company_account_id(v_company_id, '2000');
  if v_collection_tax > 0 or v_fee_tax > 0 then
    v_vat_account_id := public.require_company_account_id(v_company_id, '2100');
  end if;
  if v_commission_net > 0 then
    v_fee_revenue_account_id := public.require_company_account_id(v_company_id, '4100');
  end if;

  v_journal_entries := jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'no', 'PAY-' || left(replace(v_request_id, '-', ''), 12) || '-D',
      'date', v_date::text,
      'account_id', v_cash_account_id,
      'amount', v_amount,
      'type', 'DEBIT',
      'source_id', v_receipt_id,
      'entity_type', 'contract',
      'entity_id', v_invoice.contract_id,
      'created_at', timezone('utc', now())
    )
  );

  if v_is_owner_creditor then
    v_journal_entries := v_journal_entries || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'PAY-' || left(replace(v_request_id, '-', ''), 12) || '-C-OFP',
        'date', v_date::text,
        'account_id', v_owner_payable_account_id,
        'amount', v_collection_net,
        'type', 'CREDIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice.contract_id,
        'created_at', timezone('utc', now())
      )
    );
    if v_collection_tax > 0 then
      v_journal_entries := v_journal_entries || jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid(),
          'no', 'PAY-' || left(replace(v_request_id, '-', ''), 12) || '-C-VAT',
          'date', v_date::text,
          'account_id', v_vat_account_id,
          'amount', v_collection_tax,
          'type', 'CREDIT',
          'source_id', v_receipt_id,
          'entity_type', 'contract',
          'entity_id', v_invoice.contract_id,
          'created_at', timezone('utc', now())
        )
      );
    end if;
  else
    v_journal_entries := v_journal_entries || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'PAY-' || left(replace(v_request_id, '-', ''), 12) || '-C-AR',
        'date', v_date::text,
        'account_id', v_receivable_account_id,
        'amount', v_amount,
        'type', 'CREDIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice.contract_id,
        'created_at', timezone('utc', now())
      )
    );
  end if;

  if v_commission_net > 0 then
    v_journal_entries := v_journal_entries || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'FEE-' || left(replace(v_request_id, '-', ''), 12) || '-D',
        'date', v_date::text,
        'account_id', v_owner_payable_account_id,
        'amount', v_fee_gross,
        'type', 'DEBIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice.contract_id,
        'created_at', timezone('utc', now())
      ),
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'FEE-' || left(replace(v_request_id, '-', ''), 12) || '-C',
        'date', v_date::text,
        'account_id', v_fee_revenue_account_id,
        'amount', v_commission_net,
        'type', 'CREDIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice.contract_id,
        'created_at', timezone('utc', now())
      )
    );
    if v_fee_tax > 0 then
      v_journal_entries := v_journal_entries || jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid(),
          'no', 'FEE-' || left(replace(v_request_id, '-', ''), 12) || '-C-VAT',
          'date', v_date::text,
          'account_id', v_vat_account_id,
          'amount', v_fee_tax,
          'type', 'CREDIT',
          'source_id', v_receipt_id,
          'entity_type', 'contract',
          'entity_id', v_invoice.contract_id,
          'created_at', timezone('utc', now())
        )
      );
    end if;
  end if;

  v_internal_payload := jsonb_build_object(
    'request_id', v_request_id,
    'receipt', jsonb_build_object(
      'id', v_receipt_id,
      'contract_id', v_invoice.contract_id,
      'date_time', v_date::text,
      'channel', v_method,
      'amount', v_amount,
      'ref', coalesce(v_reference, v_request_id),
      'notes', 'Invoice payment ' || v_invoice_id::text,
      'status', 'POSTED',
      'created_at', timezone('utc', now()),
      'request_id', v_request_id
    ),
    'allocations', jsonb_build_array(jsonb_build_object(
      'id', v_allocation_id,
      'invoice_id', v_invoice_id,
      'amount', v_amount,
      'created_at', timezone('utc', now())
    )),
    'journal_entries', v_journal_entries
  );

  v_internal_result := public.post_receipt_atomic(v_internal_payload);
  v_actual_receipt_id := coalesce(nullif(v_internal_result->>'receipt_id','')::uuid, v_receipt_id);
  select jb.id into v_owner_funds_batch_id
    from public.journal_batches jb
   where jb.company_id = v_company_id
     and jb.source_type = 'receipt'
     and jb.source_id = v_actual_receipt_id::text
   order by jb.created_at, jb.id
   limit 1;

  if v_taxable then
    v_tax_allocation_receipt_id := v_actual_receipt_id;
    insert into public.invoice_payment_tax_allocations (
      company_id, receipt_id, invoice_id, tax_snapshot_id, net_amount, tax_amount
    ) values (
      v_company_id, v_tax_allocation_receipt_id, v_invoice_id,
      v_invoice.tax_snapshot_id, v_collection_net, v_collection_tax
    );
  end if;

  if v_commission_net > 0 then
    insert into public.management_fee_tax_snapshots (
      company_id, receipt_id, invoice_id, fee_kind, treatment_id, tax_profile_id,
      tax_code, tax_rate, net_amount, tax_amount, effective_date, journal_batch_id
    ) values (
      v_company_id, v_actual_receipt_id, v_invoice_id, 'RATE_MANAGEMENT_FEE',
      v_fee_treatment_id, v_fee_tax_profile_id, v_fee_tax_code, v_fee_tax_rate,
      v_commission_net, v_fee_tax, v_date, v_owner_funds_batch_id
    );
  end if;

  if v_is_owner_creditor then
    insert into public.owner_funds_events (
      company_id, owner_id, contract_id, invoice_id, source_type, source_id,
      event_id, amount_delta, effective_date, journal_batch_id
    ) values (
      v_company_id, v_owner_id, v_invoice.contract_id, v_invoice_id,
      'OWNER_COLLECTION', v_actual_receipt_id::text, 'collection',
      v_collection_net, v_date, v_owner_funds_batch_id
    );
  end if;

  if v_commission_net > 0 then
    insert into public.owner_funds_events (
      company_id, owner_id, contract_id, invoice_id, source_type, source_id,
      event_id, amount_delta, effective_date, journal_batch_id
    ) values (
      v_company_id, v_owner_id, v_invoice.contract_id, v_invoice_id,
      'MANAGEMENT_FEE', v_actual_receipt_id::text, 'fee',
      -v_fee_gross, v_date, v_owner_funds_batch_id
    );
  end if;

  v_result := v_internal_result || jsonb_build_object(
    'status', 'recorded',
    'request_id', v_request_id,
    'invoice_id', v_invoice_id,
    'receipt_id', coalesce(nullif(v_internal_result->>'receipt_id', '')::uuid, v_receipt_id),
    'accounting_model', coalesce(v_operating_model, 'STANDARD'),
    'collection_role', v_collection_role,
    'cash_account_no', v_cash_account_no,
    'collection_net', v_collection_net,
    'collection_tax', v_collection_tax,
    'management_fee_net', v_commission_net,
    'management_fee_tax', v_fee_tax,
    'management_fee_gross', v_fee_gross
  );

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values (
    'record_invoice_payment_atomic:' || v_company_id::text,
    v_request_id,
    jsonb_build_object(
      '_request_fingerprint', v_request_fingerprint,
      '_target_id', v_invoice_id::text,
      'response', v_result
    )
  ) on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$;

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
  v_fee_treatment_id uuid;
  v_fee_tax_profile_id uuid;
  v_fee_tax_code text;
  v_fee_tax_rate numeric := 0;
  v_accrual_id uuid;
  v_due_from_owner_id text;
  v_revenue_id text;
  v_vat_id text;
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
  if v_net > 0 then
    select treatment_id, tax_profile_id, tax_code, tax_rate
      into v_fee_treatment_id, v_fee_tax_profile_id, v_fee_tax_code, v_fee_tax_rate
      from public.resolve_active_fee_tax_treatment(p_company_id, 'FIXED_MONTHLY', p_economic_date);
    v_tax := public.compute_tax_amount(v_net, v_fee_tax_rate);
  end if;
  v_gross := public.gl_pm_round_omr(v_net + v_tax);

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
    'fee_tax_treatment_id', v_fee_treatment_id,
    'fee_tax_profile_id', v_fee_tax_profile_id,
    'fee_tax_code', v_fee_tax_code,
    'fee_tax_rate', v_fee_tax_rate,
    'tax_authority_status', 'VERSIONED_FEE_TREATMENT'
  )::text, 'UTF8')), 'hex');

  select * into v_existing
  from public.fixed_monthly_daily_accruals a
  where a.company_id = p_company_id
    and a.agreement_version_id = p_agreement_version_id
    and a.accrual_date = p_economic_date;

  if found then
    if v_existing.source_fingerprint <> v_fingerprint
       or v_existing.net_amount <> v_net
       or v_existing.tax_amount <> v_tax
       or v_existing.gross_amount <> v_gross
       or v_existing.fee_tax_treatment_id is distinct from v_fee_treatment_id
       or v_existing.fee_tax_profile_id is distinct from v_fee_tax_profile_id
       or v_existing.fee_tax_rate is distinct from v_fee_tax_rate then
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
    if v_tax > 0 then
      v_vat_id := public.gl_pm_require_account(p_company_id, '2100');
    end if;

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
      ) || case when v_tax > 0 then jsonb_build_array(
        jsonb_build_object(
          'account_id', v_vat_id,
          'debit', 0,
          'credit', v_tax,
          'line_description', 'Daily management fee VAT',
          'ref_source_id', v_accrual_id::text,
          'ref_entity_type', 'fixed_monthly_daily_accrual',
          'ref_entity_id', v_accrual_id::text
        )
      ) else '[]'::jsonb end
    ));
    v_batch_id := (v_post_result->>'batch_id')::uuid;
  end if;

  insert into public.fixed_monthly_daily_accruals (
    id, company_id, owner_agreement_id, agreement_version_id, owner_id, property_id,
    accrual_date, agreement_starts_on, agreement_ends_on,
    version_effective_from, version_effective_to,
    monthly_contract_amount, monthly_amount_omr, calendar_days, calendar_day,
    rounding_rule, net_amount, tax_amount, gross_amount, tax_authority_status,
    fee_tax_treatment_id, fee_tax_profile_id, fee_tax_code, fee_tax_rate,
    journal_batch_id, source_fingerprint, executed_by
  ) values (
    v_accrual_id, p_company_id, v_owner_agreement_id, p_agreement_version_id, v_owner_id, v_property_id,
    p_economic_date, v_agreement_start, v_agreement_end,
    v_version_start, v_version_end,
    v_monthly_contract, v_monthly_omr, v_calendar_days, v_calendar_day,
    'EARLIEST_DAYS_PLUS_ONE_BAISA', v_net, v_tax, v_gross,
    case when v_net > 0 then 'VERSIONED_FEE_TREATMENT' else 'VERSIONED_FEE_TREATMENT' end,
    v_fee_treatment_id, v_fee_tax_profile_id, v_fee_tax_code, v_fee_tax_rate,
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


alter function public.reverse_invoice_credit_atomic(jsonb) owner to postgres;
revoke all on function public.reverse_invoice_credit_atomic(jsonb) from public, anon;
grant execute on function public.reverse_invoice_credit_atomic(jsonb) to authenticated, service_role;
alter function public.rpt_rc1_owner_agency_invoice_mapping_diagnostics(date,date) owner to postgres;
revoke all on function public.rpt_rc1_owner_agency_invoice_mapping_diagnostics(date,date) from public, anon;
grant execute on function public.rpt_rc1_owner_agency_invoice_mapping_diagnostics(date,date) to authenticated, service_role;
alter function public.record_invoice_payment_atomic(jsonb) owner to postgres;
revoke all on function public.record_invoice_payment_atomic(jsonb) from public, anon;
grant execute on function public.record_invoice_payment_atomic(jsonb) to authenticated, service_role;
alter function public.gl_accrue_fixed_monthly_day(uuid,uuid,date,uuid) owner to postgres;
revoke all on function public.gl_accrue_fixed_monthly_day(uuid,uuid,date,uuid) from public, anon, authenticated;
grant execute on function public.gl_accrue_fixed_monthly_day(uuid,uuid,date,uuid) to service_role;

comment on function public.record_invoice_payment_atomic(jsonb) is
  'RC1 owner-agency payment authority. Requires immutable classified owner-agency invoice lineage; derives cash/bank, original rent tax and explicit versioned management-fee tax treatment.';
comment on function public.reverse_invoice_credit_atomic(jsonb) is
  'RC1 credit reversal with target-bound payload fingerprint idempotency; reused request ids cannot replay another credit.';
comment on function public.assert_owner_funds_event_cutover(uuid,date,uuid) is
  'Fails closed for a company with historical 2000 GL sources until an S08-approved immutable opening cutover is approved.';
comment on function public.resolve_active_fee_tax_treatment(uuid,text,date) is
  'Versioned management-fee tax authority. Raises FEE_TAX_TREATMENT_MISSING instead of assuming zero VAT.';


-- Reconcile 2000 against an approved opening baseline plus only post-cutover
-- append-only events. Without a cutover, only a clean/new event ledger is used;
-- any historical 2000 source is blocked at event insertion instead of hidden.
create or replace function public.wp05_subledger_owner_payables(
  p_company_id uuid,
  p_as_of date default current_date
)
returns table (balance numeric, cnt bigint)
language plpgsql
stable
set search_path = public, pg_temp
as $function$
declare
  v_cutover public.owner_funds_event_cutovers%rowtype;
  v_bal numeric := 0;
  v_cnt bigint := 0;
begin
  if p_company_id is null then
    raise exception 'WP05_SUBLEDGER_OWNER_REQUIRED: company_id required' using errcode='22023';
  end if;

  select * into v_cutover
    from public.owner_funds_event_cutovers
   where company_id = p_company_id and status = 'APPROVED';

  if found then
    if p_as_of < v_cutover.cutover_date then
      raise exception 'OWNER_FUNDS_PRE_CUTOVER_REPORT_REVIEW_REQUIRED: pre-cutover 2000 reporting remains governed historical review.' using errcode='23514';
    end if;
    select
      public.wp05_round_omr(v_cutover.opening_balance + coalesce(sum(e.amount_delta), 0)),
      count(*) filter (where abs(e.amount_delta) > 0.0005)::bigint
    into v_bal, v_cnt
    from public.owner_funds_events e
    where e.company_id = p_company_id
      and e.effective_date > v_cutover.cutover_date
      and e.effective_date <= p_as_of;
    return query select coalesce(v_bal,0)::numeric, coalesce(v_cnt,0)::bigint;
    return;
  end if;

  if exists (select 1 from public.owner_funds_events e where e.company_id = p_company_id) then
    select public.wp05_round_omr(coalesce(sum(e.amount_delta),0)),
           count(*) filter (where abs(e.amount_delta) > 0.0005)::bigint
      into v_bal, v_cnt
      from public.owner_funds_events e
     where e.company_id = p_company_id and e.effective_date <= p_as_of;
    return query select coalesce(v_bal,0)::numeric, coalesce(v_cnt,0)::bigint;
    return;
  end if;

  if to_regclass('public.owner_balances') is not null then
    select public.wp05_round_omr(coalesce(sum(case when ob.net_balance > 0 then ob.net_balance else 0 end),0)),
           count(*) filter (where ob.net_balance > 0.0005)::bigint
      into v_bal, v_cnt
      from public.owner_balances ob
     where ob.company_id = p_company_id;
  end if;
  return query select coalesce(v_bal,0)::numeric, coalesce(v_cnt,0)::bigint;
end;
$function$;

comment on function public.wp05_subledger_owner_payables(uuid,date) is
  'RC1 2000 subledger: approved S08-backed opening balance plus post-cutover owner_funds_events; no implicit owner_balances/events blend.';


alter function public.create_owner_funds_cutover_atomic(jsonb) owner to postgres;
revoke all on function public.create_owner_funds_cutover_atomic(jsonb) from public, anon;
grant execute on function public.create_owner_funds_cutover_atomic(jsonb) to authenticated, service_role;
alter function public.approve_owner_funds_cutover_atomic(jsonb) owner to postgres;
revoke all on function public.approve_owner_funds_cutover_atomic(jsonb) from public, anon;
grant execute on function public.approve_owner_funds_cutover_atomic(jsonb) to authenticated, service_role;
alter function public.assert_owner_funds_event_cutover(uuid,date,uuid) owner to postgres;
revoke all on function public.assert_owner_funds_event_cutover(uuid,date,uuid) from public, anon, authenticated;
grant execute on function public.assert_owner_funds_event_cutover(uuid,date,uuid) to service_role;
alter function public.create_fee_tax_treatment_atomic(jsonb) owner to postgres;
revoke all on function public.create_fee_tax_treatment_atomic(jsonb) from public, anon;
grant execute on function public.create_fee_tax_treatment_atomic(jsonb) to authenticated, service_role;
alter function public.approve_fee_tax_treatment_atomic(jsonb) owner to postgres;
revoke all on function public.approve_fee_tax_treatment_atomic(jsonb) from public, anon;
grant execute on function public.approve_fee_tax_treatment_atomic(jsonb) to authenticated, service_role;
alter function public.resolve_active_fee_tax_treatment(uuid,text,date) owner to postgres;
revoke all on function public.resolve_active_fee_tax_treatment(uuid,text,date) from public, anon, authenticated;
grant execute on function public.resolve_active_fee_tax_treatment(uuid,text,date) to service_role;

commit;

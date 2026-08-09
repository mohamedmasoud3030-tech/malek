-- =============================================================================
-- Stage S06 — Master lease measurement, lifecycle and canonical GL posting
-- ADR-0010: master_lease = PRINCIPAL, OMR precision = 0.001.
-- Browser roles are read-only. Financial mutations are service-role RPCs that
-- derive journal lines server-side and call the canonical S03 GL engine.
-- No historical financial row is rewritten or deleted.
-- Rollback: supabase/rollback/20260809020000_rollback_s06_master_lease_gl_lifecycle.sql
-- =============================================================================

begin;

-- Supporting S06 accounts already referenced by the merged S06 kernel.
create or replace function public.gl_ml_provision_supporting_accounts(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_created integer := 0;
  v_rows integer := 0;
begin
  if p_company_id is null or not exists (select 1 from public.companies where id=p_company_id) then
    raise exception 'GL_ML_COMPANY_REQUIRED' using errcode='22023';
  end if;

  insert into public.accounts(id,no,name,company_id,account_type,normal_balance,currency_code,precision,is_active,created_at,updated_at)
  values ('coa:'||p_company_id::text||':1650','1650','Accumulated ROU Depreciation',p_company_id,'asset','credit','OMR',3,true,now(),now())
  on conflict (company_id,no) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.accounts(id,no,name,company_id,account_type,normal_balance,currency_code,precision,is_active,created_at,updated_at)
  values ('coa:'||p_company_id::text||':4400','4400','Lease Modification / Termination Gain',p_company_id,'revenue','credit','OMR',3,true,now(),now())
  on conflict (company_id,no) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.accounts(id,no,name,company_id,account_type,normal_balance,currency_code,precision,is_active,created_at,updated_at)
  values ('coa:'||p_company_id::text||':6400','6400','Lease Modification / Termination Loss',p_company_id,'expense','debit','OMR',3,true,now(),now())
  on conflict (company_id,no) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  if exists (
    select 1 from public.accounts a
    where a.company_id=p_company_id and (
      (a.no='1650' and (a.account_type<>'asset' or a.normal_balance<>'credit' or a.currency_code<>'OMR' or a.precision<>3 or not a.is_active)) or
      (a.no='4400' and (a.account_type<>'revenue' or a.normal_balance<>'credit' or a.currency_code<>'OMR' or a.precision<>3 or not a.is_active)) or
      (a.no='6400' and (a.account_type<>'expense' or a.normal_balance<>'debit' or a.currency_code<>'OMR' or a.precision<>3 or not a.is_active))
    )
  ) then
    raise exception 'GL_ML_ACCOUNT_CONTRACT_MISMATCH' using errcode='22023';
  end if;
  return jsonb_build_object('company_id',p_company_id,'created',v_created);
end;
$fn$;
alter function public.gl_ml_provision_supporting_accounts(uuid) owner to postgres;
revoke all on function public.gl_ml_provision_supporting_accounts(uuid) from public,anon,authenticated;
grant execute on function public.gl_ml_provision_supporting_accounts(uuid) to service_role;

select public.gl_ml_provision_supporting_accounts(id) from public.companies;

create table if not exists public.master_lease_measurements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  owner_agreement_id uuid not null references public.owner_agreements(id) on delete restrict,
  version_no integer not null check(version_no>0),
  measurement_type text not null check(measurement_type in ('INITIAL','REMEASUREMENT','PARTIAL_TERMINATION','FULL_TERMINATION')),
  status text not null default 'DRAFT' check(status in ('DRAFT','ACTIVE','SUPERSEDED','TERMINATED')),
  supersedes_measurement_id uuid references public.master_lease_measurements(id) on delete restrict,
  effective_date date not null,
  periods_per_year integer not null check(periods_per_year in (1,2,3,4,6,12)),
  periods_count integer not null check(periods_count>=0),
  annual_discount_rate_bps numeric(12,4) not null check(annual_discount_rate_bps>=0),
  periodic_rate numeric(20,12) not null check(periodic_rate>=0),
  short_term_exempt boolean not null default false,
  initial_direct_costs numeric(18,3) not null default 0 check(initial_direct_costs>=0),
  lease_incentives numeric(18,3) not null default 0 check(lease_incentives>=0),
  prepayments numeric(18,3) not null default 0 check(prepayments>=0),
  initial_liability numeric(18,3) not null default 0 check(initial_liability>=0),
  initial_rou_asset numeric(18,3) not null default 0 check(initial_rou_asset>=0),
  carrying_liability_before numeric(18,3),
  carrying_rou_before numeric(18,3),
  liability_delta numeric(18,3) not null default 0,
  rou_adjustment numeric(18,3) not null default 0,
  termination_gain_loss numeric(18,3) not null default 0,
  scope_reduction_bps integer not null default 0 check(scope_reduction_bps between 0 and 10000),
  request_id text not null,
  input_fingerprint text not null,
  input_payload jsonb not null,
  posted_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique(owner_agreement_id,version_no),
  unique(company_id,request_id),
  check(
    (measurement_type='INITIAL' and supersedes_measurement_id is null and scope_reduction_bps=0) or
    (measurement_type='REMEASUREMENT' and supersedes_measurement_id is not null and scope_reduction_bps=0) or
    (measurement_type='PARTIAL_TERMINATION' and supersedes_measurement_id is not null and scope_reduction_bps between 1 and 9999) or
    (measurement_type='FULL_TERMINATION' and supersedes_measurement_id is not null and scope_reduction_bps=10000)
  )
);
create unique index if not exists master_lease_measurements_id_company_uidx on public.master_lease_measurements(id,company_id);
create unique index if not exists master_lease_measurements_one_active_uidx on public.master_lease_measurements(owner_agreement_id) where status='ACTIVE';
create unique index if not exists master_lease_measurements_one_draft_uidx on public.master_lease_measurements(owner_agreement_id) where status='DRAFT';
create index if not exists master_lease_measurements_company_idx on public.master_lease_measurements(company_id,owner_agreement_id,version_no desc);

create table if not exists public.master_lease_schedule_rows (
  id uuid primary key default gen_random_uuid(),
  measurement_id uuid not null,
  company_id uuid not null,
  period_no integer not null check(period_no>0),
  due_date date not null,
  opening_liability numeric(18,3) not null check(opening_liability>=0),
  interest_amount numeric(18,3) not null check(interest_amount>=0),
  payment_amount numeric(18,3) not null check(payment_amount>=0),
  principal_amount numeric(18,3) not null,
  closing_liability numeric(18,3) not null check(closing_liability>=0),
  rou_depreciation numeric(18,3) not null check(rou_depreciation>=0),
  closing_rou_asset numeric(18,3) not null check(closing_rou_asset>=0),
  posted_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(measurement_id,company_id) references public.master_lease_measurements(id,company_id) on delete restrict,
  unique(measurement_id,period_no)
);
create index if not exists master_lease_schedule_company_due_idx on public.master_lease_schedule_rows(company_id,due_date);

create or replace function public.guard_master_lease_measurement_parent()
returns trigger language plpgsql set search_path=public,pg_temp as $fn$
begin
  if not exists(select 1 from public.owner_agreements oa where oa.id=new.owner_agreement_id and oa.company_id=new.company_id and oa.agreement_type='master_lease') then
    raise exception 'MASTER_LEASE_PARENT_SCOPE_INVALID' using errcode='23503';
  end if;
  return new;
end;$fn$;

drop trigger if exists guard_master_lease_measurement_parent on public.master_lease_measurements;
create trigger guard_master_lease_measurement_parent before insert or update of company_id,owner_agreement_id on public.master_lease_measurements for each row execute function public.guard_master_lease_measurement_parent();

create or replace function public.guard_master_lease_measurement_immutable()
returns trigger language plpgsql set search_path=public,pg_temp as $fn$
begin
  if tg_op='DELETE' then raise exception 'MASTER_LEASE_MEASUREMENT_APPEND_ONLY' using errcode='42501'; end if;
  if new.company_id is distinct from old.company_id or new.owner_agreement_id is distinct from old.owner_agreement_id or new.version_no is distinct from old.version_no
     or new.measurement_type is distinct from old.measurement_type or new.supersedes_measurement_id is distinct from old.supersedes_measurement_id
     or new.effective_date is distinct from old.effective_date or new.periods_per_year is distinct from old.periods_per_year or new.periods_count is distinct from old.periods_count
     or new.annual_discount_rate_bps is distinct from old.annual_discount_rate_bps or new.periodic_rate is distinct from old.periodic_rate
     or new.short_term_exempt is distinct from old.short_term_exempt or new.initial_direct_costs is distinct from old.initial_direct_costs
     or new.lease_incentives is distinct from old.lease_incentives or new.prepayments is distinct from old.prepayments
     or new.initial_liability is distinct from old.initial_liability or new.initial_rou_asset is distinct from old.initial_rou_asset
     or new.carrying_liability_before is distinct from old.carrying_liability_before or new.carrying_rou_before is distinct from old.carrying_rou_before
     or new.liability_delta is distinct from old.liability_delta or new.rou_adjustment is distinct from old.rou_adjustment
     or new.termination_gain_loss is distinct from old.termination_gain_loss or new.scope_reduction_bps is distinct from old.scope_reduction_bps
     or new.request_id is distinct from old.request_id or new.input_fingerprint is distinct from old.input_fingerprint or new.input_payload is distinct from old.input_payload
     or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
    raise exception 'MASTER_LEASE_MEASUREMENT_FINANCIAL_FIELDS_IMMUTABLE' using errcode='42501';
  end if;
  return new;
end;$fn$;

drop trigger if exists guard_master_lease_measurement_immutable on public.master_lease_measurements;
create trigger guard_master_lease_measurement_immutable before update or delete on public.master_lease_measurements for each row execute function public.guard_master_lease_measurement_immutable();

create or replace function public.guard_master_lease_schedule_immutable()
returns trigger language plpgsql set search_path=public,pg_temp as $fn$
begin
  if tg_op='DELETE' then raise exception 'MASTER_LEASE_SCHEDULE_APPEND_ONLY' using errcode='42501'; end if;
  if new.measurement_id is distinct from old.measurement_id or new.company_id is distinct from old.company_id or new.period_no is distinct from old.period_no
     or new.due_date is distinct from old.due_date or new.opening_liability is distinct from old.opening_liability or new.interest_amount is distinct from old.interest_amount
     or new.payment_amount is distinct from old.payment_amount or new.principal_amount is distinct from old.principal_amount or new.closing_liability is distinct from old.closing_liability
     or new.rou_depreciation is distinct from old.rou_depreciation or new.closing_rou_asset is distinct from old.closing_rou_asset or new.created_at is distinct from old.created_at then
    raise exception 'MASTER_LEASE_SCHEDULE_FINANCIAL_FIELDS_IMMUTABLE' using errcode='42501';
  end if;
  return new;
end;$fn$;

drop trigger if exists guard_master_lease_schedule_immutable on public.master_lease_schedule_rows;
create trigger guard_master_lease_schedule_immutable before update or delete on public.master_lease_schedule_rows for each row execute function public.guard_master_lease_schedule_immutable();

alter function public.guard_master_lease_measurement_parent() owner to postgres;
alter function public.guard_master_lease_measurement_immutable() owner to postgres;
alter function public.guard_master_lease_schedule_immutable() owner to postgres;
revoke all on function public.guard_master_lease_measurement_parent() from public,anon,authenticated;
revoke all on function public.guard_master_lease_measurement_immutable() from public,anon,authenticated;
revoke all on function public.guard_master_lease_schedule_immutable() from public,anon,authenticated;

alter table public.master_lease_measurements enable row level security;
alter table public.master_lease_schedule_rows enable row level security;
drop policy if exists master_lease_measurements_company_read on public.master_lease_measurements;
create policy master_lease_measurements_company_read on public.master_lease_measurements for select to authenticated using(company_id=public.require_company_id());
drop policy if exists master_lease_schedule_company_read on public.master_lease_schedule_rows;
create policy master_lease_schedule_company_read on public.master_lease_schedule_rows for select to authenticated using(company_id=public.require_company_id());
revoke all on table public.master_lease_measurements from public,anon,authenticated,service_role;
revoke all on table public.master_lease_schedule_rows from public,anon,authenticated,service_role;
grant select on table public.master_lease_measurements to authenticated,service_role;
grant select on table public.master_lease_schedule_rows to authenticated,service_role;

-- Validate payment series and calculate the present value. Payment objects are
-- {period, amount}; amount is OMR and period is a positive unique integer.
create or replace function public.gl_ml_measure_payments(p_payments jsonb,p_annual_discount_rate_bps numeric,p_periods_per_year integer)
returns jsonb language plpgsql set search_path=public,pg_temp as $fn$
declare
  v_item jsonb; v_period integer; v_amount numeric; v_seen integer[]:='{}'::integer[];
  v_max integer:=0; v_rate numeric; v_pv numeric:=0; v_positive integer:=0;
begin
  if p_payments is null or jsonb_typeof(p_payments)<>'array' or jsonb_array_length(p_payments)=0 then raise exception 'GL_ML_PAYMENTS_REQUIRED' using errcode='22023'; end if;
  if p_periods_per_year not in (1,2,3,4,6,12) then raise exception 'GL_ML_PERIODS_PER_YEAR_INVALID' using errcode='22023'; end if;
  if p_annual_discount_rate_bps is null or p_annual_discount_rate_bps<0 or p_annual_discount_rate_bps::text in ('NaN','Infinity','-Infinity') then raise exception 'GL_ML_DISCOUNT_RATE_INVALID' using errcode='22023'; end if;
  v_rate:=p_annual_discount_rate_bps/10000/p_periods_per_year;
  for v_item in select value from jsonb_array_elements(p_payments) loop
    begin v_period:=nullif(v_item->>'period','')::integer; v_amount:=round(nullif(v_item->>'amount','')::numeric,3); exception when others then raise exception 'GL_ML_PAYMENT_INVALID' using errcode='22023'; end;
    if v_period is null or v_period<=0 or v_period=any(v_seen) then raise exception 'GL_ML_PAYMENT_PERIOD_INVALID_OR_DUPLICATE' using errcode='22023'; end if;
    if v_amount is null or v_amount<0 or v_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'GL_ML_PAYMENT_AMOUNT_INVALID' using errcode='22023'; end if;
    v_seen:=array_append(v_seen,v_period); v_max:=greatest(v_max,v_period); if v_amount>0 then v_positive:=v_positive+1; end if;
    v_pv:=v_pv+(v_amount/power(1+v_rate,v_period));
  end loop;
  if v_positive=0 then raise exception 'GL_ML_PAYMENTS_ALL_ZERO' using errcode='22023'; end if;
  return jsonb_build_object('initial_liability',round(v_pv,3),'max_period',v_max,'periodic_rate',v_rate);
end;$fn$;
alter function public.gl_ml_measure_payments(jsonb,numeric,integer) owner to postgres;
revoke all on function public.gl_ml_measure_payments(jsonb,numeric,integer) from public,anon,authenticated,service_role;

create or replace function public.gl_ml_insert_schedule_rows(p_measurement_id uuid,p_company_id uuid,p_effective_date date,p_payments jsonb,p_periods_per_year integer,p_periodic_rate numeric,p_initial_liability numeric,p_initial_rou numeric,p_short_term_exempt boolean)
returns integer language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_max integer; v_period integer; v_months integer:=12/p_periods_per_year;
  v_liability numeric:=round(p_initial_liability,3); v_rou numeric:=round(p_initial_rou,3);
  v_open numeric; v_interest numeric; v_payment numeric; v_principal numeric; v_close numeric; v_dep numeric; v_close_rou numeric; v_straight numeric;
begin
  select max((value->>'period')::integer) into v_max from jsonb_array_elements(p_payments);
  if v_max is null or v_max<=0 then raise exception 'GL_ML_SCHEDULE_PERIODS_REQUIRED' using errcode='22023'; end if;
  v_straight:=p_initial_rou/v_max;
  for v_period in 1..v_max loop
    select round((value->>'amount')::numeric,3) into v_payment from jsonb_array_elements(p_payments) where (value->>'period')::integer=v_period limit 1;
    v_payment:=coalesce(v_payment,0);
    if p_short_term_exempt then
      v_open:=0; v_interest:=0; v_principal:=v_payment; v_close:=0; v_dep:=0; v_close_rou:=0;
    else
      v_open:=v_liability; v_interest:=round(v_open*p_periodic_rate,3);
      if v_period=v_max then v_payment:=round(v_open+v_interest,3); end if;
      v_principal:=round(v_payment-v_interest,3); v_close:=round(v_open+v_interest-v_payment,3);
      if v_close<0 then raise exception 'GL_ML_PAYMENT_OVER_SETTLES' using errcode='22023'; end if;
      v_dep:=case when v_period=v_max then v_rou else least(v_rou,round(v_straight,3)) end;
      v_close_rou:=greatest(0,round(v_rou-v_dep,3));
    end if;
    insert into public.master_lease_schedule_rows(measurement_id,company_id,period_no,due_date,opening_liability,interest_amount,payment_amount,principal_amount,closing_liability,rou_depreciation,closing_rou_asset)
    values(p_measurement_id,p_company_id,v_period,(p_effective_date+make_interval(months=>v_months*v_period))::date,v_open,v_interest,v_payment,v_principal,v_close,v_dep,v_close_rou);
    if not p_short_term_exempt then v_liability:=v_close; v_rou:=v_close_rou; end if;
  end loop;
  return v_max;
end;$fn$;
alter function public.gl_ml_insert_schedule_rows(uuid,uuid,date,jsonb,integer,numeric,numeric,numeric,boolean) owner to postgres;
revoke all on function public.gl_ml_insert_schedule_rows(uuid,uuid,date,jsonb,integer,numeric,numeric,numeric,boolean) from public,anon,authenticated,service_role;

create or replace function public.gl_ml_create_initial_measurement(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_company uuid:=nullif(p_payload->>'company_id','')::uuid; v_agreement uuid:=nullif(p_payload->>'owner_agreement_id','')::uuid;
  v_request text:=nullif(p_payload->>'request_id',''); v_effective date:=nullif(p_payload->>'effective_date','')::date;
  v_ppy integer:=coalesce(nullif(p_payload->>'periods_per_year','')::integer,12); v_bps numeric:=coalesce(nullif(p_payload->>'annual_discount_rate_bps','')::numeric,0);
  v_direct numeric:=round(coalesce(nullif(p_payload->>'initial_direct_costs','')::numeric,0),3); v_incentives numeric:=round(coalesce(nullif(p_payload->>'lease_incentives','')::numeric,0),3);
  v_prepay numeric:=round(coalesce(nullif(p_payload->>'prepayments','')::numeric,0),3); v_short boolean:=coalesce((p_payload->>'short_term_exempt')::boolean,false);
  v_payments jsonb:=p_payload->'payments'; v_measure jsonb; v_liability numeric; v_rou numeric; v_rate numeric; v_periods integer; v_id uuid;
  v_fingerprint text:=md5((p_payload-'company_id')::text); v_existing public.master_lease_measurements%rowtype;
begin
  if v_company is null or v_agreement is null or v_request is null or v_effective is null then raise exception 'GL_ML_INITIAL_METADATA_REQUIRED' using errcode='22023'; end if;
  if least(v_direct,v_incentives,v_prepay)<0 then raise exception 'GL_ML_INITIAL_ADJUSTMENTS_INVALID' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('master-lease:'||v_company::text||':'||v_agreement::text,0));
  select * into v_existing from public.master_lease_measurements where company_id=v_company and request_id=v_request;
  if found then if v_existing.input_fingerprint<>v_fingerprint then raise exception 'GL_ML_REQUEST_CONFLICT' using errcode='23505'; end if; return jsonb_build_object('measurement_id',v_existing.id,'idempotent',true,'status',v_existing.status); end if;
  if not exists(select 1 from public.owner_agreements oa where oa.id=v_agreement and oa.company_id=v_company and oa.agreement_type='master_lease') then raise exception 'GL_ML_AGREEMENT_NOT_FOUND_OR_NOT_MASTER_LEASE' using errcode='42501'; end if;
  if exists(select 1 from public.master_lease_measurements where owner_agreement_id=v_agreement) then raise exception 'GL_ML_INITIAL_ALREADY_EXISTS' using errcode='23505'; end if;
  perform public.gl_ml_provision_supporting_accounts(v_company);
  v_measure:=public.gl_ml_measure_payments(v_payments,v_bps,v_ppy); v_periods:=(v_measure->>'max_period')::integer; v_rate:=(v_measure->>'periodic_rate')::numeric;
  if v_short then
    if v_periods>v_ppy then raise exception 'GL_ML_SHORT_TERM_EXEMPTION_TERM_EXCEEDS_12_MONTHS' using errcode='22023'; end if; v_liability:=0; v_rou:=0;
  else
    v_liability:=round((v_measure->>'initial_liability')::numeric,3); v_rou:=round(v_liability+v_direct+v_prepay-v_incentives,3);
    if v_rou<0 then raise exception 'GL_ML_INITIAL_ROU_NEGATIVE' using errcode='22023'; end if;
  end if;
  insert into public.master_lease_measurements(company_id,owner_agreement_id,version_no,measurement_type,status,effective_date,periods_per_year,periods_count,annual_discount_rate_bps,periodic_rate,short_term_exempt,initial_direct_costs,lease_incentives,prepayments,initial_liability,initial_rou_asset,request_id,input_fingerprint,input_payload,created_by)
  values(v_company,v_agreement,1,'INITIAL','DRAFT',v_effective,v_ppy,v_periods,v_bps,v_rate,v_short,v_direct,v_incentives,v_prepay,v_liability,v_rou,v_request,v_fingerprint,p_payload,auth.uid()) returning id into v_id;
  perform public.gl_ml_insert_schedule_rows(v_id,v_company,v_effective,v_payments,v_ppy,v_rate,v_liability,v_rou,v_short);
  return jsonb_build_object('measurement_id',v_id,'idempotent',false,'status','DRAFT','short_term_exempt',v_short,'initial_liability',v_liability,'initial_rou_asset',v_rou,'periods_count',v_periods);
end;$fn$;
alter function public.gl_ml_create_initial_measurement(jsonb) owner to postgres;
revoke all on function public.gl_ml_create_initial_measurement(jsonb) from public,anon,authenticated;
grant execute on function public.gl_ml_create_initial_measurement(jsonb) to service_role;

create or replace function public.gl_ml_post_initial_recognition(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_company uuid:=nullif(p_payload->>'company_id','')::uuid; v_measurement_id uuid:=nullif(p_payload->>'measurement_id','')::uuid; v_cash_no text:=coalesce(nullif(p_payload->>'cash_account_no',''),'1120');
  v_m public.master_lease_measurements%rowtype; v_rou_id text; v_liability_id text; v_cash_id text; v_diff numeric; v_lines jsonb; v_batch jsonb;
begin
  if v_company is null or v_measurement_id is null or v_cash_no not in ('1111','1120') then raise exception 'GL_ML_INITIAL_POST_METADATA_INVALID' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('master-lease-measurement:'||v_measurement_id::text,0));
  select * into v_m from public.master_lease_measurements where id=v_measurement_id and company_id=v_company for update;
  if not found then raise exception 'GL_ML_MEASUREMENT_NOT_FOUND' using errcode='P0002'; end if;
  if v_m.measurement_type<>'INITIAL' then raise exception 'GL_ML_NOT_INITIAL_MEASUREMENT' using errcode='22023'; end if;
  if v_m.status='ACTIVE' then return jsonb_build_object('measurement_id',v_m.id,'status','ACTIVE','idempotent',true); end if;
  if v_m.status<>'DRAFT' then raise exception 'GL_ML_INITIAL_STATUS_INVALID' using errcode='22023'; end if;
  if v_m.short_term_exempt then update public.master_lease_measurements set status='ACTIVE',posted_at=now() where id=v_m.id; return jsonb_build_object('measurement_id',v_m.id,'status','ACTIVE','short_term_exempt',true,'batch',null); end if;
  perform public.gl_ml_provision_supporting_accounts(v_company);
  v_rou_id:=public.require_company_account_id(v_company,'1600'); v_liability_id:=public.require_company_account_id(v_company,'2500'); v_cash_id:=public.require_company_account_id(v_company,v_cash_no); v_diff:=round(v_m.initial_rou_asset-v_m.initial_liability,3);
  v_lines:=jsonb_build_array(jsonb_build_object('account_id',v_rou_id,'debit',v_m.initial_rou_asset,'credit',0),jsonb_build_object('account_id',v_liability_id,'debit',0,'credit',v_m.initial_liability));
  if v_diff>0 then v_lines:=v_lines||jsonb_build_array(jsonb_build_object('account_id',v_cash_id,'debit',0,'credit',v_diff)); elsif v_diff<0 then v_lines:=v_lines||jsonb_build_array(jsonb_build_object('account_id',v_cash_id,'debit',abs(v_diff),'credit',0)); end if;
  v_batch:=public.post_journal_event(jsonb_build_object('company_id',v_company,'source_type','master_lease_initial_recognition','source_id',v_m.id::text,'event_id','initial-recognition','effective_date',v_m.effective_date,'description','Master lease initial recognition','lines',v_lines));
  update public.master_lease_measurements set status='ACTIVE',posted_at=now() where id=v_m.id;
  return jsonb_build_object('measurement_id',v_m.id,'status','ACTIVE','batch',v_batch);
end;$fn$;
alter function public.gl_ml_post_initial_recognition(jsonb) owner to postgres;
revoke all on function public.gl_ml_post_initial_recognition(jsonb) from public,anon,authenticated;
grant execute on function public.gl_ml_post_initial_recognition(jsonb) to service_role;

create or replace function public.gl_ml_post_period(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_company uuid:=nullif(p_payload->>'company_id','')::uuid; v_measurement_id uuid:=nullif(p_payload->>'measurement_id','')::uuid; v_period integer:=nullif(p_payload->>'period_no','')::integer; v_cash_no text:=coalesce(nullif(p_payload->>'cash_account_no',''),'1120');
  v_m public.master_lease_measurements%rowtype; v_r public.master_lease_schedule_rows%rowtype; v_cash_id text; v_liability_id text; v_interest_id text; v_dep_id text; v_accum_id text; v_expense_id text; v_lines jsonb:='[]'::jsonb; v_batch jsonb;
begin
  if v_company is null or v_measurement_id is null or v_period is null or v_period<=0 or v_cash_no not in ('1111','1120') then raise exception 'GL_ML_PERIOD_METADATA_INVALID' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('master-lease-period:'||v_measurement_id::text||':'||v_period::text,0));
  select * into v_m from public.master_lease_measurements where id=v_measurement_id and company_id=v_company for update;
  if not found then raise exception 'GL_ML_MEASUREMENT_NOT_FOUND' using errcode='P0002'; end if; if v_m.status<>'ACTIVE' then raise exception 'GL_ML_MEASUREMENT_NOT_ACTIVE' using errcode='22023'; end if;
  select * into v_r from public.master_lease_schedule_rows where measurement_id=v_measurement_id and company_id=v_company and period_no=v_period and superseded_at is null for update;
  if not found then raise exception 'GL_ML_PERIOD_NOT_FOUND_OR_SUPERSEDED' using errcode='P0002'; end if;
  if exists(select 1 from public.master_lease_schedule_rows r where r.measurement_id=v_measurement_id and r.period_no<v_period and r.superseded_at is null and r.posted_at is null) then raise exception 'GL_ML_PRIOR_PERIOD_NOT_POSTED' using errcode='22023'; end if;
  perform public.gl_ml_provision_supporting_accounts(v_company); v_cash_id:=public.require_company_account_id(v_company,v_cash_no);
  if v_m.short_term_exempt then
    if v_r.payment_amount>0 then v_expense_id:=public.require_company_account_id(v_company,'6100'); v_lines:=jsonb_build_array(jsonb_build_object('account_id',v_expense_id,'debit',v_r.payment_amount,'credit',0),jsonb_build_object('account_id',v_cash_id,'debit',0,'credit',v_r.payment_amount)); v_batch:=public.post_journal_event(jsonb_build_object('company_id',v_company,'source_type','master_lease_short_term_payment','source_id',v_m.id::text,'event_id','period:'||v_period::text,'effective_date',v_r.due_date,'description','Short-term lease payment expense','lines',v_lines)); end if;
  else
    v_liability_id:=public.require_company_account_id(v_company,'2500'); v_interest_id:=public.require_company_account_id(v_company,'6300'); v_dep_id:=public.require_company_account_id(v_company,'6200'); v_accum_id:=public.require_company_account_id(v_company,'1650');
    if v_r.interest_amount>0 then v_lines:=v_lines||jsonb_build_array(jsonb_build_object('account_id',v_interest_id,'debit',v_r.interest_amount,'credit',0),jsonb_build_object('account_id',v_liability_id,'debit',0,'credit',v_r.interest_amount)); end if;
    if v_r.payment_amount>0 then v_lines:=v_lines||jsonb_build_array(jsonb_build_object('account_id',v_liability_id,'debit',v_r.payment_amount,'credit',0),jsonb_build_object('account_id',v_cash_id,'debit',0,'credit',v_r.payment_amount)); end if;
    if v_r.rou_depreciation>0 then v_lines:=v_lines||jsonb_build_array(jsonb_build_object('account_id',v_dep_id,'debit',v_r.rou_depreciation,'credit',0),jsonb_build_object('account_id',v_accum_id,'debit',0,'credit',v_r.rou_depreciation)); end if;
    v_batch:=public.post_journal_event(jsonb_build_object('company_id',v_company,'source_type','master_lease_period','source_id',v_m.id::text,'event_id','period:'||v_period::text,'effective_date',v_r.due_date,'description','Master lease period '||v_period::text,'lines',v_lines));
  end if;
  update public.master_lease_schedule_rows set posted_at=coalesce(posted_at,now()) where id=v_r.id;
  return jsonb_build_object('measurement_id',v_m.id,'period_no',v_period,'batch',v_batch,'idempotent',v_r.posted_at is not null);
end;$fn$;
alter function public.gl_ml_post_period(jsonb) owner to postgres;
revoke all on function public.gl_ml_post_period(jsonb) from public,anon,authenticated;
grant execute on function public.gl_ml_post_period(jsonb) to service_role;

-- Remeasurements are accepted only on a posted schedule boundary. That avoids
-- inventing mid-period accrued interest that this monthly/quarterly schedule
-- does not measure.
create or replace function public.gl_ml_create_remeasurement(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_company uuid:=nullif(p_payload->>'company_id','')::uuid; v_agreement uuid:=nullif(p_payload->>'owner_agreement_id','')::uuid; v_request text:=nullif(p_payload->>'request_id',''); v_effective date:=nullif(p_payload->>'effective_date','')::date;
  v_ppy integer:=coalesce(nullif(p_payload->>'periods_per_year','')::integer,12); v_bps numeric:=coalesce(nullif(p_payload->>'annual_discount_rate_bps','')::numeric,0); v_scope integer:=coalesce(nullif(p_payload->>'scope_reduction_bps','')::integer,0); v_payments jsonb:=coalesce(p_payload->'payments','[]'::jsonb);
  v_fingerprint text:=md5((p_payload-'company_id')::text); v_old public.master_lease_measurements%rowtype; v_existing public.master_lease_measurements%rowtype; v_last public.master_lease_schedule_rows%rowtype; v_measure jsonb;
  v_new_liability numeric:=0; v_new_rou numeric:=0; v_rate numeric:=0; v_periods integer:=0; v_carry_liability numeric; v_carry_rou numeric; v_liab_derec numeric; v_rou_derec numeric; v_remaining_liab numeric; v_delta_after numeric; v_liability_delta numeric; v_rou_adjustment numeric; v_gain_loss numeric; v_type text; v_new_id uuid; v_version integer;
begin
  if v_company is null or v_agreement is null or v_request is null or v_effective is null or v_scope<0 or v_scope>10000 or v_ppy not in (1,2,3,4,6,12) or v_bps<0 then raise exception 'GL_ML_REMEASUREMENT_METADATA_INVALID' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('master-lease:'||v_company::text||':'||v_agreement::text,0));
  select * into v_existing from public.master_lease_measurements where company_id=v_company and request_id=v_request;
  if found then if v_existing.input_fingerprint<>v_fingerprint then raise exception 'GL_ML_REQUEST_CONFLICT' using errcode='23505'; end if; return jsonb_build_object('measurement_id',v_existing.id,'idempotent',true,'status',v_existing.status); end if;
  select * into v_old from public.master_lease_measurements where company_id=v_company and owner_agreement_id=v_agreement and status='ACTIVE' for update;
  if not found then raise exception 'GL_ML_ACTIVE_MEASUREMENT_NOT_FOUND' using errcode='P0002'; end if; if v_old.short_term_exempt then raise exception 'GL_ML_SHORT_TERM_REMEASUREMENT_NOT_APPLICABLE' using errcode='22023'; end if; if v_effective<=v_old.effective_date then raise exception 'GL_ML_RETROACTIVE_REMEASUREMENT_FORBIDDEN' using errcode='22023'; end if;
  if exists(select 1 from public.master_lease_measurements where owner_agreement_id=v_agreement and status='DRAFT') then raise exception 'GL_ML_DRAFT_ALREADY_EXISTS' using errcode='23505'; end if;
  if not exists(select 1 from public.master_lease_schedule_rows r where r.measurement_id=v_old.id and r.due_date=v_effective and r.posted_at is not null and r.superseded_at is null) then raise exception 'GL_ML_REMEASUREMENT_REQUIRES_POSTED_PERIOD_BOUNDARY' using errcode='22023'; end if;
  if exists(select 1 from public.master_lease_schedule_rows r where r.measurement_id=v_old.id and r.due_date<=v_effective and r.superseded_at is null and r.posted_at is null) then raise exception 'GL_ML_PRIOR_DUE_PERIOD_UNPOSTED' using errcode='22023'; end if;
  if exists(select 1 from public.master_lease_schedule_rows r where r.measurement_id=v_old.id and r.due_date>v_effective and r.posted_at is not null) then raise exception 'GL_ML_RETROACTIVE_REMEASUREMENT_POSTED_FUTURE_EXISTS' using errcode='22023'; end if;
  select * into v_last from public.master_lease_schedule_rows where measurement_id=v_old.id and company_id=v_company and due_date<=v_effective and posted_at is not null order by period_no desc limit 1;
  v_carry_liability:=v_last.closing_liability; v_carry_rou:=v_last.closing_rou_asset;
  if v_scope=10000 then
    if jsonb_typeof(v_payments)<>'array' or jsonb_array_length(v_payments)<>0 then raise exception 'GL_ML_FULL_TERMINATION_REVISED_PAYMENTS_FORBIDDEN' using errcode='22023'; end if; v_type:='FULL_TERMINATION';
  else
    v_measure:=public.gl_ml_measure_payments(v_payments,v_bps,v_ppy); v_new_liability:=round((v_measure->>'initial_liability')::numeric,3); v_rate:=(v_measure->>'periodic_rate')::numeric; v_periods:=(v_measure->>'max_period')::integer;
  end if;
  v_liab_derec:=round(v_carry_liability*v_scope/10000,3); v_rou_derec:=round(v_carry_rou*v_scope/10000,3); v_remaining_liab:=round(v_carry_liability-v_liab_derec,3); v_delta_after:=round(v_new_liability-v_remaining_liab,3);
  v_new_rou:=case when v_scope=10000 then 0 else round(v_carry_rou-v_rou_derec+v_delta_after,3) end;
  if v_new_rou<0 then raise exception 'GL_ML_REMEASUREMENT_ROU_NEGATIVE' using errcode='22023'; end if;
  if v_scope=0 then v_type:='REMEASUREMENT'; elsif v_scope<10000 then v_type:='PARTIAL_TERMINATION'; end if;
  v_gain_loss:=round(v_liab_derec-v_rou_derec,3); v_liability_delta:=round(v_new_liability-v_carry_liability,3); v_rou_adjustment:=case when v_scope=10000 then -v_carry_rou else round(-v_rou_derec+v_delta_after,3) end;
  if v_liability_delta=0 and v_rou_adjustment=0 and v_gain_loss=0 then raise exception 'GL_ML_REMEASUREMENT_NO_FINANCIAL_CHANGE' using errcode='22023'; end if;
  select coalesce(max(version_no),0)+1 into v_version from public.master_lease_measurements where owner_agreement_id=v_agreement; perform public.gl_ml_provision_supporting_accounts(v_company);
  insert into public.master_lease_measurements(company_id,owner_agreement_id,version_no,measurement_type,status,supersedes_measurement_id,effective_date,periods_per_year,periods_count,annual_discount_rate_bps,periodic_rate,short_term_exempt,initial_liability,initial_rou_asset,carrying_liability_before,carrying_rou_before,liability_delta,rou_adjustment,termination_gain_loss,scope_reduction_bps,request_id,input_fingerprint,input_payload,created_by)
  values(v_company,v_agreement,v_version,v_type,'DRAFT',v_old.id,v_effective,v_ppy,v_periods,v_bps,v_rate,false,v_new_liability,v_new_rou,v_carry_liability,v_carry_rou,v_liability_delta,v_rou_adjustment,v_gain_loss,v_scope,v_request,v_fingerprint,p_payload,auth.uid()) returning id into v_new_id;
  if v_scope<10000 then perform public.gl_ml_insert_schedule_rows(v_new_id,v_company,v_effective,v_payments,v_ppy,v_rate,v_new_liability,v_new_rou,false); end if;
  return jsonb_build_object('measurement_id',v_new_id,'supersedes_measurement_id',v_old.id,'idempotent',false,'measurement_type',v_type,'status','DRAFT','carrying_liability_before',v_carry_liability,'carrying_rou_before',v_carry_rou,'initial_liability',v_new_liability,'initial_rou_asset',v_new_rou,'liability_delta',v_liability_delta,'rou_adjustment',v_rou_adjustment,'termination_gain_loss',v_gain_loss);
end;$fn$;
alter function public.gl_ml_create_remeasurement(jsonb) owner to postgres;
revoke all on function public.gl_ml_create_remeasurement(jsonb) from public,anon,authenticated;
grant execute on function public.gl_ml_create_remeasurement(jsonb) to service_role;

create or replace function public.gl_ml_post_remeasurement(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_company uuid:=nullif(p_payload->>'company_id','')::uuid; v_measurement_id uuid:=nullif(p_payload->>'measurement_id','')::uuid; v_m public.master_lease_measurements%rowtype; v_old public.master_lease_measurements%rowtype; v_rou_id text; v_liability_id text; v_gain_id text; v_loss_id text; v_lines jsonb:='[]'::jsonb; v_batch jsonb;
begin
  if v_company is null or v_measurement_id is null then raise exception 'GL_ML_REMEASUREMENT_POST_METADATA_INVALID' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('master-lease-remeasurement-post:'||v_measurement_id::text,0));
  select * into v_m from public.master_lease_measurements where id=v_measurement_id and company_id=v_company for update;
  if not found then raise exception 'GL_ML_MEASUREMENT_NOT_FOUND' using errcode='P0002'; end if; if v_m.measurement_type='INITIAL' then raise exception 'GL_ML_NOT_REMEASUREMENT' using errcode='22023'; end if;
  if v_m.status in ('ACTIVE','TERMINATED') and v_m.posted_at is not null then return jsonb_build_object('measurement_id',v_m.id,'status',v_m.status,'idempotent',true); end if; if v_m.status<>'DRAFT' then raise exception 'GL_ML_REMEASUREMENT_STATUS_INVALID' using errcode='22023'; end if;
  select * into v_old from public.master_lease_measurements where id=v_m.supersedes_measurement_id and company_id=v_company and status='ACTIVE' for update; if not found then raise exception 'GL_ML_SUPERSEDED_ACTIVE_MEASUREMENT_NOT_FOUND' using errcode='P0002'; end if;
  perform public.gl_ml_provision_supporting_accounts(v_company); v_rou_id:=public.require_company_account_id(v_company,'1600'); v_liability_id:=public.require_company_account_id(v_company,'2500'); v_gain_id:=public.require_company_account_id(v_company,'4400'); v_loss_id:=public.require_company_account_id(v_company,'6400');
  if v_m.rou_adjustment>0 then v_lines:=v_lines||jsonb_build_array(jsonb_build_object('account_id',v_rou_id,'debit',v_m.rou_adjustment,'credit',0)); elsif v_m.rou_adjustment<0 then v_lines:=v_lines||jsonb_build_array(jsonb_build_object('account_id',v_rou_id,'debit',0,'credit',abs(v_m.rou_adjustment))); end if;
  if v_m.liability_delta>0 then v_lines:=v_lines||jsonb_build_array(jsonb_build_object('account_id',v_liability_id,'debit',0,'credit',v_m.liability_delta)); elsif v_m.liability_delta<0 then v_lines:=v_lines||jsonb_build_array(jsonb_build_object('account_id',v_liability_id,'debit',abs(v_m.liability_delta),'credit',0)); end if;
  if v_m.termination_gain_loss>0 then v_lines:=v_lines||jsonb_build_array(jsonb_build_object('account_id',v_gain_id,'debit',0,'credit',v_m.termination_gain_loss)); elsif v_m.termination_gain_loss<0 then v_lines:=v_lines||jsonb_build_array(jsonb_build_object('account_id',v_loss_id,'debit',abs(v_m.termination_gain_loss),'credit',0)); end if;
  v_batch:=public.post_journal_event(jsonb_build_object('company_id',v_company,'source_type','master_lease_remeasurement','source_id',v_m.id::text,'event_id','remeasurement','effective_date',v_m.effective_date,'description','Master lease '||lower(v_m.measurement_type),'lines',v_lines));
  update public.master_lease_schedule_rows set superseded_at=coalesce(superseded_at,now()) where measurement_id=v_old.id and due_date>v_m.effective_date and posted_at is null;
  if v_m.measurement_type='FULL_TERMINATION' then
    update public.master_lease_measurements set status='TERMINATED',superseded_at=now() where id=v_old.id; update public.master_lease_measurements set status='TERMINATED',posted_at=now() where id=v_m.id; return jsonb_build_object('measurement_id',v_m.id,'status','TERMINATED','batch',v_batch);
  end if;
  update public.master_lease_measurements set status='SUPERSEDED',superseded_at=now() where id=v_old.id; update public.master_lease_measurements set status='ACTIVE',posted_at=now() where id=v_m.id;
  return jsonb_build_object('measurement_id',v_m.id,'status','ACTIVE','batch',v_batch);
end;$fn$;
alter function public.gl_ml_post_remeasurement(jsonb) owner to postgres;
revoke all on function public.gl_ml_post_remeasurement(jsonb) from public,anon,authenticated;
grant execute on function public.gl_ml_post_remeasurement(jsonb) to service_role;

create or replace function public.gl_ml_post_sublease_receipt(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_company uuid:=nullif(p_payload->>'company_id','')::uuid; v_contract_id text:=nullif(p_payload->>'contract_id',''); v_source_id text:=nullif(p_payload->>'source_id',''); v_amount numeric:=round(nullif(p_payload->>'amount','')::numeric,3); v_effective date:=nullif(p_payload->>'effective_date','')::date; v_cash_no text:=coalesce(nullif(p_payload->>'cash_account_no',''),'1120'); v_cash_id text; v_revenue_id text; v_batch jsonb;
begin
  if v_company is null or v_contract_id is null or v_source_id is null or v_effective is null or v_amount is null or v_amount<=0 or v_cash_no not in ('1111','1120') then raise exception 'GL_ML_SUBLEASE_RECEIPT_METADATA_INVALID' using errcode='22023'; end if;
  if not exists(select 1 from public.contracts c join public.owner_agreements oa on oa.id=c.agreement_id where c.id::text=v_contract_id and c.company_id=v_company and oa.company_id=v_company and oa.agreement_type='master_lease') then raise exception 'GL_ML_SUBLEASE_CONTRACT_NOT_MASTER_LEASE_OR_OUTSIDE_COMPANY' using errcode='42501'; end if;
  v_cash_id:=public.require_company_account_id(v_company,v_cash_no); v_revenue_id:=public.require_company_account_id(v_company,'4000');
  v_batch:=public.post_journal_event(jsonb_build_object('company_id',v_company,'source_type','master_lease_sublease_receipt','source_id',v_source_id,'event_id','collect','effective_date',v_effective,'description','Master lease sublease rental revenue','lines',jsonb_build_array(jsonb_build_object('account_id',v_cash_id,'debit',v_amount,'credit',0),jsonb_build_object('account_id',v_revenue_id,'debit',0,'credit',v_amount))));
  return jsonb_build_object('contract_id',v_contract_id,'amount',v_amount,'batch',v_batch);
end;$fn$;
alter function public.gl_ml_post_sublease_receipt(jsonb) owner to postgres;
revoke all on function public.gl_ml_post_sublease_receipt(jsonb) from public,anon,authenticated;
grant execute on function public.gl_ml_post_sublease_receipt(jsonb) to service_role;

commit;

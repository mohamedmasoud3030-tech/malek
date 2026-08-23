-- RC1 commission deal identity + OMR precision follow-up.
-- Enforces the locked business rule that commissions are one-time, person-specific,
-- deal-based rewards, never recurring collection commissions.

begin;

-- Fail closed rather than mutating historical rows that cannot prove a deal/source.
do $rc1_commission_source_preflight$
declare
  v_missing integer;
  v_duplicates integer;
begin
  select count(*) into v_missing
  from public.commissions
  where type in ('contract','owner','lead','land')
    and nullif(btrim(source_id), '') is null;

  if v_missing > 0 then
    raise exception 'RC1_COMMISSION_SOURCE_MISSING: % canonical commission row(s) have no deal/source reference; review them before enforcing one-time deal identity.', v_missing
      using errcode = '23514';
  end if;

  select count(*) into v_duplicates
  from (
    select company_id, lower(btrim(staff_name)) as beneficiary, type, btrim(source_id) as source_id
    from public.commissions
    where type in ('contract','owner','lead','land')
      and nullif(btrim(source_id), '') is not null
    group by company_id, lower(btrim(staff_name)), type, btrim(source_id)
    having count(*) > 1
  ) d;

  if v_duplicates > 0 then
    raise exception 'RC1_COMMISSION_DUPLICATE_DEAL_IDENTITY: % duplicate beneficiary/deal commission identity group(s) exist; review them before enforcing one-time commissions.', v_duplicates
      using errcode = '23514';
  end if;
end
$rc1_commission_source_preflight$;

alter table public.commissions
  drop constraint if exists commissions_source_required_rc1_check;

alter table public.commissions
  add constraint commissions_source_required_rc1_check
  check (
    type is null
    or (
      type in ('contract','owner','lead','land')
      and nullif(btrim(source_id), '') is not null
    )
  );

create unique index if not exists commissions_one_time_deal_identity_uidx
  on public.commissions (
    company_id,
    lower(btrim(staff_name)),
    type,
    btrim(source_id)
  )
  where type in ('contract','owner','lead','land')
    and nullif(btrim(source_id), '') is not null;

comment on constraint commissions_source_required_rc1_check on public.commissions is
  'RC1: canonical commissions require a real source/deal reference.';
comment on index public.commissions_one_time_deal_identity_uidx is
  'RC1: one commission per company + beneficiary + source type + source/deal identity.';

-- The previous closeout migration preserved an old 2dp derivation inside the
-- RPC bodies. OMR authority is 3dp. Patch only that exact derivation anchor and
-- fail closed if the expected function body is not present.
do $rc1_commission_omr_precision$
declare
  v_sql text;
  v_old text := 'round(v_deal_value * (v_percentage / 100.0), 2)';
  v_new text := 'round(v_deal_value * (v_percentage / 100.0), 3)';
begin
  select pg_get_functiondef('public.create_commission_atomic(jsonb)'::regprocedure) into v_sql;
  if position(v_old in v_sql) > 0 then
    execute replace(v_sql, v_old, v_new);
  elsif position(v_new in v_sql) = 0 then
    raise exception 'RC1_CREATE_COMMISSION_OMR_PRECISION_ANCHOR_NOT_FOUND';
  end if;

  select pg_get_functiondef('public.update_commission_atomic(jsonb)'::regprocedure) into v_sql;
  if position(v_old in v_sql) > 0 then
    execute replace(v_sql, v_old, v_new);
  elsif position(v_new in v_sql) = 0 then
    raise exception 'RC1_UPDATE_COMMISSION_OMR_PRECISION_ANCHOR_NOT_FOUND';
  end if;
end
$rc1_commission_omr_precision$;

comment on function public.create_commission_atomic(jsonb) is
  'RC1: creates one-time deal-based commissions; payment/collection type is rejected; derived OMR amount is rounded to 3dp.';
comment on function public.update_commission_atomic(jsonb) is
  'RC1: updates governed one-time deal-based commissions; derived OMR amount is rounded to 3dp.';

commit;

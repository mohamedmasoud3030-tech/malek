-- PRD-008 / SEC-005 / SEC-010: authoritative AI access, idempotency and daily budget reservations.
-- No prompts, model responses, tenant names, document contents or other business data are stored.

begin;

create table public.ai_assistant_budget_reservations (
  company_id uuid not null references public.companies(id) on delete cascade,
  request_id uuid not null,
  user_id uuid not null,
  usage_date date not null default (timezone('UTC', now()))::date,
  reserved_microusd bigint not null check (reserved_microusd between 1 and 1000000),
  created_at timestamptz not null default now(),
  primary key (company_id, request_id)
);

create index ai_assistant_budget_reservations_company_day_idx
  on public.ai_assistant_budget_reservations(company_id, usage_date);
create index ai_assistant_budget_reservations_user_day_idx
  on public.ai_assistant_budget_reservations(company_id, user_id, usage_date);

alter table public.ai_assistant_budget_reservations enable row level security;
create policy ai_assistant_budget_reservations_deny_authenticated
  on public.ai_assistant_budget_reservations as restrictive for all to authenticated
  using (false) with check (false);
revoke all on public.ai_assistant_budget_reservations from public, anon, authenticated;
grant select, insert, delete on public.ai_assistant_budget_reservations to service_role;

create or replace function public.authorize_ai_assistant_access()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user uuid := auth.uid();
  v_company uuid := public.require_company_id();
begin
  if v_user is null
     or not coalesce(public.is_app_user(), false)
     or not coalesce(public.is_company_member(v_company, v_user), false)
     or not exists (
       select 1 from public.company_members cm
       where cm.company_id = v_company
         and cm.user_id = v_user
         and upper(cm.role::text) in ('ADMIN', 'MANAGER')
     ) then
    raise exception 'AI_ASSISTANT_ACCESS_DENIED' using errcode = '42501';
  end if;
  return jsonb_build_object('allowed', true);
end;
$function$;

alter function public.authorize_ai_assistant_access() owner to postgres;
revoke all on function public.authorize_ai_assistant_access() from public, anon;
grant execute on function public.authorize_ai_assistant_access() to authenticated, service_role;
comment on function public.authorize_ai_assistant_access()
is 'Fail-closed active-company AI Assistant authorization. Company ADMIN/MANAGER is temporary parity with the governed rollout flag until an approved AI capability key exists.';

create or replace function public.reserve_ai_assistant_budget_atomic(
  p_request_id uuid,
  p_reserved_microusd bigint default 20000,
  p_user_daily_request_limit integer default 100,
  p_company_daily_budget_microusd bigint default 2000000
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user uuid := auth.uid();
  v_company uuid := public.require_company_id();
  v_day date := (timezone('UTC', clock_timestamp()))::date;
  v_user_count bigint;
  v_company_reserved bigint;
begin
  perform public.authorize_ai_assistant_access();
  if p_request_id is null
     or p_reserved_microusd not between 1 and 1000000
     or p_user_daily_request_limit not between 1 and 10000
     or p_company_daily_budget_microusd not between 1 and 1000000000 then
    raise exception 'AI_BUDGET_INPUT_INVALID' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ai_budget:' || v_company::text || ':' || v_day::text, 0));

  if exists (
    select 1 from public.ai_assistant_budget_reservations
    where company_id = v_company and request_id = p_request_id
  ) then
    return jsonb_build_object('allowed', false, 'duplicate', true, 'reason', 'DUPLICATE_REQUEST');
  end if;

  select coalesce(sum(reserved_microusd), 0)
    into v_company_reserved
  from public.ai_assistant_budget_reservations
  where company_id = v_company and usage_date = v_day;

  select count(*) into v_user_count
  from public.ai_assistant_budget_reservations
  where company_id = v_company and user_id = v_user and usage_date = v_day;

  if v_user_count >= p_user_daily_request_limit then
    return jsonb_build_object('allowed', false, 'duplicate', false, 'reason', 'USER_DAILY_REQUEST_LIMIT');
  end if;
  if v_company_reserved + p_reserved_microusd > p_company_daily_budget_microusd then
    return jsonb_build_object('allowed', false, 'duplicate', false, 'reason', 'COMPANY_DAILY_BUDGET');
  end if;

  insert into public.ai_assistant_budget_reservations(company_id, request_id, user_id, usage_date, reserved_microusd)
  values (v_company, p_request_id, v_user, v_day, p_reserved_microusd);

  return jsonb_build_object(
    'allowed', true,
    'duplicate', false,
    'remaining_company_microusd', p_company_daily_budget_microusd - v_company_reserved - p_reserved_microusd,
    'remaining_user_requests', p_user_daily_request_limit - v_user_count - 1
  );
end;
$function$;

alter function public.reserve_ai_assistant_budget_atomic(uuid, bigint, integer, bigint) owner to postgres;
revoke all on function public.reserve_ai_assistant_budget_atomic(uuid, bigint, integer, bigint) from public, anon;
grant execute on function public.reserve_ai_assistant_budget_atomic(uuid, bigint, integer, bigint) to authenticated, service_role;
comment on function public.reserve_ai_assistant_budget_atomic(uuid, bigint, integer, bigint)
is 'Atomically reserves a conservative provider-call budget and rejects duplicate request IDs. Stores metadata only; never prompt or response content.';

commit;

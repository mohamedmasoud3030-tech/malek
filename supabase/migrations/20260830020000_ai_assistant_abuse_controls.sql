-- SEC-010 / PRD-008: distributed, company-scoped AI assistant quota.
-- The browser/Edge Function cannot choose company or actor. This table is
-- internal and the RPC fails closed unless the authenticated user is active
-- and belongs to the active company.

begin;

create table if not exists public.ai_assistant_rate_limits (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key(company_id,user_id,window_started_at)
);

create index if not exists ai_assistant_rate_limits_cleanup_idx
  on public.ai_assistant_rate_limits(window_started_at);

alter table public.ai_assistant_rate_limits enable row level security;
drop policy if exists ai_assistant_rate_limits_deny_authenticated on public.ai_assistant_rate_limits;
create policy ai_assistant_rate_limits_deny_authenticated on public.ai_assistant_rate_limits
  as restrictive for all to authenticated using (false) with check (false);
revoke all on public.ai_assistant_rate_limits from public,anon,authenticated;
grant select,insert,update,delete on public.ai_assistant_rate_limits to service_role;

create or replace function public.consume_ai_assistant_quota_atomic(
  p_window_seconds integer default 60,
  p_max_requests integer default 10
) returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_user uuid:=auth.uid();
  v_company uuid:=public.require_company_id();
  v_window timestamptz;
  v_count integer;
  v_retry integer;
begin
  if v_user is null or p_window_seconds not between 10 and 3600 or p_max_requests not between 1 and 100 then
    raise exception 'AI_QUOTA_INPUT_OR_AUTH_INVALID' using errcode='42501';
  end if;
  if not public.is_app_user() or not public.is_company_member(v_company,v_user) then
    raise exception 'AI_ACTIVE_COMPANY_MEMBERSHIP_REQUIRED' using errcode='42501';
  end if;

  v_window:=to_timestamp(floor(extract(epoch from clock_timestamp())/p_window_seconds)*p_window_seconds);
  delete from public.ai_assistant_rate_limits
    where company_id=v_company and user_id=v_user and window_started_at < clock_timestamp()-interval '1 day';
  perform pg_advisory_xact_lock(hashtextextended('ai_quota:'||v_company::text||':'||v_user::text||':'||v_window::text,0));

  insert into public.ai_assistant_rate_limits(company_id,user_id,window_started_at,request_count)
    values(v_company,v_user,v_window,1)
  on conflict(company_id,user_id,window_started_at) do update
    set request_count=public.ai_assistant_rate_limits.request_count+1,updated_at=now()
  returning request_count into v_count;

  v_retry:=greatest(1,ceil(extract(epoch from (v_window+make_interval(secs=>p_window_seconds)-clock_timestamp())))::integer);
  return jsonb_build_object('allowed',v_count<=p_max_requests,'remaining',greatest(0,p_max_requests-v_count),'retry_after',v_retry);
end;
$function$;

alter function public.consume_ai_assistant_quota_atomic(integer,integer) owner to postgres;
revoke all on function public.consume_ai_assistant_quota_atomic(integer,integer) from public,anon;
grant execute on function public.consume_ai_assistant_quota_atomic(integer,integer) to authenticated,service_role;

comment on function public.consume_ai_assistant_quota_atomic(integer,integer)
is 'Distributed AI quota with active-user/company enforcement; one atomic counter per user/company/window.';

commit;

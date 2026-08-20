-- PRD-009 / SEC-002 / SEC-003 / SEC-010 / UX-001 / UX-008
-- Internal, company-scoped support intake. No external support platform or webhook.
-- Attachments are intentionally unsupported; free text is bounded and screened.

begin;

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  requester_id uuid not null,
  reference text not null unique,
  category text not null check (category in ('HOW_TO','ACCESS','TECHNICAL','DATA_QUALITY','PAYMENT_POSTING','SECURITY')),
  urgency text not null check (urgency in ('LOW','NORMAL','HIGH','CRITICAL')),
  status text not null default 'ACKNOWLEDGED' check (status in ('ACKNOWLEDGED','IN_REVIEW','WAITING_USER','RESOLVED','CLOSED')),
  route text not null check (length(route) between 1 and 300 and route like '/%'),
  app_version text not null check (length(app_version) between 1 and 100),
  requester_role text not null check (length(requester_role) between 1 and 40),
  error_reference text check (error_reference is null or length(error_reference) between 1 and 120),
  expected_behavior text not null check (length(expected_behavior) between 10 and 1000),
  actual_behavior text not null check (length(actual_behavior) between 10 and 1000),
  public_note text check (public_note is null or length(public_note) <= 500),
  acknowledged_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_requests_company_status_created_idx
  on public.support_requests(company_id, status, created_at desc);
create index support_requests_requester_created_idx
  on public.support_requests(company_id, requester_id, created_at desc);

create table public.support_request_events (
  id bigint generated always as identity primary key,
  support_request_id uuid not null references public.support_requests(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid not null,
  event_type text not null check (event_type in ('CREATED','STATUS_CHANGED')),
  from_status text,
  to_status text not null,
  created_at timestamptz not null default now()
);

create index support_request_events_request_idx
  on public.support_request_events(support_request_id, created_at);

alter table public.support_requests enable row level security;
alter table public.support_request_events enable row level security;
create policy support_requests_deny_authenticated on public.support_requests
  as restrictive for all to authenticated using (false) with check (false);
create policy support_request_events_deny_authenticated on public.support_request_events
  as restrictive for all to authenticated using (false) with check (false);
revoke all on public.support_requests, public.support_request_events from public, anon, authenticated;
grant select, insert, update, delete on public.support_requests to service_role;
grant select, insert, delete on public.support_request_events to service_role;
grant usage, select on sequence public.support_request_events_id_seq to service_role;

create or replace function public.support_text_is_safe(p_text text)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(p_text, '') !~* '(password|passcode|كلمة[[:space:]]*المرور|api[_ -]?key|secret|token|authorization[[:space:]]*:|private[[:space:]]+key|-----begin|reset[_ -]?link|رابط[[:space:]]+الاستعادة)'
     and coalesce(p_text, '') !~ '[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+'
     and coalesce(p_text, '') !~ '([0-9][[:space:]-]*){8,}';
$function$;

revoke all on function public.support_text_is_safe(text) from public, anon, authenticated;
grant execute on function public.support_text_is_safe(text) to service_role;

create or replace function public.create_support_request_atomic(
  p_category text,
  p_urgency text,
  p_route text,
  p_app_version text,
  p_error_reference text,
  p_expected_behavior text,
  p_actual_behavior text
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user uuid := auth.uid();
  v_company uuid := public.require_company_id();
  v_role text;
  v_id uuid := gen_random_uuid();
  v_reference text;
  v_urgency text := upper(btrim(coalesce(p_urgency, '')));
  v_category text := upper(btrim(coalesce(p_category, '')));
begin
  if v_user is null
     or not coalesce(public.is_app_user(), false)
     or not coalesce(public.is_company_member(v_company, v_user), false) then
    raise exception 'SUPPORT_ACTIVE_COMPANY_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;

  select upper(cm.role::text) into v_role
  from public.company_members cm
  where cm.company_id = v_company and cm.user_id = v_user;
  if v_role is null then
    raise exception 'SUPPORT_ROLE_UNAVAILABLE' using errcode = '42501';
  end if;

  if v_category not in ('HOW_TO','ACCESS','TECHNICAL','DATA_QUALITY','PAYMENT_POSTING','SECURITY')
     or v_urgency not in ('LOW','NORMAL','HIGH','CRITICAL') then
    raise exception 'SUPPORT_CATEGORY_OR_URGENCY_INVALID' using errcode = '22023';
  end if;
  if v_category in ('SECURITY','DATA_QUALITY','PAYMENT_POSTING') and v_urgency in ('LOW','NORMAL') then
    v_urgency := 'HIGH';
  end if;
  if v_urgency = 'CRITICAL' and v_category not in ('SECURITY','DATA_QUALITY','PAYMENT_POSTING') then
    v_urgency := 'HIGH';
  end if;

  p_route := btrim(coalesce(p_route, ''));
  p_app_version := left(btrim(coalesce(p_app_version, 'unavailable')), 100);
  p_error_reference := nullif(btrim(coalesce(p_error_reference, '')), '');
  p_expected_behavior := btrim(coalesce(p_expected_behavior, ''));
  p_actual_behavior := btrim(coalesce(p_actual_behavior, ''));

  if length(p_route) not between 1 and 300
     or p_route not like '/%'
     or position('?' in p_route) > 0
     or position('#' in p_route) > 0
     or p_route ~* '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(/|$)'
     or p_route ~ '/[0-9]{6,}(/|$)' then
    raise exception 'SUPPORT_ROUTE_INVALID' using errcode = '22023';
  end if;
  if p_error_reference is not null and (length(p_error_reference) > 120 or p_error_reference !~ '^[[:alnum:]_.:/-]+$') then
    raise exception 'SUPPORT_ERROR_REFERENCE_INVALID' using errcode = '22023';
  end if;
  if length(p_expected_behavior) not between 10 and 1000 or length(p_actual_behavior) not between 10 and 1000 then
    raise exception 'SUPPORT_DESCRIPTION_LENGTH_INVALID' using errcode = '22023';
  end if;
  if not public.support_text_is_safe(p_expected_behavior || E'\n' || p_actual_behavior) then
    raise exception 'SUPPORT_SENSITIVE_CONTENT_REJECTED' using errcode = '22023';
  end if;

  v_reference := 'MS-' || to_char(timezone('UTC', clock_timestamp()), 'YYYYMMDD') || '-' || upper(substr(replace(v_id::text, '-', ''), 1, 8));

  insert into public.support_requests(
    id, company_id, requester_id, reference, category, urgency, status,
    route, app_version, requester_role, error_reference, expected_behavior, actual_behavior
  ) values (
    v_id, v_company, v_user, v_reference, v_category, v_urgency, 'ACKNOWLEDGED',
    p_route, p_app_version, v_role, p_error_reference, p_expected_behavior, p_actual_behavior
  );

  insert into public.support_request_events(
    support_request_id, company_id, actor_id, event_type, from_status, to_status
  ) values (v_id, v_company, v_user, 'CREATED', null, 'ACKNOWLEDGED');

  return jsonb_build_object(
    'id', v_id,
    'reference', v_reference,
    'status', 'ACKNOWLEDGED',
    'urgency', v_urgency,
    'created_at', clock_timestamp()
  );
end;
$function$;

alter function public.create_support_request_atomic(text,text,text,text,text,text,text) owner to postgres;
revoke all on function public.create_support_request_atomic(text,text,text,text,text,text,text) from public, anon;
grant execute on function public.create_support_request_atomic(text,text,text,text,text,text,text) to authenticated, service_role;

create or replace function public.list_my_support_requests()
returns jsonb
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select case
    when auth.uid() is null or not coalesce(public.is_app_user(), false) then '[]'::jsonb
    else coalesce(jsonb_agg(jsonb_build_object(
      'id', sr.id,
      'reference', sr.reference,
      'category', sr.category,
      'urgency', sr.urgency,
      'status', sr.status,
      'public_note', sr.public_note,
      'created_at', sr.created_at,
      'updated_at', sr.updated_at
    ) order by sr.created_at desc), '[]'::jsonb)
  end
  from public.support_requests sr
  where sr.company_id = public.require_company_id()
    and sr.requester_id = auth.uid()
    and public.is_company_member(public.require_company_id(), auth.uid());
$function$;

alter function public.list_my_support_requests() owner to postgres;
revoke all on function public.list_my_support_requests() from public, anon;
grant execute on function public.list_my_support_requests() to authenticated, service_role;

create or replace function public.update_support_request_status_atomic(
  p_request_id uuid,
  p_status text,
  p_public_note text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user uuid := auth.uid();
  v_company uuid := public.require_company_id();
  v_from text;
  v_to text := upper(btrim(coalesce(p_status, '')));
begin
  if v_user is null
     or not coalesce(public.is_app_user(), false)
     or not exists (
       select 1 from public.company_members cm
       where cm.company_id = v_company and cm.user_id = v_user and upper(cm.role::text) = 'ADMIN'
     ) then
    raise exception 'SUPPORT_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if v_to not in ('ACKNOWLEDGED','IN_REVIEW','WAITING_USER','RESOLVED','CLOSED') then
    raise exception 'SUPPORT_STATUS_INVALID' using errcode = '22023';
  end if;
  p_public_note := nullif(btrim(coalesce(p_public_note, '')), '');
  if p_public_note is not null and (length(p_public_note) > 500 or not public.support_text_is_safe(p_public_note)) then
    raise exception 'SUPPORT_PUBLIC_NOTE_INVALID' using errcode = '22023';
  end if;

  select status into v_from
  from public.support_requests
  where id = p_request_id and company_id = v_company
  for update;
  if v_from is null then raise exception 'SUPPORT_REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_from is distinct from v_to and not (
    (v_from = 'ACKNOWLEDGED' and v_to in ('IN_REVIEW','CLOSED'))
    or (v_from = 'IN_REVIEW' and v_to in ('WAITING_USER','RESOLVED','CLOSED'))
    or (v_from = 'WAITING_USER' and v_to in ('IN_REVIEW','CLOSED'))
    or (v_from = 'RESOLVED' and v_to = 'CLOSED')
  ) then
    raise exception 'SUPPORT_STATUS_TRANSITION_INVALID: % -> %', v_from, v_to using errcode = '22023';
  end if;

  update public.support_requests
  set status = v_to,
      public_note = coalesce(p_public_note, public_note),
      resolved_at = case when v_to in ('RESOLVED','CLOSED') then coalesce(resolved_at, now()) else null end,
      updated_at = now()
  where id = p_request_id and company_id = v_company;

  if v_from is distinct from v_to then
    insert into public.support_request_events(
      support_request_id, company_id, actor_id, event_type, from_status, to_status
    ) values (p_request_id, v_company, v_user, 'STATUS_CHANGED', v_from, v_to);
  end if;

  return jsonb_build_object('id', p_request_id, 'status', v_to, 'updated_at', clock_timestamp());
end;
$function$;

alter function public.update_support_request_status_atomic(uuid,text,text) owner to postgres;
revoke all on function public.update_support_request_status_atomic(uuid,text,text) from public, anon;
grant execute on function public.update_support_request_status_atomic(uuid,text,text) to authenticated, service_role;

comment on table public.support_requests is 'Company-scoped internal support intake. No attachments, secrets, private documents, outbound webhook or paid support platform.';
comment on function public.create_support_request_atomic(text,text,text,text,text,text,text) is 'Creates and immediately acknowledges a privacy-minimized internal support request; derives company, actor and role server-side.';
comment on function public.list_my_support_requests() is 'Returns metadata-only status summaries for the authenticated requester in the active company.';
comment on function public.update_support_request_status_atomic(uuid,text,text) is 'ADMIN-only support status transition with append-only event evidence.';

commit;

-- SEC-002 / SEC-003 / SEC-005 / SEC-008 / SEC-010 / UX-001 / UX-008
-- Minimal support-operations toolkit: masked read-only investigation, low-risk ticket triage,
-- and non-executable user-access proposals. No impersonation, export, financial action or bulk mutation.

begin;

insert into public.app_permission_catalog(permission,label_ar,admin_only,requestable) values
  ('support.operations.view','عرض عمليات الدعم',false,false),
  ('support.requests.triage','فرز طلبات الدعم',false,false),
  ('support.user_lookup.view','عرض بحث المستخدمين المقنّع',true,false)
on conflict(permission) do update set label_ar=excluded.label_ar,admin_only=excluded.admin_only,requestable=excluded.requestable;

create table public.admin_support_audit_events (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid not null,
  capability text not null,
  action text not null,
  target_type text not null,
  target_id uuid,
  reason text not null check(length(reason) between 10 and 500),
  outcome text not null,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique(company_id,idempotency_key)
);

create table public.admin_user_access_change_proposals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  target_user_id uuid not null,
  prior_role text not null,
  proposed_role text not null check(proposed_role in ('ADMIN','MANAGER','ACCOUNTANT','OPERATIONS','USER','VIEWER')),
  current_active boolean not null,
  proposed_active boolean not null,
  reason text not null check(length(reason) between 10 and 500),
  requested_by uuid not null,
  idempotency_key uuid not null,
  status text not null default 'PENDING_OWNER_APPROVAL' check(status in ('PENDING_OWNER_APPROVAL','APPROVED_NOT_ENABLED','REJECTED','EXPIRED')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '7 days',
  unique(company_id,idempotency_key)
);

alter table public.support_request_events add column if not exists reason text;
alter table public.support_request_events add column if not exists idempotency_key uuid;
create unique index if not exists support_request_events_company_idempotency_idx
  on public.support_request_events(company_id,idempotency_key) where idempotency_key is not null;

alter table public.admin_support_audit_events enable row level security;
alter table public.admin_user_access_change_proposals enable row level security;
create policy admin_support_audit_events_deny_authenticated on public.admin_support_audit_events
  as restrictive for all to authenticated using(false) with check(false);
create policy admin_user_access_change_proposals_deny_authenticated on public.admin_user_access_change_proposals
  as restrictive for all to authenticated using(false) with check(false);
revoke all on public.admin_support_audit_events,public.admin_user_access_change_proposals from public,anon,authenticated;
grant select,insert on public.admin_support_audit_events to service_role;
grant select,insert,update on public.admin_user_access_change_proposals to service_role;
grant usage,select on sequence public.admin_support_audit_events_id_seq to service_role;

create or replace function public.prevent_admin_support_audit_mutation()
returns trigger language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  raise exception 'ADMIN_SUPPORT_AUDIT_IMMUTABLE' using errcode='55000';
end;
$function$;
create trigger trg_admin_support_audit_immutable before update or delete on public.admin_support_audit_events
for each row execute function public.prevent_admin_support_audit_mutation();

create or replace function public.current_user_has_support_capability(p_capability text)
returns boolean
language sql stable security definer
set search_path to 'public','pg_temp'
as $function$
  select public.is_app_user() and case p_capability
    when 'support.operations.view' then public.current_app_role() in ('ADMIN','MANAGER')
      or public.current_user_has_effective_app_permission(p_capability)
    when 'support.requests.triage' then public.current_app_role() in ('ADMIN','MANAGER')
      or public.current_user_has_effective_app_permission(p_capability)
    when 'support.user_lookup.view' then public.current_app_role()='ADMIN'
      or public.current_user_has_effective_app_permission(p_capability)
    else false end;
$function$;
revoke all on function public.current_user_has_support_capability(text) from public,anon;
grant execute on function public.current_user_has_support_capability(text) to authenticated,service_role;

create or replace function public.mask_admin_support_name(p_value text)
returns text language sql immutable
set search_path to 'public','pg_temp'
as $function$
  select case when nullif(btrim(coalesce(p_value,'')),'') is null then 'مستخدم'
    else left(btrim(p_value),1)||'***' end;
$function$;
create or replace function public.mask_admin_support_email(p_value text)
returns text language sql immutable
set search_path to 'public','pg_temp'
as $function$
  select case when coalesce(p_value,'') not like '%@%' then '***'
    else left(split_part(p_value,'@',1),1)||'***@'||left(split_part(p_value,'@',2),1)||'***' end;
$function$;
revoke all on function public.mask_admin_support_name(text),public.mask_admin_support_email(text) from public,anon,authenticated;
grant execute on function public.mask_admin_support_name(text),public.mask_admin_support_email(text) to service_role;

create or replace function public.get_admin_support_operations_snapshot(p_query text default null)
returns jsonb
language plpgsql stable security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_company uuid:=public.require_company_id();
  v_query text:=btrim(coalesce(p_query,''));
  v_can_lookup boolean;
  v_requests jsonb;
  v_users jsonb:='[]'::jsonb;
  v_audit jsonb:='[]'::jsonb;
  v_summary jsonb;
begin
  if v_actor is null or not public.current_user_has_support_capability('support.operations.view')
     or not public.is_company_member(v_company,v_actor) then
    raise exception 'SUPPORT_OPERATIONS_VIEW_REQUIRED' using errcode='42501';
  end if;
  if length(v_query)>100 then raise exception 'SUPPORT_OPERATIONS_QUERY_TOO_LONG' using errcode='22023'; end if;
  v_can_lookup:=public.current_user_has_support_capability('support.user_lookup.view');

  select jsonb_build_object(
    'open_requests',count(*) filter(where status not in ('RESOLVED','CLOSED')),
    'critical_high',count(*) filter(where urgency in ('CRITICAL','HIGH') and status not in ('RESOLVED','CLOSED')),
    'waiting_user',count(*) filter(where status='WAITING_USER'),
    'oldest_open_at',min(created_at) filter(where status not in ('RESOLVED','CLOSED')),
    'communication_dead',coalesce((select count(*) from public.communication_delivery_outbox c where c.company_id=v_company and c.status='DEAD'),0),
    'communication_suppressed_today',coalesce((select count(*) from public.communication_delivery_outbox c where c.company_id=v_company and c.status='SUPPRESSED' and timezone('Asia/Muscat',c.created_at)::date=timezone('Asia/Muscat',now())::date),0),
    'ai_reserved_today_microusd',coalesce((select sum(a.reserved_microusd) from public.ai_assistant_budget_reservations a where a.company_id=v_company and a.usage_date=timezone('UTC',now())::date),0)
  ) into v_summary from public.support_requests s where s.company_id=v_company;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'reference',s.reference,'category',s.category,'urgency',s.urgency,'status',s.status,
    'route',s.route,'app_version',s.app_version,'requester_role',s.requester_role,
    'public_note',s.public_note,'created_at',s.created_at,'updated_at',s.updated_at
  ) order by case s.urgency when 'CRITICAL' then 1 when 'HIGH' then 2 when 'NORMAL' then 3 else 4 end,s.created_at), '[]'::jsonb)
  into v_requests from (select * from public.support_requests where company_id=v_company
    and (v_query='' or reference ilike '%'||replace(replace(v_query,'%','\%'),'_','\_')||'%' escape '\')
    order by created_at desc limit 50) s;

  if v_can_lookup and length(v_query)>=3 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',q.id,'name_masked',public.mask_admin_support_name(coalesce(q.full_name,q.name)),
      'email_masked',public.mask_admin_support_email(q.email),'app_role',q.role,'company_role',q.company_role,
      'status',q.status,'is_active',q.is_active,'last_login',q.last_login
    ) order by q.name),'[]'::jsonb) into v_users
    from (
      select u.id,u.full_name,u.name,u.email,u.role,u.status,u.is_active,u.last_login,cm.role company_role
      from public.company_members cm join public.users u on u.id=cm.user_id
      where cm.company_id=v_company and cm.is_active and u.deleted_at is null
        and (u.email ilike '%'||replace(replace(v_query,'%','\%'),'_','\_')||'%' escape '\'
          or coalesce(u.full_name,u.name,'') ilike '%'||replace(replace(v_query,'%','\%'),'_','\_')||'%' escape '\')
      order by u.name limit 20
    ) q;
  end if;

  if v_can_lookup then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'actor_masked',public.mask_admin_support_name(u.name),'capability',e.capability,
      'action',e.action,'target_type',e.target_type,'outcome',e.outcome,'created_at',e.created_at
    ) order by e.created_at desc),'[]'::jsonb) into v_audit
    from (select * from public.admin_support_audit_events where company_id=v_company order by created_at desc limit 50) e
    left join public.users u on u.id=e.actor_id;
  end if;

  return jsonb_build_object(
    'capabilities',jsonb_build_object('view',true,'triage',public.current_user_has_support_capability('support.requests.triage'),'user_lookup',v_can_lookup),
    'summary',v_summary,'requests',v_requests,'users',v_users,'audit',v_audit,
    'limits',jsonb_build_object('request_rows',50,'user_rows',20,'bulk_actions',0,'exports',false,'impersonation',false)
  );
end;
$function$;
alter function public.get_admin_support_operations_snapshot(text) owner to postgres;
revoke all on function public.get_admin_support_operations_snapshot(text) from public,anon;
grant execute on function public.get_admin_support_operations_snapshot(text) to authenticated,service_role;

create or replace function public.triage_support_request_atomic(
  p_request_id uuid,p_status text,p_public_note text,p_reason text,p_idempotency_key uuid
) returns jsonb
language plpgsql security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_actor uuid:=auth.uid(); v_company uuid:=public.require_company_id();
  v_from text; v_to text:=upper(btrim(coalesce(p_status,''))); v_existing record;
begin
  if v_actor is null or not public.current_user_has_support_capability('support.requests.triage')
     or not public.is_company_member(v_company,v_actor) then
    raise exception 'SUPPORT_TRIAGE_REQUIRED' using errcode='42501';
  end if;
  p_reason:=btrim(coalesce(p_reason,'')); p_public_note:=nullif(btrim(coalesce(p_public_note,'')),'');
  if p_idempotency_key is null or length(p_reason) not between 10 and 500 or not public.support_text_is_safe(p_reason)
     or (p_public_note is not null and (length(p_public_note)>500 or not public.support_text_is_safe(p_public_note))) then
    raise exception 'SUPPORT_TRIAGE_INPUT_INVALID' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('support_triage:'||v_company::text||':'||p_idempotency_key::text,0));
  select * into v_existing from public.support_request_events where company_id=v_company and idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('request_id',v_existing.support_request_id,'status',v_existing.to_status,'duplicate',true); end if;

  select status into v_from from public.support_requests where id=p_request_id and company_id=v_company for update;
  if v_from is null then raise exception 'SUPPORT_REQUEST_NOT_FOUND' using errcode='P0002'; end if;
  if v_to='CLOSED' and public.current_app_role()<>'ADMIN' then raise exception 'SUPPORT_CLOSE_ADMIN_REQUIRED' using errcode='42501'; end if;
  if v_from is distinct from v_to and not (
    (v_from='ACKNOWLEDGED' and v_to in ('IN_REVIEW','CLOSED')) or
    (v_from='IN_REVIEW' and v_to in ('WAITING_USER','RESOLVED','CLOSED')) or
    (v_from='WAITING_USER' and v_to in ('IN_REVIEW','CLOSED')) or
    (v_from='RESOLVED' and v_to='CLOSED')
  ) then raise exception 'SUPPORT_STATUS_TRANSITION_INVALID' using errcode='22023'; end if;

  update public.support_requests set status=v_to,public_note=coalesce(p_public_note,public_note),
    resolved_at=case when v_to in ('RESOLVED','CLOSED') then coalesce(resolved_at,now()) else null end,updated_at=now()
  where id=p_request_id and company_id=v_company;
  insert into public.support_request_events(support_request_id,company_id,actor_id,event_type,from_status,to_status,reason,idempotency_key)
  values(p_request_id,v_company,v_actor,'STATUS_CHANGED',v_from,v_to,p_reason,p_idempotency_key);
  insert into public.admin_support_audit_events(company_id,actor_id,capability,action,target_type,target_id,reason,outcome,idempotency_key)
  values(v_company,v_actor,'support.requests.triage','SUPPORT_STATUS_CHANGED','support_request',p_request_id,p_reason,v_to,p_idempotency_key);
  return jsonb_build_object('request_id',p_request_id,'status',v_to,'duplicate',false,'updated_at',clock_timestamp());
end;
$function$;
alter function public.triage_support_request_atomic(uuid,text,text,text,uuid) owner to postgres;
revoke all on function public.triage_support_request_atomic(uuid,text,text,text,uuid) from public,anon;
grant execute on function public.triage_support_request_atomic(uuid,text,text,text,uuid) to authenticated,service_role;

-- Retire the historical reason-optional browser status RPC. Service role retains emergency access.
revoke execute on function public.update_support_request_status_atomic(uuid,text,text) from authenticated,service_role;

create or replace function public.propose_user_access_change_atomic(
  p_target_user_id uuid,p_proposed_role text,p_proposed_active boolean,p_reason text,p_idempotency_key uuid
) returns jsonb
language plpgsql security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_actor uuid:=auth.uid(); v_company uuid:=public.require_company_id(); v_target record; v_existing record; v_admin_count integer;
begin
  if v_actor is null or not public.current_user_has_support_capability('support.user_lookup.view')
     or not public.is_company_member(v_company,v_actor) then
    raise exception 'SUPPORT_USER_LOOKUP_REQUIRED' using errcode='42501';
  end if;
  p_reason:=btrim(coalesce(p_reason,'')); p_proposed_role:=upper(btrim(coalesce(p_proposed_role,'')));
  if p_idempotency_key is null or p_proposed_role not in ('ADMIN','MANAGER','ACCOUNTANT','OPERATIONS','USER','VIEWER')
     or length(p_reason) not between 10 and 500 or not public.support_text_is_safe(p_reason) then
    raise exception 'ACCESS_PROPOSAL_INPUT_INVALID' using errcode='22023';
  end if;
  if p_target_user_id=v_actor then raise exception 'ACCESS_PROPOSAL_SELF_CHANGE_PROHIBITED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('access_proposal:'||v_company::text||':'||p_idempotency_key::text,0));
  select * into v_existing from public.admin_user_access_change_proposals where company_id=v_company and idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('proposal_id',v_existing.id,'status',v_existing.status,'duplicate',true,'executed',false); end if;
  select u.id,u.role::text role,u.is_active into v_target
  from public.users u join public.company_members cm on cm.user_id=u.id and cm.company_id=v_company and cm.is_active
  where u.id=p_target_user_id and u.deleted_at is null for update;
  if not found then raise exception 'ACCESS_PROPOSAL_TARGET_NOT_FOUND' using errcode='P0002'; end if;
  if v_target.role='ADMIN' and (p_proposed_role<>'ADMIN' or not p_proposed_active) then
    select count(*) into v_admin_count from public.users u join public.company_members cm on cm.user_id=u.id
    where cm.company_id=v_company and cm.is_active and u.deleted_at is null and u.is_active and u.role::text='ADMIN';
    if v_admin_count<=1 then raise exception 'ACCESS_PROPOSAL_LAST_ADMIN_PROTECTED' using errcode='42501'; end if;
  end if;
  insert into public.admin_user_access_change_proposals(company_id,target_user_id,prior_role,proposed_role,current_active,proposed_active,reason,requested_by,idempotency_key)
  values(v_company,p_target_user_id,v_target.role,p_proposed_role,v_target.is_active,p_proposed_active,p_reason,v_actor,p_idempotency_key)
  returning * into v_existing;
  insert into public.admin_support_audit_events(company_id,actor_id,capability,action,target_type,target_id,reason,outcome,idempotency_key)
  values(v_company,v_actor,'support.user_lookup.view','USER_ACCESS_CHANGE_PROPOSED','user',p_target_user_id,p_reason,'PENDING_OWNER_APPROVAL',p_idempotency_key);
  return jsonb_build_object('proposal_id',v_existing.id,'status',v_existing.status,'duplicate',false,
    'current_role',v_existing.prior_role,'proposed_role',v_existing.proposed_role,
    'current_active',v_existing.current_active,'proposed_active',v_existing.proposed_active,'expires_at',v_existing.expires_at,
    'executed',false);
end;
$function$;
alter function public.propose_user_access_change_atomic(uuid,text,boolean,text,uuid) owner to postgres;
revoke all on function public.propose_user_access_change_atomic(uuid,text,boolean,text,uuid) from public,anon;
grant execute on function public.propose_user_access_change_atomic(uuid,text,boolean,text,uuid) to authenticated,service_role;

-- Direct browser mutation of user authority is retired. No execution RPC replaces it in this change.
drop policy if exists users_admin_write on public.users;
revoke insert,update,delete on public.users from authenticated;

comment on function public.get_admin_support_operations_snapshot(text) is 'Masked company-scoped support investigation; no descriptions, identifiers in audit preview, export, bulk action or impersonation.';
comment on function public.propose_user_access_change_atomic(uuid,text,boolean,text,uuid) is 'Non-executable access preview/proposal only. High-impact execution intentionally absent pending owner approval, reauthentication and maker-checker design.';

commit;

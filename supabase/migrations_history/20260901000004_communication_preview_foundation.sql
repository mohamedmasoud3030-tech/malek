-- SEC-002 / SEC-003 / SEC-005 / SEC-010 / UX-001 / UX-008
-- Provider-neutral communication preferences and metadata-only preview ledger.
-- External providers remain disabled: no address, rendered content, secret, URL or provider call is stored/performed.

begin;

create table public.communication_preferences (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  event_type text not null check (event_type in (
    'ACCESS_DECISION','SUPPORT_STATUS_CHANGED','PAYMENT_RECEIPT_POSTED','PAYMENT_RESULT_UNCERTAIN',
    'CONTRACT_EXPIRING','RENT_DUE_REMINDER','OVERDUE_FOLLOW_UP','MAINTENANCE_URGENT','OWNER_STATEMENT_READY'
  )),
  channel text not null check (channel in ('IN_APP','EMAIL','WHATSAPP','SMS','PUSH')),
  enabled boolean not null default false,
  locale text not null default 'ar' check (locale in ('ar','en')),
  timezone text not null default 'Asia/Muscat' check (timezone = 'Asia/Muscat'),
  quiet_hours_start smallint not null default 21 check (quiet_hours_start between 0 and 23),
  quiet_hours_end smallint not null default 8 check (quiet_hours_end between 0 and 23),
  updated_at timestamptz not null default now(),
  primary key(company_id,user_id,event_type,channel)
);

create table public.communication_delivery_outbox (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  recipient_user_id uuid not null,
  event_type text not null,
  channel text not null check (channel in ('IN_APP','EMAIL','WHATSAPP','SMS','PUSH')),
  template_key text not null check (length(template_key) between 1 and 120),
  template_version integer not null check (template_version > 0),
  locale text not null check (locale in ('ar','en')),
  source_type text not null check (length(source_type) between 1 and 64),
  source_id uuid,
  idempotency_key uuid not null,
  status text not null check (status in ('PREVIEW','SUPPRESSED','QUEUED','SENDING','SENT','DELIVERED','FAILED','DEAD','CANCELLED')),
  suppression_reason text,
  consent_confirmed_at timestamptz,
  human_reviewed_by uuid,
  human_reviewed_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  next_attempt_at timestamptz,
  provider_id text,
  provider_reference_hash text,
  last_error_code text,
  reserved_cost_microusd bigint not null default 0 check (reserved_cost_microusd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,recipient_user_id,channel,idempotency_key)
);

create index communication_delivery_outbox_status_idx
  on public.communication_delivery_outbox(company_id,status,next_attempt_at,created_at);
create index communication_delivery_outbox_recipient_idx
  on public.communication_delivery_outbox(company_id,recipient_user_id,created_at desc);

alter table public.communication_preferences enable row level security;
alter table public.communication_delivery_outbox enable row level security;
create policy communication_preferences_deny_authenticated on public.communication_preferences
  as restrictive for all to authenticated using(false) with check(false);
create policy communication_delivery_outbox_deny_authenticated on public.communication_delivery_outbox
  as restrictive for all to authenticated using(false) with check(false);
revoke all on public.communication_preferences, public.communication_delivery_outbox from public,anon,authenticated;
grant select,insert,update,delete on public.communication_preferences to service_role;
grant select,insert,update,delete on public.communication_delivery_outbox to service_role;

create or replace function public.communication_event_channel_allowed(p_event text,p_channel text)
returns boolean
language sql immutable
set search_path to 'public','pg_temp'
as $function$
  select case upper(p_event)
    when 'ACCESS_DECISION' then upper(p_channel)='IN_APP'
    when 'SUPPORT_STATUS_CHANGED' then upper(p_channel)='IN_APP'
    when 'PAYMENT_RECEIPT_POSTED' then upper(p_channel) in ('IN_APP','EMAIL','WHATSAPP')
    when 'PAYMENT_RESULT_UNCERTAIN' then upper(p_channel)='IN_APP'
    when 'CONTRACT_EXPIRING' then upper(p_channel) in ('IN_APP','EMAIL','WHATSAPP')
    when 'RENT_DUE_REMINDER' then upper(p_channel) in ('EMAIL','WHATSAPP')
    when 'OVERDUE_FOLLOW_UP' then upper(p_channel) in ('IN_APP','EMAIL','WHATSAPP')
    when 'MAINTENANCE_URGENT' then upper(p_channel)='IN_APP'
    when 'OWNER_STATEMENT_READY' then upper(p_channel) in ('IN_APP','EMAIL')
    else false end;
$function$;
revoke all on function public.communication_event_channel_allowed(text,text) from public,anon,authenticated;
grant execute on function public.communication_event_channel_allowed(text,text) to service_role;

create or replace function public.communication_event_requires_human_review(p_event text,p_channel text)
returns boolean
language sql immutable
set search_path to 'public','pg_temp'
as $function$
  select upper(p_channel) <> 'IN_APP'
     and upper(p_event) in ('PAYMENT_RECEIPT_POSTED','CONTRACT_EXPIRING','RENT_DUE_REMINDER','OVERDUE_FOLLOW_UP','OWNER_STATEMENT_READY');
$function$;
revoke all on function public.communication_event_requires_human_review(text,text) from public,anon,authenticated;
grant execute on function public.communication_event_requires_human_review(text,text) to service_role;

create or replace function public.communication_template_key(p_event text,p_channel text,p_locale text)
returns text
language sql immutable
set search_path to 'public','pg_temp'
as $function$
  select lower(p_event)||'.'||lower(p_channel)||'.'||lower(p_locale);
$function$;
revoke all on function public.communication_template_key(text,text,text) from public,anon,authenticated;
grant execute on function public.communication_template_key(text,text,text) to service_role;

create or replace function public.set_my_communication_preference_atomic(
  p_event_type text,
  p_channel text,
  p_enabled boolean,
  p_locale text default 'ar',
  p_quiet_hours_start integer default 21,
  p_quiet_hours_end integer default 8
) returns jsonb
language plpgsql security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_user uuid:=auth.uid();
  v_company uuid:=public.require_company_id();
  v_event text:=upper(btrim(coalesce(p_event_type,'')));
  v_channel text:=upper(btrim(coalesce(p_channel,'')));
begin
  if v_user is null or not public.is_app_user() or not public.is_company_member(v_company,v_user) then
    raise exception 'COMMUNICATION_ACTIVE_MEMBERSHIP_REQUIRED' using errcode='42501';
  end if;
  if not public.communication_event_channel_allowed(v_event,v_channel)
     or p_locale not in ('ar','en')
     or p_quiet_hours_start not between 0 and 23
     or p_quiet_hours_end not between 0 and 23 then
    raise exception 'COMMUNICATION_PREFERENCE_INVALID' using errcode='22023';
  end if;
  if v_channel='IN_APP' and v_event in ('ACCESS_DECISION','SUPPORT_STATUS_CHANGED','PAYMENT_RECEIPT_POSTED','PAYMENT_RESULT_UNCERTAIN','MAINTENANCE_URGENT') and not p_enabled then
    raise exception 'COMMUNICATION_TRANSACTIONAL_IN_APP_REQUIRED' using errcode='22023';
  end if;

  insert into public.communication_preferences(company_id,user_id,event_type,channel,enabled,locale,quiet_hours_start,quiet_hours_end)
  values(v_company,v_user,v_event,v_channel,p_enabled,p_locale,p_quiet_hours_start,p_quiet_hours_end)
  on conflict(company_id,user_id,event_type,channel) do update
    set enabled=excluded.enabled,locale=excluded.locale,
        quiet_hours_start=excluded.quiet_hours_start,quiet_hours_end=excluded.quiet_hours_end,updated_at=now();

  return jsonb_build_object('event_type',v_event,'channel',v_channel,'enabled',p_enabled,'locale',p_locale);
end;
$function$;
alter function public.set_my_communication_preference_atomic(text,text,boolean,text,integer,integer) owner to postgres;
revoke all on function public.set_my_communication_preference_atomic(text,text,boolean,text,integer,integer) from public,anon;
grant execute on function public.set_my_communication_preference_atomic(text,text,boolean,text,integer,integer) to authenticated,service_role;

create or replace function public.prepare_communication_preview_atomic(
  p_event_type text,
  p_channel text,
  p_recipient_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_idempotency_key uuid,
  p_locale text default 'ar',
  p_consent_confirmed boolean default false,
  p_human_reviewed boolean default false
) returns jsonb
language plpgsql security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_company uuid:=public.require_company_id();
  v_event text:=upper(btrim(coalesce(p_event_type,'')));
  v_channel text:=upper(btrim(coalesce(p_channel,'')));
  v_existing public.communication_delivery_outbox%rowtype;
  v_pref public.communication_preferences%rowtype;
  v_status text:='PREVIEW';
  v_reason text;
  v_daily_limit integer;
  v_today_count integer;
  v_local_hour integer;
begin
  if v_actor is null or not public.is_admin_or_manager() or not public.is_company_member(v_company,v_actor) then
    raise exception 'COMMUNICATION_PREVIEW_AUTHORITY_REQUIRED' using errcode='42501';
  end if;
  if p_recipient_user_id is null or not exists (
    select 1 from public.company_members cm
    join public.companies c on c.id=cm.company_id and c.is_active
    join public.users u on u.id=cm.user_id and u.deleted_at is null and u.is_active and u.status::text='ACTIVE'
    where cm.company_id=v_company and cm.user_id=p_recipient_user_id and cm.is_active
  ) then
    raise exception 'COMMUNICATION_RECIPIENT_COMPANY_MISMATCH' using errcode='42501';
  end if;
  if p_idempotency_key is null or length(btrim(coalesce(p_source_type,''))) not between 1 and 64
     or p_locale not in ('ar','en') or not public.communication_event_channel_allowed(v_event,v_channel) then
    raise exception 'COMMUNICATION_PREVIEW_INPUT_INVALID' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('communication:'||v_company::text||':'||p_recipient_user_id::text||':'||v_channel||':'||p_idempotency_key::text,0));
  select * into v_existing from public.communication_delivery_outbox
   where company_id=v_company and recipient_user_id=p_recipient_user_id and channel=v_channel and idempotency_key=p_idempotency_key;
  if found then
    return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'duplicate',true,'suppression_reason',v_existing.suppression_reason);
  end if;

  if v_channel <> 'IN_APP' then
    select * into v_pref from public.communication_preferences
     where company_id=v_company and user_id=p_recipient_user_id and event_type=v_event and channel=v_channel;
    if not found or not v_pref.enabled then v_status:='SUPPRESSED'; v_reason:='PREFERENCE_DISABLED';
    elsif not p_consent_confirmed then v_status:='SUPPRESSED'; v_reason:='CONSENT_REQUIRED';
    elsif public.communication_event_requires_human_review(v_event,v_channel) and not p_human_reviewed then v_status:='SUPPRESSED'; v_reason:='HUMAN_REVIEW_REQUIRED';
    else
      v_local_hour:=extract(hour from timezone(v_pref.timezone,clock_timestamp()))::integer;
      if v_pref.quiet_hours_start <> v_pref.quiet_hours_end and (
        (v_pref.quiet_hours_start>v_pref.quiet_hours_end and (v_local_hour>=v_pref.quiet_hours_start or v_local_hour<v_pref.quiet_hours_end))
        or (v_pref.quiet_hours_start<v_pref.quiet_hours_end and v_local_hour>=v_pref.quiet_hours_start and v_local_hour<v_pref.quiet_hours_end)
      ) then v_status:='SUPPRESSED'; v_reason:='QUIET_HOURS'; end if;
    end if;
  end if;

  v_daily_limit:=case v_event when 'SUPPORT_STATUS_CHANGED' then 10 when 'ACCESS_DECISION' then 5 when 'MAINTENANCE_URGENT' then 5 when 'PAYMENT_RESULT_UNCERTAIN' then 5 when 'PAYMENT_RECEIPT_POSTED' then 3 else 1 end;
  select count(*) into v_today_count from public.communication_delivery_outbox
   where company_id=v_company and recipient_user_id=p_recipient_user_id and event_type=v_event and channel=v_channel
     and timezone('Asia/Muscat',created_at)::date=timezone('Asia/Muscat',clock_timestamp())::date;
  if v_status='PREVIEW' and v_today_count>=v_daily_limit then v_status:='SUPPRESSED'; v_reason:='DAILY_RATE_LIMIT'; end if;

  insert into public.communication_delivery_outbox(
    company_id,recipient_user_id,event_type,channel,template_key,template_version,locale,
    source_type,source_id,idempotency_key,status,suppression_reason,
    consent_confirmed_at,human_reviewed_by,human_reviewed_at,reserved_cost_microusd
  ) values(
    v_company,p_recipient_user_id,v_event,v_channel,public.communication_template_key(v_event,v_channel,p_locale),1,p_locale,
    btrim(p_source_type),p_source_id,p_idempotency_key,v_status,v_reason,
    case when v_channel<>'IN_APP' and p_consent_confirmed then clock_timestamp() end,
    case when p_human_reviewed then v_actor end,
    case when p_human_reviewed then clock_timestamp() end,0
  ) returning * into v_existing;

  return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'duplicate',false,'suppression_reason',v_existing.suppression_reason,'provider_mode','PREVIEW','reserved_cost_microusd',0);
end;
$function$;
alter function public.prepare_communication_preview_atomic(text,text,uuid,text,uuid,uuid,text,boolean,boolean) owner to postgres;
revoke all on function public.prepare_communication_preview_atomic(text,text,uuid,text,uuid,uuid,text,boolean,boolean) from public,anon;
grant execute on function public.prepare_communication_preview_atomic(text,text,uuid,text,uuid,uuid,text,boolean,boolean) to authenticated,service_role;

-- Existing persisted permission notifications are transactional, but reasons may contain private text.
-- Replace preview copy with generic action/status language and keep only a safe canonical route.
update public.app_notifications
set title=case when type='permission_request' then 'طلب صلاحية يحتاج مراجعة' else 'تم تحديث حالة صلاحية' end,
    message=case when type='permission_request' then 'راجع طلب الصلاحية من المسار المعتمد داخل MALEK.' else 'راجع حالة الصلاحية من المسار المعتمد داخل MALEK.' end,
    link='/settings?section=users-permissions'
where type in ('permission_request','permission_decision');
update public.app_notifications set title='إشعار'
where coalesce(title,'') ~* '(password|token|secret|authorization[[:space:]]*:|[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+|([0-9][[:space:]-]*){8,})';
update public.app_notifications set message='يوجد تحديث يحتاج مراجعة داخل MALEK.'
where coalesce(message,'') ~* '(password|token|secret|authorization[[:space:]]*:|[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+|([0-9][[:space:]-]*){8,})';
update public.app_notifications set link='/dashboard'
where coalesce(link,'') not like '/%' or coalesce(link,'') ~* '(@|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';

create or replace function public.sanitize_app_notification_content()
returns trigger language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  if new.type='permission_request' then
    new.title:='طلب صلاحية يحتاج مراجعة'; new.message:='راجع طلب الصلاحية من المسار المعتمد داخل MALEK.'; new.link:='/settings?section=users-permissions';
  elsif new.type='permission_decision' then
    new.title:='تم تحديث حالة صلاحية'; new.message:='راجع حالة الصلاحية من المسار المعتمد داخل MALEK.'; new.link:='/settings?section=users-permissions';
  end if;
  if coalesce(new.link,'') not like '/%' or coalesce(new.link,'') ~* '(@|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})' then new.link:='/dashboard'; end if;
  if coalesce(new.title,'') ~* '(password|token|secret|authorization[[:space:]]*:|[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+|([0-9][[:space:]-]*){8,})' then new.title:='إشعار'; end if;
  if coalesce(new.message,'') ~* '(password|token|secret|authorization[[:space:]]*:|[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+|([0-9][[:space:]-]*){8,})' then new.message:='يوجد تحديث يحتاج مراجعة داخل MALEK.'; end if;
  new.title:=left(coalesce(nullif(btrim(new.title),''),'إشعار'),120);
  new.message:=left(coalesce(new.message,''),240);
  return new;
end;
$function$;
drop trigger if exists trg_sanitize_app_notification_content on public.app_notifications;
create trigger trg_sanitize_app_notification_content before insert or update of title,message,link,type on public.app_notifications
for each row execute function public.sanitize_app_notification_content();

-- Automation notifications are internal operational signals, not entity detail previews.
update public.automation_notifications
set body=case type when 'contract_expiry' then 'يوجد عقد يقترب من نهايته ويحتاج مراجعة.'
  when 'overdue_invoice' then 'توجد متأخرات تحتاج مراجعة من المسار المعتمد.'
  when 'maintenance_overdue' then 'يوجد طلب صيانة يحتاج متابعة.'
  else 'يوجد تحديث تشغيلي يحتاج مراجعة داخل MALEK.' end;

create or replace function public.sanitize_automation_notification_content()
returns trigger language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  new.body:=case new.type when 'contract_expiry' then 'يوجد عقد يقترب من نهايته ويحتاج مراجعة.'
    when 'overdue_invoice' then 'توجد متأخرات تحتاج مراجعة من المسار المعتمد.'
    when 'maintenance_overdue' then 'يوجد طلب صيانة يحتاج متابعة.'
    else 'يوجد تحديث تشغيلي يحتاج مراجعة داخل MALEK.' end;
  new.title:=case new.type when 'contract_expiry' then 'متابعة عقد'
    when 'overdue_invoice' then 'متابعة متأخرات'
    when 'maintenance_overdue' then 'متابعة صيانة'
    else 'تحديث تشغيلي' end;
  return new;
end;
$function$;
drop trigger if exists trg_sanitize_automation_notification_content on public.automation_notifications;
create trigger trg_sanitize_automation_notification_content before insert or update of title,body,type on public.automation_notifications
for each row execute function public.sanitize_automation_notification_content();

drop policy if exists app_read_automation_notifications on public.automation_notifications;
drop policy if exists manager_write_automation_notifications on public.automation_notifications;
create policy automation_notifications_manager_read on public.automation_notifications for select to authenticated
  using(public.is_admin_or_manager());
create policy automation_notifications_manager_update on public.automation_notifications for update to authenticated
  using(public.is_admin_or_manager()) with check(public.is_admin_or_manager());
revoke insert,delete on public.automation_notifications from authenticated;
grant select,update(is_read) on public.automation_notifications to authenticated;

comment on table public.communication_delivery_outbox is 'Metadata-only provider-neutral preview/outbox. Current preparation emits PREVIEW/SUPPRESSED only; live queueing requires a separately approved migration/provider.';
comment on function public.prepare_communication_preview_atomic(text,text,uuid,text,uuid,uuid,text,boolean,boolean) is 'Company-authorized, preference/consent/review/quiet-hour/rate-limit/idempotency enforcement. No external send and no recipient address/content storage.';

commit;

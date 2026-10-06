-- SEC-002 / SEC-003 / SEC-005 / SEC-009 / SEC-010
-- Durable Postgres-backed jobs using the existing Supabase stack. No paid queue and no Production schedule activation.
-- Payloads are type-specific identifiers only; no secrets, recipient addresses, document text or financial amounts.

begin;

create table public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_type text not null check(job_type in ('AUTOMATION_RULE_EVALUATION','CLEANUP_AI_METADATA','CLEANUP_JOB_RETENTION')),
  payload jsonb not null default '{}'::jsonb check(octet_length(payload::text)<=2048),
  status text not null default 'QUEUED' check(status in ('QUEUED','RUNNING','RETRY_WAIT','SUCCEEDED','DEAD','CANCELLED')),
  priority smallint not null default 50 check(priority between 1 and 100),
  available_at timestamptz not null default now(),
  attempt_count smallint not null default 0 check(attempt_count between 0 and 3),
  max_attempts smallint not null default 3 check(max_attempts between 1 and 3),
  lease_expires_at timestamptz,
  locked_by uuid,
  cancellation_requested boolean not null default false,
  cancellation_reason text check(cancellation_reason is null or length(cancellation_reason) between 10 and 300),
  progress_current integer not null default 0 check(progress_current>=0),
  progress_total integer check(progress_total is null or progress_total>=0),
  progress_code text,
  idempotency_key text not null check(length(idempotency_key) between 1 and 200 and idempotency_key ~ '^[A-Za-z0-9:._-]+$'),
  source_type text not null check(length(source_type) between 1 and 64),
  source_id text,
  result_summary jsonb not null default '{}'::jsonb check(octet_length(result_summary::text)<=2048),
  last_error_code text,
  estimated_cost_microusd bigint not null default 0 check(estimated_cost_microusd=0),
  requested_by uuid,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,job_type,idempotency_key)
);

create table public.background_job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.background_jobs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  event_type text not null check(event_type in ('ENQUEUED','CLAIMED','RETRY_SCHEDULED','SUCCEEDED','DEAD','CANCEL_REQUESTED','CANCELLED')),
  attempt_count smallint not null,
  code text,
  request_key uuid,
  created_at timestamptz not null default now()
);

create table public.background_job_schedules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  schedule_name text not null check(length(schedule_name) between 1 and 100),
  job_type text not null check(job_type in ('AUTOMATION_RULE_EVALUATION','CLEANUP_AI_METADATA','CLEANUP_JOB_RETENTION')),
  payload jsonb not null default '{}'::jsonb check(octet_length(payload::text)<=2048),
  interval_minutes integer not null check(interval_minutes between 5 and 43200),
  timezone text not null default 'Asia/Muscat' check(timezone='Asia/Muscat'),
  enabled boolean not null default false,
  next_run_at timestamptz not null default now(),
  source_type text not null,
  source_id text,
  failure_count integer not null default 0 check(failure_count>=0),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,schedule_name)
);

create index background_jobs_claim_idx on public.background_jobs(company_id,status,available_at,priority,created_at)
  where status in ('QUEUED','RETRY_WAIT','RUNNING');
create index background_jobs_retention_idx on public.background_jobs(company_id,status,finished_at);
create index background_job_events_job_idx on public.background_job_events(job_id,created_at);
create unique index background_job_events_request_key_idx on public.background_job_events(company_id,request_key) where request_key is not null;
create index background_job_schedules_due_idx on public.background_job_schedules(enabled,next_run_at) where enabled;

alter table public.background_jobs enable row level security;
alter table public.background_job_events enable row level security;
alter table public.background_job_schedules enable row level security;
create policy background_jobs_deny_authenticated on public.background_jobs as restrictive for all to authenticated using(false) with check(false);
create policy background_job_events_deny_authenticated on public.background_job_events as restrictive for all to authenticated using(false) with check(false);
create policy background_job_schedules_deny_authenticated on public.background_job_schedules as restrictive for all to authenticated using(false) with check(false);
revoke all on public.background_jobs,public.background_job_events,public.background_job_schedules from public,anon,authenticated;
grant select,insert,update,delete on public.background_jobs to service_role;
grant select,insert,delete on public.background_job_events to service_role;
grant select,insert,update,delete on public.background_job_schedules to service_role;
grant usage,select on sequence public.background_job_events_id_seq to service_role;

create or replace function public.prevent_background_job_event_mutation()
returns trigger language plpgsql set search_path to 'public','pg_temp'
as $function$
begin
  if tg_op='DELETE' and coalesce(auth.role(),'')='service_role' then return old; end if;
  raise exception 'BACKGROUND_JOB_EVENT_IMMUTABLE' using errcode='55000';
end;
$function$;
create trigger trg_background_job_events_immutable before update or delete on public.background_job_events
for each row execute function public.prevent_background_job_event_mutation();

create or replace function public.is_background_service_worker()
returns boolean language sql stable
set search_path to 'public','pg_temp'
as $function$
  select coalesce(auth.role(),'')='service_role';
$function$;
revoke all on function public.is_background_service_worker() from public,anon,authenticated;
grant execute on function public.is_background_service_worker() to service_role;

create or replace function public.background_job_payload_valid(p_job_type text,p_payload jsonb)
returns boolean language sql immutable
set search_path to 'public','pg_temp'
as $function$
  select case p_job_type
    when 'AUTOMATION_RULE_EVALUATION' then jsonb_typeof(p_payload)='object'
      and (select array_agg(k order by k) from jsonb_object_keys(p_payload) k)=array['rule_id']::text[]
      and jsonb_typeof(p_payload->'rule_id')='string' and length(p_payload->>'rule_id') between 1 and 120
    when 'CLEANUP_AI_METADATA' then p_payload='{}'::jsonb
    when 'CLEANUP_JOB_RETENTION' then p_payload='{}'::jsonb
    else false end
    and p_payload::text !~* '(password|secret|token|api[_ -]?key|authorization|email|phone|amount|document|content|message)';
$function$;
revoke all on function public.background_job_payload_valid(text,jsonb) from public,anon,authenticated;
grant execute on function public.background_job_payload_valid(text,jsonb) to service_role;

create or replace function public.enqueue_background_job_internal(
  p_company_id uuid,p_job_type text,p_payload jsonb,p_idempotency_key text,p_source_type text,p_source_id text,
  p_requested_by uuid default null,p_available_at timestamptz default now(),p_priority integer default 50
) returns jsonb
language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_job public.background_jobs%rowtype; v_active integer;
begin
  if p_company_id is null or not exists(select 1 from public.companies c where c.id=p_company_id and c.is_active)
     or not public.background_job_payload_valid(p_job_type,p_payload)
     or p_idempotency_key !~ '^[A-Za-z0-9:._-]{1,200}$'
     or length(btrim(coalesce(p_source_type,''))) not between 1 and 64
     or p_available_at>now()+interval '30 days' or p_priority not between 1 and 100 then
    raise exception 'BACKGROUND_JOB_INPUT_INVALID' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('background_enqueue:'||p_company_id::text||':'||p_job_type||':'||p_idempotency_key,0));
  select * into v_job from public.background_jobs where company_id=p_company_id and job_type=p_job_type and idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('job_id',v_job.id,'status',v_job.status,'duplicate',true); end if;
  select count(*) into v_active from public.background_jobs where company_id=p_company_id and status in ('QUEUED','RUNNING','RETRY_WAIT');
  if v_active>=1000 then raise exception 'BACKGROUND_JOB_COMPANY_QUEUE_LIMIT' using errcode='54000'; end if;

  insert into public.background_jobs(company_id,job_type,payload,idempotency_key,source_type,source_id,requested_by,available_at,priority)
  values(p_company_id,p_job_type,p_payload,p_idempotency_key,btrim(p_source_type),nullif(btrim(coalesce(p_source_id,'')),''),p_requested_by,p_available_at,p_priority)
  returning * into v_job;
  insert into public.background_job_events(job_id,company_id,event_type,attempt_count,code)
  values(v_job.id,p_company_id,'ENQUEUED',0,'ENQUEUED');
  return jsonb_build_object('job_id',v_job.id,'status',v_job.status,'duplicate',false,'estimated_cost_microusd',0);
end;
$function$;
alter function public.enqueue_background_job_internal(uuid,text,jsonb,text,text,text,uuid,timestamptz,integer) owner to postgres;
revoke all on function public.enqueue_background_job_internal(uuid,text,jsonb,text,text,text,uuid,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.enqueue_background_job_internal(uuid,text,jsonb,text,text,text,uuid,timestamptz,integer) to service_role;

create or replace function public.enqueue_automation_rule_job_atomic(p_rule_id text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_company uuid:=public.require_company_id(); v_actor uuid:=auth.uid(); v_daily integer;
begin
  if v_actor is null or not public.is_admin_or_manager() or not public.is_company_member(v_company,v_actor) then
    raise exception 'AUTOMATION_JOB_AUTHORITY_REQUIRED' using errcode='42501';
  end if;
  if p_request_id is null or not exists(select 1 from public.automation_rules r where r.id=p_rule_id and r.company_id=v_company and r.deleted_at is null and r.is_enabled
    and r.rule_type in ('contract_expiry','overdue_invoice','maintenance_overdue')) then
    raise exception 'AUTOMATION_JOB_RULE_INVALID' using errcode='22023';
  end if;
  select count(*) into v_daily from public.background_jobs where company_id=v_company and job_type='AUTOMATION_RULE_EVALUATION'
    and timezone('Asia/Muscat',created_at)::date=timezone('Asia/Muscat',now())::date;
  if v_daily>=100 then raise exception 'AUTOMATION_JOB_DAILY_LIMIT' using errcode='54000'; end if;
  return public.enqueue_background_job_internal(v_company,'AUTOMATION_RULE_EVALUATION',jsonb_build_object('rule_id',p_rule_id),
    'manual:'||p_request_id::text,'automation_rule',p_rule_id,v_actor,now(),40);
end;
$function$;
alter function public.enqueue_automation_rule_job_atomic(text,uuid) owner to postgres;
revoke all on function public.enqueue_automation_rule_job_atomic(text,uuid) from public,anon;
grant execute on function public.enqueue_automation_rule_job_atomic(text,uuid) to authenticated,service_role;

create or replace function public.dispatch_due_background_schedules_atomic(p_now timestamptz default now(),p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare s record; v_count integer:=0; v_failed integer:=0; v_result jsonb; v_key text;
begin
  if not public.is_background_service_worker() or p_limit not between 1 and 50 then
    raise exception 'BACKGROUND_WORKER_REQUIRED' using errcode='42501';
  end if;
  for s in select * from public.background_job_schedules where enabled and next_run_at<=p_now
    order by next_run_at,id for update skip locked limit p_limit
  loop
    begin
      v_key:='schedule:'||s.id::text||':'||to_char(s.next_run_at at time zone s.timezone,'YYYYMMDDHH24MI');
      v_result:=public.enqueue_background_job_internal(s.company_id,s.job_type,s.payload,v_key,s.source_type,s.source_id,null,s.next_run_at,50);
      update public.background_job_schedules set next_run_at=next_run_at+make_interval(mins=>interval_minutes),failure_count=0,last_error_code=null,updated_at=now() where id=s.id;
      v_count:=v_count+1;
    exception when others then
      update public.background_job_schedules set enabled=false,failure_count=failure_count+1,last_error_code='SCHEDULE_DISPATCH_FAILED',updated_at=now() where id=s.id;
      v_failed:=v_failed+1;
    end;
  end loop;
  return jsonb_build_object('dispatched',v_count,'failed_disabled',v_failed,'schedule_limit',p_limit);
end;
$function$;
alter function public.dispatch_due_background_schedules_atomic(timestamptz,integer) owner to postgres;
revoke all on function public.dispatch_due_background_schedules_atomic(timestamptz,integer) from public,anon,authenticated;
grant execute on function public.dispatch_due_background_schedules_atomic(timestamptz,integer) to service_role;

create or replace function public.list_background_job_companies_atomic(p_limit integer default 5)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp'
as $function$
declare v_result jsonb;
begin
  if not public.is_background_service_worker() or p_limit not between 1 and 10 then
    raise exception 'BACKGROUND_WORKER_REQUIRED' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(company_id order by oldest_at),'[]'::jsonb) into v_result
  from (
    select company_id,min(available_at) oldest_at from public.background_jobs
    where status in ('QUEUED','RETRY_WAIT','RUNNING')
      and (status='RUNNING' or available_at<=now())
    group by company_id order by oldest_at limit p_limit
  ) q;
  return v_result;
end;
$function$;
alter function public.list_background_job_companies_atomic(integer) owner to postgres;
revoke all on function public.list_background_job_companies_atomic(integer) from public,anon,authenticated;
grant execute on function public.list_background_job_companies_atomic(integer) to service_role;

create or replace function public.claim_background_jobs_atomic(p_company_id uuid,p_worker_id uuid,p_limit integer default 5)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_jobs jsonb;
begin
  if not public.is_background_service_worker() or p_worker_id is null or p_limit not between 1 and 5 then
    raise exception 'BACKGROUND_WORKER_REQUIRED' using errcode='42501';
  end if;
  update public.background_jobs set status='DEAD',finished_at=now(),lease_expires_at=null,locked_by=null,last_error_code='LEASE_EXPIRED_MAX_ATTEMPTS',updated_at=now()
   where company_id=p_company_id and status='RUNNING' and lease_expires_at<now() and attempt_count>=max_attempts;
  insert into public.background_job_events(job_id,company_id,event_type,attempt_count,code)
   select id,company_id,'DEAD',attempt_count,'LEASE_EXPIRED_MAX_ATTEMPTS' from public.background_jobs
   where company_id=p_company_id and status='DEAD' and last_error_code='LEASE_EXPIRED_MAX_ATTEMPTS'
     and not exists(select 1 from public.background_job_events e where e.job_id=background_jobs.id and e.event_type='DEAD');
  update public.background_jobs set status='RETRY_WAIT',available_at=now(),lease_expires_at=null,locked_by=null,last_error_code='LEASE_EXPIRED',updated_at=now()
   where company_id=p_company_id and status='RUNNING' and lease_expires_at<now() and attempt_count<max_attempts;

  with candidates as (
    select id from public.background_jobs where company_id=p_company_id and status in ('QUEUED','RETRY_WAIT')
      and available_at<=now() and not cancellation_requested
    order by priority,available_at,created_at for update skip locked limit p_limit
  ), claimed as (
    update public.background_jobs j set status='RUNNING',attempt_count=attempt_count+1,locked_by=p_worker_id,
      lease_expires_at=now()+interval '5 minutes',started_at=coalesce(started_at,now()),updated_at=now()
    from candidates c where j.id=c.id returning j.*
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'job_type',job_type,'payload',payload,'attempt_count',attempt_count,'lease_expires_at',lease_expires_at)
    order by priority,created_at),'[]'::jsonb) into v_jobs from claimed;
  insert into public.background_job_events(job_id,company_id,event_type,attempt_count,code)
   select j.id,j.company_id,'CLAIMED',j.attempt_count,'CLAIMED' from public.background_jobs j
   where j.company_id=p_company_id and j.locked_by=p_worker_id and j.status='RUNNING'
     and j.updated_at>=now()-interval '5 seconds'
     and not exists(select 1 from public.background_job_events e where e.job_id=j.id and e.event_type='CLAIMED' and e.attempt_count=j.attempt_count);
  return v_jobs;
end;
$function$;
alter function public.claim_background_jobs_atomic(uuid,uuid,integer) owner to postgres;
revoke all on function public.claim_background_jobs_atomic(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_background_jobs_atomic(uuid,uuid,integer) to service_role;

create or replace function public.process_automation_rule_background_internal(p_company_id uuid,p_rule_id text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare r public.automation_rules%rowtype; v_run uuid; v_count integer:=0; v_type text; v_title text; v_body text;
begin
  select * into r from public.automation_rules where id=p_rule_id and company_id=p_company_id and deleted_at is null and is_enabled for update;
  if not found then return jsonb_build_object('success',false,'code','AUTOMATION_RULE_UNAVAILABLE'); end if;
  perform pg_advisory_xact_lock(hashtextextended('background_automation:'||p_company_id::text||':'||p_rule_id,0));
  insert into public.automation_runs(job_name,rule_id,status,started_at,company_id)
  values(r.name,r.id,'running',extract(epoch from now())*1000,p_company_id) returning id into v_run;

  if r.rule_type='contract_expiry' then
    select count(*) into v_count from public.contracts c where c.company_id=p_company_id and c.deleted_at is null
      and lower(c.status::text)='active' and c.end_date between current_date and current_date+30;
    v_type:='contract_expiry'; v_title:='متابعة عقود'; v_body:='توجد عقود تقترب من نهايتها وتحتاج مراجعة.';
  elsif r.rule_type='overdue_invoice' then
    select count(*) into v_count from public.invoices i where i.company_id=p_company_id and i.deleted_at is null
      and lower(i.status::text) not in ('paid','cancelled','void') and i.due_date<current_date
      and (i.amount-coalesce(i.paid_amount,0))>0;
    v_type:='overdue_invoice'; v_title:='متابعة متأخرات'; v_body:='توجد متأخرات تحتاج مراجعة من المسار المعتمد.';
  elsif r.rule_type='maintenance_overdue' then
    select count(*) into v_count from public.maintenance_records m where m.company_id=p_company_id and m.deleted_at is null
      and lower(m.status::text) in ('open','in_progress') and m.created_at<now()-interval '7 days';
    v_type:='maintenance_overdue'; v_title:='متابعة صيانة'; v_body:='توجد طلبات صيانة تحتاج متابعة.';
  else
    update public.automation_runs set completed_at=extract(epoch from now())*1000,status='failed',error_message='UNSUPPORTED_RULE_TYPE' where id=v_run;
    return jsonb_build_object('success',false,'code','UNSUPPORTED_RULE_TYPE');
  end if;

  if v_count>0 then
    insert into public.automation_notifications(rule_id,run_id,type,title,body,related_entity_type,related_entity_id,company_id)
    values(r.id,v_run,v_type,v_title,v_body,null,null,p_company_id);
  end if;
  update public.automation_runs set completed_at=extract(epoch from now())*1000,status='success',items_processed=v_count,
    actions_taken=jsonb_build_array(jsonb_build_object('aggregate_notification_created',v_count>0)) where id=v_run;
  update public.automation_rules set last_run_at=now(),last_run_status='SUCCESS',
    last_run_result='Processed aggregate count: '||v_count,updated_at=now() where id=r.id and company_id=p_company_id;
  return jsonb_build_object('success',true,'run_id',v_run,'processed',v_count,'notifications',case when v_count>0 then 1 else 0 end);
end;
$function$;
alter function public.process_automation_rule_background_internal(uuid,text) owner to postgres;
revoke all on function public.process_automation_rule_background_internal(uuid,text) from public,anon,authenticated;
grant execute on function public.process_automation_rule_background_internal(uuid,text) to service_role;

create or replace function public.process_background_job_atomic(p_job_id uuid,p_worker_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare j public.background_jobs%rowtype; v_result jsonb; v_ok boolean:=false; v_delay integer; v_deleted integer:=0;
begin
  if not public.is_background_service_worker() or p_worker_id is null then raise exception 'BACKGROUND_WORKER_REQUIRED' using errcode='42501'; end if;
  select * into j from public.background_jobs where id=p_job_id and status='RUNNING' and locked_by=p_worker_id and lease_expires_at>now() for update;
  if not found then raise exception 'BACKGROUND_JOB_LEASE_INVALID' using errcode='55000'; end if;
  if j.cancellation_requested then
    update public.background_jobs set status='CANCELLED',finished_at=now(),locked_by=null,lease_expires_at=null,progress_code='CANCELLED',updated_at=now() where id=j.id;
    insert into public.background_job_events(job_id,company_id,event_type,attempt_count,code) values(j.id,j.company_id,'CANCELLED',j.attempt_count,'CANCELLED');
    return jsonb_build_object('job_id',j.id,'status','CANCELLED');
  end if;
  perform set_config('statement_timeout','45s',true);
  begin
    if j.job_type='AUTOMATION_RULE_EVALUATION' then
      v_result:=public.process_automation_rule_background_internal(j.company_id,j.payload->>'rule_id');
      v_ok:=coalesce((v_result->>'success')::boolean,false);
      if not v_ok then raise exception 'AUTOMATION_RULE_EVALUATION_FAILED'; end if;
      update public.background_jobs set progress_current=coalesce((v_result->>'processed')::integer,0),
        progress_total=coalesce((v_result->>'processed')::integer,0),progress_code='AUTOMATION_COMPLETE',
        result_summary=jsonb_build_object('processed',coalesce((v_result->>'processed')::integer,0),'notifications',coalesce((v_result->>'notifications')::integer,0)) where id=j.id;
    elsif j.job_type='CLEANUP_AI_METADATA' then
      delete from public.ai_assistant_rate_limits where ctid in (select ctid from public.ai_assistant_rate_limits where company_id=j.company_id and window_started_at<now()-interval '1 day' limit 500);
      get diagnostics v_deleted=row_count;
      delete from public.ai_assistant_budget_reservations where ctid in (select ctid from public.ai_assistant_budget_reservations where company_id=j.company_id and usage_date<current_date-90 limit 500);
      get diagnostics v_delay=row_count; v_deleted:=v_deleted+v_delay; v_ok:=true;
      update public.background_jobs set progress_current=v_deleted,progress_total=v_deleted,progress_code='CLEANUP_COMPLETE',result_summary=jsonb_build_object('deleted',v_deleted) where id=j.id;
    elsif j.job_type='CLEANUP_JOB_RETENTION' then
      delete from public.background_jobs where ctid in (select ctid from public.background_jobs where company_id=j.company_id and id<>j.id
        and ((status in ('SUCCEEDED','CANCELLED') and finished_at<now()-interval '30 days') or (status='DEAD' and finished_at<now()-interval '90 days')) limit 500);
      get diagnostics v_deleted=row_count; v_ok:=true;
      update public.background_jobs set progress_current=v_deleted,progress_total=v_deleted,progress_code='CLEANUP_COMPLETE',result_summary=jsonb_build_object('deleted',v_deleted) where id=j.id;
    else raise exception 'BACKGROUND_JOB_TYPE_UNSUPPORTED'; end if;

    update public.background_jobs set status='SUCCEEDED',finished_at=now(),locked_by=null,lease_expires_at=null,last_error_code=null,updated_at=now() where id=j.id;
    insert into public.background_job_events(job_id,company_id,event_type,attempt_count,code) values(j.id,j.company_id,'SUCCEEDED',j.attempt_count,'SUCCEEDED');
    return jsonb_build_object('job_id',j.id,'status','SUCCEEDED','result',coalesce(v_result,'{}'::jsonb));
  exception when others then
    v_delay:=case j.attempt_count when 1 then 60 when 2 then 300 else 1800 end;
    if j.attempt_count>=j.max_attempts or SQLSTATE in ('22023','42501','42P01','42883') then
      update public.background_jobs set status='DEAD',finished_at=now(),locked_by=null,lease_expires_at=null,last_error_code='PERMANENT_JOB_FAILURE',progress_code='DEAD',updated_at=now() where id=j.id;
      insert into public.background_job_events(job_id,company_id,event_type,attempt_count,code) values(j.id,j.company_id,'DEAD',j.attempt_count,'PERMANENT_JOB_FAILURE');
      return jsonb_build_object('job_id',j.id,'status','DEAD','error_code','PERMANENT_JOB_FAILURE');
    end if;
    update public.background_jobs set status='RETRY_WAIT',available_at=now()+make_interval(secs=>v_delay),locked_by=null,lease_expires_at=null,
      last_error_code='TRANSIENT_JOB_FAILURE',progress_code='RETRY_WAIT',updated_at=now() where id=j.id;
    insert into public.background_job_events(job_id,company_id,event_type,attempt_count,code) values(j.id,j.company_id,'RETRY_SCHEDULED',j.attempt_count,'TRANSIENT_JOB_FAILURE');
    return jsonb_build_object('job_id',j.id,'status','RETRY_WAIT','retry_after_seconds',v_delay,'error_code','TRANSIENT_JOB_FAILURE');
  end;
end;
$function$;
alter function public.process_background_job_atomic(uuid,uuid) owner to postgres;
revoke all on function public.process_background_job_atomic(uuid,uuid) from public,anon,authenticated;
grant execute on function public.process_background_job_atomic(uuid,uuid) to service_role;

create or replace function public.cancel_background_job_atomic(p_job_id uuid,p_reason text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_company uuid:=public.require_company_id(); v_actor uuid:=auth.uid(); j public.background_jobs%rowtype; v_prior record;
begin
  if v_actor is null or not public.is_admin_or_manager() or not public.is_company_member(v_company,v_actor) then raise exception 'BACKGROUND_JOB_CANCEL_AUTHORITY_REQUIRED' using errcode='42501'; end if;
  if p_idempotency_key is null or length(btrim(coalesce(p_reason,''))) not between 10 and 300
     or not public.support_text_is_safe(p_reason) then raise exception 'BACKGROUND_JOB_CANCEL_INPUT_INVALID' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('background_cancel:'||v_company::text||':'||p_idempotency_key::text,0));
  select * into v_prior from public.background_job_events where company_id=v_company and request_key=p_idempotency_key;
  if found then return jsonb_build_object('job_id',v_prior.job_id,'event',v_prior.event_type,'duplicate',true); end if;
  select * into j from public.background_jobs where id=p_job_id and company_id=v_company for update;
  if not found then raise exception 'BACKGROUND_JOB_NOT_FOUND' using errcode='P0002'; end if;
  if j.status in ('SUCCEEDED','DEAD','CANCELLED') then return jsonb_build_object('job_id',j.id,'status',j.status,'changed',false); end if;
  if j.status='RUNNING' then
    update public.background_jobs set cancellation_requested=true,cancellation_reason=btrim(p_reason),progress_code='CANCEL_REQUESTED',updated_at=now() where id=j.id;
    insert into public.background_job_events(job_id,company_id,event_type,attempt_count,code,request_key) values(j.id,j.company_id,'CANCEL_REQUESTED',j.attempt_count,'CANCEL_REQUESTED',p_idempotency_key);
    return jsonb_build_object('job_id',j.id,'status','RUNNING','cancellation_requested',true);
  end if;
  update public.background_jobs set status='CANCELLED',finished_at=now(),cancellation_reason=btrim(p_reason),progress_code='CANCELLED',updated_at=now() where id=j.id;
  insert into public.background_job_events(job_id,company_id,event_type,attempt_count,code,request_key) values(j.id,j.company_id,'CANCELLED',j.attempt_count,'CANCELLED',p_idempotency_key);
  return jsonb_build_object('job_id',j.id,'status','CANCELLED','changed',true);
end;
$function$;
alter function public.cancel_background_job_atomic(uuid,text,uuid) owner to postgres;
revoke all on function public.cancel_background_job_atomic(uuid,text,uuid) from public,anon;
grant execute on function public.cancel_background_job_atomic(uuid,text,uuid) to authenticated,service_role;

create or replace function public.get_background_job_status(p_job_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp'
as $function$
declare v_company uuid:=public.require_company_id(); v_actor uuid:=auth.uid(); j public.background_jobs%rowtype;
begin
  if v_actor is null or not public.is_admin_or_manager() or not public.is_company_member(v_company,v_actor) then raise exception 'BACKGROUND_JOB_VIEW_AUTHORITY_REQUIRED' using errcode='42501'; end if;
  select * into j from public.background_jobs where id=p_job_id and company_id=v_company;
  if not found then raise exception 'BACKGROUND_JOB_NOT_FOUND' using errcode='P0002'; end if;
  return jsonb_build_object('id',j.id,'job_type',j.job_type,'status',j.status,'attempt_count',j.attempt_count,'max_attempts',j.max_attempts,
    'available_at',j.available_at,'progress_current',j.progress_current,'progress_total',j.progress_total,'progress_code',j.progress_code,
    'last_error_code',j.last_error_code,'cancellation_requested',j.cancellation_requested,'created_at',j.created_at,'started_at',j.started_at,'finished_at',j.finished_at,
    'estimated_cost_microusd',j.estimated_cost_microusd);
end;
$function$;
alter function public.get_background_job_status(uuid) owner to postgres;
revoke all on function public.get_background_job_status(uuid) from public,anon;
grant execute on function public.get_background_job_status(uuid) to authenticated,service_role;

-- Historical job/run tables become worker-owned evidence; browser users cannot fabricate queue or run history.
drop policy if exists app_read_automation_jobs on public.automation_jobs;
drop policy if exists manager_write_automation_jobs on public.automation_jobs;
create policy automation_jobs_manager_read on public.automation_jobs for select to authenticated using(public.is_admin_or_manager());
revoke insert,update,delete on public.automation_jobs from authenticated;
grant select on public.automation_jobs to authenticated;

drop policy if exists app_read_automation_runs on public.automation_runs;
drop policy if exists manager_write_automation_runs on public.automation_runs;
create policy automation_runs_manager_read on public.automation_runs for select to authenticated using(public.is_admin_or_manager());
revoke insert,update,delete on public.automation_runs from authenticated;
grant select on public.automation_runs to authenticated;

drop policy if exists app_read_automation_run_logs on public.automation_run_logs;
drop policy if exists manager_write_automation_run_logs on public.automation_run_logs;
create policy automation_run_logs_manager_read on public.automation_run_logs for select to authenticated using(public.is_admin_or_manager());
revoke insert,update,delete on public.automation_run_logs from authenticated;
grant select on public.automation_run_logs to authenticated;

-- Prepare schedules in the disabled state only. No cron is installed by this migration.
insert into public.background_job_schedules(company_id,schedule_name,job_type,payload,interval_minutes,enabled,next_run_at,source_type,source_id)
select r.company_id,'automation:'||r.id,'AUTOMATION_RULE_EVALUATION',jsonb_build_object('rule_id',r.id),least(43200,greatest(60,coalesce(r.schedule_interval_hours,24)*60)),false,now(),'automation_rule',r.id
from public.automation_rules r where r.deleted_at is null and r.rule_type in ('contract_expiry','overdue_invoice','maintenance_overdue')
on conflict(company_id,schedule_name) do nothing;
insert into public.background_job_schedules(company_id,schedule_name,job_type,payload,interval_minutes,enabled,next_run_at,source_type)
select c.id,'cleanup:ai-metadata','CLEANUP_AI_METADATA','{}'::jsonb,1440,false,now(),'system_cleanup' from public.companies c where c.is_active
on conflict(company_id,schedule_name) do nothing;
insert into public.background_job_schedules(company_id,schedule_name,job_type,payload,interval_minutes,enabled,next_run_at,source_type)
select c.id,'cleanup:job-retention','CLEANUP_JOB_RETENTION','{}'::jsonb,1440,false,now(),'system_cleanup' from public.companies c where c.is_active
on conflict(company_id,schedule_name) do nothing;

-- Disable the historical cron assumption and synchronous browser execution.
do $unschedule$
begin
  if to_regnamespace('cron') is not null then
    begin perform cron.unschedule('rentrix-automation-hourly'); exception when others then null; end;
  end if;
end
$unschedule$;

create or replace function public.run_scheduled_automation_rules()
returns jsonb language sql security definer set search_path to 'public','pg_temp'
as $function$ select jsonb_build_object('success',false,'disabled',true,'reason','BACKGROUND_SCHEDULE_ACTIVATION_REQUIRED') $function$;
revoke all on function public.run_scheduled_automation_rules() from public,anon,authenticated;
grant execute on function public.run_scheduled_automation_rules() to service_role;
revoke execute on function public.retry_automation_run(uuid) from authenticated,service_role;
revoke execute on function public.execute_automation_rule_internal(text) from authenticated,service_role;
update public.automation_runs set error_message='LEGACY_AUTOMATION_FAILURE' where error_message is not null;
update public.automation_rules set last_run_result='LEGACY_AUTOMATION_FAILURE' where last_run_status='FAILED' and last_run_result is not null;

create or replace function public.execute_automation_rule(p_rule_id text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_request uuid:=gen_random_uuid(); v_result jsonb;
begin
  v_result:=public.enqueue_automation_rule_job_atomic(p_rule_id,v_request);
  return jsonb_build_object('success',true,'queued',true,'run_id',v_result->>'job_id','processed',0,'failed',0,'notifications',0,'duplicate',v_result->'duplicate');
end;
$function$;
revoke all on function public.execute_automation_rule(text) from public,anon;
grant execute on function public.execute_automation_rule(text) to authenticated,service_role;

comment on table public.background_jobs is 'Durable metadata-minimized Postgres job queue. No Production dispatcher schedule is installed.';
comment on function public.process_background_job_atomic(uuid,uuid) is 'Service-role worker executes one leased job atomically with 45s timeout, bounded retry and safe error codes.';
comment on function public.dispatch_due_background_schedules_atomic(timestamptz,integer) is 'Service-role dispatcher for explicitly enabled schedules. All seeded schedules are disabled by default.';

commit;

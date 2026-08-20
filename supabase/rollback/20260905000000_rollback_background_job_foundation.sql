-- Manual emergency rollback; not auto-applied.
-- Rollback for 20260905000000_background_job_foundation.sql.
-- Fails closed: it does not restore or schedule the historical synchronous cron executor.

begin;
do $unschedule$
begin
  if to_regnamespace('cron') is not null then
    begin perform cron.unschedule('malek-background-dispatcher'); exception when others then null; end;
    begin perform cron.unschedule('rentrix-automation-hourly'); exception when others then null; end;
  end if;
end
$unschedule$;

create or replace function public.execute_automation_rule(p_rule_id text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
begin
  raise exception 'BACKGROUND_JOB_ROLLBACK_REQUIRES_FORWARD_REPAIR' using errcode='55000';
end;
$function$;
revoke all on function public.execute_automation_rule(text) from public,anon;
grant execute on function public.execute_automation_rule(text) to authenticated,service_role;

create or replace function public.run_scheduled_automation_rules()
returns jsonb language sql security definer set search_path to 'public','pg_temp'
as $function$ select jsonb_build_object('success',false,'disabled',true,'reason','BACKGROUND_JOB_ROLLBACK_REQUIRES_FORWARD_REPAIR') $function$;
revoke all on function public.run_scheduled_automation_rules() from public,anon,authenticated;
grant execute on function public.run_scheduled_automation_rules() to service_role;

revoke execute on function public.retry_automation_run(uuid) from authenticated;

drop policy if exists automation_jobs_manager_read on public.automation_jobs;
create policy app_read_automation_jobs on public.automation_jobs for select to authenticated using(public.is_app_user());
create policy manager_write_automation_jobs on public.automation_jobs for all to authenticated using(public.is_admin_or_manager()) with check(public.is_admin_or_manager());
grant select,insert,update on public.automation_jobs to authenticated;
drop policy if exists automation_runs_manager_read on public.automation_runs;
create policy app_read_automation_runs on public.automation_runs for select to authenticated using(public.is_app_user());
create policy manager_write_automation_runs on public.automation_runs for all to authenticated using(public.is_admin_or_manager()) with check(public.is_admin_or_manager());
grant select,insert,update on public.automation_runs to authenticated;
drop policy if exists automation_run_logs_manager_read on public.automation_run_logs;
create policy app_read_automation_run_logs on public.automation_run_logs for select to authenticated using(public.is_app_user());
create policy manager_write_automation_run_logs on public.automation_run_logs for all to authenticated using(public.is_admin_or_manager()) with check(public.is_admin_or_manager());
grant select,insert,update on public.automation_run_logs to authenticated;

drop function if exists public.get_background_job_status(uuid);
drop function if exists public.cancel_background_job_atomic(uuid,text,uuid);
drop function if exists public.process_background_job_atomic(uuid,uuid);
drop function if exists public.process_automation_rule_background_internal(uuid,text);
drop function if exists public.claim_background_jobs_atomic(uuid,uuid,integer);
drop function if exists public.list_background_job_companies_atomic(integer);
drop function if exists public.dispatch_due_background_schedules_atomic(timestamptz,integer);
drop function if exists public.enqueue_automation_rule_job_atomic(text,uuid);
drop function if exists public.enqueue_background_job_internal(uuid,text,jsonb,text,text,text,uuid,timestamptz,integer);
drop function if exists public.background_job_payload_valid(text,jsonb);
drop function if exists public.is_background_service_worker();
drop trigger if exists trg_background_job_events_immutable on public.background_job_events;
drop function if exists public.prevent_background_job_event_mutation();
drop table if exists public.background_job_schedules;
drop table if exists public.background_job_events;
drop table if exists public.background_jobs;
commit;

-- Fix automation exception handling + add scheduling via pg_cron
-- Ensures FAILED logs persist (no rollback due to RAISE) and adds real scheduling

begin;

-- 1. Fix execute_automation_rule to preserve FAILED logs without rollback
create or replace function public.execute_automation_rule(p_rule_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_rule record;
  v_run_id uuid;
  v_items_processed int :=0;
  v_items_failed int :=0;
  v_result jsonb;
  v_contract record;
  v_invoice record;
  v_maint record;
  v_notif_count int :=0;
  v_error_msg text;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER required' using errcode='42501';
  end if;

  select * into v_rule from public.automation_rules where id=p_rule_id and deleted_at is null for update;
  if not found then raise exception 'Rule not found'; end if;

  if not v_rule.is_enabled then
    raise exception 'Rule is disabled';
  end if;

  -- Prevent duplicate concurrent execution via advisory lock per rule
  perform pg_advisory_xact_lock(hashtextextended('automation_rule:'||p_rule_id,0));

  -- Additional duplicate prevention: if last run was <5 minutes ago and still running, skip
  if exists (
    select 1 from public.automation_runs
    where rule_id=p_rule_id and status='running' and started_at > extract(epoch from (now() - interval '5 minutes'))*1000
  ) then
    return jsonb_build_object('success',false,'skipped',true,'reason','duplicate running execution prevented');
  end if;

  -- Create run entry
  insert into public.automation_runs (job_name, rule_id, status, started_at, retry_count)
  values (v_rule.name, v_rule.id, 'running', extract(epoch from now())*1000, 0)
  returning id into v_run_id;

  BEGIN
    -- Based on rule_type
    if v_rule.rule_type = 'contract_expiry' then
      for v_contract in
        select id, property_id, tenant_id, end_date from public.contracts
        where deleted_at is null and status='active' and end_date between current_date and current_date + interval '30 days'
        limit 100
      loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id)
        values (v_rule.id, v_run_id, 'contract_expiry',
                'عقد قريب من الانتهاء',
                'العقد '||v_contract.id||' ينتهي في '||v_contract.end_date,
                'contract', v_contract.id::text);
        v_items_processed := v_items_processed +1;
        v_notif_count := v_notif_count+1;
      end loop;

    elsif v_rule.rule_type = 'overdue_invoice' then
      for v_invoice in
        select id, contract_id, due_date, amount, paid_amount from public.invoices
        where deleted_at is null and status not in ('paid','cancelled','void') and due_date < current_date and (amount - coalesce(paid_amount,0)) >0
        limit 100
      loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id)
        values (v_rule.id, v_run_id, 'overdue_invoice',
                'فاتورة متأخرة',
                'الفاتورة '||v_invoice.id||' متأخرة منذ '||v_invoice.due_date||' بمبلغ '||(v_invoice.amount - coalesce(v_invoice.paid_amount,0)),
                'invoice', v_invoice.id::text);
        v_items_processed := v_items_processed +1;
        v_notif_count := v_notif_count+1;
      end loop;

    elsif v_rule.rule_type = 'maintenance_overdue' then
      for v_maint in
        select id, property_id, title, status from public.maintenance_records
        where deleted_at is null and status in ('open','in_progress') and created_at < now() - interval '7 days'
        limit 100
      loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id)
        values (v_rule.id, v_run_id, 'maintenance_overdue',
                'صيانة متأخرة',
                'طلب الصيانة '||coalesce(v_maint.title, v_maint.id::text)||' متأخر أكثر من 7 أيام',
                'maintenance', v_maint.id::text);
        v_items_processed := v_items_processed +1;
        v_notif_count := v_notif_count+1;
      end loop;
    else
      v_items_processed :=0;
    end if;

    -- Update run as completed
    update public.automation_runs
    set completed_at = extract(epoch from now())*1000,
        status = case when v_items_failed>0 then 'partial' else 'success' end,
        items_processed = v_items_processed,
        items_failed = v_items_failed,
        actions_taken = jsonb_build_array(jsonb_build_object('notifications_created', v_notif_count))
    where id=v_run_id;

    update public.automation_rules
    set last_run_at = now(),
        last_run_status = case when v_items_failed>0 then 'PARTIAL' else 'SUCCESS' end,
        last_run_result = 'Processed '||v_items_processed||' items, created '||v_notif_count||' notifications',
        updated_at = now()
    where id=v_rule.id;

    v_result := jsonb_build_object('success',true,'run_id',v_run_id,'processed',v_items_processed,'failed',v_items_failed,'notifications',v_notif_count);

    return v_result;

  EXCEPTION WHEN OTHERS THEN
    v_error_msg := SQLERRM;
    -- Persist FAILED logs WITHOUT rollback - do not RAISE after update
    BEGIN
      update public.automation_runs
      set completed_at = extract(epoch from now())*1000,
          status = 'failed',
          error_message = v_error_msg,
          items_processed = v_items_processed,
          items_failed = v_items_failed +1
      where id=v_run_id;
    EXCEPTION WHEN OTHERS THEN
      -- Even if update fails, try to log
      RAISE NOTICE 'Failed to update automation run to failed: %', SQLERRM;
    END;

    BEGIN
      update public.automation_rules
      set last_run_at = now(),
          last_run_status = 'FAILED',
          last_run_result = v_error_msg,
          updated_at = now()
      where id=v_rule.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to update automation rule to failed: %', SQLERRM;
    END;

    -- Return failure result instead of RAISE to preserve logs
    RETURN jsonb_build_object('success',false,'run_id',v_run_id,'error',v_error_msg,'processed',v_items_processed,'failed',v_items_failed+1);
  END;
end;
$$;

revoke all on function public.execute_automation_rule(text) from public, anon;
grant execute on function public.execute_automation_rule(text) to authenticated, service_role;

-- 2. Internal version for cron (no auth check, SECURITY DEFINER, for scheduled execution)
create or replace function public.execute_automation_rule_internal(p_rule_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_rule record;
  v_run_id uuid;
  v_items_processed int :=0;
  v_items_failed int :=0;
  v_result jsonb;
  v_contract record;
  v_invoice record;
  v_maint record;
  v_notif_count int :=0;
  v_error_msg text;
begin
  select * into v_rule from public.automation_rules where id=p_rule_id and deleted_at is null and is_enabled=true for update;
  if not found then return jsonb_build_object('success',false,'skipped',true,'reason','rule not found or disabled'); end if;

  perform pg_advisory_xact_lock(hashtextextended('automation_rule_internal:'||p_rule_id,0));

  if exists (
    select 1 from public.automation_runs
    where rule_id=p_rule_id and status='running' and started_at > extract(epoch from (now() - interval '5 minutes'))*1000
  ) then
    return jsonb_build_object('success',false,'skipped',true,'reason','duplicate prevention');
  end if;

  insert into public.automation_runs (job_name, rule_id, status, started_at)
  values (v_rule.name, v_rule.id, 'running', extract(epoch from now())*1000)
  returning id into v_run_id;

  BEGIN
    if v_rule.rule_type = 'contract_expiry' then
      for v_contract in select id, end_date from public.contracts where deleted_at is null and status='active' and end_date between current_date and current_date + interval '30 days' limit 100 loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id)
        values (v_rule.id, v_run_id, 'contract_expiry','عقد قريب من الانتهاء','العقد '||v_contract.id||' ينتهي في '||v_contract.end_date,'contract',v_contract.id::text);
        v_items_processed := v_items_processed+1; v_notif_count:=v_notif_count+1;
      end loop;
    elsif v_rule.rule_type = 'overdue_invoice' then
      for v_invoice in select id, due_date, amount, paid_amount from public.invoices where deleted_at is null and status not in ('paid','cancelled','void') and due_date < current_date and (amount - coalesce(paid_amount,0))>0 limit 100 loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id)
        values (v_rule.id, v_run_id, 'overdue_invoice','فاتورة متأخرة','الفاتورة '||v_invoice.id||' متأخرة','invoice',v_invoice.id::text);
        v_items_processed:=v_items_processed+1; v_notif_count:=v_notif_count+1;
      end loop;
    elsif v_rule.rule_type = 'maintenance_overdue' then
      for v_maint in select id, title from public.maintenance_records where deleted_at is null and status in ('open','in_progress') and created_at < now() - interval '7 days' limit 100 loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id)
        values (v_rule.id, v_run_id, 'maintenance_overdue','صيانة متأخرة','طلب '||coalesce(v_maint.title, v_maint.id::text)||' متأخر','maintenance',v_maint.id::text);
        v_items_processed:=v_items_processed+1; v_notif_count:=v_notif_count+1;
      end loop;
    end if;

    update public.automation_runs set completed_at=extract(epoch from now())*1000, status='success', items_processed=v_items_processed, actions_taken=jsonb_build_array(jsonb_build_object('notifications_created',v_notif_count)) where id=v_run_id;
    update public.automation_rules set last_run_at=now(), last_run_status='SUCCESS', last_run_result='Scheduled: '||v_items_processed||' items, '||v_notif_count||' notifs', updated_at=now() where id=v_rule.id;
    return jsonb_build_object('success',true,'run_id',v_run_id,'processed',v_items_processed,'notifications',v_notif_count);
  EXCEPTION WHEN OTHERS THEN
    v_error_msg:=SQLERRM;
    BEGIN
      update public.automation_runs set completed_at=extract(epoch from now())*1000, status='failed', error_message=v_error_msg where id=v_run_id;
      update public.automation_rules set last_run_at=now(), last_run_status='FAILED', last_run_result=v_error_msg where id=v_rule.id;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Failed to update failed status: %', SQLERRM;
    END;
    RETURN jsonb_build_object('success',false,'run_id',v_run_id,'error',v_error_msg);
  END;
end;
$$;

revoke all on function public.execute_automation_rule_internal(text) from public, anon;
grant execute on function public.execute_automation_rule_internal(text) to service_role;

-- 3. Function to run all due automation rules (for cron)
create or replace function public.run_scheduled_automation_rules()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_rule record;
  v_results jsonb := '[]'::jsonb;
  v_single_result jsonb;
  v_processed_count int :=0;
begin
  for v_rule in select id from public.automation_rules where deleted_at is null and is_enabled=true loop
    -- Check if interval has passed since last run
    -- If last_run_at is null or older than schedule_interval_hours
    if exists (
      select 1 from public.automation_rules r
      where r.id=v_rule.id
      and (
        r.last_run_at is null
        or (r.schedule_interval_hours is not null and r.last_run_at < now() - (r.schedule_interval_hours || ' hours')::interval)
        or (r.schedule_interval_hours is null and r.last_run_at < now() - interval '1 hour')
      )
    ) then
      v_single_result := public.execute_automation_rule_internal(v_rule.id);
      v_results := v_results || jsonb_build_array(v_single_result);
      v_processed_count := v_processed_count +1;
    end if;
  end loop;

  return jsonb_build_object('success',true,'processed_rules',v_processed_count,'results',v_results);
end;
$$;

revoke all on function public.run_scheduled_automation_rules() from public, anon;
grant execute on function public.run_scheduled_automation_rules() to service_role;

-- 4. Enable pg_cron and schedule job (if extension available)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron extension not available, scheduling will need manual Edge Function cron: %', SQLERRM;
END $$;

-- Try to schedule hourly job, drop if exists first
DO $$
BEGIN
  PERFORM cron.unschedule('rentrix-automation-hourly');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'No existing rentrix-automation-hourly job to unschedule';
END $$;

DO $cron_outer$
BEGIN
  PERFORM cron.schedule(
    'rentrix-automation-hourly',
    '0 * * * *',
    $cron_inner$ SELECT public.run_scheduled_automation_rules(); $cron_inner$
  );
  RAISE NOTICE 'Scheduled rentrix-automation-hourly cron job';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Failed to schedule cron job (pg_cron may not be enabled): %', SQLERRM;
END $cron_outer$;

-- 5. Add retry support function
create or replace function public.retry_automation_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_run record;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER required' using errcode='42501';
  end if;

  select * into v_run from public.automation_runs where id=p_run_id for update;
  if not found then raise exception 'Run not found'; end if;

  if v_run.status != 'failed' then
    raise exception 'Only failed runs can be retried';
  end if;

  if v_run.retry_count >=3 then
    raise exception 'Max retries (3) exceeded';
  end if;

  update public.automation_runs set retry_count=retry_count+1, status='running', started_at=extract(epoch from now())*1000, completed_at=null, error_message=null where id=p_run_id;

  -- Re-execute the rule
  v_result := public.execute_automation_rule(v_run.rule_id);

  return v_result;
end;
$$;

revoke all on function public.retry_automation_run(uuid) from public, anon;
grant execute on function public.retry_automation_run(uuid) to authenticated, service_role;

commit;

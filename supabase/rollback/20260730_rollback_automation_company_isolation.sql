-- Rollback for 20260730090500_fix_automation_rule_company_isolation_and_safe_date.sql
-- Restores execute_automation_rule to the 20260722000002 definition
-- Restores execute_automation_rule_internal to the 20260730090000 definition
-- Does NOT delete data or tables

begin;

-- Restore execute_automation_rule from 20260722000002_multi_tenant_rpc_company_isolation.sql
CREATE OR REPLACE FUNCTION public.execute_automation_rule(p_rule_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_company_id uuid;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER required' using errcode='42501';
  end if;
  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  select * into v_rule from public.automation_rules where id=p_rule_id and deleted_at is null for update;
  if not found then raise exception 'Rule not found'; end if;
  if not v_rule.is_enabled then raise exception 'Rule is disabled'; end if;
  perform pg_advisory_xact_lock(hashtextextended('automation_rule:'||p_rule_id,0));
  if exists (
    select 1 from public.automation_runs
    where rule_id=p_rule_id and status='running' and started_at > extract(epoch from (now() - interval '5 minutes'))*1000
  ) then
    return jsonb_build_object('success',false,'skipped',true,'reason','duplicate running execution prevented');
  end if;
  insert into public.automation_runs (job_name, rule_id, status, started_at, retry_count, company_id)
  values (v_rule.name, v_rule.id, 'running', extract(epoch from now())*1000, 0, v_company_id)
  returning id into v_run_id;
  BEGIN
    if v_rule.rule_type = 'contract_expiry' then
      for v_contract in
        select id, property_id, tenant_id, end_date from public.contracts
        where deleted_at is null and status='active'
        and end_date between current_date and current_date + interval '30 days'
        limit 100
      loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id, company_id)
        values (v_rule.id, v_run_id, 'contract_expiry','عقد قريب من الانتهاء','العقد '||v_contract.id||' ينتهي في '||v_contract.end_date,'contract', v_contract.id::text, v_company_id);
        v_items_processed := v_items_processed +1; v_notif_count:=v_notif_count+1;
      end loop;
    elsif v_rule.rule_type = 'overdue_invoice' then
      for v_invoice in
        select id, contract_id, due_date, amount, paid_amount from public.invoices
        where deleted_at is null and status not in ('paid','cancelled','void')
          and due_date is not null and due_date::date < current_date
          and (amount - coalesce(paid_amount,0)) >0
        limit 100
      loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id, company_id)
        values (v_rule.id, v_run_id, 'overdue_invoice','فاتورة متأخرة','الفاتورة '||v_invoice.id||' متأخرة منذ '||v_invoice.due_date||' بمبلغ '||(v_invoice.amount - coalesce(v_invoice.paid_amount,0)),'invoice', v_invoice.id::text, v_company_id);
        v_items_processed := v_items_processed +1; v_notif_count:=v_notif_count+1;
      end loop;
    elsif v_rule.rule_type = 'maintenance_overdue' then
      for v_maint in
        select id, property_id, title, status from public.maintenance_records
        where deleted_at is null and status in ('open','in_progress') and created_at < now() - interval '7 days'
        limit 100
      loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id, company_id)
        values (v_rule.id, v_run_id, 'maintenance_overdue','صيانة متأخرة','طلب الصيانة '||coalesce(v_maint.title, v_maint.id::text)||' متأخر أكثر من 7 أيام','maintenance', v_maint.id::text, v_company_id);
        v_items_processed := v_items_processed +1; v_notif_count:=v_notif_count+1;
      end loop;
    else
      v_items_processed :=0;
    end if;
    update public.automation_runs
    set completed_at = extract(epoch from now())*1000,
        status = case when v_items_failed>0 then 'partial' else 'success' end,
        items_processed = v_items_processed, items_failed = v_items_failed,
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
    BEGIN
      update public.automation_runs set completed_at=extract(epoch from now())*1000, status='failed', error_message=v_error_msg, items_processed=v_items_processed, items_failed=v_items_failed+1 where id=v_run_id;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Failed to update automation run to failed: %', SQLERRM; END;
    BEGIN
      update public.automation_rules set last_run_at=now(), last_run_status='FAILED', last_run_result=v_error_msg, updated_at=now() where id=v_rule.id;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Failed to update automation rule to failed: %', SQLERRM; END;
    return jsonb_build_object('success',false,'run_id',v_run_id,'error',v_error_msg);
  END;
end;
$function$;

-- Restore execute_automation_rule_internal from 20260730090000
CREATE OR REPLACE FUNCTION public.execute_automation_rule_internal(p_rule_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_rule record; v_run_id uuid; v_items_processed int :=0; v_items_failed int :=0;
  v_result jsonb; v_contract record; v_invoice record; v_maint record;
  v_notif_count int :=0; v_error_msg text;
begin
  select * into v_rule from public.automation_rules where id=p_rule_id and deleted_at is null and is_enabled=true for update;
  if not found then return jsonb_build_object('success',false,'skipped',true,'reason','rule not found or disabled'); end if;
  perform pg_advisory_xact_lock(hashtextextended('automation_rule_internal:'||p_rule_id,0));
  if exists (select 1 from public.automation_runs where rule_id=p_rule_id and status='running' and started_at > extract(epoch from (now() - interval '5 minutes'))*1000) then
    return jsonb_build_object('success',false,'skipped',true,'reason','duplicate prevention');
  end if;
  insert into public.automation_runs (job_name, rule_id, status, started_at, company_id)
  values (v_rule.name, v_rule.id, 'running', extract(epoch from now())*1000, v_rule.company_id) returning id into v_run_id;
  BEGIN
    if v_rule.rule_type = 'contract_expiry' then
      for v_contract in select id, end_date from public.contracts where deleted_at is null and status='active' and end_date::date between current_date and current_date + interval '30 days' limit 100 loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id, company_id)
        values (v_rule.id, v_run_id, 'contract_expiry','عقد قريب من الانتهاء','العقد '||v_contract.id||' ينتهي في '||v_contract.end_date,'contract',v_contract.id::text, v_rule.company_id);
        v_items_processed := v_items_processed+1; v_notif_count:=v_notif_count+1;
      end loop;
    elsif v_rule.rule_type = 'overdue_invoice' then
      for v_invoice in select id, due_date, amount, paid_amount from public.invoices where deleted_at is null and status not in ('paid','cancelled','void') and due_date::date < current_date and (amount - coalesce(paid_amount,0))>0 limit 100 loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id, company_id)
        values (v_rule.id, v_run_id, 'overdue_invoice','فاتورة متأخرة','الفاتورة '||v_invoice.id||' متأخرة','invoice',v_invoice.id::text, v_rule.company_id);
        v_items_processed:=v_items_processed+1; v_notif_count:=v_notif_count+1;
      end loop;
    elsif v_rule.rule_type = 'maintenance_overdue' then
      for v_maint in select id, title from public.maintenance_records where deleted_at is null and status in ('open','in_progress') and created_at < now() - interval '7 days' limit 100 loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id, company_id)
        values (v_rule.id, v_run_id, 'maintenance_overdue','صيانة متأخرة','طلب '||coalesce(v_maint.title, v_maint.id::text)||' متأخر','maintenance',v_maint.id::text, v_rule.company_id);
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

revoke all on function public.execute_automation_rule(text) from public, anon, authenticated, service_role;
grant execute on function public.execute_automation_rule(text) to authenticated;

revoke all on function public.execute_automation_rule_internal(text) from public, anon, authenticated;
grant execute on function public.execute_automation_rule_internal(text) to service_role;

commit;

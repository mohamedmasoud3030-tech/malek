-- Fix execute_automation_rule's overdue_invoice branch: invoices.due_date is
-- stored as `text` (schema id/type-mismatch class), so
-- `due_date < current_date` raised "operator does not exist: text < date"
-- and caused every overdue_invoice automation run (e.g. "rent-reminder-due")
-- to fail unconditionally. Cast to date inline; no signature change, so
-- CREATE OR REPLACE is safe without a DROP.
--
-- Discovered during authenticated release verification on 2026-07-19 while
-- confirming PR #1211's retry_automation_run fix: the retry executed
-- correctly (no longer self-blocking), but the underlying rule execution
-- still failed on this unrelated bug. Verified fixed via rollback-isolated
-- authenticated production check: a genuine failed run was retried and the
-- new run completed with status 'success', error null.

begin;

create or replace function public.execute_automation_rule(p_rule_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
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

  perform pg_advisory_xact_lock(hashtextextended('automation_rule:'||p_rule_id,0));

  if exists (
    select 1 from public.automation_runs
    where rule_id=p_rule_id and status='running' and started_at > extract(epoch from (now() - interval '5 minutes'))*1000
  ) then
    return jsonb_build_object('success',false,'skipped',true,'reason','duplicate running execution prevented');
  end if;

  insert into public.automation_runs (job_name, rule_id, status, started_at, retry_count)
  values (v_rule.name, v_rule.id, 'running', extract(epoch from now())*1000, 0)
  returning id into v_run_id;

  BEGIN
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
        where deleted_at is null and status not in ('paid','cancelled','void')
          and due_date is not null and due_date::date < current_date
          and (amount - coalesce(paid_amount,0)) >0
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
    BEGIN
      update public.automation_runs
      set completed_at = extract(epoch from now())*1000,
          status = 'failed',
          error_message = v_error_msg,
          items_processed = v_items_processed,
          items_failed = v_items_failed +1
      where id=v_run_id;
    EXCEPTION WHEN OTHERS THEN
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

    RETURN jsonb_build_object('success',false,'run_id',v_run_id,'error',v_error_msg,'processed',v_items_processed,'failed',v_items_failed+1);
  END;
end;
$$;

commit;

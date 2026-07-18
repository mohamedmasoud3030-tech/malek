-- Phase: Real Automation Execution
-- Enhances automation_jobs to support enabling/disabling, cron scheduling, and real run logging
-- Adds automation_rules table for UI-configurable rules
-- Requires the baseline-captured automation jobs/runs/logs tables; the preflight below enforces that ordering

begin;

-- The execution layer extends baseline-captured automation tables. Fail early
-- with a deterministic dependency error instead of partially creating the module.
do $
begin
  if to_regclass('public.automation_jobs') is null
     or to_regclass('public.automation_runs') is null
     or to_regclass('public.automation_run_logs') is null then
    raise exception 'Automation baseline missing: automation_jobs, automation_runs, and automation_run_logs must exist before 20260717000004';
  end if;
end
$;

-- 1. Create automation_rules table (user-facing rules catalog with real persistence)
create table if not exists public.automation_rules (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  description text,
  rule_type text not null check (rule_type in ('contract_expiry','overdue_invoice','maintenance_overdue','payment_reminder','large_payment_alert','unit_status','custom')),
  is_enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  schedule_cron text,
  schedule_interval_hours integer,
  last_run_at timestamptz,
  last_run_status text check (last_run_status in ('SUCCESS','FAILED','PARTIAL','SKIPPED')),
  last_run_result text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_automation_rules_enabled on public.automation_rules(is_enabled) where deleted_at is null;
create index if not exists idx_automation_rules_type on public.automation_rules(rule_type) where deleted_at is null;

alter table public.automation_rules enable row level security;

drop policy if exists app_read_automation_rules on public.automation_rules;
drop policy if exists manager_write_automation_rules on public.automation_rules;

create policy app_read_automation_rules on public.automation_rules
  for select to authenticated
  using (public.is_app_user());

create policy manager_write_automation_rules on public.automation_rules
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

grant select on public.automation_rules to authenticated;
grant insert, update on public.automation_rules to authenticated;
revoke delete on public.automation_rules from authenticated;

drop trigger if exists trg_automation_rules_updated_at on public.automation_rules;
create trigger trg_automation_rules_updated_at
  before update on public.automation_rules
  for each row execute function public.set_updated_at();

-- 2. Enhance automation_runs / logs with retry support
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='automation_runs' and column_name='retry_count') then
    alter table public.automation_runs add column retry_count integer not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='automation_runs' and column_name='rule_id') then
    alter table public.automation_runs add column rule_id text references public.automation_rules(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='automation_run_logs' and column_name='rule_id') then
    alter table public.automation_run_logs add column rule_id text references public.automation_rules(id) on delete set null;
  end if;
end $$;

-- 3. Create automation_notifications (internal notifications, no external send)
create table if not exists public.automation_notifications (
  id uuid primary key default gen_random_uuid(),
  rule_id text references public.automation_rules(id) on delete set null,
  job_id uuid references public.automation_jobs(id) on delete set null,
  run_id uuid references public.automation_runs(id) on delete set null,
  type text not null,
  title text not null,
  body text not null,
  related_entity_type text,
  related_entity_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_automation_notifications_rule on public.automation_notifications(rule_id);
create index if not exists idx_automation_notifications_created on public.automation_notifications(created_at desc);

alter table public.automation_notifications enable row level security;

drop policy if exists app_read_automation_notifications on public.automation_notifications;
drop policy if exists manager_write_automation_notifications on public.automation_notifications;

create policy app_read_automation_notifications on public.automation_notifications
  for select to authenticated
  using (public.is_app_user());

create policy manager_write_automation_notifications on public.automation_notifications
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

grant select on public.automation_notifications to authenticated;
grant insert, update on public.automation_notifications to authenticated;
revoke delete on public.automation_notifications from authenticated;

-- 4. RPC to execute automation rule (checks contracts expiring, invoices overdue, maintenance overdue)
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
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER required' using errcode='42501';
  end if;

  select * into v_rule from public.automation_rules where id=p_rule_id and deleted_at is null for update;
  if not found then raise exception 'Rule not found'; end if;

  if not v_rule.is_enabled then
    raise exception 'Rule is disabled';
  end if;

  -- Create run entry
  insert into public.automation_runs (job_name, rule_id, status, started_at)
  values (v_rule.name, v_rule.id, 'running', extract(epoch from now())*1000)
  returning id into v_run_id;

  -- Based on rule_type, perform checks and create notifications (internal only)
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
    -- Custom or other types: just log run as success with 0 items
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

  -- Update rule last run
  update public.automation_rules
  set last_run_at = now(),
      last_run_status = case when v_items_failed>0 then 'PARTIAL' else 'SUCCESS' end,
      last_run_result = 'Processed '||v_items_processed||' items, created '||v_notif_count||' notifications',
      updated_at = now()
  where id=v_rule.id;

  v_result := jsonb_build_object('success',true,'run_id',v_run_id,'processed',v_items_processed,'failed',v_items_failed,'notifications',v_notif_count);

  return v_result;

exception when others then
  -- On error, mark run failed
  if v_run_id is not null then
    update public.automation_runs
    set completed_at = extract(epoch from now())*1000,
        status = 'failed',
        error_message = SQLERRM
    where id=v_run_id;
  end if;

  if v_rule.id is not null then
    update public.automation_rules
    set last_run_at = now(),
        last_run_status = 'FAILED',
        last_run_result = SQLERRM
    where id=v_rule.id;
  end if;

  raise;
end;
$$;

revoke all on function public.execute_automation_rule(text) from public, anon;
grant execute on function public.execute_automation_rule(text) to authenticated, service_role;

commit;

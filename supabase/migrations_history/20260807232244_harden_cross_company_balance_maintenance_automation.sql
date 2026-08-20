-- Live hardening parity: remove cross-company mutation paths from balance rebuild,
-- maintenance resolution, and manual scheduled automation runs.
begin;

create or replace function public.recalculate_all_balances()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'غير مصرح: يجب تسجيل الدخول' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('ADMIN', 'MANAGER')
  ) then
    raise exception 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول' using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  delete from public.contract_balances where company_id = v_company_id;
  insert into public.contract_balances (
    contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at, company_id
  )
  select
    c.id::text,
    c.tenant_id::text,
    c.unit_id::text,
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0)), 0),
    coalesce(sum(i.paid_amount), 0),
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0) - i.paid_amount), 0),
    now(),
    c.company_id
  from public.contracts c
  left join public.invoices i
    on i.contract_id = c.id
   and i.deleted_at is null
   and i.company_id = v_company_id
  where c.company_id = v_company_id
  group by c.id, c.tenant_id, c.unit_id, c.company_id;

  delete from public.tenant_balances where company_id = v_company_id;
  insert into public.tenant_balances (tenant_id, balance_due, updated_at, company_id)
  select
    c.tenant_id::text,
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0) - i.paid_amount), 0),
    now(),
    c.company_id
  from public.contracts c
  left join public.invoices i
    on i.contract_id = c.id
   and i.deleted_at is null
   and i.company_id = v_company_id
  where c.company_id = v_company_id
  group by c.tenant_id, c.company_id;

  delete from public.owner_balances where company_id = v_company_id;
  insert into public.owner_balances (
    owner_id, total_income, total_expenses, commission, net_balance, updated_at, company_id
  )
  select
    p.owner_id::text,
    coalesce(sum(case when i.deleted_at is null then i.paid_amount else 0 end), 0),
    coalesce((
      select sum(e.amount)
      from public.expenses e
      join public.units u2 on u2.id::text = e.property_id::text
      join public.properties p2 on p2.id = u2.property_id
      where p2.owner_id = p.owner_id
        and p2.company_id = v_company_id
        and e.company_id = v_company_id
        and e.deleted_at is null
    ), 0),
    0,
    0,
    now(),
    p.company_id
  from public.properties p
  join public.units u
    on u.property_id = p.id
   and u.company_id = v_company_id
  join public.contracts c
    on c.unit_id = u.id
   and c.company_id = v_company_id
  left join public.invoices i
    on i.contract_id = c.id
   and i.company_id = v_company_id
  where p.company_id = v_company_id
  group by p.owner_id, p.company_id;
end;
$function$;

revoke all on function public.recalculate_all_balances() from public, anon;
grant execute on function public.recalculate_all_balances() to authenticated, service_role;

create or replace function public.resolve_maintenance_with_expense(
  p_request_id text,
  p_cost numeric,
  p_notes text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_record public.maintenance_records;
  v_expense_id text;
  v_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'غير مصرح: يجب تسجيل الدخول' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('ADMIN', 'MANAGER')
  ) then
    raise exception 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول' using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  if p_cost is null or p_cost < 0 then
    raise exception 'التكلفة يجب أن تكون رقماً موجباً';
  end if;

  select * into v_record
  from public.maintenance_records
  where id = p_request_id
    and company_id = v_company_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'طلب الصيانة غير موجود';
  end if;

  if v_record.status in ('resolved', 'closed') then
    raise exception 'تم إغلاق هذا الطلب مسبقاً';
  end if;

  if p_cost > 0 then
    insert into public.expenses (
      property_id, category, amount, expense_date, description, notes, ref, status, company_id
    ) values (
      v_record.property_id, 'صيانة', p_cost, current_date,
      coalesce(v_record.title, 'مصروف صيانة'),
      p_notes, v_record.id, 'posted', v_company_id
    )
    returning id into v_expense_id;
  end if;

  update public.maintenance_records
  set status = 'resolved',
      cost = p_cost,
      resolved_at = now(),
      notes = coalesce(p_notes, notes)
  where id = p_request_id
    and company_id = v_company_id
  returning * into v_record;

  return jsonb_build_object(
    'maintenance', to_jsonb(v_record),
    'expense_id', v_expense_id
  );
end;
$function$;

revoke all on function public.resolve_maintenance_with_expense(text, numeric, text) from public, anon;
grant execute on function public.resolve_maintenance_with_expense(text, numeric, text) to authenticated, service_role;

create or replace function public.run_scheduled_automation_rules()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_rule record;
  v_results jsonb := '[]'::jsonb;
  v_single_result jsonb;
  v_processed_count int := 0;
  v_company_id uuid := null;
begin
  if auth.uid() is not null then
    if not exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role in ('ADMIN', 'MANAGER')
    ) then
      raise exception 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول' using errcode = '42501';
    end if;
    v_company_id := public.require_company_id();
  end if;

  for v_rule in
    select id
    from public.automation_rules
    where deleted_at is null
      and is_enabled = true
      and (v_company_id is null or company_id = v_company_id)
  loop
    if exists (
      select 1
      from public.automation_rules r
      where r.id = v_rule.id
        and (v_company_id is null or r.company_id = v_company_id)
        and (
          r.last_run_at is null
          or (r.schedule_interval_hours is not null and r.last_run_at < now() - (r.schedule_interval_hours || ' hours')::interval)
          or (r.schedule_interval_hours is null and r.last_run_at < now() - interval '1 hour')
        )
    ) then
      v_single_result := public.execute_automation_rule_internal(v_rule.id);
      v_results := v_results || jsonb_build_array(v_single_result);
      v_processed_count := v_processed_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'processed_rules', v_processed_count,
    'results', v_results
  );
end;
$function$;

revoke all on function public.run_scheduled_automation_rules() from public, anon;
grant execute on function public.run_scheduled_automation_rules() to authenticated, service_role;

commit;

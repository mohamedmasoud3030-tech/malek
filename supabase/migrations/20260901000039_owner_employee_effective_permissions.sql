-- P6 owner/employee permission model.
-- Routine UX exposes Office Owner + Employee only. The historical six-role
-- engine remains a compatibility input, while an explicit owner decision is
-- authoritative for an employee capability.

begin;

insert into public.app_permission_catalog (permission, label_ar, admin_only, requestable)
values
  ('properties.view', 'عرض العقارات والوحدات', false, true),
  ('contracts.view', 'عرض العقود والمستأجرين', false, true),
  ('maintenance.write', 'إنشاء ومتابعة وتنفيذ الصيانة', false, true),
  ('financial.workspace.view', 'عرض المالية والتحصيل', false, true)
on conflict (permission) do update set
  label_ar = excluded.label_ar,
  admin_only = excluded.admin_only,
  requestable = excluded.requestable;

create table if not exists public.user_permission_overrides (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  permission text not null references public.app_permission_catalog(permission) on delete cascade,
  allowed boolean not null,
  set_by uuid not null references public.users(id),
  reason text,
  set_at timestamptz not null default now(),
  primary key (company_id, user_id, permission)
);

alter table public.user_permission_overrides enable row level security;
revoke all on table public.user_permission_overrides from public, anon, authenticated;

comment on table public.user_permission_overrides is
  'Owner-authored employee permission decisions. These are part of the canonical effective-permission engine and take precedence over legacy role defaults.';

create or replace function public.role_has_app_permission(p_role text, p_permission text)
returns boolean
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select case upper(coalesce(p_role, ''))
    when 'ADMIN' then
      exists(select 1 from public.app_permission_catalog c where c.permission = p_permission)
    when 'MANAGER' then
      p_permission = any(array[
        'app.dashboard.view','properties.view','properties.write','contracts.view','contracts.write',
        'maintenance.view','maintenance.write','financial.workspace.view',
        'permission_requests.review','cost_centers.manage','documents.write',
        'owners.hub.view','owners.detail.view','lands.view','leads.view','commissions.view','communication.view',
        'automation.view','auth.password.change','expenses.view','expenses.write','arrears.view',
        'financial.deposits.view','financial.invoices.generate','financial.invoices.export',
        'financial.payments.create','financial.receipts.void','financial.reports.view','financial.reports.export',
        'financial.bank_reconciliation.view','financial.bank_reconciliation.match','financial.owner_settlements.view',
        'service_providers.view','service_providers.write',
        'financial.fixed_monthly_accruals.view','financial.fixed_monthly_accruals.execute',
        'financial.fixed_monthly_accruals.reverse','support.operations.view','support.requests.triage'
      ]::text[])
    when 'ACCOUNTANT' then
      p_permission = any(array[
        'app.dashboard.view','financial.workspace.view','audit.view','expenses.view','arrears.view',
        'financial.deposits.view','financial.invoices.generate','financial.invoices.export',
        'financial.reports.view','financial.reports.export','financial.bank_reconciliation.view',
        'financial.bank_reconciliation.match','financial.owner_settlements.view','auth.password.change',
        'financial.fixed_monthly_accruals.view','financial.fixed_monthly_accruals.execute',
        'financial.fixed_monthly_accruals.reverse'
      ]::text[])
    when 'OPERATIONS' then
      p_permission = any(array[
        'app.dashboard.view','properties.view','contracts.view','maintenance.view','maintenance.write',
        'financial.workspace.view','service_providers.view','service_providers.write','cost_centers.manage',
        'documents.write','owners.hub.view','owners.detail.view','lands.view','leads.view','communication.view',
        'automation.view','auth.password.change','properties.write','contracts.write','expenses.view','expenses.write','arrears.view'
      ]::text[])
    when 'USER' then
      p_permission = any(array['app.dashboard.view','auth.password.change']::text[])
    when 'VIEWER' then
      p_permission = any(array[
        'app.dashboard.view','properties.view','contracts.view','maintenance.view','financial.workspace.view',
        'financial.reports.view','service_providers.view','owners.hub.view','owners.detail.view','lands.view','leads.view',
        'commissions.view','communication.view','automation.view','expenses.view','arrears.view',
        'financial.deposits.view','financial.owner_settlements.view','financial.bank_reconciliation.view','auth.password.change'
      ]::text[])
    else false
  end
$$;

create or replace function public.current_user_has_effective_app_permission(p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_override boolean;
begin
  if not coalesce(public.is_app_user(), false) then
    return false;
  end if;
  if not exists (select 1 from public.app_permission_catalog c where c.permission = p_permission) then
    return false;
  end if;
  if public.is_admin() then
    return true;
  end if;

  select o.allowed into v_override
  from public.user_permission_overrides o
  where o.company_id = v_company
    and o.user_id = auth.uid()
    and o.permission = p_permission;
  if found then
    return v_override;
  end if;

  return public.role_has_app_permission(public.current_app_role(), p_permission)
    or exists (
      select 1
      from public.user_permission_grants g
      where g.company_id = v_company
        and g.user_id = auth.uid()
        and g.permission = p_permission
        and g.revoked_at is null
    );
end;
$function$;

create or replace function public.list_my_effective_app_permissions()
returns table(permission text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select c.permission
  from public.app_permission_catalog c
  where public.current_user_has_effective_app_permission(c.permission)
  order by c.permission;
$function$;

create or replace function public.list_employee_effective_permissions()
returns table(user_id uuid, permission text, allowed boolean, explicitly_set boolean)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'OFFICE_OWNER_REQUIRED' using errcode = '42501';
  end if;

  return query
  select
    cm.user_id,
    c.permission,
    coalesce(
      o.allowed,
      public.role_has_app_permission(cm.role::text, c.permission)
        or exists (
          select 1 from public.user_permission_grants g
          where g.company_id = cm.company_id
            and g.user_id = cm.user_id
            and g.permission = c.permission
            and g.revoked_at is null
        )
    ) as allowed,
    (o.permission is not null) as explicitly_set
  from public.company_members cm
  join public.users u on u.id = cm.user_id
  cross join public.app_permission_catalog c
  left join public.user_permission_overrides o
    on o.company_id = cm.company_id
   and o.user_id = cm.user_id
   and o.permission = c.permission
  where cm.company_id = v_company
    and cm.is_active = true
    and u.is_active = true
    and u.deleted_at is null
    and cm.role::text <> 'ADMIN'
    and c.requestable = true
    and c.admin_only = false
  order by cm.user_id, c.permission;
end;
$function$;

create or replace function public.set_employee_permission(
  p_user_id uuid,
  p_permission text,
  p_allowed boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not coalesce(public.is_admin(), false) then
    raise exception 'OFFICE_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if p_user_id is null or p_allowed is null then
    raise exception 'INVALID_EMPLOYEE_PERMISSION_INPUT' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.company_members cm
    join public.users u on u.id = cm.user_id
    where cm.company_id = v_company
      and cm.user_id = p_user_id
      and cm.is_active = true
      and u.is_active = true
      and u.deleted_at is null
      and cm.role::text <> 'ADMIN'
  ) then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.app_permission_catalog c
    where c.permission = p_permission
      and c.requestable = true
      and c.admin_only = false
  ) then
    raise exception 'EMPLOYEE_PERMISSION_NOT_ASSIGNABLE' using errcode = '42501';
  end if;

  insert into public.user_permission_overrides
    (company_id, user_id, permission, allowed, set_by, reason, set_at)
  values
    (v_company, p_user_id, p_permission, p_allowed, v_actor, nullif(btrim(coalesce(p_reason, '')), ''), now())
  on conflict (company_id, user_id, permission) do update set
    allowed = excluded.allowed,
    set_by = excluded.set_by,
    reason = excluded.reason,
    set_at = excluded.set_at;

  return jsonb_build_object('user_id', p_user_id, 'permission', p_permission, 'allowed', p_allowed);
end;
$function$;

revoke all on function public.list_my_effective_app_permissions() from public, anon;
revoke all on function public.list_employee_effective_permissions() from public, anon;
revoke all on function public.set_employee_permission(uuid,text,boolean,text) from public, anon;
grant execute on function public.list_my_effective_app_permissions() to authenticated;
grant execute on function public.list_employee_effective_permissions() to authenticated;
grant execute on function public.set_employee_permission(uuid,text,boolean,text) to authenticated;

do $policies$
declare
  r record;
  v_permission text;
  v_name text;
begin
  for r in
    select * from (values
      ('properties', 'properties.write'),
      ('units', 'properties.write'),
      ('contracts', 'contracts.write'),
      ('maintenance_records', 'maintenance.write'),
      ('expenses', 'expenses.write')
    ) as x(table_name, permission)
  loop
    if to_regclass('public.' || r.table_name) is null then
      continue;
    end if;
    v_permission := r.permission;

    v_name := 'p6_' || r.table_name || '_cap_insert';
    execute format('drop policy if exists %I on public.%I', v_name, r.table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (company_id = public.require_company_id() and public.current_user_has_effective_app_permission(%L))',
      v_name, r.table_name, v_permission
    );

    v_name := 'p6_' || r.table_name || '_cap_update';
    execute format('drop policy if exists %I on public.%I', v_name, r.table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using (company_id = public.require_company_id() and public.current_user_has_effective_app_permission(%L)) with check (company_id = public.require_company_id() and public.current_user_has_effective_app_permission(%L))',
      v_name, r.table_name, v_permission, v_permission
    );

    v_name := 'p6_' || r.table_name || '_cap_delete';
    execute format('drop policy if exists %I on public.%I', v_name, r.table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (company_id = public.require_company_id() and public.current_user_has_effective_app_permission(%L))',
      v_name, r.table_name, v_permission
    );
  end loop;
end
$policies$;

-- Maintenance commands use several historical authority shapes. Replace only
-- the known canonical guards and require the final function definition to
-- contain maintenance.write; otherwise migration replay aborts fail closed.
do $maintenance$
declare
  r record;
  v_sql text;
  v_changed boolean;
  v_target text := $$public.current_user_has_effective_app_permission('maintenance.write')$$;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_maintenance_atomic',
        'transition_maintenance_status_atomic',
        'resolve_maintenance_with_expense'
      )
  loop
    v_sql := pg_get_functiondef(r.oid);
    if position('maintenance.write' in v_sql) > 0 then
      continue;
    end if;
    v_changed := false;

    if position('public.is_admin_or_manager()' in v_sql) > 0 then
      v_sql := replace(v_sql, 'public.is_admin_or_manager()', v_target);
      v_changed := true;
    elsif position('is_admin_or_manager()' in v_sql) > 0 then
      v_sql := replace(v_sql, 'is_admin_or_manager()', $$current_user_has_effective_app_permission('maintenance.write')$$);
      v_changed := true;
    elsif position('public.is_app_user()' in v_sql) > 0 then
      v_sql := replace(v_sql, 'public.is_app_user()', v_target);
      v_changed := true;
    elsif position('is_app_user()' in v_sql) > 0 then
      v_sql := replace(v_sql, 'is_app_user()', $$current_user_has_effective_app_permission('maintenance.write')$$);
      v_changed := true;
    end if;

    if not v_changed then
      raise exception 'P6 refused to patch maintenance command %: authority anchor not found', r.proname;
    end if;

    execute v_sql;
    if position('maintenance.write' in pg_get_functiondef(r.oid)) = 0 then
      raise exception 'P6 failed to install maintenance.write authority in %', r.proname;
    end if;
  end loop;
end
$maintenance$;

commit;

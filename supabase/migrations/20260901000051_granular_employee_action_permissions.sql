-- Granular Employee action permissions.
--
-- P6 introduced owner-authored effective permissions but kept three broad
-- compatibility writes (properties.write / contracts.write / maintenance.write).
-- This migration makes routine Employee delegation match the product language:
-- view / add / edit / approve-or-close / cancel-or-archive where the domain
-- actually supports those actions.
--
-- Historical broad writes remain internal compatibility inputs only. Existing
-- role defaults and existing owner overrides are preserved as fallback until an
-- owner makes an explicit granular decision. New UI decisions are granular and
-- are enforced by RLS + SECURITY DEFINER command boundaries, not presentation.

begin;

insert into public.app_permission_catalog(permission, label_ar, admin_only, requestable)
values
  ('properties.create', 'إضافة عقار أو وحدة', false, true),
  ('properties.edit', 'تعديل عقار أو وحدة', false, true),
  ('properties.archive', 'أرشفة عقار أو وحدة', false, true),
  ('contracts.create', 'إضافة عقد أو مستأجر', false, true),
  ('contracts.edit', 'تعديل وتمديد وتجديد العقد', false, true),
  ('contracts.approve', 'اعتماد أو رفض وتفعيل العقد', false, true),
  ('contracts.cancel', 'إنهاء أو أرشفة العقد', false, true),
  ('maintenance.create', 'إضافة طلب صيانة', false, true),
  ('maintenance.edit', 'متابعة وتحديث الصيانة', false, true),
  ('maintenance.approve', 'اعتماد إغلاق الصيانة', false, true),
  ('maintenance.cancel', 'إلغاء طلب الصيانة', false, true)
on conflict(permission) do update set
  label_ar = excluded.label_ar,
  admin_only = excluded.admin_only,
  requestable = excluded.requestable;

-- Broad writes stay resolvable for old roles/grants but disappear from the
-- routine owner-facing permission editor. They are compatibility parents only.
update public.app_permission_catalog
set requestable = false
where permission in ('properties.write', 'contracts.write', 'maintenance.write');

-- Resolve exact owner decisions first, then a historical broad owner decision,
-- then exact legacy defaults/grants, then the compatibility parent. This lets
-- an owner progressively refine an old broad ALLOW/DENY one action at a time.
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
  v_parent_override boolean;
  v_parent text;
begin
  if not coalesce(public.is_app_user(), false) then
    return false;
  end if;
  if not exists(select 1 from public.app_permission_catalog c where c.permission = p_permission) then
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

  v_parent := case p_permission
    when 'properties.create' then 'properties.write'
    when 'properties.edit' then 'properties.write'
    when 'properties.archive' then 'properties.write'
    when 'contracts.create' then 'contracts.write'
    when 'contracts.edit' then 'contracts.write'
    when 'contracts.approve' then 'contracts.write'
    when 'contracts.cancel' then 'contracts.write'
    when 'maintenance.create' then 'maintenance.write'
    when 'maintenance.edit' then 'maintenance.write'
    when 'maintenance.approve' then 'maintenance.write'
    when 'maintenance.cancel' then 'maintenance.write'
    else null
  end;

  if v_parent is not null then
    select o.allowed into v_parent_override
    from public.user_permission_overrides o
    where o.company_id = v_company
      and o.user_id = auth.uid()
      and o.permission = v_parent;
    if found then
      return v_parent_override;
    end if;
  end if;

  if public.role_has_app_permission(public.current_app_role(), p_permission)
     or exists (
       select 1 from public.user_permission_grants g
       where g.company_id = v_company
         and g.user_id = auth.uid()
         and g.permission = p_permission
         and g.revoked_at is null
     ) then
    return true;
  end if;

  if v_parent is not null then
    return public.role_has_app_permission(public.current_app_role(), v_parent)
      or exists (
        select 1 from public.user_permission_grants g
        where g.company_id = v_company
          and g.user_id = auth.uid()
          and g.permission = v_parent
          and g.revoked_at is null
      );
  end if;

  return false;
end;
$function$;

-- Owner-facing permission mutation with action -> workspace dependencies.
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
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_dependency text;
  v_child text;
begin
  if v_actor is null or not coalesce(public.is_admin(), false) then
    raise exception 'OFFICE_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if p_user_id is null or p_allowed is null then
    raise exception 'INVALID_EMPLOYEE_PERMISSION_INPUT' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.company_members cm
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

  insert into public.user_permission_overrides(company_id,user_id,permission,allowed,set_by,reason,set_at)
  values(v_company,p_user_id,p_permission,p_allowed,v_actor,v_reason,now())
  on conflict(company_id,user_id,permission) do update set
    allowed=excluded.allowed,set_by=excluded.set_by,reason=excluded.reason,set_at=excluded.set_at;

  if p_allowed then
    v_dependency := case
      when p_permission like 'properties.%' and p_permission <> 'properties.view' then 'properties.view'
      when p_permission like 'contracts.%' and p_permission <> 'contracts.view' then 'contracts.view'
      when p_permission like 'maintenance.%' and p_permission <> 'maintenance.view' then 'maintenance.view'
      when p_permission = 'financial.payments.create' then 'financial.workspace.view'
      when p_permission in ('expenses.view','expenses.write') then 'financial.workspace.view'
      when p_permission = 'financial.reports.export' then 'financial.reports.view'
      else null
    end;
    if v_dependency is not null then
      insert into public.user_permission_overrides(company_id,user_id,permission,allowed,set_by,reason,set_at)
      values(v_company,p_user_id,v_dependency,true,v_actor,'AUTO_DEPENDENCY',now())
      on conflict(company_id,user_id,permission) do update set
        allowed=true,set_by=excluded.set_by,reason=excluded.reason,set_at=excluded.set_at;
    end if;
  else
    -- A hidden workspace cannot retain executable child actions.
    if p_permission = 'properties.view' then
      foreach v_child in array array['properties.create','properties.edit','properties.archive'] loop
        insert into public.user_permission_overrides(company_id,user_id,permission,allowed,set_by,reason,set_at)
        values(v_company,p_user_id,v_child,false,v_actor,'WORKSPACE_DISABLED',now())
        on conflict(company_id,user_id,permission) do update set allowed=false,set_by=excluded.set_by,reason=excluded.reason,set_at=excluded.set_at;
      end loop;
    elsif p_permission = 'contracts.view' then
      foreach v_child in array array['contracts.create','contracts.edit','contracts.approve','contracts.cancel'] loop
        insert into public.user_permission_overrides(company_id,user_id,permission,allowed,set_by,reason,set_at)
        values(v_company,p_user_id,v_child,false,v_actor,'WORKSPACE_DISABLED',now())
        on conflict(company_id,user_id,permission) do update set allowed=false,set_by=excluded.set_by,reason=excluded.reason,set_at=excluded.set_at;
      end loop;
    elsif p_permission = 'maintenance.view' then
      foreach v_child in array array['maintenance.create','maintenance.edit','maintenance.approve','maintenance.cancel'] loop
        insert into public.user_permission_overrides(company_id,user_id,permission,allowed,set_by,reason,set_at)
        values(v_company,p_user_id,v_child,false,v_actor,'WORKSPACE_DISABLED',now())
        on conflict(company_id,user_id,permission) do update set allowed=false,set_by=excluded.set_by,reason=excluded.reason,set_at=excluded.set_at;
      end loop;
    elsif p_permission = 'financial.workspace.view' then
      foreach v_child in array array['financial.payments.create','expenses.view','expenses.write'] loop
        insert into public.user_permission_overrides(company_id,user_id,permission,allowed,set_by,reason,set_at)
        values(v_company,p_user_id,v_child,false,v_actor,'WORKSPACE_DISABLED',now())
        on conflict(company_id,user_id,permission) do update set allowed=false,set_by=excluded.set_by,reason=excluded.reason,set_at=excluded.set_at;
      end loop;
    elsif p_permission = 'financial.reports.view' then
      insert into public.user_permission_overrides(company_id,user_id,permission,allowed,set_by,reason,set_at)
      values(v_company,p_user_id,'financial.reports.export',false,v_actor,'WORKSPACE_DISABLED',now())
      on conflict(company_id,user_id,permission) do update set allowed=false,set_by=excluded.set_by,reason=excluded.reason,set_at=excluded.set_at;
    end if;
  end if;

  return jsonb_build_object('user_id',p_user_id,'permission',p_permission,'allowed',p_allowed);
end;
$function$;

revoke all on function public.set_employee_permission(uuid,text,boolean,text) from public,anon;
grant execute on function public.set_employee_permission(uuid,text,boolean,text) to authenticated;

-- Replace P6 broad table gates with operation-specific gates. Both a permissive
-- capability policy and its restrictive owner-decision companion are replaced;
-- leaving the old permissive policy would make a granular ALLOW unusable.
do $granular_rls$
declare
  r record;
  v_name text;
begin
  for r in
    select * from (values
      ('properties','properties.create','properties.edit','properties.archive'),
      ('units','properties.create','properties.edit','properties.archive'),
      ('contracts','contracts.create','contracts.edit','contracts.cancel'),
      ('maintenance_records','maintenance.create','maintenance.edit','maintenance.cancel')
    ) as x(table_name,insert_permission,update_permission,delete_permission)
  loop
    if to_regclass('public.' || r.table_name) is null then continue; end if;

    foreach v_name in array array[
      'p6_'||r.table_name||'_cap_insert','p6_'||r.table_name||'_cap_update','p6_'||r.table_name||'_cap_delete',
      'p6_'||r.table_name||'_cap_insert_guard','p6_'||r.table_name||'_cap_update_guard','p6_'||r.table_name||'_cap_delete_guard'
    ] loop
      execute format('drop policy if exists %I on public.%I',v_name,r.table_name);
    end loop;

    v_name := 'p50_'||r.table_name||'_action_insert';
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (company_id=public.require_company_id() and public.current_user_has_effective_app_permission(%L))',
      v_name,r.table_name,r.insert_permission);
    v_name := 'p50_'||r.table_name||'_action_insert_guard';
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated with check (company_id=public.require_company_id() and public.current_user_has_effective_app_permission(%L))',
      v_name,r.table_name,r.insert_permission);

    v_name := 'p50_'||r.table_name||'_action_update';
    execute format(
      'create policy %I on public.%I for update to authenticated using (company_id=public.require_company_id() and public.current_user_has_effective_app_permission(%L)) with check (company_id=public.require_company_id() and public.current_user_has_effective_app_permission(%L))',
      v_name,r.table_name,r.update_permission,r.update_permission);
    v_name := 'p50_'||r.table_name||'_action_update_guard';
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using (company_id=public.require_company_id() and public.current_user_has_effective_app_permission(%L)) with check (company_id=public.require_company_id() and public.current_user_has_effective_app_permission(%L))',
      v_name,r.table_name,r.update_permission,r.update_permission);

    v_name := 'p50_'||r.table_name||'_action_delete';
    execute format(
      'create policy %I on public.%I for delete to authenticated using (company_id=public.require_company_id() and public.current_user_has_effective_app_permission(%L))',
      v_name,r.table_name,r.delete_permission);
    v_name := 'p50_'||r.table_name||'_action_delete_guard';
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (company_id=public.require_company_id() and public.current_user_has_effective_app_permission(%L))',
      v_name,r.table_name,r.delete_permission);
  end loop;
end
$granular_rls$;

-- Transition helper: cancellation is a separate owner-delegated action while
-- ordinary progress/completion stays an edit. The transition RPC still owns the
-- lifecycle legality checks and terminal-state rules.
create or replace function public.current_user_can_transition_maintenance(p_next_status text)
returns boolean
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select case lower(btrim(coalesce(p_next_status,'')))
    when 'cancelled' then public.current_user_has_effective_app_permission('maintenance.cancel')
    else public.current_user_has_effective_app_permission('maintenance.edit')
  end;
$function$;
revoke all on function public.current_user_can_transition_maintenance(text) from public,anon;
grant execute on function public.current_user_can_transition_maintenance(text) to authenticated,service_role;

-- Patch command boundaries mechanically and fail closed if a known command is
-- present but no recognized authority anchor can be replaced. Business rules,
-- maker/checker separation, agreement coverage and accounting logic are not
-- rewritten here.
do $command_authority$
declare
  r record;
  p record;
  v_sql text;
  v_target text;
  v_changed boolean;
begin
  for r in
    select * from (values
      ('create_contract_atomic','contracts.create'),
      ('create_contract_atomic_v2','contracts.create'),
      ('update_contract_atomic','contracts.edit'),
      ('update_contract_atomic_v2','contracts.edit'),
      ('update_contract_billing_policy_atomic','contracts.edit'),
      ('renew_contract_atomic','contracts.edit'),
      ('submit_contract_for_approval_atomic','contracts.edit'),
      ('approve_contract_atomic','contracts.approve'),
      ('reject_contract_atomic','contracts.approve'),
      ('activate_contract_with_agreement_snapshot_atomic','contracts.approve'),
      ('terminate_contract_atomic','contracts.cancel'),
      ('soft_delete_contract_atomic','contracts.cancel'),
      ('extend_short_stay_contract_atomic','contracts.edit'),
      ('create_maintenance_atomic','maintenance.create'),
      ('close_maintenance_with_expense','maintenance.approve'),
      ('resolve_maintenance_with_expense','maintenance.approve')
    ) as x(function_name,permission)
  loop
    for p in
      select proc.oid
      from pg_proc proc join pg_namespace n on n.oid=proc.pronamespace
      where n.nspname='public' and proc.proname=r.function_name
    loop
      v_sql := pg_get_functiondef(p.oid);
      if position(r.permission in v_sql)>0 then continue; end if;
      v_target := format('public.current_user_has_effective_app_permission(%L)',r.permission);
      v_changed := false;

      if position($$public.current_user_has_effective_app_permission('contracts.write')$$ in v_sql)>0 then
        v_sql := replace(v_sql,$$public.current_user_has_effective_app_permission('contracts.write')$$,v_target); v_changed:=true;
      end if;
      if position($$public.current_user_has_effective_app_permission('maintenance.write')$$ in v_sql)>0 then
        v_sql := replace(v_sql,$$public.current_user_has_effective_app_permission('maintenance.write')$$,v_target); v_changed:=true;
      end if;
      if position('public.is_admin_or_manager()' in v_sql)>0 then
        v_sql := replace(v_sql,'public.is_admin_or_manager()',v_target); v_changed:=true;
      end if;
      if position('public.is_admin()' in v_sql)>0 then
        v_sql := replace(v_sql,'public.is_admin()',v_target); v_changed:=true;
      end if;
      if position('public.is_app_user()' in v_sql)>0 then
        v_sql := replace(v_sql,'public.is_app_user()',v_target); v_changed:=true;
      end if;

      if not v_changed then
        raise exception 'P50 authority anchor not found in %',r.function_name;
      end if;
      execute v_sql;
      if position(r.permission in pg_get_functiondef(p.oid))=0 then
        raise exception 'P50 failed to install % in %',r.permission,r.function_name;
      end if;
    end loop;
  end loop;
end
$command_authority$;

-- transition_maintenance_status_atomic needs next-status-aware authority.
do $maintenance_transition_authority$
declare
  p record;
  v_sql text;
  v_changed boolean;
begin
  for p in
    select proc.oid
    from pg_proc proc join pg_namespace n on n.oid=proc.pronamespace
    where n.nspname='public' and proc.proname='transition_maintenance_status_atomic'
  loop
    v_sql := pg_get_functiondef(p.oid);
    if position('current_user_can_transition_maintenance' in v_sql)>0 then continue; end if;
    v_changed:=false;
    if position($$public.current_user_has_effective_app_permission('maintenance.write')$$ in v_sql)>0 then
      v_sql:=replace(v_sql,$$public.current_user_has_effective_app_permission('maintenance.write')$$,$$public.current_user_can_transition_maintenance(p_next_status)$$);
      v_changed:=true;
    elsif position('public.is_app_user()' in v_sql)>0 then
      v_sql:=replace(v_sql,'public.is_app_user()',$$public.current_user_can_transition_maintenance(p_next_status)$$);
      v_changed:=true;
    end if;
    if not v_changed then raise exception 'P50 maintenance transition authority anchor not found'; end if;
    execute v_sql;
  end loop;
end
$maintenance_transition_authority$;

notify pgrst,'reload schema';
commit;

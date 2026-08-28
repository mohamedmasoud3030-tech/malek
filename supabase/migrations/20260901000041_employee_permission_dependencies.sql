-- Keep owner-authored Employee permissions coherent. An action capability may
-- never be enabled while its owning workspace is hidden, and hiding a
-- workspace disables the dependent actions explicitly.

begin;

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
    (v_company, p_user_id, p_permission, p_allowed, v_actor, v_reason, now())
  on conflict (company_id, user_id, permission) do update set
    allowed = excluded.allowed,
    set_by = excluded.set_by,
    reason = excluded.reason,
    set_at = excluded.set_at;

  -- Enabling an action automatically reveals its workspace.
  if p_allowed then
    v_dependency := case p_permission
      when 'properties.write' then 'properties.view'
      when 'contracts.write' then 'contracts.view'
      when 'maintenance.write' then 'maintenance.view'
      when 'financial.payments.create' then 'financial.workspace.view'
      when 'expenses.view' then 'financial.workspace.view'
      when 'expenses.write' then 'financial.workspace.view'
      when 'financial.reports.export' then 'financial.reports.view'
      else null
    end;

    if v_dependency is not null then
      insert into public.user_permission_overrides
        (company_id, user_id, permission, allowed, set_by, reason, set_at)
      values
        (v_company, p_user_id, v_dependency, true, v_actor, 'AUTO_DEPENDENCY', now())
      on conflict (company_id, user_id, permission) do update set
        allowed = true,
        set_by = excluded.set_by,
        reason = excluded.reason,
        set_at = excluded.set_at;
    end if;
  else
    -- Hiding a workspace explicitly disables actions that belong to it.
    if p_permission = 'properties.view' then
      update public.user_permission_overrides
      set allowed = false, set_by = v_actor, reason = 'WORKSPACE_DISABLED', set_at = now()
      where company_id = v_company and user_id = p_user_id and permission = 'properties.write';
      insert into public.user_permission_overrides(company_id,user_id,permission,allowed,set_by,reason,set_at)
      values(v_company,p_user_id,'properties.write',false,v_actor,'WORKSPACE_DISABLED',now())
      on conflict(company_id,user_id,permission) do update set allowed=false,set_by=excluded.set_by,reason=excluded.reason,set_at=excluded.set_at;
    elsif p_permission = 'contracts.view' then
      insert into public.user_permission_overrides(company_id,user_id,permission,allowed,set_by,reason,set_at)
      values(v_company,p_user_id,'contracts.write',false,v_actor,'WORKSPACE_DISABLED',now())
      on conflict(company_id,user_id,permission) do update set allowed=false,set_by=excluded.set_by,reason=excluded.reason,set_at=excluded.set_at;
    elsif p_permission = 'maintenance.view' then
      insert into public.user_permission_overrides(company_id,user_id,permission,allowed,set_by,reason,set_at)
      values(v_company,p_user_id,'maintenance.write',false,v_actor,'WORKSPACE_DISABLED',now())
      on conflict(company_id,user_id,permission) do update set allowed=false,set_by=excluded.set_by,reason=excluded.reason,set_at=excluded.set_at;
    elsif p_permission = 'financial.workspace.view' then
      insert into public.user_permission_overrides(company_id,user_id,permission,allowed,set_by,reason,set_at)
      values
        (v_company,p_user_id,'financial.payments.create',false,v_actor,'WORKSPACE_DISABLED',now()),
        (v_company,p_user_id,'expenses.view',false,v_actor,'WORKSPACE_DISABLED',now()),
        (v_company,p_user_id,'expenses.write',false,v_actor,'WORKSPACE_DISABLED',now())
      on conflict(company_id,user_id,permission) do update set allowed=false,set_by=excluded.set_by,reason=excluded.reason,set_at=excluded.set_at;
    elsif p_permission = 'financial.reports.view' then
      insert into public.user_permission_overrides(company_id,user_id,permission,allowed,set_by,reason,set_at)
      values(v_company,p_user_id,'financial.reports.export',false,v_actor,'WORKSPACE_DISABLED',now())
      on conflict(company_id,user_id,permission) do update set allowed=false,set_by=excluded.set_by,reason=excluded.reason,set_at=excluded.set_at;
    end if;
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'permission', p_permission,
    'allowed', p_allowed
  );
end;
$function$;

revoke all on function public.set_employee_permission(uuid,text,boolean,text) from public, anon;
grant execute on function public.set_employee_permission(uuid,text,boolean,text) to authenticated;

commit;

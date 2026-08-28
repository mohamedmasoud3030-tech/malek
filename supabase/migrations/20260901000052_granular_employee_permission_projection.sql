-- Keep the owner-facing employee permission matrix aligned with the canonical
-- effective-permission resolver installed in 00050.
--
-- Existing MANAGER/OPERATIONS members may still inherit broad compatibility
-- parents (properties.write / contracts.write / maintenance.write). Migration
-- 00050 intentionally lets those parents continue to authorize granular child
-- actions until the owner makes an explicit granular decision. The original P6
-- list_employee_effective_permissions() projection only checked the exact child
-- role/grant, so it could display a child as disabled while the command boundary
-- correctly allowed it. This projection mirrors the same precedence as
-- current_user_has_effective_app_permission():
-- exact owner decision -> broad owner decision -> exact legacy grant/default ->
-- broad compatibility grant/default.

begin;

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
      exact_override.allowed,
      parent_override.allowed,
      public.role_has_app_permission(cm.role::text, c.permission)
        or exists (
          select 1
          from public.user_permission_grants g
          where g.company_id = cm.company_id
            and g.user_id = cm.user_id
            and g.permission = c.permission
            and g.revoked_at is null
        )
        or (
          parent.permission is not null
          and (
            public.role_has_app_permission(cm.role::text, parent.permission)
            or exists (
              select 1
              from public.user_permission_grants g
              where g.company_id = cm.company_id
                and g.user_id = cm.user_id
                and g.permission = parent.permission
                and g.revoked_at is null
            )
          )
        ),
      false
    ) as allowed,
    (exact_override.permission is not null) as explicitly_set
  from public.company_members cm
  join public.users u on u.id = cm.user_id
  cross join public.app_permission_catalog c
  left join lateral (
    select case c.permission
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
    end as permission
  ) parent on true
  left join public.user_permission_overrides exact_override
    on exact_override.company_id = cm.company_id
   and exact_override.user_id = cm.user_id
   and exact_override.permission = c.permission
  left join public.user_permission_overrides parent_override
    on parent_override.company_id = cm.company_id
   and parent_override.user_id = cm.user_id
   and parent_override.permission = parent.permission
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

revoke all on function public.list_employee_effective_permissions() from public, anon;
grant execute on function public.list_employee_effective_permissions() to authenticated;

notify pgrst, 'reload schema';
commit;

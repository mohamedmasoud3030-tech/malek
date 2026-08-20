-- Complete the six-role company-membership cutover without editing deployed migration 08.
--
-- Migration 08 replaced the CHECK constraint, but the legacy MEMBER default and
-- OWNER/MEMBER authorization predicate remained active.  This forward migration
-- aligns defaults and management authority with SEC-004/SEC-005.

begin;

alter table public.company_members
  alter column role set default 'USER';

create or replace function app_private.can_manage_company_members(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select auth.uid() is not null
     and target_company_id = public.current_company_id()
     and public.current_user_has_effective_app_permission('users.manage')
     and exists (
       select 1
       from public.company_members cm
       join public.companies c on c.id = cm.company_id
       join public.users u on u.id = cm.user_id
       where cm.company_id = target_company_id
         and cm.user_id = auth.uid()
         and cm.is_active
         and c.is_active
         and u.deleted_at is null
         and u.is_active
         and u.status::text = 'ACTIVE'
     );
$$;

revoke all on function app_private.can_manage_company_members(uuid) from public;
revoke all on function app_private.can_manage_company_members(uuid) from anon;
grant execute on function app_private.can_manage_company_members(uuid) to authenticated;
grant execute on function app_private.can_manage_company_members(uuid) to service_role;

comment on function app_private.can_manage_company_members(uuid) is
  'Checks active-company membership plus effective users.manage authority; membership role labels are not authorization.';

commit;

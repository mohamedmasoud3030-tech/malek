-- Live hardening parity: company-membership administration must be authorized
-- from current database membership/user state, never from stale JWT role claims.
begin;

create or replace function app_private.can_manage_company_members(target_company_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select auth.uid() is not null
     and exists (
       select 1
       from public.company_members cm
       join public.companies c on c.id = cm.company_id
       join public.users u on u.id = cm.user_id
       where cm.company_id = target_company_id
         and cm.user_id = auth.uid()
         and cm.is_active
         and c.is_active
         and upper(coalesce(cm.role, 'MEMBER')) in ('OWNER', 'ADMIN')
         and u.deleted_at is null
         and u.is_active
         and u.status::text = 'ACTIVE'
     );
$function$;

revoke all on function app_private.can_manage_company_members(uuid) from public, anon;
grant execute on function app_private.can_manage_company_members(uuid) to authenticated, service_role;

drop policy if exists companies_member_read on public.companies;
create policy companies_member_read on public.companies
  for select to authenticated
  using (
    public.is_app_user()
    and public.is_company_member(companies.id, auth.uid())
  );

drop policy if exists company_members_read_own on public.company_members;
create policy company_members_read_own on public.company_members
  for select to authenticated
  using (
    public.is_app_user()
    and (
      user_id = auth.uid()
      or app_private.can_manage_company_members(company_id)
    )
  );

drop policy if exists company_members_admin_write_f5617d3b_ins on public.company_members;
drop policy if exists company_members_admin_write_f5617d3b_upd on public.company_members;
drop policy if exists company_members_admin_write_f5617d3b_del on public.company_members;
drop policy if exists company_members_admin_write on public.company_members;

create policy company_members_admin_write_ins on public.company_members
  for insert to authenticated
  with check (app_private.can_manage_company_members(company_id));

create policy company_members_admin_write_upd on public.company_members
  for update to authenticated
  using (app_private.can_manage_company_members(company_id))
  with check (app_private.can_manage_company_members(company_id));

create policy company_members_admin_write_del on public.company_members
  for delete to authenticated
  using (app_private.can_manage_company_members(company_id));

commit;

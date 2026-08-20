-- Live parity: the active-company JWT scopes business data and membership
-- mutations, but must not hide the caller's other active memberships. The
-- client needs that authorized list to offer A <-> B switching before asking
-- Auth to issue the next company claim.
begin;

drop policy if exists p0_tenant_isolation on public.companies;
drop policy if exists p0_tenant_isolation on public.company_members;

-- companies remains read-only to authenticated callers unless another explicit
-- write policy is added. companies_member_read already requires is_app_user()
-- + an active membership in an active company.

-- Membership mutations remain restricted to the company currently claimed by
-- the JWT, in addition to the permissive live OWNER/ADMIN authority policies.
drop policy if exists company_members_tenant_write_scope_ins on public.company_members;
drop policy if exists company_members_tenant_write_scope_upd on public.company_members;
drop policy if exists company_members_tenant_write_scope_del on public.company_members;

create policy company_members_tenant_write_scope_ins
  on public.company_members
  as restrictive
  for insert
  to authenticated
  with check (company_id = public.current_company_id());

create policy company_members_tenant_write_scope_upd
  on public.company_members
  as restrictive
  for update
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy company_members_tenant_write_scope_del
  on public.company_members
  as restrictive
  for delete
  to authenticated
  using (company_id = public.current_company_id());

commit;

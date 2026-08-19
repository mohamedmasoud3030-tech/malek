-- Membership SELECT policies on expenses and tenant_deposits are permissive.
-- Add a restrictive active-company invariant so a valid member cannot read rows
-- from a non-active company when the signed JWT selects another company.

begin;

alter table public.expenses enable row level security;
alter table public.tenant_deposits enable row level security;

drop policy if exists p0_tenant_isolation on public.expenses;
create policy p0_tenant_isolation
on public.expenses
as restrictive
for all
to public
using (company_id = (select public.current_company_id()))
with check (company_id = (select public.current_company_id()));

drop policy if exists p0_tenant_isolation on public.tenant_deposits;
create policy p0_tenant_isolation
on public.tenant_deposits
as restrictive
for all
to public
using (company_id = (select public.current_company_id()))
with check (company_id = (select public.current_company_id()));

commit;

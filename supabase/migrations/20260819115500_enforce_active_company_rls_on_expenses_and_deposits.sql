-- Expenses and tenant_deposits had permissive membership SELECT policies.
-- A user who belongs to a company could therefore still read that company's
-- rows while their signed JWT selected a different active company, because
-- permissive policies combine with OR.
--
-- Match the restrictive active-company invariant already used by other
-- tenant-scoped operational tables: membership/permission policies still
-- decide whether an operation is allowed, while this restrictive policy also
-- requires every visible/writable row to match the active JWT company claim.

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

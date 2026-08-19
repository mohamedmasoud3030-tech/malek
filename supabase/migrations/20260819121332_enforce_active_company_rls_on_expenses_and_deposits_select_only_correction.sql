begin;

-- Expenses are RPC-only for mutations. Keep the active-company fence on reads
-- without reintroducing any INSERT/UPDATE/DELETE/ALL RLS policy, preserving the
-- S02 direct-write hardening contract.
drop policy if exists p0_tenant_isolation on public.expenses;
create policy p0_tenant_isolation
on public.expenses
as restrictive
for select
to public
using (company_id = (select public.current_company_id()));

commit;
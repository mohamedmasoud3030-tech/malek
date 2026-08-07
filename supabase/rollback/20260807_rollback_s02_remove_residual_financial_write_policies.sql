-- Fail-closed rollback for 20260807010000_s02_remove_residual_financial_write_policies.sql.
--
-- This rollback intentionally does not restore FOR ALL policies or browser
-- DML grants. It restores the historical policy name as SELECT-only and keeps
-- direct financial mutations restricted to approved SECURITY DEFINER RPCs.
begin;

alter table public.payments enable row level security;
alter table public.expenses enable row level security;

drop policy if exists p0_tenant_isolation on public.payments;
create policy p0_tenant_isolation
  on public.payments
  as restrictive
  for select
  to authenticated
  using (company_id = public.current_company_id());

drop policy if exists p0_tenant_isolation on public.expenses;
create policy p0_tenant_isolation
  on public.expenses
  as restrictive
  for select
  to authenticated
  using (company_id = public.current_company_id());

revoke insert, update, delete on table public.payments, public.expenses
  from public, anon, authenticated;

do $$
declare
  v_write_policy_count integer;
  v_direct_write_grant_count integer;
begin
  select count(*)
    into v_write_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('payments', 'expenses')
    and upper(cmd) in ('ALL', 'INSERT', 'UPDATE', 'DELETE');

  if v_write_policy_count <> 0 then
    raise exception
      'Fail-closed rollback aborted: write-capable RLS policies remain on payments/expenses: %',
      v_write_policy_count;
  end if;

  select count(*)
    into v_direct_write_grant_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in ('payments', 'expenses')
    and grantee in ('PUBLIC', 'anon', 'authenticated')
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE');

  if v_direct_write_grant_count <> 0 then
    raise exception
      'Fail-closed rollback aborted: direct write grants remain on payments/expenses: %',
      v_direct_write_grant_count;
  end if;
end $$;

commit;

-- S02-T06 follow-up — remove residual write-capable tenant policies.
--
-- The original P0 tenant-isolation migration created restrictive FOR ALL
-- policies named p0_tenant_isolation. S02-T06 replaced legacy permissive
-- write policies and table grants, but those two restrictive FOR ALL policies
-- remained visible to the security contract as write-capable policies.
--
-- This forward-only repair keeps the existing company-scoped SELECT policies
-- and removes every residual browser-direct write path on payments/expenses.
begin;

alter table public.payments enable row level security;
alter table public.expenses enable row level security;

drop policy if exists p0_tenant_isolation on public.payments;
drop policy if exists p0_tenant_isolation on public.expenses;

revoke insert, update, delete on table public.payments, public.expenses
  from public, anon, authenticated;

do $$
declare
  v_write_policy_count integer;
  v_missing_select_policy_count integer;
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
      'S02-T06 repair aborted: write-capable RLS policies remain on payments/expenses: %',
      v_write_policy_count;
  end if;

  select count(*)
    into v_missing_select_policy_count
  from (
    values
      ('payments'::text, 'payments_select_app_users'::text),
      ('expenses'::text, 'expenses_select_app_users'::text)
  ) as expected(tablename, policyname)
  left join pg_policies p
    on p.schemaname = 'public'
   and p.tablename = expected.tablename
   and p.policyname = expected.policyname
   and upper(p.cmd) = 'SELECT'
  where p.policyname is null;

  if v_missing_select_policy_count <> 0 then
    raise exception
      'S02-T06 repair aborted: expected company-scoped SELECT policies are missing: %',
      v_missing_select_policy_count;
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
      'S02-T06 repair aborted: direct write grants remain on payments/expenses: %',
      v_direct_write_grant_count;
  end if;
end $$;

comment on table public.payments is
  'S02-T06: authenticated clients have company-scoped SELECT only; mutations require approved SECURITY DEFINER RPCs.';
comment on table public.expenses is
  'S02-T06: authenticated clients have company-scoped SELECT only; mutations require approved SECURITY DEFINER RPCs.';

commit;

begin;

create extension if not exists pgtap;
select plan(11);

select ok(
  has_table_privilege('authenticated', 'public.accounts', 'SELECT'),
  'authenticated keeps SELECT on accounts'
);
select ok(
  not has_table_privilege('authenticated', 'public.accounts', 'INSERT'),
  'authenticated cannot INSERT accounts directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.accounts', 'UPDATE'),
  'authenticated cannot UPDATE accounts directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.accounts', 'DELETE'),
  'authenticated cannot DELETE accounts directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.accounts', 'TRUNCATE'),
  'authenticated cannot TRUNCATE accounts directly'
);

select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'admin_write_accounts'),
  0,
  'legacy admin_write_accounts policy is absent'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'no_browser_write_accounts'),
  1,
  'explicit no_browser_write_accounts policy exists'
);

select ok(
  has_function_privilege('authenticated', 'public.ensure_company_chart_of_accounts()', 'EXECUTE'),
  'authenticated may execute the approved chart provisioning facade'
);
select ok(
  not has_function_privilege('authenticated', 'public.provision_company_chart_of_accounts(uuid)', 'EXECUTE'),
  'authenticated cannot execute the trusted provisioning primitive directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.ensure_company_account(uuid,text,text)', 'EXECUTE'),
  'authenticated cannot execute the internal single-account creation helper'
);
select ok(
  has_table_privilege('service_role', 'public.accounts', 'INSERT')
  and has_table_privilege('service_role', 'public.accounts', 'UPDATE')
  and has_table_privilege('service_role', 'public.accounts', 'DELETE'),
  'service_role retains server-side account mutation privileges'
);

select * from finish();
rollback;

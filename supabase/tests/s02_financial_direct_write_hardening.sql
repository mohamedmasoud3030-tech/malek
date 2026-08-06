-- S02-T06 database contract tests.
-- Run after migrations with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/s02_financial_direct_write_hardening.sql
-- Tests fail closed by raising exceptions; no warning-only or WHEN OTHERS passes.

begin;

do $$
declare
  v_count integer;
  v_predicate text;
  v_source text;
begin
  select count(*) into v_count
  from (values
    ('public.record_invoice_payment_atomic(jsonb)'),
    ('public.void_receipt_atomic(jsonb)'),
    ('public.create_expense_with_journal_atomic(jsonb)'),
    ('public.update_expense_with_journal_atomic(jsonb)')
  ) required(signature)
  join pg_proc p on p.oid = to_regprocedure(required.signature)
  where p.prosecdef;
  if v_count <> 4 then
    raise exception 'Expected four SECURITY DEFINER financial RPC overloads, found %', v_count;
  end if;

  if has_table_privilege('authenticated', 'public.payments', 'INSERT')
     or has_table_privilege('authenticated', 'public.payments', 'UPDATE')
     or has_table_privilege('authenticated', 'public.payments', 'DELETE') then
    raise exception 'authenticated still has direct mutation privilege on payments';
  end if;
  if has_table_privilege('authenticated', 'public.expenses', 'INSERT')
     or has_table_privilege('authenticated', 'public.expenses', 'UPDATE')
     or has_table_privilege('authenticated', 'public.expenses', 'DELETE') then
    raise exception 'authenticated still has direct mutation privilege on expenses';
  end if;
  if has_table_privilege('anon', 'public.payments', 'SELECT')
     or has_table_privilege('anon', 'public.expenses', 'SELECT') then
    raise exception 'anon unexpectedly has financial table SELECT';
  end if;
  if not has_table_privilege('authenticated', 'public.payments', 'SELECT')
     or not has_table_privilege('authenticated', 'public.expenses', 'SELECT') then
    raise exception 'authenticated lost required financial table SELECT';
  end if;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('payments', 'expenses')
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL');
  if v_count <> 0 then
    raise exception 'Write-capable RLS policies remain on payments/expenses: %', v_count;
  end if;

  select pg_get_expr(polqual, polrelid) into v_predicate
  from pg_policy
  where polrelid = 'public.payments'::regclass
    and polname = 'payments_select_app_users';
  if v_predicate is null
     or position('current_company_id' in v_predicate) = 0
     or position('company_id' in v_predicate) = 0 then
    raise exception 'payments SELECT policy is not company scoped: %', v_predicate;
  end if;

  select pg_get_expr(polqual, polrelid) into v_predicate
  from pg_policy
  where polrelid = 'public.expenses'::regclass
    and polname = 'expenses_select_app_users';
  if v_predicate is null
     or position('current_company_id' in v_predicate) = 0
     or position('company_id' in v_predicate) = 0 then
    raise exception 'expenses SELECT policy is not company scoped: %', v_predicate;
  end if;

  if has_function_privilege('public', 'public.record_invoice_payment_atomic(jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.record_invoice_payment_atomic(jsonb)', 'EXECUTE') then
    raise exception 'record_invoice_payment_atomic exposed to PUBLIC/anon';
  end if;
  if has_function_privilege('public', 'public.void_receipt_atomic(jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.void_receipt_atomic(jsonb)', 'EXECUTE') then
    raise exception 'void_receipt_atomic exposed to PUBLIC/anon';
  end if;
  if has_function_privilege('public', 'public.create_expense_with_journal_atomic(jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.create_expense_with_journal_atomic(jsonb)', 'EXECUTE') then
    raise exception 'create_expense_with_journal_atomic exposed to PUBLIC/anon';
  end if;
  if has_function_privilege('public', 'public.update_expense_with_journal_atomic(jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.update_expense_with_journal_atomic(jsonb)', 'EXECUTE') then
    raise exception 'update_expense_with_journal_atomic exposed to PUBLIC/anon';
  end if;

  if not has_function_privilege('authenticated', 'public.record_invoice_payment_atomic(jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.void_receipt_atomic(jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.create_expense_with_journal_atomic(jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.update_expense_with_journal_atomic(jsonb)', 'EXECUTE') then
    raise exception 'authenticated is missing one or more approved RPC EXECUTE grants';
  end if;

  select pg_get_functiondef('public.record_invoice_payment_atomic(jsonb)'::regprocedure) into v_source;
  if position('auth.uid()' in v_source) = 0
     or position('is_admin_or_manager' in v_source) = 0
     or position('company_id' in v_source) = 0 then
    raise exception 'record_invoice_payment_atomic lost auth/role/company guard';
  end if;

  select pg_get_functiondef('public.void_receipt_atomic(jsonb)'::regprocedure) into v_source;
  if position('auth.uid()' in v_source) = 0
     or position('company_id' in v_source) = 0 then
    raise exception 'void_receipt_atomic lost auth/company guard';
  end if;

  select pg_get_functiondef('public.create_expense_with_journal_atomic(jsonb)'::regprocedure) into v_source;
  if position('auth.uid()' in v_source) = 0
     or position('company_id' in v_source) = 0 then
    raise exception 'create_expense_with_journal_atomic lost auth/company guard';
  end if;

  select pg_get_functiondef('public.update_expense_with_journal_atomic(jsonb)'::regprocedure) into v_source;
  if position('auth.uid()' in v_source) = 0
     or position('company_id' in v_source) = 0 then
    raise exception 'update_expense_with_journal_atomic lost auth/company guard';
  end if;
end $$;

set local role authenticated;

do $$
begin
  begin
    perform public.record_invoice_payment_atomic('{}'::jsonb);
    raise exception 'record_invoice_payment_atomic accepted unauthenticated context';
  exception when sqlstate '42501' then null;
  end;

  begin
    perform public.void_receipt_atomic('{}'::jsonb);
    raise exception 'void_receipt_atomic accepted unauthenticated context';
  exception when sqlstate '42501' then null;
  end;

  begin
    perform public.create_expense_with_journal_atomic('{}'::jsonb);
    raise exception 'create_expense_with_journal_atomic accepted unauthenticated context';
  exception when sqlstate '42501' then null;
  end;

  begin
    perform public.update_expense_with_journal_atomic('{}'::jsonb);
    raise exception 'update_expense_with_journal_atomic accepted unauthenticated context';
  exception when sqlstate '42501' then null;
  end;
end $$;

reset role;
rollback;

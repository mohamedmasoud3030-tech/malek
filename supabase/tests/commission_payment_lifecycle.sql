-- S02-T07 — Commission payment and reversal boundary contract.
--
-- This suite has no business fixture and leaves no rows behind.  It proves the
-- database boundary that makes commission payment/reversal server-only before
-- exercising the richer replayed lifecycle suite in the application package.
-- Run after migrations with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/commission_payment_lifecycle.sql

begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

select ok(
  to_regprocedure('public.pay_commission_atomic(jsonb)') is not null,
  'pay_commission_atomic(jsonb) exists'
);

select ok(
  to_regprocedure('public.reverse_commission_atomic(jsonb)') is not null,
  'reverse_commission_atomic(jsonb) exists'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    where p.oid = 'public.pay_commission_atomic(jsonb)'::regprocedure
  ),
  'pay_commission_atomic is SECURITY DEFINER'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    where p.oid = 'public.reverse_commission_atomic(jsonb)'::regprocedure
  ),
  'reverse_commission_atomic is SECURITY DEFINER'
);

select ok(
  (
    select array_to_string(p.proconfig, ',')
    from pg_proc p
    where p.oid = 'public.pay_commission_atomic(jsonb)'::regprocedure
  ) like '%search_path=public, pg_temp%',
  'pay_commission_atomic pins public, pg_temp search_path'
);

select ok(
  (
    select array_to_string(p.proconfig, ',')
    from pg_proc p
    where p.oid = 'public.reverse_commission_atomic(jsonb)'::regprocedure
  ) like '%search_path=public, pg_temp%',
  'reverse_commission_atomic pins public, pg_temp search_path'
);

select ok(
  not has_function_privilege('public', 'public.pay_commission_atomic(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.pay_commission_atomic(jsonb)', 'EXECUTE'),
  'pay_commission_atomic is not executable by PUBLIC or anon'
);

select ok(
  has_function_privilege('authenticated', 'public.pay_commission_atomic(jsonb)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.pay_commission_atomic(jsonb)', 'EXECUTE'),
  'pay_commission_atomic is executable by approved trusted callers'
);

select ok(
  not has_function_privilege('public', 'public.reverse_commission_atomic(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.reverse_commission_atomic(jsonb)', 'EXECUTE'),
  'reverse_commission_atomic is not executable by PUBLIC or anon'
);

select ok(
  has_function_privilege('authenticated', 'public.reverse_commission_atomic(jsonb)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.reverse_commission_atomic(jsonb)', 'EXECUTE'),
  'reverse_commission_atomic is executable by approved trusted callers'
);

select has_trigger(
  'public', 'commissions', 'trg_guard_commission_financial_fields',
  'commissions has its financial-field write guard'
);

select ok(
  (
    select pg_get_triggerdef(t.oid)
    from pg_trigger t
    where t.tgrelid = 'public.commissions'::regclass
      and t.tgname = 'trg_guard_commission_financial_fields'
  ) like '%BEFORE INSERT OR UPDATE OF status, paid_at, expense_id%',
  'financial-field guard covers status, paid_at and expense_id'
);

select ok(
  not has_table_privilege('authenticated', 'public.commissions', 'INSERT')
  and not has_table_privilege('authenticated', 'public.commissions', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.commissions', 'DELETE'),
  'authenticated cannot mutate commissions directly'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'commissions'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and (
        coalesce(qual, '') not in ('false', '(false)')
        or coalesce(with_check, '') not in ('false', '(false)')
      )
  ),
  'commissions has no permissive browser write-capable RLS policy'
);

select ok(
  pg_get_functiondef('public.pay_commission_atomic(jsonb)'::regprocedure) like '%pg_advisory_xact_lock%',
  'payment serializes the commission payment operation'
);

select ok(
  pg_get_functiondef('public.pay_commission_atomic(jsonb)'::regprocedure) like '%company_id = v_company_id%',
  'payment scopes the commission mutation to the active company'
);

select ok(
  pg_get_functiondef('public.reverse_commission_atomic(jsonb)'::regprocedure) like '%company_id = v_company_id%',
  'reversal scopes financial rows to the active company'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);

select throws_ok(
  $$select public.pay_commission_atomic('{}'::jsonb)$$,
  '42501',
  'غير مصرح: يجب أن تكون مديراً أو مشرفاً لصرف العمولة',
  'payment rejects an authenticated caller with no user/role context'
);

select throws_ok(
  $$select public.reverse_commission_atomic('{}'::jsonb)$$,
  '42501',
  'غير مصرح: يجب أن تكون مديراً أو مشرفاً لعكس العمولة',
  'reversal rejects an authenticated caller with no user/role context'
);

reset role;
select * from finish();
rollback;

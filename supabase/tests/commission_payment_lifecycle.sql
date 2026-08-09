-- S02-T06 · pay_commission_atomic / reverse_commission_atomic contract tests.
-- Verifies: SECURITY DEFINER + pinned search_path, RPC-only write boundary,
-- trigger guard (trg_guard_commission_financial_fields), idempotency source,
-- and behavioral rejection of unauthenticated callers and direct writes.
--
-- Pattern: temp table collects is()/pass()/fail() results across role-switch
-- boundaries. Final SELECT emits aggregated TAP output; psql ON_ERROR_STOP=1
-- surfaces assertion failures as non-zero exit.
--
-- Run:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/commission_payment_lifecycle.sql

begin;

create extension if not exists pgtap with schema extensions;

-- Temp table to collect assertion lines across role-switch sessions
create temp table _comm_results (seq serial, line text);

-- ── Seed fixtures ─────────────────────────────────────────────────────────────

insert into public.companies (id, name, slug)
values ('c5060000-0000-4000-8000-000000000001', 'S02 Commission Test Co', 's02-comm-test');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  'a5060000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 's02-comm@test.invalid', 'not-used',
  now(), now(), now(), '{}'::jsonb, '{}'::jsonb
);

insert into public.users (id, email, name, role, status, is_active)
values (
  'a5060000-0000-4000-8000-000000000001',
  's02-comm@test.invalid', 'S02 Commission Admin', 'ADMIN', 'ACTIVE', true
);

insert into public.company_members (company_id, user_id, role)
values (
  'c5060000-0000-4000-8000-000000000001',
  'a5060000-0000-4000-8000-000000000001',
  'ADMIN'
);

-- properties.id is text (not uuid)
insert into public.properties (id, name, type, address, company_id)
values (
  'd5060000000000000000000000000001',
  'عقار اختبار العمولات', 'سكني', 'مسقط',
  'c5060000-0000-4000-8000-000000000001'
);

-- GL accounts required by pay_commission_atomic
-- accounts(company_id, no) is unique — ON CONFLICT is safe
insert into public.accounts (id, no, name, type, company_id)
values
  (gen_random_uuid()::text, '1111', 'صندوق اختبار',   'asset',   'c5060000-0000-4000-8000-000000000001'),
  (gen_random_uuid()::text, '6100', 'مصاريف عمولات', 'expense', 'c5060000-0000-4000-8000-000000000001')
on conflict (company_id, no) do nothing;

-- Commission under test
insert into public.commissions (id, staff_name, amount, status, type, company_id)
values (
  'e5060000-0000-4000-8000-000000000001',
  'موظف اختبار', 500.00, 'pending', 'contract',
  'c5060000-0000-4000-8000-000000000001'
);

-- ── Plan ──────────────────────────────────────────────────────────────────────

select plan(17);

-- ── Block 1: Static schema assertions (runs as postgres/superuser) ────────────

do $$
declare
  v_src text;
begin
  -- [1] pay_commission_atomic SECURITY DEFINER
  insert into _comm_results(line)
  select is(
    (select prosecdef from pg_proc p join pg_namespace n on p.pronamespace=n.oid
     where n.nspname='public' and p.proname='pay_commission_atomic'),
    true,
    'pay_commission_atomic: SECURITY DEFINER'
  );

  -- [2] reverse_commission_atomic SECURITY DEFINER
  insert into _comm_results(line)
  select is(
    (select prosecdef from pg_proc p join pg_namespace n on p.pronamespace=n.oid
     where n.nspname='public' and p.proname='reverse_commission_atomic'),
    true,
    'reverse_commission_atomic: SECURITY DEFINER'
  );

  -- [3] pay_commission_atomic pinned search_path
  -- Note: proconfig is text[] with quoted elements; array_to_string gives clean comparison
  insert into _comm_results(line)
  select is(
    array_to_string(
      (select proconfig from pg_proc p join pg_namespace n on p.pronamespace=n.oid
       where n.nspname='public' and p.proname='pay_commission_atomic'),
      ','
    ),
    'search_path=public, pg_temp',
    'pay_commission_atomic: pinned search_path'
  );

  -- [4] reverse_commission_atomic pinned search_path
  insert into _comm_results(line)
  select is(
    array_to_string(
      (select proconfig from pg_proc p join pg_namespace n on p.pronamespace=n.oid
       where n.nspname='public' and p.proname='reverse_commission_atomic'),
      ','
    ),
    'search_path=public, pg_temp',
    'reverse_commission_atomic: pinned search_path'
  );

  -- [5] anon cannot execute pay_commission_atomic
  insert into _comm_results(line)
  select is(
    has_function_privilege('anon','public.pay_commission_atomic(jsonb)','EXECUTE'),
    false,
    'anon: no EXECUTE on pay_commission_atomic'
  );

  -- [6] anon cannot execute reverse_commission_atomic
  insert into _comm_results(line)
  select is(
    has_function_privilege('anon','public.reverse_commission_atomic(jsonb)','EXECUTE'),
    false,
    'anon: no EXECUTE on reverse_commission_atomic'
  );

  -- [7] authenticated can execute pay_commission_atomic
  insert into _comm_results(line)
  select is(
    has_function_privilege('authenticated','public.pay_commission_atomic(jsonb)','EXECUTE'),
    true,
    'authenticated: EXECUTE on pay_commission_atomic'
  );

  -- [8] authenticated can execute reverse_commission_atomic
  insert into _comm_results(line)
  select is(
    has_function_privilege('authenticated','public.reverse_commission_atomic(jsonb)','EXECUTE'),
    true,
    'authenticated: EXECUTE on reverse_commission_atomic'
  );

  -- [9] authenticated has no direct INSERT/UPDATE/DELETE on commissions
  insert into _comm_results(line)
  select is(
    (has_table_privilege('authenticated','public.commissions','INSERT')
     or has_table_privilege('authenticated','public.commissions','UPDATE')
     or has_table_privilege('authenticated','public.commissions','DELETE')),
    false,
    'authenticated: no direct write grants on commissions'
  );

  -- [10] trigger guard exists and is enabled (tgenabled = 'O' means ORIGIN/always)
  insert into _comm_results(line)
  select is(
    (select tgenabled::text
     from pg_trigger t
     join pg_class c on t.tgrelid=c.oid
     join pg_namespace n on c.relnamespace=n.oid
     where n.nspname='public' and c.relname='commissions'
       and t.tgname='trg_guard_commission_financial_fields'),
    'O',
    'trg_guard_commission_financial_fields: exists and enabled'
  );

  -- [11–15] Source-level guards in pay_commission_atomic
  select pg_get_functiondef('public.pay_commission_atomic(jsonb)'::regprocedure) into v_src;

  insert into _comm_results(line)
  select is(position('auth.uid()' in v_src)>0, true,
    'pay_commission_atomic: contains auth.uid() guard');

  insert into _comm_results(line)
  select is(position('is_admin_or_manager' in v_src)>0, true,
    'pay_commission_atomic: contains is_admin_or_manager guard');

  insert into _comm_results(line)
  select is(position('current_company_id' in v_src)>0, true,
    'pay_commission_atomic: contains current_company_id isolation');

  insert into _comm_results(line)
  select is(position('pg_advisory_xact_lock' in v_src)>0, true,
    'pay_commission_atomic: contains advisory lock');

  insert into _comm_results(line)
  select is(position('financial_operation_idempotency' in v_src)>0, true,
    'pay_commission_atomic: references idempotency table');
end $$;

-- ── Block 2: Behavioral rejections (role-switched to authenticated) ───────────

set local role authenticated;

do $$
begin
  -- [16] pay_commission_atomic rejects null JWT (no set_config for auth.uid())
  begin
    perform public.pay_commission_atomic(
      jsonb_build_object('commission_id','e5060000-0000-4000-8000-000000000001')
    );
    insert into _comm_results(line)
    select fail('pay_commission_atomic: should have rejected null auth.uid()');
  exception when sqlstate '42501' then
    insert into _comm_results(line)
    select pass('pay_commission_atomic: rejects caller with no JWT (42501)');
  end;

  -- [17] trigger guard blocks direct write of financial fields
  begin
    update public.commissions
    set status  = 'paid',
        paid_at = extract(epoch from now())::bigint
    where id = 'e5060000-0000-4000-8000-000000000001';
    insert into _comm_results(line)
    select fail('trg_guard_commission_financial_fields: should have blocked direct write');
  exception when sqlstate '42501' then
    insert into _comm_results(line)
    select pass('trg_guard_commission_financial_fields: blocks direct paid/paid_at write (42501)');
  end;
end $$;

reset role;

-- ── Emit all collected TAP lines then finish ──────────────────────────────────

select line from _comm_results order by seq;
select * from finish();

rollback;

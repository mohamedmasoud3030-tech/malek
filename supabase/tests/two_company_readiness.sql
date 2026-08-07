-- Two-company readiness gate.
-- Runs after the full migration replay against disposable PostgreSQL.
-- Proves that one multi-company user can switch A <-> B through the auth hook
-- while RLS and financial SECURITY DEFINER RPCs remain company-scoped.

begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into public.companies (id, name, slug, currency, locale)
values
  ('10000000-0000-4000-8000-00000000000a', 'Readiness Company A', 'readiness-company-a', 'OMR', 'ar-OM'),
  ('10000000-0000-4000-8000-00000000000b', 'Readiness Company B', 'readiness-company-b', 'OMR', 'ar-OM')
on conflict (id) do nothing;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'multi-company@readiness.invalid', 'not-used',
    now(), now(), now(), '{}'::jsonb,
    '{"company_id":"10000000-0000-4000-8000-00000000000a"}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000099',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'no-company@readiness.invalid', 'not-used',
    now(), now(), now(), '{}'::jsonb,
    '{"company_id":"10000000-0000-4000-8000-00000000000b"}'::jsonb
  )
on conflict (id) do update
set raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

insert into public.users (id, email, name, role, status, is_active)
values
  ('10000000-0000-4000-8000-000000000001', 'multi-company@readiness.invalid', 'Readiness Admin', 'ADMIN', 'ACTIVE', true),
  ('10000000-0000-4000-8000-000000000099', 'no-company@readiness.invalid', 'Readiness No Company', 'ADMIN', 'ACTIVE', true)
on conflict (id) do update
set role = excluded.role,
    status = excluded.status,
    is_active = excluded.is_active;

insert into public.company_members (id, company_id, user_id, role, created_at)
values
  (
    '10000000-0000-4000-8000-0000000000a1',
    '10000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-000000000001',
    'ADMIN',
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '10000000-0000-4000-8000-0000000000b1',
    '10000000-0000-4000-8000-00000000000b',
    '10000000-0000-4000-8000-000000000001',
    'ADMIN',
    timestamptz '2026-01-02 00:00:00+00'
  )
on conflict (company_id, user_id) do update
set role = excluded.role,
    is_active = true;

insert into public.properties (id, title, type, address, status, company_id)
values
  ('10000000-0000-4000-8000-00000000001a', 'Readiness Property A', 'residential', 'A', 'active', '10000000-0000-4000-8000-00000000000a'),
  ('10000000-0000-4000-8000-00000000001b', 'Readiness Property B', 'residential', 'B', 'active', '10000000-0000-4000-8000-00000000000b')
on conflict (id) do nothing;

insert into public.commissions (
  id, staff_name, type, status, amount, company_id, created_at, updated_at
)
values
  ('READINESS-COMMISSION-A', 'Readiness Broker A', 'contract', 'pending', 100, '10000000-0000-4000-8000-00000000000a', now(), now()),
  ('READINESS-COMMISSION-B', 'Readiness Broker B', 'contract', 'pending', 200, '10000000-0000-4000-8000-00000000000b', now(), now())
on conflict (id) do nothing;

-- A is selected by user_metadata and validated against membership.
select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', '10000000-0000-4000-8000-000000000001',
    'claims', jsonb_build_object('role', 'authenticated', 'app_metadata', '{}'::jsonb)
  ))->'claims'->'app_metadata'->>'company_id',
  '10000000-0000-4000-8000-00000000000a',
  'access-token hook selects Company A preference after membership validation'
);

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', '10000000-0000-4000-8000-000000000001',
    'claims', jsonb_build_object('role', 'authenticated', 'app_metadata', '{}'::jsonb)
  ))->'claims'->'app_metadata'->>'user_role',
  'ADMIN',
  'access-token hook preserves canonical application role'
);

-- Change preference to B: this is the server-side half of switchCompany().
update auth.users
set raw_user_meta_data = jsonb_build_object('company_id', '10000000-0000-4000-8000-00000000000b')
where id = '10000000-0000-4000-8000-000000000001';

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', '10000000-0000-4000-8000-000000000001',
    'claims', jsonb_build_object('role', 'authenticated', 'app_metadata', '{}'::jsonb)
  ))->'claims'->'app_metadata'->>'company_id',
  '10000000-0000-4000-8000-00000000000b',
  'access-token hook switches the same user to Company B'
);

-- An arbitrary user_metadata company is never trusted. Because A is the first
-- deterministic valid membership, the hook falls back to A rather than C.
update auth.users
set raw_user_meta_data = jsonb_build_object('company_id', '10000000-0000-4000-8000-00000000000c')
where id = '10000000-0000-4000-8000-000000000001';

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', '10000000-0000-4000-8000-000000000001',
    'claims', jsonb_build_object('role', 'authenticated', 'app_metadata', '{}'::jsonb)
  ))->'claims'->'app_metadata'->>'company_id',
  '10000000-0000-4000-8000-00000000000a',
  'invalid preferred company cannot cross the membership boundary'
);

-- A user with no membership cannot retain a stale incoming company claim.
select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', '10000000-0000-4000-8000-000000000099',
    'claims', jsonb_build_object(
      'role', 'authenticated',
      'app_metadata', jsonb_build_object('company_id', '10000000-0000-4000-8000-00000000000b')
    )
  ))->'claims'->'app_metadata'->>'company_id',
  null,
  'user with no membership receives no company claim'
);

select ok(
  not has_function_privilege('authenticated', 'public.custom_access_token_hook(jsonb)', 'EXECUTE'),
  'authenticated browser cannot call the auth hook directly'
);
select ok(
  not has_function_privilege('anon', 'public.custom_access_token_hook(jsonb)', 'EXECUTE'),
  'anon cannot call the auth hook directly'
);
select ok(
  has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'EXECUTE'),
  'Supabase Auth admin retains hook execute privilege'
);

-- Company A JWT: only A operational rows are visible.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"10000000-0000-4000-8000-00000000000a"}}',
  true
);
set local role authenticated;
select is((select count(*)::int from public.properties where id in (
  '10000000-0000-4000-8000-00000000001a', '10000000-0000-4000-8000-00000000001b'
)), 1, 'Company A sees exactly one readiness property');
select is((select title from public.properties where id = '10000000-0000-4000-8000-00000000001a'), 'Readiness Property A', 'Company A sees its property');
select is((select count(*)::int from public.commissions where id in ('READINESS-COMMISSION-A', 'READINESS-COMMISSION-B')), 1, 'Company A sees only its readiness commission');
select throws_ok(
  $$select public.update_commission_atomic('{"commission_id":"READINESS-COMMISSION-B","staff_name":"Cross-company","type":"contract","requested_status":"approved","amount":200,"request_id":"readiness-cross-a-to-b"}'::jsonb)$$,
  '42501',
  'COMMISSION_NOT_FOUND_OR_FORBIDDEN',
  'Company A cannot update Company B commission through SECURITY DEFINER RPC'
);
select lives_ok(
  $$select public.create_commission_atomic('{"staff_name":"Created by A","type":"contract","amount":125,"request_id":"readiness-create-a"}'::jsonb)$$,
  'Company A can create a commission through trusted RPC'
);
reset role;
select is((select count(*)::int from public.commissions where staff_name = 'Created by A' and company_id = '10000000-0000-4000-8000-00000000000a'), 1, 'A RPC write is stamped with Company A server-side');

-- Company B JWT: the same user switches isolation scope cleanly.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"10000000-0000-4000-8000-00000000000b"}}',
  true
);
set local role authenticated;
select is((select count(*)::int from public.properties where id in (
  '10000000-0000-4000-8000-00000000001a', '10000000-0000-4000-8000-00000000001b'
)), 1, 'Company B sees exactly one readiness property');
select is((select title from public.properties where id = '10000000-0000-4000-8000-00000000001b'), 'Readiness Property B', 'Company B sees its property');
select is((select count(*)::int from public.commissions where id in ('READINESS-COMMISSION-A', 'READINESS-COMMISSION-B')), 1, 'Company B sees only its readiness commission');
select lives_ok(
  $$select public.create_commission_atomic('{"staff_name":"Created by B","type":"contract","amount":225,"request_id":"readiness-create-b"}'::jsonb)$$,
  'Company B can create a commission through trusted RPC'
);
reset role;
select is((select count(*)::int from public.commissions where staff_name = 'Created by B' and company_id = '10000000-0000-4000-8000-00000000000b'), 1, 'B RPC write is stamped with Company B server-side');

select * from finish();
rollback;

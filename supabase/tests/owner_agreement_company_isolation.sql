-- FA-004 behavioral integration test. The isolated Supabase replay runs every
-- migration from an empty database before executing this file via `supabase
-- test db`. It uses real PostgreSQL roles, JWT request context, RLS, and the
-- SECURITY DEFINER RPC; it is not a source-text inspection.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Two independent tenants and one admin user per tenant.
insert into public.companies (id, name, slug)
values
  ('00000000-0000-4000-8000-0000000000a1', 'FA4 Company A', 'fa4-company-a'),
  ('00000000-0000-4000-8000-0000000000b1', 'FA4 Company B', 'fa4-company-b')
on conflict (id) do nothing;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fa4-a@test.invalid', 'not-used', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fa4-b@test.invalid', 'not-used', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into public.users (id, email, name, role, status, is_active)
values
  ('00000000-0000-0000-0000-00000000a001', 'fa4-a@test.invalid', 'FA4 A Admin', 'ADMIN', 'ACTIVE', true),
  ('00000000-0000-0000-0000-00000000b001', 'fa4-b@test.invalid', 'FA4 B Admin', 'ADMIN', 'ACTIVE', true)
on conflict (id) do update set role = excluded.role, status = excluded.status, is_active = excluded.is_active;

insert into public.company_members (company_id, user_id, role)
values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000a001', 'ADMIN'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-00000000b001', 'ADMIN')
on conflict (company_id, user_id) do update set role = excluded.role;

insert into public.owners (id, full_name, company_id)
values
  ('00000000-0000-0000-0000-00000000a101', 'FA4 Owner A', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000b101', 'FA4 Owner B', '00000000-0000-4000-8000-0000000000b1');

insert into public.properties (id, title, type, address, status, company_id)
values
  ('00000000-0000-0000-0000-00000000a201', 'FA4 Property A', 'residential', 'FA4 A', 'active', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000b201', 'FA4 Property B', 'residential', 'FA4 B', 'active', '00000000-0000-4000-8000-0000000000b1');

insert into public.owner_agreements
  (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, company_id)
values
  ('00000000-0000-0000-0000-00000000a301', '00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a201', 'property_management', 'RATE', 5, date '2026-01-01', date '2027-12-31', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000b301', '00000000-0000-0000-0000-00000000b101', '00000000-0000-0000-0000-00000000b201', 'property_management', 'RATE', 7, date '2026-01-01', date '2027-12-31', '00000000-0000-4000-8000-0000000000b1');

-- Company A can update its own agreement.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-0000000000a1"}}', true);
set local role authenticated;
select lives_ok(
  $$select public.update_owner_agreement_atomic('00000000-0000-0000-0000-00000000a301', '{"commission_value": 8, "notes": "A update"}'::jsonb)$$,
  'Company A can update Company A agreement'
);
select is((select commission_value from public.owner_agreements where id = '00000000-0000-0000-0000-00000000a301'), 8::numeric, 'Company A value changed');

-- Company A cannot see or modify Company B through the SECURITY DEFINER RPC.
select throws_ok(
  $$select public.update_owner_agreement_atomic('00000000-0000-0000-0000-00000000b301', '{"commission_value": 99}'::jsonb)$$,
  '42501', 'AGREEMENT_NOT_FOUND_OR_FORBIDDEN',
  'Company A cannot update Company B agreement'
);
-- Inspect B as the database test owner, not as A (RLS correctly hides B from A).
reset role;
select is((select commission_value from public.owner_agreements where id = '00000000-0000-0000-0000-00000000b301'), 7::numeric, 'Company B agreement is unchanged');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-0000000000a1"}}', true);
select throws_ok(
  $$select public.update_owner_agreement_atomic('00000000-0000-0000-0000-00000000dead', '{"commission_value": 99}'::jsonb)$$,
  '42501', 'AGREEMENT_NOT_FOUND_OR_FORBIDDEN',
  'unknown UUID has the same SQLSTATE and message as cross-company UUID'
);

-- Relationship transfer attempts are rejected without changing the row.
select throws_ok(
  $$select public.update_owner_agreement_atomic('00000000-0000-0000-0000-00000000a301', '{"owner_id":"00000000-0000-0000-0000-00000000b101"}'::jsonb)$$,
  '42501', 'AGREEMENT_RELATIONSHIP_IMMUTABLE', 'owner_id cannot be changed'
);
select throws_ok(
  $$select public.update_owner_agreement_atomic('00000000-0000-0000-0000-00000000a301', '{"property_id":"00000000-0000-0000-0000-00000000b201"}'::jsonb)$$,
  '42501', 'AGREEMENT_RELATIONSHIP_IMMUTABLE', 'property_id cannot be changed'
);
select is((select owner_id from public.owner_agreements where id = '00000000-0000-0000-0000-00000000a301'), '00000000-0000-0000-0000-00000000a101'::uuid, 'owner relationship remains unchanged');
select is((select property_id from public.owner_agreements where id = '00000000-0000-0000-0000-00000000a301'), '00000000-0000-0000-0000-00000000a201'::uuid, 'property relationship remains unchanged');

-- Explicit null and empty commission values are rejected before numeric cast.
select throws_ok(
  $$select public.update_owner_agreement_atomic('00000000-0000-0000-0000-00000000a301', '{"commission_value":null}'::jsonb)$$,
  '22023', 'قيمة العمولة مطلوبة عند إرسال commission_value', 'null commission_value is rejected'
);
select throws_ok(
  $$select public.update_owner_agreement_atomic('00000000-0000-0000-0000-00000000a301', '{"commission_value":""}'::jsonb)$$,
  '22023', 'قيمة العمولة مطلوبة عند إرسال commission_value', 'empty commission_value is rejected'
);

-- Company B is independently authorized for its own agreement and cannot touch A.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b001","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-0000000000b1"}}', true);
select lives_ok(
  $$select public.update_owner_agreement_atomic('00000000-0000-0000-0000-00000000b301', '{"commission_value": 9}'::jsonb)$$,
  'Company B can update Company B agreement'
);
select throws_ok(
  $$select public.update_owner_agreement_atomic('00000000-0000-0000-0000-00000000a301', '{"commission_value": 99}'::jsonb)$$,
  '42501', 'AGREEMENT_NOT_FOUND_OR_FORBIDDEN', 'Company B cannot update Company A agreement'
);
reset role;
select * from finish();
rollback;

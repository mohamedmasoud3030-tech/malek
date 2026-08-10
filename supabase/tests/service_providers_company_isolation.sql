-- Service Providers company isolation, permissions, and Maintenance assignment.
-- Runs only on the disposable full-migration replay used by the database gate.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select has_table('public', 'service_providers', 'canonical service_providers table exists');
select has_table('public', 'service_provider_categories', 'maintainable category table exists');
select has_table('public', 'service_provider_category_links', 'normalized provider/category link table exists');
select col_type_is('public', 'maintenance_records', 'service_provider_id', 'uuid', 'Maintenance provider FK uses provider UUID type');
select col_type_is('public', 'maintenance_records', 'service_provider_category_id', 'uuid', 'Maintenance category FK uses category UUID type');
select ok(has_table_privilege('authenticated', 'public.service_providers', 'SELECT'), 'authenticated has provider SELECT grant (RLS remains authoritative)');
select ok(not has_table_privilege('anon', 'public.service_providers', 'SELECT'), 'anon has no provider SELECT grant');
select ok(public.role_has_app_permission('MANAGER', 'service_providers.view'), 'MANAGER receives canonical provider view permission');
select ok(public.role_has_app_permission('MANAGER', 'service_providers.write'), 'MANAGER receives canonical provider write permission');

insert into public.companies(id, name, slug, currency, locale)
values
  ('71000000-0000-4000-8000-00000000000a', 'Provider Company A', 'provider-company-a', 'OMR', 'ar-OM'),
  ('71000000-0000-4000-8000-00000000000b', 'Provider Company B', 'provider-company-b', 'OMR', 'ar-OM')
on conflict (id) do nothing;

insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  '71000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'provider-manager@readiness.invalid', 'not-used',
  now(), now(), now(), '{}'::jsonb, '{}'::jsonb
) on conflict (id) do nothing;

insert into public.users(id, email, name, role, status, is_active)
values ('71000000-0000-4000-8000-000000000001', 'provider-manager@readiness.invalid', 'Provider Manager', 'MANAGER', 'ACTIVE', true)
on conflict (id) do update set role='MANAGER', status='ACTIVE', is_active=true;

insert into public.company_members(id, company_id, user_id, role, is_active)
values
  ('71000000-0000-4000-8000-0000000000a1', '71000000-0000-4000-8000-00000000000a', '71000000-0000-4000-8000-000000000001', 'MEMBER', true),
  ('71000000-0000-4000-8000-0000000000b1', '71000000-0000-4000-8000-00000000000b', '71000000-0000-4000-8000-000000000001', 'MEMBER', true)
on conflict (company_id, user_id) do update set role='MEMBER', is_active=true;

insert into public.service_providers(id, company_id, name)
values
  ('71000000-0000-4000-8000-00000000001a', '71000000-0000-4000-8000-00000000000a', 'Provider A'),
  ('71000000-0000-4000-8000-00000000001b', '71000000-0000-4000-8000-00000000000b', 'Provider B');
insert into public.service_provider_categories(id, company_id, name)
values
  ('71000000-0000-4000-8000-00000000002a', '71000000-0000-4000-8000-00000000000a', 'Category A'),
  ('71000000-0000-4000-8000-00000000003a', '71000000-0000-4000-8000-00000000000a', 'Other Category A'),
  ('71000000-0000-4000-8000-00000000002b', '71000000-0000-4000-8000-00000000000b', 'Category B');
insert into public.service_provider_category_links(id, company_id, service_provider_id, category_id)
values
  ('71000000-0000-4000-8000-00000000004a', '71000000-0000-4000-8000-00000000000a', '71000000-0000-4000-8000-00000000001a', '71000000-0000-4000-8000-00000000002a'),
  ('71000000-0000-4000-8000-00000000004b', '71000000-0000-4000-8000-00000000000b', '71000000-0000-4000-8000-00000000001b', '71000000-0000-4000-8000-00000000002b');

insert into public.properties(id, company_id, title, type, address, status)
values ('71000000-0000-4000-8000-00000000005a', '71000000-0000-4000-8000-00000000000a', 'Property A', 'residential', 'A', 'active')
on conflict (id) do nothing;
insert into public.maintenance_records(id, company_id, property_id, title, priority, status)
values ('71000000-0000-4000-8000-00000000006a', '71000000-0000-4000-8000-00000000000a', '71000000-0000-4000-8000-00000000005a', 'Maintenance A', 'medium', 'open');

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"user_role":"MANAGER","company_id":"71000000-0000-4000-8000-00000000000a"}}',
  true
);
set local role authenticated;
select is((select count(*)::int from public.service_providers), 1, 'Company A sees only its provider');
select is((select name from public.service_providers), 'Provider A', 'Company A reads its provider');
select throws_ok(
  $$insert into public.service_providers(company_id,name) values('71000000-0000-4000-8000-00000000000b','Cross-company write')$$,
  '42501', null,
  'Company A cannot insert a Company B provider'
);
reset role;

select throws_ok(
  $$update public.maintenance_records set service_provider_id='71000000-0000-4000-8000-00000000001b' where id='71000000-0000-4000-8000-00000000006a'$$,
  '23503', null,
  'Maintenance cannot reference a provider from another company'
);
select throws_ok(
  $$update public.maintenance_records set service_provider_id='71000000-0000-4000-8000-00000000001a', service_provider_category_id='71000000-0000-4000-8000-00000000003a' where id='71000000-0000-4000-8000-00000000006a'$$,
  '23514', null,
  'Maintenance rejects a provider that does not support the selected category'
);
select lives_ok(
  $$update public.maintenance_records set service_provider_id='71000000-0000-4000-8000-00000000001a', service_provider_category_id='71000000-0000-4000-8000-00000000002a' where id='71000000-0000-4000-8000-00000000006a'$$,
  'Maintenance accepts a same-company provider supporting the selected category'
);

select * from finish();
rollback;

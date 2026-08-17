-- S04-T01 behavioral proof: explicit collection role, canonical commission
-- recognition, non-retroactive versioning, company isolation and read-only
-- browser access to version history.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into public.companies (id,name,slug) values
 ('00000000-0000-4000-8000-0000000004a1','S04 Company A','s04-a'),
 ('00000000-0000-4000-8000-0000000004b1','S04 Company B','s04-b')
on conflict (id) do nothing;

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000004a01','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s04-a@test.invalid','x',now(),now(),now(),'{}','{}'),
 ('00000000-0000-0000-0000-000000004b01','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s04-b@test.invalid','x',now(),now(),now(),'{}','{}')
on conflict (id) do nothing;

insert into public.users (id,email,name,role,status,is_active) values
 ('00000000-0000-0000-0000-000000004a01','s04-a@test.invalid','S04 A','ADMIN','ACTIVE',true),
 ('00000000-0000-0000-0000-000000004b01','s04-b@test.invalid','S04 B','ADMIN','ACTIVE',true)
on conflict (id) do update set role='ADMIN',status='ACTIVE',is_active=true;

insert into public.company_members (company_id,user_id,role) values
 ('00000000-0000-4000-8000-0000000004a1','00000000-0000-0000-0000-000000004a01','ADMIN'),
 ('00000000-0000-4000-8000-0000000004b1','00000000-0000-0000-0000-000000004b01','ADMIN')
on conflict (company_id,user_id) do update set role='ADMIN';

insert into public.owners (id,full_name,company_id) values
 ('00000000-0000-0000-0000-000000004a11','S04 Owner A','00000000-0000-4000-8000-0000000004a1'),
 ('00000000-0000-0000-0000-000000004b11','S04 Owner B','00000000-0000-4000-8000-0000000004b1');

insert into public.properties (id,title,type,address,status,company_id) values
 ('00000000-0000-0000-0000-000000004a21','S04 Property A','residential','A','active','00000000-0000-4000-8000-0000000004a1'),
 ('00000000-0000-0000-0000-000000004b21','S04 Property B','residential','B','active','00000000-0000-4000-8000-0000000004b1');

insert into public.property_owners (id,property_id,owner_id,ownership_percentage,is_primary,starts_on,ends_on,company_id) values
 ('00000000-0000-0000-0000-000000004a25','00000000-0000-0000-0000-000000004a21','00000000-0000-0000-0000-000000004a11',100,true,'2025-01-01',null,'00000000-0000-4000-8000-0000000004a1'),
 ('00000000-0000-0000-0000-000000004b25','00000000-0000-0000-0000-000000004b21','00000000-0000-0000-0000-000000004b11',100,true,'2025-01-01',null,'00000000-0000-4000-8000-0000000004b1');

insert into public.owner_agreements (id,owner_id,property_id,agreement_type,commission_type,commission_value,starts_on,ends_on,company_id) values
 ('00000000-0000-0000-0000-000000004a31','00000000-0000-0000-0000-000000004a11','00000000-0000-0000-0000-000000004a21','property_management','RATE',5,'2026-01-01','2027-12-31','00000000-0000-4000-8000-0000000004a1'),
 ('00000000-0000-0000-0000-000000004b31','00000000-0000-0000-0000-000000004b11','00000000-0000-0000-0000-000000004b21','property_management','RATE',7,'2026-01-01','2027-12-31','00000000-0000-4000-8000-0000000004b1');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000004a01","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-0000000004a1"}}',true);
set local role authenticated;

select lives_ok(
 $$select public.create_future_owner_agreement_version_atomic('00000000-0000-0000-0000-000000004a31','{"effective_from":"2026-08-08"}'::jsonb)$$,
 'first explicit version can be created'
);
select is((select version_no from public.owner_agreement_versions where owner_agreement_id='00000000-0000-0000-0000-000000004a31'::uuid and superseded_at is null),1,'first version number is 1');
select is((select operating_model from public.owner_agreement_versions where owner_agreement_id='00000000-0000-0000-0000-000000004a31'::uuid and superseded_at is null),'OWNER_AGENCY','owner-agency model is explicit');
select is((select collection_role from public.owner_agreement_versions where owner_agreement_id='00000000-0000-0000-0000-000000004a31'::uuid and superseded_at is null),'OWNER_IS_CREDITOR','default collection role is explicit');
select is((select commission_recognition_basis from public.owner_agreement_versions where owner_agreement_id='00000000-0000-0000-0000-000000004a31'::uuid and superseded_at is null),'ON_COLLECTION','RATE derives ON_COLLECTION');

select lives_ok(
 $$select public.create_future_owner_agreement_version_atomic('00000000-0000-0000-0000-000000004a31', jsonb_build_object('effective_from',(current_date + 30)::text,'collection_role','OFFICE_IS_CREDITOR','commission_type','FIXED_MONTHLY','commission_value',30,'offset_allowed',true,'reserve_amount',100))$$,
 'second future version can be created'
);
select is((select count(*)::int from public.owner_agreement_versions where owner_agreement_id='00000000-0000-0000-0000-000000004a31'::uuid),2,'history contains two versions');
select is((select commission_recognition_basis from public.owner_agreement_versions where owner_agreement_id='00000000-0000-0000-0000-000000004a31'::uuid and superseded_at is null),'DAILY_ACCRUAL','FIXED_MONTHLY derives DAILY_ACCRUAL');
select ok((select offset_allowed and reserve_amount=100 from public.owner_agreement_versions where owner_agreement_id='00000000-0000-0000-0000-000000004a31'::uuid and superseded_at is null),'offset right and reserve are versioned terms');

select throws_ok(
 $$select public.create_future_owner_agreement_version_atomic('00000000-0000-0000-0000-000000004a31', jsonb_build_object('effective_from',(current_date - 1)::text))$$,
 '22023','OWNER_AGREEMENT_VERSION_MUST_BE_FUTURE','retroactive replacement is rejected'
);
select throws_ok(
 $$select public.create_future_owner_agreement_version_atomic('00000000-0000-0000-0000-000000004b31', jsonb_build_object('effective_from',(current_date + 30)::text))$$,
 '42501','OWNER_AGREEMENT_NOT_FOUND_OR_NOT_AGENCY','cross-company versioning is denied'
);
select throws_ok(
 $$insert into public.owner_agreement_versions(owner_agreement_id,company_id,version_no,operating_model,collection_role,commission_type,commission_value,commission_recognition_basis,effective_from) values ('00000000-0000-0000-0000-000000004a31','00000000-0000-4000-8000-0000000004a1',99,'OWNER_AGENCY','OWNER_IS_CREDITOR','RATE',5,'ON_COLLECTION','2027-01-01')$$,
 '42501',null,'authenticated browser cannot write version rows directly'
);

reset role;
select * from finish();
rollback;

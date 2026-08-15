-- WP-03 / GAP-004 — contract activation authority hardening.
-- Proves: create_contract_atomic is draft-only; update_contract_atomic cannot
-- set 'active' directly; signed (active) and APPROVED commercial terms are
-- immutable through update; non-commercial edits remain allowed; fresh drafts
-- remain editable.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

insert into public.companies (id,name,slug) values
 ('00000000-0000-4000-8000-0000000004d1','GAP004 Co','gap004')
on conflict (id) do nothing;
insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000004d01','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gap004-maker@test.invalid','x',now(),now(),now(),'{}','{}'),
 ('00000000-0000-0000-0000-000000004d02','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gap004-checker@test.invalid','x',now(),now(),now(),'{}','{}')
on conflict (id) do nothing;
insert into public.users (id,email,name,role,status,is_active) values
 ('00000000-0000-0000-0000-000000004d01','gap004-maker@test.invalid','GAP004 Maker','ADMIN','ACTIVE',true),
 ('00000000-0000-0000-0000-000000004d02','gap004-checker@test.invalid','GAP004 Checker','MANAGER','ACTIVE',true)
on conflict (id) do update set role=excluded.role,status='ACTIVE',is_active=true;
insert into public.company_members (company_id,user_id,role) values
 ('00000000-0000-4000-8000-0000000004d1','00000000-0000-0000-0000-000000004d01','ADMIN'),
 ('00000000-0000-4000-8000-0000000004d1','00000000-0000-0000-0000-000000004d02','ADMIN')
on conflict (company_id,user_id) do update set role=excluded.role;

insert into public.owners (id,full_name,company_id) values
 ('00000000-0000-0000-0000-000000004d11','GAP004 Owner','00000000-0000-4000-8000-0000000004d1');
insert into public.properties (id,title,type,address,status,company_id) values
 ('00000000-0000-0000-0000-000000004d21','GAP004 Property','residential','C','active','00000000-0000-4000-8000-0000000004d1');
insert into public.units (id,name,property_id,unit_number,status,company_id) values
 ('00000000-0000-0000-0000-000000004d22','Unit 1','00000000-0000-0000-0000-000000004d21','D-1','available','00000000-0000-4000-8000-0000000004d1'),
 ('00000000-0000-0000-0000-000000004d23','Unit 2','00000000-0000-0000-0000-000000004d21','D-2','available','00000000-0000-4000-8000-0000000004d1'),
 ('00000000-0000-0000-0000-000000004d24','Unit 3','00000000-0000-0000-0000-000000004d21','D-3','available','00000000-0000-4000-8000-0000000004d1');
insert into public.people (id,full_name,type,company_id) values
 ('00000000-0000-0000-0000-000000004d31','Tenant 1','tenant','00000000-0000-4000-8000-0000000004d1'),
 ('00000000-0000-0000-0000-000000004d32','Tenant 2','tenant','00000000-0000-4000-8000-0000000004d1'),
 ('00000000-0000-0000-0000-000000004d33','Tenant 3','tenant','00000000-0000-4000-8000-0000000004d1');
insert into public.property_owners (id,property_id,owner_id,ownership_percentage,is_primary,starts_on,ends_on,company_id) values
 ('00000000-0000-0000-0000-000000004d25','00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d11',100,true,'2025-01-01',null,'00000000-0000-4000-8000-0000000004d1');
insert into public.owner_agreements (id,owner_id,property_id,agreement_type,commission_type,commission_value,starts_on,ends_on,company_id) values
 ('00000000-0000-0000-0000-000000004d41','00000000-0000-0000-0000-000000004d11','00000000-0000-0000-0000-000000004d21','property_management','RATE',5,'2026-01-01','2027-12-31','00000000-0000-4000-8000-0000000004d1');
insert into public.owner_agreement_versions (id,owner_agreement_id,company_id,version_no,operating_model,collection_role,commission_type,commission_value,commission_recognition_basis,effective_from,effective_to)
values ('00000000-0000-0000-0000-000000004d42','00000000-0000-0000-0000-000000004d41','00000000-0000-4000-8000-0000000004d1',1,'OWNER_AGENCY','OWNER_IS_CREDITOR','RATE',5,'ON_COLLECTION','2026-01-01','2027-12-31');
update public.owner_agreements set current_version_id='00000000-0000-0000-0000-000000004d42' where id='00000000-0000-0000-0000-000000004d41';

-- Admin/maker context.
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000004d01","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-0000000004d1"}}',true);
set local role authenticated;

-- 1. A new contract cannot be born 'active'.
select throws_ok(
  $$select public.create_contract_atomic(
    '00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d22',
    '00000000-0000-0000-0000-000000004d31','00000000-0000-0000-0000-000000004d41',
    date '2026-10-01', date '2027-09-30', 1000, 'monthly', null,
    'active', null, 'gap004-c1', null)$$,
  '23514', 'CONTRACT_CREATE_MUST_BE_DRAFT',
  '1. create_contract_atomic rejects a non-draft status'
);

-- 2. Draft creation succeeds.
select lives_ok(
  $$select public.create_contract_atomic(
    '00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d22',
    '00000000-0000-0000-0000-000000004d31','00000000-0000-0000-0000-000000004d41',
    date '2026-10-01', date '2027-09-30', 1000, 'monthly', null,
    'draft', null, 'gap004-c1', null)$$,
  '2. create_contract_atomic accepts draft'
);
-- Capture the created contract id via the notes marker.
select is(
  (select count(*)::int from public.contracts where notes='gap004-c1' and lower(status)='draft'),
  1,
  '3. created contract is a draft'
);

-- 3. Full maker-checker approval then activation on contract 1.
select lives_ok(
  $$select public.submit_contract_for_approval_atomic(
    (select id::text from public.contracts where notes='gap004-c1' limit 1), 'maker-sig')$$,
  '4. maker submits contract 1'
);
reset role;

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000004d02","role":"authenticated","app_metadata":{"user_role":"MANAGER","company_id":"00000000-0000-4000-8000-0000000004d1"}}',true);
set local role authenticated;
select lives_ok(
  $$select public.approve_contract_atomic(
    (select id::text from public.contracts where notes='gap004-c1' limit 1), 'checker-sig')$$,
  '5. distinct checker approves contract 1'
);
select lives_ok(
  $$select public.activate_contract_with_agreement_snapshot_atomic(
    (select id::text from public.contracts where notes='gap004-c1' limit 1))$$,
  '6. activation freezes the agreement snapshot'
);
select is(
  (select lower(status) from public.contracts where notes='gap004-c1'),
  'active',
  '7. contract 1 is active'
);

-- 4. Signed (active) terms are immutable through update_contract_atomic.
select throws_ok(
  $$select public.update_contract_atomic(
    (select id::text from public.contracts where notes='gap004-c1' limit 1),
    '00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d22',
    '00000000-0000-0000-0000-000000004d31','00000000-0000-0000-0000-000000004d41',
    date '2026-10-01', date '2027-09-30', 1500, 'monthly', null,
    'active', null, 'gap004-c1', null)$$,
  '23514', 'CONTRACT_SIGNED_TERMS_IMMUTABLE',
  '8. commercial edit on an active contract is rejected'
);
select lives_ok(
  $$select public.update_contract_atomic(
    (select id::text from public.contracts where notes='gap004-c1' limit 1),
    '00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d22',
    '00000000-0000-0000-0000-000000004d31','00000000-0000-0000-0000-000000004d41',
    date '2026-10-01', date '2027-09-30', 1000, 'monthly', null,
    'active', null, 'gap004-c1-notes', null)$$,
  '9. non-commercial edit on an active contract is allowed'
);
select throws_ok(
  $$select public.update_contract_atomic(
    (select id::text from public.contracts where notes='gap004-c1-notes' limit 1),
    '00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d22',
    '00000000-0000-0000-0000-000000004d31','00000000-0000-0000-0000-000000004d41',
    date '2026-10-01', date '2027-09-30', 1000, 'monthly', null,
    'draft', null, 'gap004-c1-notes', null)$$,
  '23514', 'CONTRACT_ACTIVE_STATUS_IMMUTABLE',
  '10. active status cannot be changed through update'
);

-- 5. APPROVED (not yet activated) draft terms are also frozen.
select lives_ok(
  $$select public.create_contract_atomic(
    '00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d23',
    '00000000-0000-0000-0000-000000004d32','00000000-0000-0000-0000-000000004d41',
    date '2026-10-01', date '2027-09-30', 800, 'monthly', null,
    'draft', null, 'gap004-c2', null)$$,
  '11. contract 2 created as draft'
);
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000004d01","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-0000000004d1"}}',true);
set local role authenticated;
select public.submit_contract_for_approval_atomic(
  (select id::text from public.contracts where notes='gap004-c2' limit 1), 'maker-sig-2');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000004d02","role":"authenticated","app_metadata":{"user_role":"MANAGER","company_id":"00000000-0000-4000-8000-0000000004d1"}}',true);
set local role authenticated;
select public.approve_contract_atomic(
  (select id::text from public.contracts where notes='gap004-c2' limit 1), 'checker-sig-2');
select throws_ok(
  $$select public.update_contract_atomic(
    (select id::text from public.contracts where notes='gap004-c2' limit 1),
    '00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d23',
    '00000000-0000-0000-0000-000000004d32','00000000-0000-0000-0000-000000004d41',
    date '2026-10-01', date '2027-09-30', 900, 'monthly', null,
    'draft', null, 'gap004-c2', null)$$,
  '23514', 'CONTRACT_APPROVED_TERMS_IMMUTABLE',
  '12. commercial edit on an APPROVED draft is rejected'
);

-- 6. A fresh, unapproved draft stays editable; direct activation is rejected.
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000004d01","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-0000000004d1"}}',true);
set local role authenticated;
select lives_ok(
  $$select public.create_contract_atomic(
    '00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d24',
    '00000000-0000-0000-0000-000000004d33','00000000-0000-0000-0000-000000004d41',
    date '2026-10-01', date '2027-09-30', 700, 'monthly', null,
    'draft', null, 'gap004-c3', null)$$,
  '13. contract 3 created as draft'
);
select lives_ok(
  $$select public.update_contract_atomic(
    (select id::text from public.contracts where notes='gap004-c3' limit 1),
    '00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d24',
    '00000000-0000-0000-0000-000000004d33','00000000-0000-0000-0000-000000004d41',
    date '2026-10-01', date '2027-09-30', 750, 'monthly', null,
    'draft', null, 'gap004-c3', null)$$,
  '14. commercial edit on a fresh draft is allowed'
);
select throws_ok(
  $$select public.update_contract_atomic(
    (select id::text from public.contracts where notes='gap004-c3' limit 1),
    '00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d24',
    '00000000-0000-0000-0000-000000004d33','00000000-0000-0000-0000-000000004d41',
    date '2026-10-01', date '2027-09-30', 750, 'monthly', null,
    'active', null, 'gap004-c3', null)$$,
  '23514', 'CONTRACT_ACTIVATION_VIA_RPC',
  '15. update cannot set a contract active'
);
select is(
  (select lower(status) from public.contracts where notes='gap004-c3'),
  'draft',
  '16. rejected direct activation leaves the contract draft'
);

reset role;
select * from finish();
rollback;

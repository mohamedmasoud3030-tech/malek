-- S04-T02: activation snapshots the covering agreement version and collection
-- role; later agreement versions do not mutate historical contract snapshots.
-- S04-T03 compatibility: contracts now pass maker-checker approval before activation.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into public.companies (id,name,slug) values
 ('00000000-0000-4000-8000-0000000004c1','S04 Snapshot Co','s04-snapshot')
on conflict (id) do nothing;
insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000004c01','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s04-c@test.invalid','x',now(),now(),now(),'{}','{}'),
 ('00000000-0000-0000-0000-000000004c02','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s04-checker@test.invalid','x',now(),now(),now(),'{}','{}')
on conflict (id) do nothing;
insert into public.users (id,email,name,role,status,is_active) values
 ('00000000-0000-0000-0000-000000004c01','s04-c@test.invalid','S04 C','ADMIN','ACTIVE',true),
 ('00000000-0000-0000-0000-000000004c02','s04-checker@test.invalid','S04 Checker','MANAGER','ACTIVE',true)
on conflict (id) do update set role=excluded.role,status='ACTIVE',is_active=true;
insert into public.company_members (company_id,user_id,role) values
 ('00000000-0000-4000-8000-0000000004c1','00000000-0000-0000-0000-000000004c01','ADMIN'),
 ('00000000-0000-4000-8000-0000000004c1','00000000-0000-0000-0000-000000004c02','ADMIN')
on conflict (company_id,user_id) do update set role=excluded.role;

insert into public.owners (id,full_name,company_id) values
 ('00000000-0000-0000-0000-000000004c11','Snapshot Owner','00000000-0000-4000-8000-0000000004c1');
insert into public.properties (id,title,type,address,status,company_id) values
 ('00000000-0000-0000-0000-000000004c21','Snapshot Property','residential','C','active','00000000-0000-4000-8000-0000000004c1');
insert into public.units (id,name,property_id,unit_number,status,company_id) values
 ('00000000-0000-0000-0000-000000004c22','Unit C','00000000-0000-0000-0000-000000004c21','C-1','available','00000000-0000-4000-8000-0000000004c1');
insert into public.people (id,full_name,type,company_id) values
 ('00000000-0000-0000-0000-000000004c23','Tenant C','tenant','00000000-0000-4000-8000-0000000004c1');
insert into public.property_owners (id,property_id,owner_id,ownership_percentage,is_primary,starts_on,ends_on,company_id) values
 ('00000000-0000-0000-0000-000000004c25','00000000-0000-0000-0000-000000004c21','00000000-0000-0000-0000-000000004c11',100,true,'2025-01-01',null,'00000000-0000-4000-8000-0000000004c1');
insert into public.owner_agreements (id,owner_id,property_id,agreement_type,commission_type,commission_value,starts_on,ends_on,company_id) values
 ('00000000-0000-0000-0000-000000004c31','00000000-0000-0000-0000-000000004c11','00000000-0000-0000-0000-000000004c21','property_management','RATE',5,'2026-01-01','2027-12-31','00000000-0000-4000-8000-0000000004c1');
insert into public.owner_agreement_versions (id,owner_agreement_id,company_id,version_no,operating_model,collection_role,commission_type,commission_value,commission_recognition_basis,effective_from,effective_to)
values ('00000000-0000-0000-0000-000000004c41','00000000-0000-0000-0000-000000004c31','00000000-0000-4000-8000-0000000004c1',1,'OWNER_AGENCY','OWNER_IS_CREDITOR','RATE',5,'ON_COLLECTION','2026-01-01','2027-12-31');
update public.owner_agreements set current_version_id='00000000-0000-0000-0000-000000004c41' where id='00000000-0000-0000-0000-000000004c31';
insert into public.contracts (id,property_id,unit_id,tenant_id,start_date,end_date,rent_amount,payment_cycle,status,agreement_id,company_id)
values ('00000000-0000-0000-0000-000000004c51','00000000-0000-0000-0000-000000004c21','00000000-0000-0000-0000-000000004c22','00000000-0000-0000-0000-000000004c23','2026-10-01','2027-09-30',1000,'monthly','draft','00000000-0000-0000-0000-000000004c31','00000000-0000-4000-8000-0000000004c1');

-- Maker submits the first contract.
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000004c01","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-0000000004c1"}}',true);
set local role authenticated;
select public.submit_contract_for_approval_atomic('00000000-0000-0000-0000-000000004c51','maker-signature');
reset role;

-- Distinct checker approves it, then activation may exercise the S04-T02 snapshot boundary.
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000004c02","role":"authenticated","app_metadata":{"user_role":"MANAGER","company_id":"00000000-0000-4000-8000-0000000004c1"}}',true);
set local role authenticated;
select public.approve_contract_atomic('00000000-0000-0000-0000-000000004c51','checker-signature');
select lives_ok($$select public.activate_contract_with_agreement_snapshot_atomic('00000000-0000-0000-0000-000000004c51')$$,'activation RPC succeeds');
select is((select lower(status) from public.contracts where id::text='00000000-0000-0000-0000-000000004c51'),'active','contract becomes active');
select is((select agreement_version_id from public.contracts where id::text='00000000-0000-0000-0000-000000004c51'),'00000000-0000-0000-0000-000000004c41'::uuid,'governing agreement version is snapshotted');
select is((select collection_role_snapshot from public.contracts where id::text='00000000-0000-0000-0000-000000004c51'),'OWNER_IS_CREDITOR','collection role is snapshotted');
select is((select operating_model_snapshot from public.contracts where id::text='00000000-0000-0000-0000-000000004c51'),'OWNER_AGENCY','operating model is snapshotted');

reset role;
update public.owner_agreement_versions set superseded_at=now(),effective_to='2027-09-30' where id='00000000-0000-0000-0000-000000004c41';
insert into public.owner_agreement_versions (id,owner_agreement_id,company_id,version_no,operating_model,collection_role,commission_type,commission_value,commission_recognition_basis,effective_from,effective_to)
values ('00000000-0000-0000-0000-000000004c42','00000000-0000-0000-0000-000000004c31','00000000-0000-4000-8000-0000000004c1',2,'OWNER_AGENCY','OFFICE_IS_CREDITOR','RATE',6,'ON_COLLECTION','2027-10-15','2027-12-31');
update public.owner_agreements set current_version_id='00000000-0000-0000-0000-000000004c42' where id='00000000-0000-0000-0000-000000004c31';
select is((select collection_role_snapshot from public.contracts where id::text='00000000-0000-0000-0000-000000004c51'),'OWNER_IS_CREDITOR','later agreement version does not change historical contract snapshot');

select throws_ok($$update public.contracts set collection_role_snapshot='OFFICE_IS_CREDITOR' where id::text='00000000-0000-0000-0000-000000004c51'$$,'55000','CONTRACT_AGREEMENT_SNAPSHOT_IMMUTABLE','snapshot cannot be rewritten');

insert into public.contracts (id,property_id,unit_id,tenant_id,start_date,end_date,rent_amount,payment_cycle,status,agreement_id,company_id)
values ('00000000-0000-0000-0000-000000004c52','00000000-0000-0000-0000-000000004c21','00000000-0000-0000-0000-000000004c22','00000000-0000-0000-0000-000000004c23','2027-10-01','2027-10-10',1000,'monthly','draft','00000000-0000-0000-0000-000000004c31','00000000-0000-4000-8000-0000000004c1');

-- Make the second contract fully approved first so the expected failure reaches
-- the agreement-version coverage gate rather than stopping at S04-T03 approval.
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000004c01","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-0000000004c1"}}',true);
set local role authenticated;
select public.submit_contract_for_approval_atomic('00000000-0000-0000-0000-000000004c52','maker-signature-2');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000004c02","role":"authenticated","app_metadata":{"user_role":"MANAGER","company_id":"00000000-0000-4000-8000-0000000004c1"}}',true);
set local role authenticated;
select public.approve_contract_atomic('00000000-0000-0000-0000-000000004c52','checker-signature-2');
select throws_ok($$select public.activate_contract_with_agreement_snapshot_atomic('00000000-0000-0000-0000-000000004c52')$$,'23514','CONTRACT_AGREEMENT_VERSION_COVERAGE_REQUIRED','activation requires one version covering the full contract term');
select is((select lower(status) from public.contracts where id::text='00000000-0000-0000-0000-000000004c52'),'draft','failed activation preserves canonical draft status while approval remains recorded');
reset role;
select * from finish();
rollback;

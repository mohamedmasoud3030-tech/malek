-- WP-03 / GAP-004 (part 2) — renewal & termination authority + cross-company isolation.
-- Canonical rules: OPS-006, OPS-007, DOM-005, SEC-003.
-- Proves:
--   * renew_contract_atomic creates a DRAFT (never ACTIVE) and links it via
--     renewed_from_id, leaving the source contract untouched;
--   * a renewed contract cannot be activated without the maker-checker
--     approval; the full submit -> approve -> activate chain then freezes the
--     agreement snapshot;
--   * generic update_contract_atomic preserves lifecycle status (draft ->
--     terminated/expired/active all fail closed; draft -> draft allowed);
--   * SECURITY DEFINER company isolation: create / update / renew / terminate
--     cannot reference or mutate another company's records.
begin;
create extension if not exists pgtap with schema extensions;

-- Company A fixtures (mirrors wp03_gap004_contract_activation_authority.sql).
insert into public.companies (id,name,slug) values
 ('00000000-0000-4000-8000-0000000004d1','GAP004A','gap004a'),
 ('00000000-0000-4000-8000-0000000005d1','GAP004B','gap004b')
on conflict (id) do nothing;
insert into auth.users (id, email, raw_app_meta_data) values
 ('00000000-0000-0000-0000-000000004d01','gap004a-maker@test.invalid','{}'),
 ('00000000-0000-0000-0000-000000004d02','gap004a-checker@test.invalid','{}'),
 ('00000000-0000-0000-0000-000000005d01','gap004b-admin@test.invalid','{}')
on conflict (id) do nothing;
insert into public.users (id,email,name,role,status,is_active) values
 ('00000000-0000-0000-0000-000000004d01','gap004a-maker@test.invalid','A Maker','ADMIN','ACTIVE',true),
 ('00000000-0000-0000-0000-000000004d02','gap004a-checker@test.invalid','A Checker','MANAGER','ACTIVE',true),
 ('00000000-0000-0000-0000-000000005d01','gap004b-admin@test.invalid','B Admin','ADMIN','ACTIVE',true)
on conflict (id) do update set role=excluded.role,status='ACTIVE',is_active=true;
insert into public.company_members (company_id,user_id,role) values
 ('00000000-0000-4000-8000-0000000004d1','00000000-0000-0000-0000-000000004d01','ADMIN'),
 ('00000000-0000-4000-8000-0000000004d1','00000000-0000-0000-0000-000000004d02','ADMIN'),
 ('00000000-0000-4000-8000-0000000005d1','00000000-0000-0000-0000-000000005d01','ADMIN')
on conflict (company_id,user_id) do update set role=excluded.role;

-- Company A operational fixtures.
insert into public.owners (id,full_name,company_id) values ('00000000-0000-0000-0000-000000004d11','Owner A','00000000-0000-4000-8000-0000000004d1');
insert into public.properties (id,title,type,address,status,company_id) values ('00000000-0000-0000-0000-000000004d21','Property A','residential','C','active','00000000-0000-4000-8000-0000000004d1');
insert into public.units (id,name,property_id,unit_number,status,company_id) values
 ('00000000-0000-0000-0000-000000004d22','U1','00000000-0000-0000-0000-000000004d21','D-1','available','00000000-0000-4000-8000-0000000004d1'),
 ('00000000-0000-0000-0000-000000004d23','U2','00000000-0000-0000-0000-000000004d21','D-2','available','00000000-0000-4000-8000-0000000004d1');
insert into public.people (id,full_name,type,company_id) values
 ('00000000-0000-0000-0000-000000004d31','Tenant A1','tenant','00000000-0000-4000-8000-0000000004d1'),
 ('00000000-0000-0000-0000-000000004d32','Tenant A2','tenant','00000000-0000-4000-8000-0000000004d1');
insert into public.property_owners (id,property_id,owner_id,ownership_percentage,is_primary,starts_on,ends_on,company_id) values
 ('00000000-0000-0000-0000-000000004d25','00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d11',100,true,'2025-01-01',null,'00000000-0000-4000-8000-0000000004d1');
insert into public.owner_agreements (id,owner_id,property_id,agreement_type,commission_type,commission_value,starts_on,ends_on,company_id) values
 ('00000000-0000-0000-0000-000000004d41','00000000-0000-0000-0000-000000004d11','00000000-0000-0000-0000-000000004d21','property_management','RATE',5,'2026-01-01','2028-12-31','00000000-0000-4000-8000-0000000004d1');
insert into public.owner_agreement_versions (id,owner_agreement_id,company_id,version_no,operating_model,collection_role,commission_type,commission_value,commission_recognition_basis,effective_from,effective_to)
values ('00000000-0000-0000-0000-000000004d42','00000000-0000-0000-0000-000000004d41','00000000-0000-4000-8000-0000000004d1',1,'OWNER_AGENCY','OWNER_IS_CREDITOR','RATE',5,'ON_COLLECTION','2026-01-01','2028-12-31');
update public.owner_agreements set current_version_id='00000000-0000-0000-0000-000000004d42' where id='00000000-0000-0000-0000-000000004d41';

-- Company B operational fixtures (for cross-company negatives).
insert into public.owners (id,full_name,company_id) values ('00000000-0000-0000-0000-000000005d11','Owner B','00000000-0000-4000-8000-0000000005d1');
insert into public.properties (id,title,type,address,status,company_id) values ('00000000-0000-0000-0000-000000005d21','Property B','residential','D','active','00000000-0000-4000-8000-0000000005d1');
insert into public.units (id,name,property_id,unit_number,status,company_id) values
 ('00000000-0000-0000-0000-000000005d22','UB','00000000-0000-0000-0000-000000005d21','DB-1','available','00000000-0000-4000-8000-0000000005d1');
insert into public.people (id,full_name,type,company_id) values ('00000000-0000-0000-0000-000000005d31','Tenant B','tenant','00000000-0000-4000-8000-0000000005d1');
insert into public.property_owners (id,property_id,owner_id,ownership_percentage,is_primary,starts_on,ends_on,company_id) values
 ('00000000-0000-0000-0000-000000005d25','00000000-0000-0000-0000-000000005d21','00000000-0000-0000-0000-000000005d11',100,true,'2025-01-01',null,'00000000-0000-4000-8000-0000000005d1');
insert into public.owner_agreements (id,owner_id,property_id,agreement_type,commission_type,commission_value,starts_on,ends_on,company_id) values
 ('00000000-0000-0000-0000-000000005d41','00000000-0000-0000-0000-000000005d11','00000000-0000-0000-0000-000000005d21','property_management','RATE',5,'2026-01-01','2028-12-31','00000000-0000-4000-8000-0000000005d1');
insert into public.owner_agreement_versions (id,owner_agreement_id,company_id,version_no,operating_model,collection_role,commission_type,commission_value,commission_recognition_basis,effective_from,effective_to)
values ('00000000-0000-0000-0000-000000005d42','00000000-0000-0000-0000-000000005d41','00000000-0000-4000-8000-0000000005d1',1,'OWNER_AGENCY','OWNER_IS_CREDITOR','RATE',5,'ON_COLLECTION','2026-01-01','2028-12-31');
update public.owner_agreements set current_version_id='00000000-0000-0000-0000-000000005d42' where id='00000000-0000-0000-0000-000000005d41';

select plan(30);

-- Company A maker context.
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000004d01","role":"authenticated","app_metadata":{"company_id":"00000000-0000-4000-8000-0000000004d1"}}',true);
set local role authenticated;

-- 1. Create the renewal source contract and drive it active via the real
--    maker-checker approval + activation authority.
select lives_ok(
  $$select public.create_contract_atomic(
    '00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d22',
    '00000000-0000-0000-0000-000000004d31','00000000-0000-0000-0000-000000004d41',
    date '2026-10-01', date '2027-09-30', 1000, 'monthly', null,
    'draft', null, 'gap004-r-src', null)$$,
  '1. renewal source contract created as draft'
);
select lives_ok(
  $$select public.submit_contract_for_approval_atomic(
    (select id::text from public.contracts where notes='gap004-r-src' limit 1), 'maker-sig')$$,
  '2. maker submits the source contract'
);
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000004d02","role":"authenticated","app_metadata":{"company_id":"00000000-0000-4000-8000-0000000004d1"}}',true);
set local role authenticated;
select lives_ok(
  $$select public.approve_contract_atomic(
    (select id::text from public.contracts where notes='gap004-r-src' limit 1), 'checker-sig')$$,
  '3. distinct checker approves the source contract'
);
select lives_ok(
  $$select public.activate_contract_with_agreement_snapshot_atomic(
    (select id::text from public.contracts where notes='gap004-r-src' limit 1))$$,
  '4. source contract activated'
);
select is(
  (select lower(status) from public.contracts where notes='gap004-r-src' limit 1),
  'active',
  '5. source contract is active'
);

-- 2. Renewal creates a DRAFT renewed contract, linked to the source, and the
--    source contract is left untouched.
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000004d01","role":"authenticated","app_metadata":{"company_id":"00000000-0000-4000-8000-0000000004d1"}}',true);
set local role authenticated;
select is(
  (select public.renew_contract_atomic(
      (select id::text from public.contracts where notes='gap004-r-src' limit 1),
      '{"new_start":"2027-10-01","new_end":"2028-09-30","new_amount":1200}'::jsonb) ->> 'status'),
  'renewed',
  '6. renewal RPC succeeds'
);
select is(
  (select lower(status) from public.contracts where renewed_from_id = (select id from public.contracts where notes='gap004-r-src' limit 1) limit 1),
  'draft',
  '7. renewed contract is born DRAFT (never ACTIVE)'
);
select is(
  (select lower(status) from public.contracts where notes='gap004-r-src' limit 1),
  'active',
  '8. source contract remains active after renewal'
);
select ok(
  exists (select 1 from public.contracts where renewed_from_id = (select id from public.contracts where notes='gap004-r-src' limit 1)),
  '9. renewed contract links to the source via renewed_from_id'
);

-- 3. A renewed contract cannot be activated before approval.
select throws_ok(
  $$select public.activate_contract_with_agreement_snapshot_atomic(
    (select id::text from public.contracts where renewed_from_id = (select id from public.contracts where notes='gap004-r-src' limit 1) limit 1))$$,
  '23514', 'CONTRACT_APPROVAL_REQUIRED',
  '10. renewal activation before approval is rejected'
);

-- 4. The renewed contract then passes the full approval chain and freezes the
--    agreement snapshot.
select lives_ok(
  $$select public.submit_contract_for_approval_atomic(
    (select id::text from public.contracts where renewed_from_id = (select id from public.contracts where notes='gap004-r-src' limit 1) limit 1), 'maker-sig-r')$$,
  '11. maker submits the renewed contract'
);
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000004d02","role":"authenticated","app_metadata":{"company_id":"00000000-0000-4000-8000-0000000004d1"}}',true);
set local role authenticated;
select lives_ok(
  $$select public.approve_contract_atomic(
    (select id::text from public.contracts where renewed_from_id = (select id from public.contracts where notes='gap004-r-src' limit 1) limit 1), 'checker-sig-r')$$,
  '12. distinct checker approves the renewed contract'
);
select lives_ok(
  $$select public.activate_contract_with_agreement_snapshot_atomic(
    (select id::text from public.contracts where renewed_from_id = (select id from public.contracts where notes='gap004-r-src' limit 1) limit 1))$$,
  '13. renewed contract activated after approval'
);
select is(
  (select lower(status) from public.contracts where renewed_from_id = (select id from public.contracts where notes='gap004-r-src' limit 1) limit 1),
  'active',
  '14. renewed contract is active after the full chain'
);
select is(
  (select agreement_version_id::text from public.contracts where renewed_from_id = (select id from public.contracts where notes='gap004-r-src' limit 1) limit 1),
  '00000000-0000-0000-0000-000000004d42',
  '15. renewed contract freezes the agreement snapshot'
);

-- 5. Generic update preserves lifecycle status.
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000004d01","role":"authenticated","app_metadata":{"company_id":"00000000-0000-4000-8000-0000000004d1"}}',true);
set local role authenticated;
select lives_ok(
  $$select public.create_contract_atomic(
    '00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d23',
    '00000000-0000-0000-0000-000000004d32','00000000-0000-0000-0000-000000004d41',
    date '2026-11-01', date '2027-10-31', 900, 'monthly', null,
    'draft', null, 'gap004-r-d1', null)$$,
  '16. draft contract created for status-preservation checks'
);
select throws_ok(
  $$select public.update_contract_atomic(
    (select id::text from public.contracts where notes='gap004-r-d1' limit 1),
    '00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d23',
    '00000000-0000-0000-0000-000000004d32','00000000-0000-0000-0000-000000004d41',
    date '2026-11-01', date '2027-10-31', 900, 'monthly', null,
    'terminated', null, 'gap004-r-d1', null)$$,
  '23514', 'CONTRACT_LIFECYCLE_STATUS_IMMUTABLE',
  '17. generic update draft->terminated is rejected'
);
select throws_ok(
  $$select public.update_contract_atomic(
    (select id::text from public.contracts where notes='gap004-r-d1' limit 1),
    '00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d23',
    '00000000-0000-0000-0000-000000004d32','00000000-0000-0000-0000-000000004d41',
    date '2026-11-01', date '2027-10-31', 900, 'monthly', null,
    'expired', null, 'gap004-r-d1', null)$$,
  '23514', 'CONTRACT_LIFECYCLE_STATUS_IMMUTABLE',
  '18. generic update draft->expired is rejected'
);
select throws_ok(
  $$select public.update_contract_atomic(
    (select id::text from public.contracts where notes='gap004-r-d1' limit 1),
    '00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d23',
    '00000000-0000-0000-0000-000000004d32','00000000-0000-0000-0000-000000004d41',
    date '2026-11-01', date '2027-10-31', 900, 'monthly', null,
    'active', null, 'gap004-r-d1', null)$$,
  '23514', 'CONTRACT_ACTIVATION_VIA_RPC',
  '19. generic update draft->active is rejected'
);
select lives_ok(
  $$select public.update_contract_atomic(
    (select id::text from public.contracts where notes='gap004-r-d1' limit 1),
    '00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d23',
    '00000000-0000-0000-0000-000000004d32','00000000-0000-0000-0000-000000004d41',
    date '2026-11-01', date '2027-10-31', 950, 'monthly', null,
    'draft', null, 'gap004-r-d1', null)$$,
  '20. generic update draft->draft (commercial edit on a fresh draft) is allowed'
);

-- 6. Cross-company isolation (SECURITY DEFINER revalidates company scope).
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000005d01","role":"authenticated","app_metadata":{"company_id":"00000000-0000-4000-8000-0000000005d1"}}',true);
set local role authenticated;
select lives_ok(
  $$select public.create_contract_atomic(
    '00000000-0000-0000-0000-000000005d21','00000000-0000-0000-0000-000000005d22',
    '00000000-0000-0000-0000-000000005d31','00000000-0000-0000-0000-000000005d41',
    date '2026-10-01', date '2027-09-30', 1000, 'monthly', null,
    'draft', null, 'gap004-r-b', null)$$,
  '21. company B admin creates a draft in its own company'
);
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000004d01","role":"authenticated","app_metadata":{"company_id":"00000000-0000-4000-8000-0000000004d1"}}',true);
set local role authenticated;
-- Company A tries to create a contract referencing company B's records.
select throws_ok(
  $$select public.create_contract_atomic(
    '00000000-0000-0000-0000-000000005d21','00000000-0000-0000-0000-000000005d22',
    '00000000-0000-0000-0000-000000005d31','00000000-0000-0000-0000-000000005d41',
    date '2026-10-01', date '2027-09-30', 1000, 'monthly', null,
    'draft', null, 'gap004-r-cross-create', null)$$,
  null, null,
  '22. cross-company create (company B records via company A) is rejected'
);
-- Company A tries to renew company B's contract.
select throws_ok(
  $$select public.renew_contract_atomic(
    (select id::text from public.contracts where notes='gap004-r-b' limit 1),
    '{"new_start":"2027-10-01","new_end":"2028-09-30","new_amount":1100}'::jsonb)$$,
  null, null,
  '23. cross-company renewal is rejected'
);
-- Company A tries to terminate company B's contract.
select throws_ok(
  $$select public.terminate_contract_atomic(
    (select id::text from public.contracts where notes='gap004-r-b' limit 1), 'نزاع')$$,
  null, null,
  '24. cross-company termination is rejected'
);
-- Company A tries to update company B's contract.
select throws_ok(
  $$select public.update_contract_atomic(
    (select id::text from public.contracts where notes='gap004-r-b' limit 1),
    '00000000-0000-0000-0000-000000005d21','00000000-0000-0000-0000-000000005d22',
    '00000000-0000-0000-0000-000000005d31','00000000-0000-0000-0000-000000005d41',
    date '2026-10-01', date '2027-09-30', 1000, 'monthly', null,
    'draft', null, 'gap004-r-b', null)$$,
  null, null,
  '25. cross-company update is rejected'
);
-- Verify the company B contract is left intact under company B's own context
-- (RLS correctly hid company B rows from company A; company B re-checks state).
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000005d01","role":"authenticated","app_metadata":{"company_id":"00000000-0000-4000-8000-0000000005d1"}}',true);
set local role authenticated;
select is(
  (select lower(status) from public.contracts where notes='gap004-r-b' limit 1),
  'draft',
  '26. company B contract is untouched by company A cross-company attempts'
);
-- Company A attempt to terminate company B's contract must not cancel its invoices.
select is(
  (select count(*)::int from public.invoices where contract_id = (select id from public.contracts where notes='gap004-r-b' limit 1)),
  0,
  '27. cross-company termination did not touch company B invoices'
);

reset role;
select * from finish();
rollback;
-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Direct-write revocation: the API cannot bypass the lifecycle by writing
--    public.contracts directly. Any authenticated direct INSERT/UPDATE that
--    would set status='active' (or write the contract at all) must fail closed
--    because write privileges are revoked (SEC-009 / GAP-018). The only
--    contract writes are the SECURITY DEFINER lifecycle RPCs.
-- ─────────────────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000004d01","role":"authenticated","app_metadata":{"company_id":"00000000-0000-4000-8000-0000000004d1"}}',true);
set local role authenticated;
select throws_ok(
  $$ insert into public.contracts (property_id, unit_id, tenant_id, start_date, end_date, rent_amount, status, company_id)
     values ('00000000-0000-0000-0000-000000004d21','00000000-0000-0000-0000-000000004d22',
             '00000000-0000-0000-0000-000000004d31', date '2026-10-01', date '2027-09-30', 1000, 'active',
             '00000000-0000-4000-8000-0000000004d1') $$,
  '42501', null,
  '28. authenticated direct INSERT into contracts is rejected (write privileges revoked)'
);
select throws_ok(
  $$ update public.contracts set status = 'active'
     where id = (select id from public.contracts where notes='gap004-r-d1' limit 1) $$,
  '42501', null,
  '29. authenticated direct UPDATE of contracts is rejected (write privileges revoked)'
);
select throws_ok(
  $$ delete from public.contracts where notes='gap004-r-d1' $$,
  '42501', null,
  '30. authenticated direct DELETE of contracts is rejected (write privileges revoked)'
);

reset role;
select * from finish();
rollback;

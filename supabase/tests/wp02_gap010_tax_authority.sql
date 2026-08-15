-- =============================================================================
-- WP-02 / GAP-010 — Authoritative, versioned company tax configuration.
-- Canonical rule: FIN-012. Proves: no universal statutory rate; taxable posting
-- blocks when no active profile covers the date; version switch changes rate at
-- the effective date; per-line tax snapshot (code/rate/amount) is immutable;
-- 3dp; idempotency; company isolation; 2100 reconciles to snapshots.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

insert into public.companies (id, name, slug, currency, is_active) values
  ('0a000000-0000-4000-8000-0000000000c1', 'GAP010 Company A', 'gap010-a', 'OMR', true),
  ('0b000000-0000-4000-8000-0000000000c1', 'GAP010 Company B', 'gap010-b', 'OMR', true)
on conflict (id) do update set is_active = true;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
  ('0a000000-0000-0000-0000-000000000cc1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gap010-a@test.invalid', 'x', now(), now(), now(), '{}', '{}'),
  ('0a000000-0000-0000-0000-000000000cc2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gap010-approver@test.invalid', 'x', now(), now(), now(), '{}', '{}'),
  ('0b000000-0000-0000-0000-000000000cc1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gap010-b@test.invalid', 'x', now(), now(), now(), '{}', '{}')
on conflict (id) do nothing;

insert into public.users (id, email, name, role, status, is_active) values
  ('0a000000-0000-0000-0000-000000000cc1', 'gap010-a@test.invalid', 'GAP010 A', 'ADMIN', 'ACTIVE', true),
  ('0a000000-0000-0000-0000-000000000cc2', 'gap010-approver@test.invalid', 'GAP010 Approver', 'ADMIN', 'ACTIVE', true),
  ('0b000000-0000-0000-0000-000000000cc1', 'gap010-b@test.invalid', 'GAP010 B', 'ADMIN', 'ACTIVE', true)
on conflict (id) do update set role='ADMIN', status='ACTIVE', is_active=true;

insert into public.company_members (company_id, user_id, role) values
  ('0a000000-0000-4000-8000-0000000000c1', '0a000000-0000-0000-0000-000000000cc1', 'ADMIN'),
  ('0a000000-0000-4000-8000-0000000000c1', '0a000000-0000-0000-0000-000000000cc2', 'ADMIN'),
  ('0b000000-0000-4000-8000-0000000000c1', '0b000000-0000-0000-0000-000000000cc1', 'ADMIN')
on conflict (company_id, user_id) do update set role='ADMIN';

select lives_ok($$ select public.provision_company_chart_of_accounts('0a000000-0000-4000-8000-0000000000c1') $$, 'provision chart A');
select lives_ok($$ select public.provision_company_chart_of_accounts('0b000000-0000-4000-8000-0000000000c1') $$, 'provision chart B');

insert into public.accounting_periods (id, company_id, name, start_date, end_date, status) values
  ('0a100000-0000-4000-8000-0000000000c1', '0a000000-0000-4000-8000-0000000000c1', '2026-08', date '2026-08-01', date '2026-08-31', 'OPEN'),
  ('0b100000-0000-4000-8000-0000000000c1', '0b000000-0000-4000-8000-0000000000c1', '2026-08', date '2026-08-01', date '2026-08-31', 'OPEN')
on conflict (id) do update set status = 'OPEN';

-- ── Test 1: taxable posting BLOCKS when no authoritative profile exists
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000cc1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000c1"}}', true);
set local role authenticated;

select throws_ok(
  $$ select public.post_taxable_collection_atomic(jsonb_build_object(
       'net_amount', 100.000, 'cash_account_no', '1120', 'effective_date', '2026-08-10',
       'request_id', 'gap010-no-profile') ) $$,
  'P0001', null, '1. posting blocked when no authoritative tax profile exists (no silent default)'
);

-- ── Test 2: create + maker-checker activate a profile
select lives_ok(
  $$ select public.create_tax_profile_atomic(jsonb_build_object(
       'tax_code', 'VAT', 'tax_rate', 5.000, 'effective_from', '2026-08-01',
       'description', 'Standard VAT', 'request_id', 'gap010-create-vat') ) $$,
  '2. create DRAFT VAT profile at 5%'
);
select is(
  (select status from public.company_tax_profiles where created_by = '0a000000-0000-0000-0000-000000000cc1'::uuid order by version_no desc limit 1),
  'DRAFT', '2b. profile is DRAFT after creation'
);

-- Same actor cannot approve (maker-checker): switch to the second admin.
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000cc2","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000c1"}}', true);
select lives_ok(
  $$ select public.approve_tax_profile_atomic(jsonb_build_object(
       'profile_id', (select id::text from public.company_tax_profiles where created_by = '0a000000-0000-0000-0000-000000000cc1'::uuid order by version_no desc limit 1),
       'request_id', 'gap010-approve-vat') ) $$,
  '3. a different approver activates the profile (maker-checker)'
);
select is(
  (select status from public.company_tax_profiles where created_by = '0a000000-0000-0000-0000-000000000cc1'::uuid order by version_no desc limit 1),
  'ACTIVE', '3b. profile is ACTIVE after approval'
);

-- ── Test 4: taxable posting now resolves tax authoritatively (5%), 3dp, snapshots
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000cc1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000c1"}}', true);
select lives_ok(
  $$ select public.post_taxable_collection_atomic(jsonb_build_object(
       'net_amount', 100.000, 'cash_account_no', '1120', 'effective_date', '2026-08-10',
       'request_id', 'gap010-coll-1') ) $$,
  '4. taxable collection posts with resolved 5% tax'
);
select is(
  (select tax_amount from public.taxable_line_tax_snapshots order by created_at desc limit 1),
  5.000::numeric, '4b. tax_amount is 5.000 (5% of 100)'
);
select is(
  (select tax_rate from public.taxable_line_tax_snapshots order by created_at desc limit 1),
  5.000::numeric, '4c. snapshot captures the authoritative rate 5.000'
);

-- ── Test 5: per-line snapshot is immutable (no UPDATE/DELETE by app user)
select throws_ok(
  $$ update public.taxable_line_tax_snapshots set tax_amount = 9.000 where company_id = '0a000000-0000-4000-8000-0000000000c1' $$,
  '42501', null, '5. per-line tax snapshot cannot be edited by the browser'
);

-- ── Test 6: version switch — a later profile with a different rate applies at its effective date
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000cc1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000c1"}}', true);
select lives_ok(
  $$ select public.create_tax_profile_atomic(jsonb_build_object(
       'tax_code', 'VAT', 'tax_rate', 10.000, 'effective_from', '2026-09-01',
       'description', 'VAT increase', 'request_id', 'gap010-create-vat2') ) $$,
  '6. create a second DRAFT profile at 10% from 2026-09-01'
);
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000cc2","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000c1"}}', true);
select lives_ok(
  $$ select public.approve_tax_profile_atomic(jsonb_build_object(
       'profile_id', (select id::text from public.company_tax_profiles where created_by = '0a000000-0000-0000-0000-000000000cc1'::uuid and tax_rate = 10.000 order by version_no desc limit 1),
       'request_id', 'gap010-approve-vat2') ) $$,
  '6b. activate the 10% profile'
);
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000cc1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000c1"}}', true);
select is(
  (select tax_rate from public.resolve_active_tax_profile('0a000000-0000-4000-8000-0000000000c1'::uuid, date '2026-08-15')),
  5.000::numeric, '6c. pre-switch date still resolves 5%'
);
select is(
  (select tax_rate from public.resolve_active_tax_profile('0a000000-0000-4000-8000-0000000000c1'::uuid, date '2026-09-15')),
  10.000::numeric, '6d. post-switch date resolves 10%'
);

-- ── Test 7: company isolation — Company B has no profile, posting blocked; profile A not visible to B
select set_config('request.jwt.claims', '{"sub":"0b000000-0000-0000-0000-000000000cc1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0b000000-0000-4000-8000-0000000000c1"}}', true);
select throws_ok(
  $$ select public.post_taxable_collection_atomic(jsonb_build_object(
       'net_amount', 100.000, 'cash_account_no', '1120', 'effective_date', '2026-08-10',
       'request_id', 'gap010-b-coll') ) $$,
  'P0001', null, '7. Company B with no profile is blocked (isolation)'
);
select is(
  (select count(*)::int from public.company_tax_profiles where company_id = '0b000000-0000-4000-8000-0000000000c1'::uuid),
  0, '7b. Company B sees no Company A profiles'
);

-- ── Test 8: 2100 reconciles to per-line tax snapshots (within company A's posting scope)
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000cc1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000c1"}}', true);
select is(
  (select coalesce(sum(s.tax_amount),0) from public.taxable_line_tax_snapshots s
     join public.journal_batches b on b.id = s.journal_batch_id
    where s.company_id = '0a000000-0000-4000-8000-0000000000c1' and b.status = 'POSTED'),
  (select coalesce(sum(l.credit),0) from public.journal_lines l
     join public.journal_batches b on b.id = l.batch_id
     join public.accounts a on a.id = l.account_id
    where b.company_id = '0a000000-0000-4000-8000-0000000000c1' and b.status = 'POSTED' and a.no = '2100'),
  '8. GL 2100 tax (credit) equals the per-line tax snapshot total'
);

-- ── Test 9: idempotency conflict — same request_id, different net amount fails closed
select throws_ok(
  $$ select public.post_taxable_collection_atomic(jsonb_build_object(
       'net_amount', 200.000, 'cash_account_no', '1120', 'effective_date', '2026-08-10',
       'request_id', 'gap010-coll-1') ) $$,
  '22023', null, '9. reused request_id with different amount fails closed'
);

reset role;
select * from finish();
rollback;

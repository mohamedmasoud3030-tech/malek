-- =============================================================================
-- WP-05 GAP-015 — S08 Frozen Historical Review infrastructure
-- Tests: immutable, lifecycle, two-company isolation, fingerprint/replay
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- Setup companies and periods
insert into public.companies (id, name, slug, currency, is_active)
values
  ('a0000000-0000-4000-8000-000000000020', 'WP05 GAP15 Company A', 'wp05-gap15-a', 'OMR', true),
  ('b0000000-0000-4000-8000-000000000021', 'WP05 GAP15 Company B', 'wp05-gap15-b', 'OMR', true)
on conflict (id) do update set is_active = true;

select lives_ok($$ select public.provision_company_chart_of_accounts('a0000000-0000-4000-8000-000000000020') $$, 'provision chart A');
select lives_ok($$ select public.provision_company_chart_of_accounts('b0000000-0000-4000-8000-000000000021') $$, 'provision chart B');

delete from public.s08_frozen_reviews where company_id in ('a0000000-0000-4000-8000-000000000020','b0000000-0000-4000-8000-000000000021');
delete from public.journal_lines where company_id in ('a0000000-0000-4000-8000-000000000020','b0000000-0000-4000-8000-000000000021');
delete from public.journal_batches where company_id in ('a0000000-0000-4000-8000-000000000020','b0000000-0000-4000-8000-000000000021');
delete from public.accounting_periods where company_id in ('a0000000-0000-4000-8000-000000000020','b0000000-0000-4000-8000-000000000021');

insert into public.accounting_periods (id, company_id, name, start_date, end_date, status)
values
  ('a2a00000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000020', '2026-07', date '2026-07-01', date '2026-07-31', 'OPEN'),
  ('b2b00000-0000-4000-8000-000000000021', 'b0000000-0000-4000-8000-000000000021', '2026-07', date '2026-07-01', date '2026-07-31', 'OPEN')
on conflict (id) do update set status = 'OPEN';

-- Need users for auth
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('a0a00000-0000-4000-8000-000000000020', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gap15-admin-a@invalid', 'x', now(), now(), now(), '{}', '{}'),
  ('b0b00000-0000-4000-8000-000000000021', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gap15-admin-b@invalid', 'x', now(), now(), now(), '{}', '{}')
on conflict (id) do nothing;

insert into public.users (id, email, name, role, status, is_active)
values
  ('a0a00000-0000-4000-8000-000000000020', 'gap15-admin-a@invalid', 'GAP15 Admin A', 'ADMIN', 'ACTIVE', true),
  ('b0b00000-0000-4000-8000-000000000021', 'gap15-admin-b@invalid', 'GAP15 Admin B', 'ADMIN', 'ACTIVE', true)
on conflict (id) do update set role = 'ADMIN', is_active = true;

insert into public.company_members (company_id, user_id, role, is_active)
values
  ('a0000000-0000-4000-8000-000000000020', 'a0a00000-0000-4000-8000-000000000020', 'ADMIN', true),
  ('b0000000-0000-4000-8000-000000000021', 'b0b00000-0000-4000-8000-000000000021', 'ADMIN', true)
on conflict (company_id, user_id) do update set is_active = true;

-- Simulate Company A JWT
select set_config('request.jwt.claims', '{"sub":"a0a00000-0000-4000-8000-000000000020","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"a0000000-0000-4000-8000-000000000020"}}', true);
set local role authenticated;

-- Test creation: should succeed for Company A
select lives_ok(
  $$ select public.s08_create_frozen_review(jsonb_build_object(
        'accounting_period_id', 'a2a00000-0000-4000-8000-000000000020',
        'analysis_version', 'v1-test',
        'dataset_lineage', 'test-lineage-a',
        'evidence_reference', 'evidence/s08/test',
        'analysis_results', '{"total_findings":0}'::jsonb,
        'reconciliation_evidence', '{"reconciled":true}'::jsonb,
        'exceptions', '[]'::jsonb
      )) $$,
  'create frozen review for Company A CREATED'
);

-- Get review id
-- Store in temp table for later?
-- Use a variable via query

select ok(
  (select count(*)::int from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000020' and reviewer_decision = 'CREATED') = 1,
  'review exists in CREATED state'
);

-- Test immutable guard: direct update should fail
select throws_ok(
  $$ update public.s08_frozen_reviews set reviewer_decision = 'APPROVED' where company_id = 'a0000000-0000-4000-8000-000000000020' $$,
  '42501',
  null,
  'direct update of frozen review blocked (immutable guard)'
);

-- Test direct delete blocked
select throws_ok(
  $$ delete from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000020' $$,
  '42501',
  null,
  'direct delete of frozen review blocked'
);

-- Test lifecycle: CREATED → ANALYZED
select lives_ok(
  $$ select public.s08_analyze_frozen_review(
       (select id from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000020' limit 1),
       '{"findings":1}'::jsonb,
       '{"evidence":"reconciled"}'::jsonb,
       '[]'::jsonb
     ) $$,
  'CREATED → ANALYZED transition allowed'
);

select results_eq(
  $$ select reviewer_decision from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000020' $$,
  $$ values ('ANALYZED'::text) $$,
  'review now in ANALYZED state'
);

-- Test lifecycle: illegal transition CREATED → APPROVED should fail (but we are already ANALYZED, try illegal)
-- Try APPROVED from ANALYZED should succeed if ACCOUNTANT role — but current user is ADMIN, is_accountant() check requires is_accountant() or is_admin()
-- is_admin() should be true for ADMIN? Let's check function is_admin checks role ADMIN? We have is_admin() helper? Need to ensure it passes
-- For test, we will attempt approval as ADMIN (should succeed because is_admin() true)

-- First, need a journal batch to give fingerprint some data, to test fingerprint replay
reset role;
select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'gap15-gl-a-001',
      'event_id', 'gap15-gl-a-001',
      'effective_date', '2026-07-10',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1111'), 'debit', 100.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '4100'), 'debit', 0, 'credit', 100.000)
      )
    ))
  $$, 'a0000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000020'),
  'post GL for fingerprint test'
);

select set_config('request.jwt.claims', '{"sub":"a0a00000-0000-4000-8000-000000000020","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"a0000000-0000-4000-8000-000000000020"}}', true);
set local role authenticated;

-- Verify fingerprint matches currently (should match)
select ok(
  ((public.s08_verify_fingerprint((select id from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000020' limit 1))->>'matches')::boolean = true),
  'fingerprint matches initially'
);

-- Now add another GL batch that changes dataset — fingerprint should now differ
reset role;
select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'gap15-gl-a-002',
      'event_id', 'gap15-gl-a-002',
      'effective_date', '2026-07-11',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1111'), 'debit', 50.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '4100'), 'debit', 0, 'credit', 50.000)
      )
    ))
  $$, 'a0000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000020'),
  'post second GL to change fingerprint'
);

select set_config('request.jwt.claims', '{"sub":"a0a00000-0000-4000-8000-000000000020","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"a0000000-0000-4000-8000-000000000020"}}', true);
set local role authenticated;

-- Fingerprint should now NOT match (dataset changed under existing review)
select ok(
  ((public.s08_verify_fingerprint((select id from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000020' limit 1))->>'matches')::boolean = false),
  'fingerprint mismatch detected after dataset change (replay protection)'
);

-- Approval should fail because fingerprint changed
select throws_ok(
  $$ select public.s08_approve_frozen_review((select id from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000020' limit 1), 'approve after change') $$,
  'P0001',
  null,
  'approval blocked when fingerprint changed (dataset silently changed)'
);

-- Create a new review after dataset change — should succeed and its fingerprint should match
select lives_ok(
  $$ select public.s08_create_frozen_review(jsonb_build_object(
        'accounting_period_id', 'a2a00000-0000-4000-8000-000000000020',
        'analysis_version', 'v2-test',
        'dataset_lineage', 'test-lineage-a',
        'evidence_reference', 'evidence/s08/test2',
        'analysis_results', '{"total_findings":0}'::jsonb,
        'reconciliation_evidence', '{"reconciled":true}'::jsonb,
        'exceptions', '[]'::jsonb
      )) $$,
  'create second frozen review after dataset change'
);

-- Analyze second review
select lives_ok(
  $$ select public.s08_analyze_frozen_review(
       (select id from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000020' and analysis_version = 'v2-test' limit 1),
       '{"findings":0}'::jsonb,
       '{"evidence":"reconciled"}'::jsonb,
       '[]'::jsonb
     ) $$,
  'analyze second review'
);

-- Two-company isolation: Company B should not see Company A reviews
select set_config('request.jwt.claims', '{"sub":"b0b00000-0000-4000-8000-000000000021","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"b0000000-0000-4000-8000-000000000021"}}', true);
set local role authenticated;

select is(
  (select count(*)::int from public.s08_frozen_reviews),
  0,
  'two-company isolation: Company B sees 0 reviews from Company A'
);

-- Company B create its own review
select lives_ok(
  $$ select public.s08_create_frozen_review(jsonb_build_object(
        'accounting_period_id', 'b2b00000-0000-4000-8000-000000000021',
        'analysis_version', 'v1-b',
        'dataset_lineage', 'test-lineage-b',
        'evidence_reference', 'evidence/s08/test-b',
        'analysis_results', '{"total_findings":0}'::jsonb,
        'reconciliation_evidence', '{"reconciled":true}'::jsonb,
        'exceptions', '[]'::jsonb
      )) $$,
  'Company B creates its own frozen review'
);

select is(
  (select count(*)::int from public.s08_frozen_reviews),
  1,
  'Company B sees exactly its own 1 review'
);

-- Test that Company A cannot approve Company B review (isolation)
-- Try to approve B's review while claiming A company — should fail to find review
select set_config('request.jwt.claims', '{"sub":"a0a00000-0000-4000-8000-000000000020","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"a0000000-0000-4000-8000-000000000020"}}', true);
set local role authenticated;

select throws_ok(
  $$ select public.s08_approve_frozen_review((select id from public.s08_frozen_reviews where company_id = 'b0000000-0000-4000-8000-000000000021' limit 1), 'cross-company approve attempt') $$,
  'P0002',
  null,
  'cross-company review IDs blocked (Company A cannot approve B review)'
);

-- Test that no APPROVED review is fabricated in migration (we have only CREATED and ANALYZED so far)
reset role;
select is(
  (select count(*)::int from public.s08_frozen_reviews where reviewer_decision = 'APPROVED'),
  0,
  'no APPROVED review fabricated by engineering — must be genuine accounting approval'
);

-- Now approve second review for Company A as ACCOUNTANT (requires is_accountant or is_admin)
-- We have ADMIN role which should pass is_admin check
select set_config('request.jwt.claims', '{"sub":"a0a00000-0000-4000-8000-000000000020","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"a0000000-0000-4000-8000-000000000020"}}', true);
set local role authenticated;

select lives_ok(
  $$ select public.s08_approve_frozen_review(
       (select id from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000020' and analysis_version = 'v2-test' limit 1),
       'genuine accounting approval for test'
     ) $$,
  'genuine APPROVED review created via accounting control (ADMIN)'
);

select results_eq(
  $$ select reviewer_decision from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000020' and analysis_version = 'v2-test' $$,
  $$ values ('APPROVED'::text) $$,
  'review is now APPROVED'
);

reset role;
select * from finish();
rollback;

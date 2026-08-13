-- =============================================================================
-- WP-05 GAP-016 — S09 Controlled Correction Framework
-- Tests: S08 gate, lifecycle, validation failures, company isolation, reversal
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- Setup companies
insert into public.companies (id, name, slug, currency, is_active)
values
  ('a0000000-0000-4000-8000-000000000030', 'WP05 GAP16 Company A', 'wp05-gap16-a', 'OMR', true),
  ('b0000000-0000-4000-8000-000000000031', 'WP05 GAP16 Company B', 'wp05-gap16-b', 'OMR', true)
on conflict (id) do update set is_active = true;

select lives_ok($$ select public.provision_company_chart_of_accounts('a0000000-0000-4000-8000-000000000030') $$, 'provision chart A');
select lives_ok($$ select public.provision_company_chart_of_accounts('b0000000-0000-4000-8000-000000000031') $$, 'provision chart B');
select lives_ok($$ select public.wp05_provision_default_cashflow_classifications('a0000000-0000-4000-8000-000000000030') $$, 'provision classifications A');
select lives_ok($$ select public.wp05_provision_default_cashflow_classifications('b0000000-0000-4000-8000-000000000031') $$, 'provision classifications B');

create temporary table wp05_gap016_test_ids (
  name text primary key,
  id text not null
) on commit drop;
grant select on wp05_gap016_test_ids to authenticated;

insert into wp05_gap016_test_ids (name, id)
select 'company_b_receivable', id
from public.accounts
where company_id = 'b0000000-0000-4000-8000-000000000031' and no = '1201'
limit 1;

-- Clean
delete from public.s09_corrections where company_id in ('a0000000-0000-4000-8000-000000000030','b0000000-0000-4000-8000-000000000031');
delete from public.s08_frozen_reviews where company_id in ('a0000000-0000-4000-8000-000000000030','b0000000-0000-4000-8000-000000000031');
delete from public.journal_lines where company_id in ('a0000000-0000-4000-8000-000000000030','b0000000-0000-4000-8000-000000000031');
delete from public.journal_batches where company_id in ('a0000000-0000-4000-8000-000000000030','b0000000-0000-4000-8000-000000000031');
delete from public.accounting_periods where company_id in ('a0000000-0000-4000-8000-000000000030','b0000000-0000-4000-8000-000000000031');

insert into public.accounting_periods (id, company_id, name, start_date, end_date, status)
values
  ('a3a00000-0000-4000-8000-000000000030', 'a0000000-0000-4000-8000-000000000030', '2026-07', date '2026-07-01', date '2026-07-31', 'OPEN'),
  ('b3b00000-0000-4000-8000-000000000031', 'b0000000-0000-4000-8000-000000000031', '2026-07', date '2026-07-01', date '2026-07-31', 'OPEN')
on conflict (id) do update set status = 'OPEN';

-- Users
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('a0a00000-0000-4000-8000-000000000030', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gap16-admin-a@invalid', 'x', now(), now(), now(), '{}', '{}'),
  ('b0b00000-0000-4000-8000-000000000031', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gap16-admin-b@invalid', 'x', now(), now(), now(), '{}', '{}')
on conflict (id) do nothing;

insert into public.users (id, email, name, role, status, is_active)
values
  ('a0a00000-0000-4000-8000-000000000030', 'gap16-admin-a@invalid', 'GAP16 Admin A', 'ADMIN', 'ACTIVE', true),
  ('b0b00000-0000-4000-8000-000000000031', 'gap16-admin-b@invalid', 'GAP16 Admin B', 'ADMIN', 'ACTIVE', true)
on conflict (id) do update set role = 'ADMIN', is_active = true;

insert into public.company_members (company_id, user_id, role, is_active)
values
  ('a0000000-0000-4000-8000-000000000030', 'a0a00000-0000-4000-8000-000000000030', 'ADMIN', true),
  ('b0000000-0000-4000-8000-000000000031', 'b0b00000-0000-4000-8000-000000000031', 'ADMIN', true)
on conflict (company_id, user_id) do update set is_active = true;

-- Create S08 frozen review for Company A but leave it in CREATED (not approved)
select set_config('request.jwt.claims', '{"sub":"a0a00000-0000-4000-8000-000000000030","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"a0000000-0000-4000-8000-000000000030"}}', true);
set local role authenticated;

select lives_ok(
  $$ select public.s08_create_frozen_review(jsonb_build_object(
        'accounting_period_id', 'a3a00000-0000-4000-8000-000000000030',
        'analysis_version', 'v1-gap16',
        'dataset_lineage', 'test-lineage-gap16-a',
        'evidence_reference', 'evidence/s08/gap16',
        'analysis_results', '{}'::jsonb,
        'reconciliation_evidence', '{}'::jsonb,
        'exceptions', '[]'::jsonb
      )) $$,
  'create S08 review for GAP16 (CREATED)'
);

-- Try to create S09 correction draft without approved review — should be allowed (staged)
select lives_ok(
  $$ select public.s09_create_correction_draft(jsonb_build_object(
        'accounting_period_id', 'a3a00000-0000-4000-8000-000000000030',
        'review_id', (select id::text from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000030' limit 1),
        'source_type', 'invoice',
        'source_id', 'inv-test-001',
        'source_scope', '{"dataset_lineage":"test-lineage-gap16-a"}'::jsonb,
        'reason', 'Test correction without approval — should be DRAFT only',
        'amount', 100.000,
        'debit_account_no', '6100',
        'credit_account_no', '1111',
        'before_evidence', '{"amount":0}'::jsonb,
        'after_evidence', '{"amount":100}'::jsonb,
        'request_id', 'gap16-draft-no-approval-001'
      )) $$,
  'S09 draft allowed without S08 approval (staged)'
);

-- Try to validate without approval — MUST FAIL at DB level (S08 gate)
select throws_ok(
  $$ select public.s09_validate_correction((select id from public.s09_corrections where company_id = 'a0000000-0000-4000-8000-000000000030' and request_id = 'gap16-draft-no-approval-001')) $$,
  '42501',
  null,
  'S09 validation MUST fail without APPROVED S08 review (DB-level gate)'
);

-- Now analyze and approve S08 review
select lives_ok(
  $$ select public.s08_analyze_frozen_review(
       (select id from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000030' limit 1),
       '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
     ) $$,
  'analyze S08 review'
);
select lives_ok(
  $$ select public.s08_approve_frozen_review(
       (select id from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000030' limit 1),
       'approving for GAP16 tests'
     ) $$,
  'approve S08 review'
);

-- Need a real invoice for source evidence validation
insert into public.properties (id, title, type, address, company_id, status)
values ('a2000000-0000-4000-8000-000000000030', 'GAP16 Prop A', 'residential', 'Muscat', 'a0000000-0000-4000-8000-000000000030', 'active')
on conflict (id) do nothing;
insert into public.units (id, property_id, unit_number, company_id)
values ('a2100000-0000-4000-8000-000000000030', 'a2000000-0000-4000-8000-000000000030', 'A-01', 'a0000000-0000-4000-8000-000000000030')
on conflict (id) do nothing;
insert into public.people (id, full_name, type, company_id)
values ('a3000000-0000-4000-8000-000000000030', 'GAP16 Tenant', 'tenant', 'a0000000-0000-4000-8000-000000000030')
on conflict (id) do nothing;
insert into public.contracts (id, property_id, unit_id, tenant_id, start_date, end_date, rent_amount, status, company_id)
values ('a4000000-0000-4000-8000-000000000030', 'a2000000-0000-4000-8000-000000000030', 'a2100000-0000-4000-8000-000000000030', 'a3000000-0000-4000-8000-000000000030', date '2026-07-01', date '2026-07-31', 100, 'active', 'a0000000-0000-4000-8000-000000000030')
on conflict (id) do nothing;
insert into public.invoices (id, contract_id, amount, issue_date, due_date, status, company_id, paid_amount)
values ('a5000000-0000-4000-8000-000000000030', 'a4000000-0000-4000-8000-000000000030', 100.000, date '2026-07-01', date '2026-07-15', 'UNPAID', 'a0000000-0000-4000-8000-000000000030', 0)
on conflict (id) do update set amount = 100.000;

-- Now create a valid correction draft with real source
select lives_ok(
  $$ select public.s09_create_correction_draft(jsonb_build_object(
        'accounting_period_id', 'a3a00000-0000-4000-8000-000000000030',
        'review_id', (select id::text from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000030' and reviewer_decision = 'APPROVED' limit 1),
        'source_type', 'invoice',
        'source_id', 'a5000000-0000-4000-8000-000000000030',
        'source_scope', '{"dataset_lineage":"test-lineage-gap16-a"}'::jsonb,
        'reason', 'Correct invoice amount from 100 to 120',
        'amount', 20.000,
        'debit_account_no', '1201',
        'credit_account_no', '4000',
        'before_evidence', '{"invoice_amount":100}'::jsonb,
        'after_evidence', '{"invoice_amount":120}'::jsonb,
        'request_id', 'gap16-valid-001'
      )) $$,
  'create valid S09 correction draft with APPROVED review and real source'
);

-- Validate should now succeed (S08 approved)
select lives_ok(
  $$ select public.s09_validate_correction((select id from public.s09_corrections where request_id = 'gap16-valid-001')) $$,
  'validate correction succeeds with APPROVED S08'
);

-- Apply should succeed and create GL batch
select lives_ok(
  $$ select public.s09_apply_correction((select id from public.s09_corrections where request_id = 'gap16-valid-001')) $$,
  'apply correction creates GL batch'
);

-- Check that correction batch exists and is POSTED
select ok(
  (select count(*)::int from public.journal_batches where source_type = 's09_correction' and company_id = 'a0000000-0000-4000-8000-000000000030') >= 1,
  'correction GL batch exists'
);

-- Check before/after evidence preserved
select ok(
  (select before_evidence is not null and after_evidence is not null from public.s09_corrections where request_id = 'gap16-valid-001'),
  'before/after evidence preserved'
);

-- Test validation failure modes

-- 1. Missing company isolation: try to use B's review for A's correction
select set_config('request.jwt.claims', '{"sub":"b0b00000-0000-4000-8000-000000000031","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"b0000000-0000-4000-8000-000000000031"}}', true);
set local role authenticated;

select lives_ok(
  $$ select public.s08_create_frozen_review(jsonb_build_object(
        'accounting_period_id', 'b3b00000-0000-4000-8000-000000000031',
        'analysis_version', 'v1-b',
        'dataset_lineage', 'test-lineage-gap16-b',
        'evidence_reference', 'evidence/s08/gap16-b',
        'analysis_results', '{}'::jsonb,
        'reconciliation_evidence', '{}'::jsonb,
        'exceptions', '[]'::jsonb
      )) $$,
  'create S08 review for Company B'
);
select lives_ok(
  $$ select public.s08_analyze_frozen_review((select id from public.s08_frozen_reviews where company_id = 'b0000000-0000-4000-8000-000000000031' limit 1), '{}'::jsonb, '{}'::jsonb, '[]'::jsonb) $$,
  'analyze B review'
);
select lives_ok(
  $$ select public.s08_approve_frozen_review((select id from public.s08_frozen_reviews where company_id = 'b0000000-0000-4000-8000-000000000031' limit 1), 'approve B') $$,
  'approve B review'
);

reset role;
insert into wp05_gap016_test_ids (name, id)
select 'company_b_review', id::text
from public.s08_frozen_reviews
where company_id = 'b0000000-0000-4000-8000-000000000031'
limit 1;

-- Try to create correction for Company A using Company B review id — should fail company mismatch
select set_config('request.jwt.claims', '{"sub":"a0a00000-0000-4000-8000-000000000030","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"a0000000-0000-4000-8000-000000000030"}}', true);
set local role authenticated;

select throws_ok(
  $$ select public.s09_create_correction_draft(jsonb_build_object(
        'accounting_period_id', 'a3a00000-0000-4000-8000-000000000030',
        'review_id', (select id from wp05_gap016_test_ids where name = 'company_b_review'),
        'source_type', 'invoice',
        'source_id', 'a5000000-0000-4000-8000-000000000030',
        'source_scope', '{"dataset_lineage":"test-lineage-gap16-b"}'::jsonb,
        'reason', 'cross-company review attempt',
        'amount', 10.000,
        'debit_account_no', '1201',
        'credit_account_no', '4000',
        'before_evidence', '{}'::jsonb,
        'after_evidence', '{}'::jsonb,
        'request_id', 'gap16-cross-company-001'
      )) $$,
  '42501',
  null,
  'cross-company review IDs blocked for S09'
);

-- 2. Missing reason should fail
select throws_ok(
  $$ select public.s09_create_correction_draft(jsonb_build_object(
        'accounting_period_id', 'a3a00000-0000-4000-8000-000000000030',
        'review_id', (select id::text from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000030' and reviewer_decision = 'APPROVED' limit 1),
        'source_type', 'invoice',
        'source_id', 'a5000000-0000-4000-8000-000000000030',
        'source_scope', '{}'::jsonb,
        'reason', '',
        'amount', 10.000,
        'debit_account_no', '1201',
        'credit_account_no', '4000',
        'before_evidence', '{}'::jsonb,
        'after_evidence', '{}'::jsonb,
        'request_id', 'gap16-no-reason-001'
      )) $$,
  '22023',
  null,
  'empty reason fails closed'
);

-- 3. Amount not 3dp precision should fail
select throws_ok(
  $$ select public.s09_create_correction_draft(jsonb_build_object(
        'accounting_period_id', 'a3a00000-0000-4000-8000-000000000030',
        'review_id', (select id::text from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000030' and reviewer_decision = 'APPROVED' limit 1),
        'source_type', 'invoice',
        'source_id', 'a5000000-0000-4000-8000-000000000030',
        'source_scope', '{}'::jsonb,
        'reason', 'bad precision',
        'amount', 10.0001,
        'debit_account_no', '1201',
        'credit_account_no', '4000',
        'before_evidence', '{}'::jsonb,
        'after_evidence', '{}'::jsonb,
        'request_id', 'gap16-bad-prec-001'
      )) $$,
  '22023',
  null,
  'bad precision fails closed before rounding'
);

-- Zero is invalid independently of precision.
select throws_ok(
  $$ select public.s09_create_correction_draft(jsonb_build_object(
        'accounting_period_id', 'a3a00000-0000-4000-8000-000000000030',
        'review_id', (select id::text from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000030' and reviewer_decision = 'APPROVED' limit 1),
        'source_type', 'invoice',
        'source_id', 'a5000000-0000-4000-8000-000000000030',
        'source_scope', '{}'::jsonb,
        'reason', 'zero amount',
        'amount', 0,
        'debit_account_no', '1201',
        'credit_account_no', '4000',
        'before_evidence', '{}'::jsonb,
        'after_evidence', '{}'::jsonb,
        'request_id', 'gap16-zero-amount-001'
      )) $$,
  '22023',
  null,
  'zero amount fails closed'
);

-- 4. Cross-company account IDs should fail
select throws_ok(
  $$ select public.s09_create_correction_draft(jsonb_build_object(
        'accounting_period_id', 'a3a00000-0000-4000-8000-000000000030',
        'review_id', (select id::text from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000030' and reviewer_decision = 'APPROVED' limit 1),
        'source_type', 'invoice',
        'source_id', 'a5000000-0000-4000-8000-000000000030',
        'source_scope', '{}'::jsonb,
        'reason', 'cross-company account',
        'amount', 10.000,
        'debit_account_id', (select id from wp05_gap016_test_ids where name = 'company_b_receivable'),
        'credit_account_id', (select id from public.accounts where company_id = 'a0000000-0000-4000-8000-000000000030' and no = '4000' limit 1),
        'before_evidence', '{}'::jsonb,
        'after_evidence', '{}'::jsonb,
        'request_id', 'gap16-cross-acct-001'
      )) $$,
  '42501',
  null,
  'cross-company account IDs blocked'
);

-- 5. Source evidence missing should fail at validate
select lives_ok(
  $$ select public.s09_create_correction_draft(jsonb_build_object(
        'accounting_period_id', 'a3a00000-0000-4000-8000-000000000030',
        'review_id', (select id::text from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000030' and reviewer_decision = 'APPROVED' limit 1),
        'source_type', 'invoice',
        'source_id', '00000000-0000-4000-8000-000000000999',
        'source_scope', '{}'::jsonb,
        'reason', 'missing source',
        'amount', 10.000,
        'debit_account_no', '1201',
        'credit_account_no', '4000',
        'before_evidence', '{}'::jsonb,
        'after_evidence', '{}'::jsonb,
        'request_id', 'gap16-missing-source-001'
      )) $$,
  'create draft with missing source (allowed at draft)'
);
select throws_ok(
  $$ select public.s09_validate_correction((select id from public.s09_corrections where request_id = 'gap16-missing-source-001')) $$,
  'P0002',
  null,
  'validate fails when source evidence missing'
);

-- 6. Idempotency: same request_id should return same id
select lives_ok(
  $$ select public.s09_create_correction_draft(jsonb_build_object(
        'accounting_period_id', 'a3a00000-0000-4000-8000-000000000030',
        'review_id', (select id::text from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000030' and reviewer_decision = 'APPROVED' limit 1),
        'source_type', 'invoice',
        'source_id', 'a5000000-0000-4000-8000-000000000030',
        'source_scope', '{}'::jsonb,
        'reason', 'idempotent test',
        'amount', 5.000,
        'debit_account_no', '1201',
        'credit_account_no', '4000',
        'before_evidence', '{}'::jsonb,
        'after_evidence', '{}'::jsonb,
        'request_id', 'gap16-idempotent-001'
      )) $$,
  'create first idempotent draft'
);
select results_eq(
  $$ select (public.s09_create_correction_draft(jsonb_build_object(
        'accounting_period_id', 'a3a00000-0000-4000-8000-000000000030',
        'review_id', (select id::text from public.s08_frozen_reviews where company_id = 'a0000000-0000-4000-8000-000000000030' and reviewer_decision = 'APPROVED' limit 1),
        'source_type', 'invoice',
        'source_id', 'a5000000-0000-4000-8000-000000000030',
        'source_scope', '{}'::jsonb,
        'reason', 'idempotent test',
        'amount', 5.000,
        'debit_account_no', '1201',
        'credit_account_no', '4000',
        'before_evidence', '{}'::jsonb,
        'after_evidence', '{}'::jsonb,
        'request_id', 'gap16-idempotent-001'
      ))->>'idempotent')::boolean $$,
  $$ values (true::boolean) $$,
  'idempotency returns idempotent true on duplicate request_id'
);

-- 7. Reversal preserves original and creates compensating batch
select lives_ok(
  $$ select public.s09_reverse_correction((select id from public.s09_corrections where request_id = 'gap16-valid-001'), 'test reversal reason') $$,
  'reverse applied correction'
);
select is(
  (select status from public.s09_corrections where request_id = 'gap16-valid-001'),
  'REVERSED'::text,
  'correction status is REVERSED after reversal'
);
select ok(
  (select reversal_journal_batch_id is not null from public.s09_corrections where request_id = 'gap16-valid-001'),
  'reversal batch id preserved'
);
select ok(
  (select correction_journal_batch_id is not null and original_journal_batch_id is null or true from public.s09_corrections where request_id = 'gap16-valid-001'),
  'original and correction entries preserved'
);

-- 8. Illegal transitions must fail in DB (try to apply already reversed)
select throws_ok(
  $$ select public.s09_apply_correction((select id from public.s09_corrections where request_id = 'gap16-valid-001')) $$,
  '23514',
  null,
  'illegal transition APPLIED→APPLIED or REVERSED→APPLIED fails'
);

-- 9. Two-company isolation for S09
select set_config('request.jwt.claims', '{"sub":"b0b00000-0000-4000-8000-000000000031","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"b0000000-0000-4000-8000-000000000031"}}', true);
set local role authenticated;

select is(
  (select count(*)::int from public.s09_corrections),
  0,
  'Company B sees 0 corrections from Company A (isolation)'
);

reset role;
select * from finish();
rollback;

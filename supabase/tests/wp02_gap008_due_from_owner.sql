-- =============================================================================
-- WP-02 / GAP-008 — Due-from-Owner (1300) lifecycle.
-- Canonical rules: FIN-008, OPS-012.
-- Proves: owner expense -> 1300 (never 6100); cash recovery; lawful settlement
-- offset (Dr 2000 / Cr 1300) only with an enforceable offset right and never
-- forcing 2000 negative; post-payout recovery; compensating reversal; company
-- isolation; idempotency conflict; 1300 subledger <-> GL 1300 reconciliation.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

-- ── Two companies
insert into public.companies (id, name, slug, currency, is_active) values
  ('0a000000-0000-4000-8000-0000000000a1', 'GAP008 Company A', 'gap008-a', 'OMR', true),
  ('0b000000-0000-4000-8000-0000000000b1', 'GAP008 Company B', 'gap008-b', 'OMR', true)
on conflict (id) do update set is_active = true;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
  ('0a000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gap008-a@test.invalid', 'x', now(), now(), now(), '{}', '{}'),
  ('0b000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gap008-b@test.invalid', 'x', now(), now(), now(), '{}', '{}')
on conflict (id) do nothing;

insert into public.users (id, email, name, role, status, is_active) values
  ('0a000000-0000-0000-0000-000000000aa1', 'gap008-a@test.invalid', 'GAP008 A', 'ADMIN', 'ACTIVE', true),
  ('0b000000-0000-0000-0000-000000000bb1', 'gap008-b@test.invalid', 'GAP008 B', 'ADMIN', 'ACTIVE', true)
on conflict (id) do update set role='ADMIN', status='ACTIVE', is_active=true;

insert into public.company_members (company_id, user_id, role) values
  ('0a000000-0000-4000-8000-0000000000a1', '0a000000-0000-0000-0000-000000000aa1', 'ADMIN'),
  ('0b000000-0000-4000-8000-0000000000b1', '0b000000-0000-0000-0000-000000000bb1', 'ADMIN')
on conflict (company_id, user_id) do update set role='ADMIN';

select lives_ok($$ select public.provision_company_chart_of_accounts('0a000000-0000-4000-8000-0000000000a1') $$, 'provision chart A');
select lives_ok($$ select public.provision_company_chart_of_accounts('0b000000-0000-4000-8000-0000000000b1') $$, 'provision chart B');

insert into public.accounting_periods (id, company_id, name, start_date, end_date, status) values
  ('0a100000-0000-4000-8000-0000000000a1', '0a000000-0000-4000-8000-0000000000a1', '2026-08', date '2026-08-01', date '2026-08-31', 'OPEN'),
  ('0b100000-0000-4000-8000-0000000000b1', '0b000000-0000-4000-8000-0000000000b1', '2026-08', date '2026-08-01', date '2026-08-31', 'OPEN')
on conflict (id) do update set status = 'OPEN';

insert into public.owners (id, full_name, company_id, is_active) values
  ('0a200000-0000-4000-8000-0000000000a1', 'GAP008 Owner A', '0a000000-0000-4000-8000-0000000000a1', true),
  ('0b200000-0000-4000-8000-0000000000b1', 'GAP008 Owner B', '0b000000-0000-4000-8000-0000000000b1', true)
on conflict (id) do update set is_active = true;

-- Agreement ownership is an authoritative prerequisite, not a fixture bypass.
insert into public.properties (id, title, type, address, status, company_id) values
  ('0a250000-0000-4000-8000-0000000000a1', 'GAP008 Property A', 'residential', 'Muscat', 'active', '0a000000-0000-4000-8000-0000000000a1')
on conflict (id) do nothing;

insert into public.property_owners (id, property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on, company_id) values
  ('0a260000-0000-4000-8000-0000000000a1', '0a250000-0000-4000-8000-0000000000a1', '0a200000-0000-4000-8000-0000000000a1', 100, true, date '2026-01-01', null, '0a000000-0000-4000-8000-0000000000a1')
on conflict (id) do nothing;

insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, company_id) values
  ('0a300000-0000-4000-8000-0000000000a1', '0a200000-0000-4000-8000-0000000000a1', '0a250000-0000-4000-8000-0000000000a1', 'property_management', 'RATE', 5, date '2026-01-01', date '2027-12-31', '0a000000-0000-4000-8000-0000000000a1')
on conflict (id) do nothing;

-- Version with an enforceable offset right (offset_allowed = true) for Company A.
insert into public.owner_agreement_versions (
  id, owner_agreement_id, company_id, version_no, operating_model, collection_role,
  commission_type, commission_value, commission_recognition_basis, effective_from, offset_allowed
) values (
  '0a310000-0000-4000-8000-0000000000a1', '0a300000-0000-4000-8000-0000000000a1',
  '0a000000-0000-4000-8000-0000000000a1', 1, 'OWNER_AGENCY', 'OWNER_IS_CREDITOR',
  'RATE', 5, 'ON_COLLECTION', date '2026-01-01', true
) on conflict (id) do update set offset_allowed = true;

-- APPROVED owner settlement (payable 200.000) for the lawful-offset test.
insert into public.owner_settlements (
  id, owner_id, company_id, date, period_start, period_end, gross_collected, office_fee,
  owner_expenses, tax_amount, net_payable, amount, status, approved_at, approved_by, request_id
) values (
  '0a400000-0000-4000-8000-0000000000a1', '0a200000-0000-4000-8000-0000000000a1',
  '0a000000-0000-4000-8000-0000000000a1', '2026-08-31', date '2026-08-01', date '2026-08-31',
  200.000, 0, 0, 0, 200.000, 200.000, 'APPROVED', now(), '0a000000-0000-0000-0000-000000000aa1', 'gap008-sett-a'
) on conflict (id) do nothing;

-- PAID owner settlement (already paid out; net_payable 0) for the post-payout test.
insert into public.owner_settlements (
  id, owner_id, company_id, date, period_start, period_end, gross_collected, office_fee,
  owner_expenses, tax_amount, net_payable, amount, status, approved_at, approved_by, paid_at, paid_by, method, request_id
) values (
  '0a400000-0000-4000-8000-0000000000a2', '0a200000-0000-4000-8000-0000000000a1',
  '0a000000-0000-4000-8000-0000000000a1', '2026-08-31', date '2026-08-01', date '2026-08-31',
  100.000, 0, 0, 0, 0, 100.000, 'PAID', now(), '0a000000-0000-0000-0000-000000000aa1',
  now(), '0a000000-0000-0000-0000-000000000aa1', 'bank_transfer', 'gap008-sett-paid'
) on conflict (id) do nothing;

select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000aa1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000a1"}}', true);
set local role authenticated;

-- ── Test 1: owner expense creates a 1300 receivable (never 6100)
select lives_ok(
  $$ select public.create_owner_receivable_atomic(jsonb_build_object(
       'owner_id', '0a200000-0000-4000-8000-0000000000a1',
       'owner_agreement_id', '0a300000-0000-4000-8000-0000000000a1',
       'amount', 100.000, 'cash_account_no', '1120', 'effective_date', '2026-08-10',
       'request_id', 'gap008-create-1') ) $$,
  '1. owner expense creates Due-from-Owner receivable'
);
select is(
  (select amount from public.due_from_owners where request_id = 'gap008-create-1'),
  100.000::numeric, '1b. receivable amount is 100.000'
);
select is(
  (select outstanding from public.due_from_owners where request_id = 'gap008-create-1'),
  100.000::numeric, '1c. outstanding is 100.000'
);
select ok(
  (select lawful_offset_right from public.due_from_owners where request_id = 'gap008-create-1'),
  '1d. receivable carries the agreement offset right'
);

-- ── Test 2: the GL line is 1300, never 6100
select is(
  (select a.no from public.journal_lines l join public.journal_batches b on b.id = l.batch_id
     join public.accounts a on a.id = l.account_id
   where b.source_type = 'pm_owner_expense' and b.company_id = '0a000000-0000-4000-8000-0000000000a1'
   order by l.debit desc limit 1),
  '1300', '2. owner expense posts to 1300 (not 6100)'
);
select ok(
  not exists (select 1 from public.journal_lines l join public.journal_batches b on b.id = l.batch_id
    join public.accounts a on a.id = l.account_id
    where b.company_id = '0a000000-0000-4000-8000-0000000000a1' and a.no = '6100'
      and b.source_type = 'pm_owner_expense'),
  '2b. no 6100 posting for owner expense'
);

-- ── Test 3: cash recovery reduces outstanding and credits 1300
select lives_ok(
  $$ select public.recover_owner_receivable_atomic(jsonb_build_object(
       'due_from_owner_id', (select id::text from public.due_from_owners where request_id = 'gap008-create-1'),
       'amount', 40.000, 'cash_account_no', '1120', 'effective_date', '2026-08-15',
       'request_id', 'gap008-recover-1') ) $$,
  '3. cash recovery of 40.000'
);
select is(
  (select outstanding from public.due_from_owners where request_id = 'gap008-create-1'),
  60.000::numeric, '3b. outstanding reduced to 60.000'
);

-- ── Test 4: lawful settlement offset (Dr 2000 / Cr 1300), reduces payable
select lives_ok(
  $$ select public.offset_owner_receivable_atomic(jsonb_build_object(
       'due_from_owner_id', (select id::text from public.due_from_owners where request_id = 'gap008-create-1'),
       'owner_settlement_id', '0a400000-0000-4000-8000-0000000000a1',
       'amount', 60.000, 'effective_date', '2026-08-20',
       'lawful_offset_evidence', 'Enforceable offset per agreement version 1, settlement netting.',
       'request_id', 'gap008-offset-1') ) $$,
  '4. lawful offset of 60.000 against APPROVED settlement'
);
select is(
  (select outstanding from public.due_from_owners where request_id = 'gap008-create-1'),
  0.000::numeric, '4b. receivable fully cleared (outstanding 0)'
);
select is(
  (select offset_applied from public.owner_settlements where id = '0a400000-0000-4000-8000-0000000000a1'),
  60.000::numeric, '4c. settlement offset_applied increased 0 -> 60 (effective payable 200 -> 140; 2000 never forced negative)'
);
select is(
  (select net_payable from public.owner_settlements where id = '0a400000-0000-4000-8000-0000000000a1'),
  200.000::numeric, '4d. server-derived net_payable preserved (immutable)'
);

-- ── Test 5: 1300 subledger reconciles to GL 1300 (GAP-008 fix)
select results_eq(
  $$ select is_reconciled from public.gl_reconcile_subledgers('0a000000-0000-4000-8000-0000000000a1', date '2026-08-31') where account_no = '1300' $$,
  $$ values (true) $$,
  '5. Due-from-Owner (1300) subledger reconciles to GL 1300'
);

-- ── Test 6: no-offset-right receivable cannot be offset (fail closed)
select lives_ok(
  $$ select public.create_owner_receivable_atomic(jsonb_build_object(
       'owner_id', '0a200000-0000-4000-8000-0000000000a1',
       'amount', 50.000, 'cash_account_no', '1120', 'effective_date', '2026-08-10',
       'request_id', 'gap008-create-no-right') ) $$,
  '6. receivable without agreement offset right is created'
);
select throws_ok(
  $$ select public.offset_owner_receivable_atomic(jsonb_build_object(
       'due_from_owner_id', (select id::text from public.due_from_owners where request_id = 'gap008-create-no-right'),
       'owner_settlement_id', '0a400000-0000-4000-8000-0000000000a1',
       'amount', 50.000, 'effective_date', '2026-08-20',
       'lawful_offset_evidence', 'no right', 'request_id', 'gap008-offset-no-right') ) $$,
  '23514', null, '6b. offset without enforceable right is rejected'
);

-- ── Test 7: post-payout refund — offset refused (settlement PAID), cash recovery used
select lives_ok(
  $$ select public.create_owner_receivable_atomic(jsonb_build_object(
       'owner_id', '0a200000-0000-4000-8000-0000000000a1',
       'owner_agreement_id', '0a300000-0000-4000-8000-0000000000a1',
       'amount', 30.000, 'cash_account_no', '1120', 'effective_date', '2026-08-10',
       'request_id', 'gap008-create-postpay') ) $$,
  '7. post-payout receivable created'
);
select throws_ok(
  $$ select public.offset_owner_receivable_atomic(jsonb_build_object(
       'due_from_owner_id', (select id::text from public.due_from_owners where request_id = 'gap008-create-postpay'),
       'owner_settlement_id', '0a400000-0000-4000-8000-0000000000a2',
       'amount', 30.000, 'effective_date', '2026-08-20',
       'lawful_offset_evidence', 'paid settlement offset attempt', 'request_id', 'gap008-offset-postpay') ) $$,
  '22023', null, '7b. offset against already-PAID settlement is refused (no negative 2000)'
);
select lives_ok(
  $$ select public.recover_owner_receivable_atomic(jsonb_build_object(
       'due_from_owner_id', (select id::text from public.due_from_owners where request_id = 'gap008-create-postpay'),
       'amount', 30.000, 'cash_account_no', '1120', 'effective_date', '2026-08-25',
       'request_id', 'gap008-recover-postpay') ) $$,
  '7c. recovery (cash) used instead after payout'
);
select is(
  (select net_payable from public.owner_settlements where id = '0a400000-0000-4000-8000-0000000000a2'),
  0.000::numeric, '7d. paid settlement payable stays 0 (2000 never forced negative)'
);

-- ── Test 8: compensating reversal of recovery restores outstanding
select lives_ok(
  $$ select public.reverse_owner_receivable_recovery_atomic(jsonb_build_object(
       'recovery_event_id', (select id::text from public.due_from_owner_recoveries where request_id = 'gap008-recover-1'),
       'reason', 'Correction of erroneous recovery.', 'request_id', 'gap008-rev-recover-1') ) $$,
  '8. reverse the 40.000 recovery'
);
select is(
  (select outstanding from public.due_from_owners where request_id = 'gap008-create-1'),
  60.000::numeric, '8b. outstanding restored to 60.000 after reversal'
);

-- ── Test 9: idempotency conflict — same request_id, different payload
select throws_ok(
  $$ select public.create_owner_receivable_atomic(jsonb_build_object(
       'owner_id', '0a200000-0000-4000-8000-0000000000a1',
       'amount', 999.000, 'cash_account_no', '1120', 'effective_date', '2026-08-10',
       'request_id', 'gap008-create-1') ) $$,
  '22023', null, '9. reused request_id with different amount fails closed'
);

-- ── Test 10: company isolation — Company B actor cannot touch Company A receivable
select set_config('request.jwt.claims', '{"sub":"0b000000-0000-0000-0000-000000000bb1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0b000000-0000-4000-8000-0000000000b1"}}', true);
select throws_ok(
  $$ select public.recover_owner_receivable_atomic(jsonb_build_object(
       'due_from_owner_id', (select id::text from public.due_from_owners where request_id = 'gap008-create-1'),
       'amount', 5.000, 'cash_account_no', '1120', 'effective_date', '2026-08-15',
       'request_id', 'gap008-cross-co') ) $$,
  '42501', null, '10. cross-company recovery is denied'
);

reset role;
select * from finish();
rollback;

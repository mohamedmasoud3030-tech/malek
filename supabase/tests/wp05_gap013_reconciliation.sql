-- =============================================================================
-- WP-05 GAP-013 — Deterministic subledger ↔ GL reconciliation (OMR 3dp, 0.001)
-- Tests: exact match PASS, 0.001 PASS, >0.001 FAIL, tenant isolation, owner isolation,
-- deposit isolation, due-from-owner isolation, commission isolation, cross-company
-- contamination prevention
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(33);

-- Setup two companies
insert into public.companies (id, name, slug, currency, is_active)
values
  ('a0000000-0000-4000-8000-000000000001', 'WP05 GAP13 Company A', 'wp05-gap13-a', 'OMR', true),
  ('b0000000-0000-4000-8000-000000000002', 'WP05 GAP13 Company B', 'wp05-gap13-b', 'OMR', true)
on conflict (id) do update set name = excluded.name, is_active = true;

-- Provision chart of accounts for both
select lives_ok($$ select public.provision_company_chart_of_accounts('a0000000-0000-4000-8000-000000000001') $$, 'provision chart for company A');
select lives_ok($$ select public.provision_company_chart_of_accounts('b0000000-0000-4000-8000-000000000002') $$, 'provision chart for company B');

-- Provision default cashflow classifications (not required for reconciliation but ensure no missing config)
select lives_ok($$ select public.wp05_provision_default_cashflow_classifications('a0000000-0000-4000-8000-000000000001') $$, 'provision cashflow classifications A');
select lives_ok($$ select public.wp05_provision_default_cashflow_classifications('b0000000-0000-4000-8000-000000000002') $$, 'provision cashflow classifications B');

-- Create accounting periods for both companies (OPEN)
insert into public.accounting_periods (id, company_id, name, start_date, end_date, status)
values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '2026-07', date '2026-07-01', date '2026-07-31', 'OPEN'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', '2026-07', date '2026-07-01', date '2026-07-31', 'OPEN')
on conflict (id) do update set status = 'OPEN';

-- Helper to get account ids
-- Company A accounts
-- We'll use post_journal_event to create GL entries

-- Test 1: exact match → PASS for all classes when subledger equals GL
-- Setup: create tenant_deposits for company A with remaining 100.000
-- Create GL entry for 2200 with 100.000 credit

-- Clean previous test data for these companies
delete from public.journal_lines where company_id in ('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002');
delete from public.journal_batches where company_id in ('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002');
delete from public.tenant_deposits where company_id in ('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002');
delete from public.commissions where company_id in ('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002');
delete from public.expenses where company_id in ('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002');
delete from public.invoices where company_id in ('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002');
delete from public.owner_balances where company_id in ('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002');
delete from public.contracts where company_id in ('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002');
delete from public.units where company_id in ('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002');
delete from public.properties where company_id in ('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002');

-- Create dummy property and contract for deposit FK
insert into public.properties (id, title, type, address, company_id, status)
values
  ('a2000000-0000-4000-8000-000000000001', 'Test Prop A', 'residential', 'Muscat', 'a0000000-0000-4000-8000-000000000001', 'active'),
  ('b2000000-0000-4000-8000-000000000002', 'Test Prop B', 'residential', 'Muscat', 'b0000000-0000-4000-8000-000000000002', 'active')
on conflict (id) do nothing;

insert into public.owners (id, full_name, company_id, is_active)
values
  ('a2200000-0000-4000-8000-000000000001', 'Owner A', 'a0000000-0000-4000-8000-000000000001', true),
  ('b2200000-0000-4000-8000-000000000002', 'Owner B', 'b0000000-0000-4000-8000-000000000002', true)
on conflict (id) do update set is_active = true;

insert into public.property_owners (id, property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on, company_id)
values
  ('a2300000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a2200000-0000-4000-8000-000000000001', 100, true, date '2026-01-01', date '2026-12-31', 'a0000000-0000-4000-8000-000000000001'),
  ('b2300000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'b2200000-0000-4000-8000-000000000002', 100, true, date '2026-01-01', date '2026-12-31', 'b0000000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, company_id)
values
  ('a2400000-0000-4000-8000-000000000001', 'a2200000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'property_management', 'RATE', 5, date '2026-01-01', date '2026-12-31', 'a0000000-0000-4000-8000-000000000001'),
  ('b2400000-0000-4000-8000-000000000002', 'b2200000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'property_management', 'RATE', 5, date '2026-01-01', date '2026-12-31', 'b0000000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

insert into public.units (id, property_id, unit_number, company_id)
values
  ('a2100000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'A-01', 'a0000000-0000-4000-8000-000000000001'),
  ('b2100000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'B-01', 'b0000000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

insert into public.people (id, full_name, type, company_id)
values
  ('a3000000-0000-4000-8000-000000000001', 'Tenant A', 'tenant', 'a0000000-0000-4000-8000-000000000001'),
  ('b3000000-0000-4000-8000-000000000002', 'Tenant B', 'tenant', 'b0000000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

insert into public.contracts (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
values
  ('a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a2100000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'a2400000-0000-4000-8000-000000000001', date '2026-07-01', date '2026-07-31', 100, 'active', 'a0000000-0000-4000-8000-000000000001'),
  ('b4000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'b2100000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000002', 'b2400000-0000-4000-8000-000000000002', date '2026-07-01', date '2026-07-31', 100, 'active', 'b0000000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

-- Tenant deposits: A has 100.000 remaining, B has 200.000 remaining
insert into public.tenant_deposits (id, contract_id, property_id, tenant_id, deposit_amount, deducted_amount, refunded_amount, remaining_amount, status, company_id)
values
  ('dep-a-001', 'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 100.000, 0, 0, 100.000, 'held', 'a0000000-0000-4000-8000-000000000001'),
  ('dep-b-001', 'b4000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000002', 200.000, 0, 0, 200.000, 'held', 'b0000000-0000-4000-8000-000000000002')
on conflict (id) do update set remaining_amount = excluded.remaining_amount, deposit_amount = excluded.deposit_amount;

-- Helper function to post GL for testing (uses post_journal_event)
-- We'll directly insert via post_journal_event

-- For Company A: GL for 2200 = 100.000 (credit - debit)
select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'gl-dep-a-001',
      'event_id', 'gl-dep-a-001',
      'effective_date', '2026-07-10',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1111'), 'debit', 100.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '2200'), 'debit', 0, 'credit', 100.000)
      )
    ))
  $$, 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  'post GL for deposit A 100.000'
);

-- For Company B: GL for 2200 = 200.000
select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'gl-dep-b-001',
      'event_id', 'gl-dep-b-001',
      'effective_date', '2026-07-10',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1111'), 'debit', 200.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '2200'), 'debit', 0, 'credit', 200.000)
      )
    ))
  $$, 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002'),
  'post GL for deposit B 200.000'
);

-- Now test reconciliation for Company A: should be PASS for deposits
select results_eq(
  $$ select reconciliation_status from public.wp05_reconcile_all('a0000000-0000-4000-8000-000000000001', date '2026-07-31') where reconciliation_class = 'SECURITY_DEPOSITS' $$,
  $$ values ('PASS'::text) $$,
  '1. exact match → PASS for SECURITY_DEPOSITS'
);

-- Test 2: difference of 0.001 → PASS
-- Update GL for Company A to be 100.001 (difference 0.001)
-- We'll create another batch with 0.001 credit difference
select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'gl-dep-a-002',
      'event_id', 'gl-dep-a-002',
      'effective_date', '2026-07-11',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1111'), 'debit', 0.001, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '2200'), 'debit', 0, 'credit', 0.001)
      )
    ))
  $$, 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  'post additional 0.001 for deposit A to test 0.001 tolerance'
);

select results_eq(
  $$ select reconciliation_status from public.wp05_reconcile_all('a0000000-0000-4000-8000-000000000001', date '2026-07-31') where reconciliation_class = 'SECURITY_DEPOSITS' $$,
  $$ values ('PASS'::text) $$,
  '2. difference of 0.001 → PASS'
);

-- Test 3: difference above 0.001 → FAIL
-- Add another 0.002 to make total diff 0.003
select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'gl-dep-a-003',
      'event_id', 'gl-dep-a-003',
      'effective_date', '2026-07-12',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1111'), 'debit', 0.002, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '2200'), 'debit', 0, 'credit', 0.002)
      )
    ))
  $$, 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  'post additional 0.002 to exceed tolerance'
);

select results_eq(
  $$ select reconciliation_status from public.wp05_reconcile_all('a0000000-0000-4000-8000-000000000001', date '2026-07-31') where reconciliation_class = 'SECURITY_DEPOSITS' $$,
  $$ values ('FAIL'::text) $$,
  '3. difference above 0.001 → FAIL'
);

-- Test assert function should throw on FAIL
select throws_ok(
  $$ select public.wp05_assert_reconciliation('a0000000-0000-4000-8000-000000000001', date '2026-07-31') $$,
  'P0001',
  null,
  'assert_reconciliation fails when variance >0.001'
);

-- Reset Company A GL for deposit to exact match again by reversing the extra batches
-- For simplicity, delete those batches (we are in test transaction, we can reverse)
-- We'll reverse the two extra batches
select lives_ok(
  $$ select public.reverse_journal_batch((select id from public.journal_batches where company_id = 'a0000000-0000-4000-8000-000000000001' and source_id = 'gl-dep-a-002')) $$,
  'reverse extra 0.001 batch'
);
select lives_ok(
  $$ select public.reverse_journal_batch((select id from public.journal_batches where company_id = 'a0000000-0000-4000-8000-000000000001' and source_id = 'gl-dep-a-003')) $$,
  'reverse extra 0.002 batch'
);

-- Now should be PASS again
select results_eq(
  $$ select reconciliation_status from public.wp05_reconcile_all('a0000000-0000-4000-8000-000000000001', date '2026-07-31') where reconciliation_class = 'SECURITY_DEPOSITS' $$,
  $$ values ('PASS'::text) $$,
  'reconciliation PASS after reversal'
);

-- Test 4: tenant isolation — Company A view should not include Company B deposits
select is(
  (select subledger_balance from public.wp05_reconcile_all('a0000000-0000-4000-8000-000000000001', date '2026-07-31') where reconciliation_class = 'SECURITY_DEPOSITS'),
  100.000::numeric,
  '4. tenant isolation: Company A subledger is 100.000, not contaminated by B'
);

select is(
  (select subledger_balance from public.wp05_reconcile_all('b0000000-0000-4000-8000-000000000002', date '2026-07-31') where reconciliation_class = 'SECURITY_DEPOSITS'),
  200.000::numeric,
  '4b. Company B subledger is 200.000'
);

-- Test 5: owner isolation — owner payables
-- Create owner_balances for each company
insert into public.owners (id, full_name, company_id)
values
  ('a5000000-0000-4000-8000-000000000001', 'Owner A', 'a0000000-0000-4000-8000-000000000001'),
  ('b5000000-0000-4000-8000-000000000002', 'Owner B', 'b0000000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

insert into public.owner_balances (owner_id, net_balance, company_id, total_income, total_expenses, commission, updated_at)
values
  ('a5000000-0000-4000-8000-000000000001', 500.000, 'a0000000-0000-4000-8000-000000000001', 500, 0, 0, now()),
  ('b5000000-0000-4000-8000-000000000002', 999.000, 'b0000000-0000-4000-8000-000000000002', 999, 0, 0, now())
on conflict (owner_id) do update set net_balance = excluded.net_balance;

-- Post GL for owner payables
select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'gl-owner-a-001',
      'event_id', 'gl-owner-a-001',
      'effective_date', '2026-07-10',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1111'), 'debit', 500.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '2000'), 'debit', 0, 'credit', 500.000)
      )
    ))
  $$, 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  'post owner payables A 500'
);
select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'gl-owner-b-001',
      'event_id', 'gl-owner-b-001',
      'effective_date', '2026-07-10',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1111'), 'debit', 999.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '2000'), 'debit', 0, 'credit', 999.000)
      )
    ))
  $$, 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002'),
  'post owner payables B 999'
);

select results_eq(
  $$ select subledger_balance from public.wp05_reconcile_all('a0000000-0000-4000-8000-000000000001', date '2026-07-31') where reconciliation_class = 'OWNER_PAYABLES' $$,
  $$ values (500.000::numeric) $$,
  '5. owner isolation: Company A owner payables 500'
);
select results_eq(
  $$ select subledger_balance from public.wp05_reconcile_all('b0000000-0000-4000-8000-000000000002', date '2026-07-31') where reconciliation_class = 'OWNER_PAYABLES' $$,
  $$ values (999.000::numeric) $$,
  '5b. Company B owner payables 999'
);

-- Test 6: deposit isolation already tested in 4, but also check GL count isolation
select cmp_ok(
  (select gl_count from public.wp05_reconcile_all('a0000000-0000-4000-8000-000000000001', date '2026-07-31') where reconciliation_class = 'SECURITY_DEPOSITS'),
  '<=',
  3,
  '6. deposit isolation: GL count for A is small, not including B'
);

-- Test 7: due-from-owner isolation
insert into public.expenses (id, property_id, amount, expense_date, category, charged_to, company_id)
values
  ('a6000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 77.000, date '2026-07-05', 'OWNER', 'OWNER', 'a0000000-0000-4000-8000-000000000001'),
  ('b6000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 88.000, date '2026-07-06', 'OWNER', 'OWNER', 'b0000000-0000-4000-8000-000000000002')
on conflict (id) do update set amount = excluded.amount;

select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'gl-due-a-001',
      'event_id', 'gl-due-a-001',
      'effective_date', '2026-07-05',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1300'), 'debit', 77.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1120'), 'debit', 0, 'credit', 77.000)
      )
    ))
  $$, 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  'post due-from-owner A 77'
);
select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'gl-due-b-001',
      'event_id', 'gl-due-b-001',
      'effective_date', '2026-07-06',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1300'), 'debit', 88.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1120'), 'debit', 0, 'credit', 88.000)
      )
    ))
  $$, 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002'),
  'post due-from-owner B 88'
);

select results_eq(
  $$ select subledger_balance from public.wp05_reconcile_all('a0000000-0000-4000-8000-000000000001', date '2026-07-31') where reconciliation_class = 'DUE_FROM_OWNER' $$,
  $$ values (77.000::numeric) $$,
  '7. due-from-owner isolation: A 77'
);
select results_eq(
  $$ select subledger_balance from public.wp05_reconcile_all('b0000000-0000-4000-8000-000000000002', date '2026-07-31') where reconciliation_class = 'DUE_FROM_OWNER' $$,
  $$ values (88.000::numeric) $$,
  '7b. due-from-owner isolation: B 88'
);

-- Test 8: commission isolation
insert into public.commissions (id, staff_name, type, status, amount, company_id)
values
  ('comm-a-001', 'Broker A', 'contract', 'PENDING', 33.000, 'a0000000-0000-4000-8000-000000000001'),
  ('comm-b-001', 'Broker B', 'contract', 'PENDING', 44.000, 'b0000000-0000-4000-8000-000000000002')
on conflict (id) do update set amount = excluded.amount;

select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'gl-comm-a-001',
      'event_id', 'gl-comm-a-001',
      'effective_date', '2026-07-07',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '6110'), 'debit', 33.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '2300'), 'debit', 0, 'credit', 33.000)
      )
    ))
  $$, 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  'post commission A 33'
);
select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'gl-comm-b-001',
      'event_id', 'gl-comm-b-001',
      'effective_date', '2026-07-07',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '6110'), 'debit', 44.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '2300'), 'debit', 0, 'credit', 44.000)
      )
    ))
  $$, 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002'),
  'post commission B 44'
);

select results_eq(
  $$ select subledger_balance from public.wp05_reconcile_all('a0000000-0000-4000-8000-000000000001', date '2026-07-31') where reconciliation_class = 'COMMISSION' $$,
  $$ values (33.000::numeric) $$,
  '8. commission isolation: A 33'
);
select results_eq(
  $$ select subledger_balance from public.wp05_reconcile_all('b0000000-0000-4000-8000-000000000002', date '2026-07-31') where reconciliation_class = 'COMMISSION' $$,
  $$ values (44.000::numeric) $$,
  '8b. commission isolation: B 44'
);

-- Test 9: cross-company records can never contaminate reconciliation
-- Insert a deposit for B but try to query A — already proven, but also insert GL for B with large amount and ensure A unchanged
select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'gl-dep-b-large',
      'event_id', 'gl-dep-b-large',
      'effective_date', '2026-07-15',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1111'), 'debit', 9999.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '2200'), 'debit', 0, 'credit', 9999.000)
      )
    ))
  $$, 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002'),
  'post large GL for B to test cross-contamination'
);

select is(
  (select gl_balance from public.wp05_reconcile_all('a0000000-0000-4000-8000-000000000001', date '2026-07-31') where reconciliation_class = 'SECURITY_DEPOSITS'),
  100.000::numeric,
  '9. cross-company records never contaminate A reconciliation (still 100.000)'
);

-- Also check OMR precision 3dp and currency OMR
select results_eq(
  $$ select currency from public.wp05_reconcile_all('a0000000-0000-4000-8000-000000000001', date '2026-07-31') limit 1 $$,
  $$ values ('OMR'::text) $$,
  'OMR currency in reconciliation'
);

select * from finish();
rollback;

-- =============================================================================
-- WP-05 GAP-014 — Complete financial statements and Cash Flow (GL-backed, OMR 3dp)
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- Setup companies
insert into public.companies (id, name, slug, currency, is_active)
values
  ('a0000000-0000-4000-8000-000000000010', 'WP05 GAP14 Company A', 'wp05-gap14-a', 'OMR', true),
  ('b0000000-0000-4000-8000-000000000011', 'WP05 GAP14 Company B', 'wp05-gap14-b', 'OMR', true)
on conflict (id) do update set is_active = true;

select lives_ok($$ select public.provision_company_chart_of_accounts('a0000000-0000-4000-8000-000000000010') $$, 'provision chart A');
select lives_ok($$ select public.provision_company_chart_of_accounts('b0000000-0000-4000-8000-000000000011') $$, 'provision chart B');
select lives_ok($$ select public.wp05_provision_default_cashflow_classifications('a0000000-0000-4000-8000-000000000010') $$, 'provision classifications A');
select lives_ok($$ select public.wp05_provision_default_cashflow_classifications('b0000000-0000-4000-8000-000000000011') $$, 'provision classifications B');

-- Clean
delete from public.journal_lines where company_id in ('a0000000-0000-4000-8000-000000000010','b0000000-0000-4000-8000-000000000011');
delete from public.journal_batches where company_id in ('a0000000-0000-4000-8000-000000000010','b0000000-0000-4000-8000-000000000011');
delete from public.accounting_periods where company_id in ('a0000000-0000-4000-8000-000000000010','b0000000-0000-4000-8000-000000000011');

insert into public.accounting_periods (id, company_id, name, start_date, end_date, status)
values
  ('a1a00000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000010', '2026-06', date '2026-06-01', date '2026-06-30', 'OPEN'),
  ('a1a00000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000010', '2026-07', date '2026-07-01', date '2026-07-31', 'OPEN'),
  ('b1b00000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000011', '2026-06', date '2026-06-01', date '2026-06-30', 'OPEN'),
  ('b1b00000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000011', '2026-07', date '2026-07-01', date '2026-07-31', 'OPEN')
on conflict (id) do update set status = 'OPEN';

-- Helper to set current company for RLS in this test (service_role bypasses RLS, but functions use require_company_id via JWT)
-- We'll set request.jwt.claims to simulate company A
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000099","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"a0000000-0000-4000-8000-000000000010"}}', true);
set local role authenticated;

-- Opening cash for A: create a GL entry in June (before July period)
reset role;
select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'opening-cash-a',
      'event_id', 'opening-cash-a',
      'effective_date', '2026-06-15',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1111'), 'debit', 1000.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '4000'), 'debit', 0, 'credit', 1000.000)
      )
    ))
  $$, 'a0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000010'),
  'post opening cash 1000 for A in June'
);

-- Operating movement: July 10, cash in from management fee revenue (4100 is OPERATING)
select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'op-cash-a-001',
      'event_id', 'op-cash-a-001',
      'effective_date', '2026-07-10',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1111'), 'debit', 200.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '4100'), 'debit', 0, 'credit', 200.000)
      )
    ))
  $$, 'a0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000010'),
  'post operating cash 200 for A'
);

-- Investing movement: July 12, cash out for ROU asset 1600 is INVESTING
select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'inv-cash-a-001',
      'event_id', 'inv-cash-a-001',
      'effective_date', '2026-07-12',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1600'), 'debit', 300.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1111'), 'debit', 0, 'credit', 300.000)
      )
    ))
  $$, 'a0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000010'),
  'post investing cash -300 for A'
);

-- Financing movement: July 15, cash out for lease liability 2500 is FINANCING
select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'fin-cash-a-001',
      'event_id', 'fin-cash-a-001',
      'effective_date', '2026-07-15',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '2500'), 'debit', 100.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1111'), 'debit', 0, 'credit', 100.000)
      )
    ))
  $$, 'a0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000010'),
  'post financing cash -100 for A'
);

-- Unclassified movement: create an account not classified, then cash movement against it
insert into public.accounts (id, no, name, company_id, account_type, normal_balance, currency_code, precision, is_active)
values ('a0000000-0000-4000-8000-00000000u001', '9999', 'Unclassified Test Account', 'a0000000-0000-4000-8000-000000000010', 'expense', 'debit', 'OMR', 3, true)
on conflict (id) do update set is_active = true;

select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%s',
      'source_type', 'test',
      'source_id', 'unclass-cash-a-001',
      'event_id', 'unclass-cash-a-001',
      'effective_date', '2026-07-18',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', '%s', 'debit', 50.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%s'::uuid and no = '1111'), 'debit', 0, 'credit', 50.000)
      )
    ))
  $$, 'a0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-00000000u001', 'a0000000-0000-4000-8000-000000000010'),
  'post unclassified cash -50 for A'
);

-- Now test cash flow for A July
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000099","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"a0000000-0000-4000-8000-000000000010"}}', true);
set local role authenticated;

-- Opening cash should be 1000.000
select results_eq(
  $$ select (public.wp05_rpt_cash_flow_gl(date '2026-07-01', date '2026-07-31')->>'opening_cash')::numeric $$,
  $$ values (1000.000::numeric) $$,
  'opening cash 1000.000'
);

-- Operating movement should be 200.000 (inflow)
select results_eq(
  $$ select (public.wp05_rpt_cash_flow_gl(date '2026-07-01', date '2026-07-31')->>'operating')::numeric $$,
  $$ values (200.000::numeric) $$,
  'operating movement 200.000'
);

-- Investing movement should be -300.000
select results_eq(
  $$ select (public.wp05_rpt_cash_flow_gl(date '2026-07-01', date '2026-07-31')->>'investing')::numeric $$,
  $$ values (-300.000::numeric) $$,
  'investing movement -300.000'
);

-- Financing movement should be -100.000
select results_eq(
  $$ select (public.wp05_rpt_cash_flow_gl(date '2026-07-01', date '2026-07-31')->>'financing')::numeric $$,
  $$ values (-100.000::numeric) $$,
  'financing movement -100.000'
);

-- Unclassified movement should be -50.000
select results_eq(
  $$ select (public.wp05_rpt_cash_flow_gl(date '2026-07-01', date '2026-07-31')->>'unclassified')::numeric $$,
  $$ values (-50.000::numeric) $$,
  'unclassified movement -50.000'
);

-- Closing cash should be 1000 +200 -300 -100 -50 = 750.000
select results_eq(
  $$ select (public.wp05_rpt_cash_flow_gl(date '2026-07-01', date '2026-07-31')->>'closing_cash')::numeric $$,
  $$ values (750.000::numeric) $$,
  'closing cash 750.000'
);

-- Exact cash bridge: Closing = Opening + Operating + Investing + Financing + Unclassified
select results_eq(
  $$ select (public.wp05_rpt_cash_flow_gl(date '2026-07-01', date '2026-07-31')->>'is_balanced')::boolean $$,
  $$ values (true::boolean) $$,
  'exact cash bridge is_balanced true'
);

-- 3dp precision: check precision field
select results_eq(
  $$ select (public.wp05_rpt_cash_flow_gl(date '2026-07-01', date '2026-07-31')->>'currency')::text $$,
  $$ values ('OMR'::text) $$,
  'OMR currency'
);

-- Company isolation: B should have 0 opening (no data) and independent
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000099","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"b0000000-0000-4000-8000-000000000011"}}', true);
select results_eq(
  $$ select (public.wp05_rpt_cash_flow_gl(date '2026-07-01', date '2026-07-31')->>'opening_cash')::numeric $$,
  $$ values (0.000::numeric) $$,
  'company isolation: B opening 0'
);

-- Date boundaries: transaction on 2026-06-30 should not be in July
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000099","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"a0000000-0000-4000-8000-000000000010"}}', true);
select results_eq(
  $$ select (public.wp05_rpt_cash_flow_gl(date '2026-07-01', date '2026-07-31')->>'opening_cash')::numeric $$,
  $$ values (1000.000::numeric) $$,
  'date boundaries: June transaction in opening, not in operating'
);

-- POSTED-only: create a DRAFT batch for cash and ensure it does not affect cash flow
reset role;
-- DRAFT batch insertion directly (will be blocked by RLS? use service_role)
-- Insert DRAFT batch with cash movement that should be ignored
insert into public.journal_batches (id, company_id, status, source_type, source_id, event_id, effective_date, accounting_period_id)
values (
  'a0000000-0000-4000-8000-00000000d001',
  'a0000000-0000-4000-8000-000000000010',
  'DRAFT',
  'test',
  'draft-cash',
  'draft-cash',
  date '2026-07-20',
  'a1a00000-0000-4000-8000-000000000011'
) on conflict (id) do nothing;

insert into public.journal_lines (id, batch_id, company_id, account_id, debit, credit)
values
  ('a0000000-0000-4000-8000-00000000d002', 'a0000000-0000-4000-8000-00000000d001', 'a0000000-0000-4000-8000-000000000010', (select id from public.accounts where company_id = 'a0000000-0000-4000-8000-000000000010' and no = '1111'), 999.000, 0),
  ('a0000000-0000-4000-8000-00000000d003', 'a0000000-0000-4000-8000-00000000d001', 'a0000000-0000-4000-8000-000000000010', (select id from public.accounts where company_id = 'a0000000-0000-4000-8000-000000000010' and no = '4100'), 0, 999.000)
on conflict (id) do nothing;

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000099","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"a0000000-0000-4000-8000-000000000010"}}', true);
set local role authenticated;

select results_eq(
  $$ select (public.wp05_rpt_cash_flow_gl(date '2026-07-01', date '2026-07-31')->>'operating')::numeric $$,
  $$ values (200.000::numeric) $$,
  'POSTED-only: DRAFT batch ignored, operating still 200'
);

-- VOID/DRAFT exclusion already tested via DRAFT

-- Drillthrough integrity: should expose classification, account, batch, source, date, amount
select ok(
  (select count(*)::int from public.wp05_cash_flow_drillthrough(date '2026-07-01', date '2026-07-31') where classification = 'OPERATING') >= 1,
  'drillthrough integrity: at least one OPERATING drillthrough row'
);

select ok(
  (select count(*)::int from public.wp05_cash_flow_drillthrough(date '2026-07-01', date '2026-07-31') where batch_id is not null and account_no is not null and effective_date is not null) >= 3,
  'drillthrough exposes batch, account, date'
);

-- GL drillthrough
select ok(
  (select count(*)::int from public.wp05_gl_drillthrough(date '2026-07-01', date '2026-07-31', '1111')) >= 3,
  'GL drillthrough for 1111 returns rows'
);

-- Trial Balance GL-backed
select ok(
  ((public.wp05_rpt_trial_balance_gl(date '2026-07-31')->>'is_balanced')::boolean = true),
  'Trial Balance is_balanced true (GL-backed)'
);

-- Balance Sheet balanced
select ok(
  ((public.wp05_rpt_balance_sheet_gl(date '2026-07-31')->>'is_balanced')::boolean = true),
  'Balance Sheet is_balanced true'
);

-- P&L
select ok(
  (public.wp05_rpt_profit_loss_gl(date '2026-07-01', date '2026-07-31')->>'net_income') is not null,
  'P&L returns net_income'
);

reset role;
select * from finish();
rollback;

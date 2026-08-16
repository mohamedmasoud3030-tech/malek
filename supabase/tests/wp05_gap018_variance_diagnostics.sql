-- =============================================================================
-- WP-05 GAP-018 — Variance diagnostics, reason codes and pending-approval
-- correction proposals.
--
-- Proves, on a real PostgreSQL instance:
--   * each of the three reported variance shapes gets the correct reason code
--   * proposals are created PENDING_APPROVAL and are idempotent
--   * maker≠checker is enforced, roles are enforced, rejection needs a reason
--   * proposals are append-only and immutable in their evidence fields
--   * company isolation holds for diagnostics, generation and listing
--   * NOTHING in this lane posts to the general ledger
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(44);

-- ---------------------------------------------------------------------------
-- Fixture — two companies, two users each (maker + checker)
-- ---------------------------------------------------------------------------
insert into public.companies (id, name, slug, currency, is_active)
values
  ('a0000000-0000-4000-8000-000000000180', 'WP05 GAP18 Company A', 'wp05-gap18-a', 'OMR', true),
  ('b0000000-0000-4000-8000-000000000181', 'WP05 GAP18 Company B', 'wp05-gap18-b', 'OMR', true)
on conflict (id) do update set name = excluded.name, is_active = true;

select lives_ok($$ select public.provision_company_chart_of_accounts('a0000000-0000-4000-8000-000000000180') $$, 'provision chart of accounts A');
select lives_ok($$ select public.provision_company_chart_of_accounts('b0000000-0000-4000-8000-000000000181') $$, 'provision chart of accounts B');

insert into public.accounting_periods (id, company_id, name, start_date, end_date, status)
values
  ('a1000000-0000-4000-8000-000000000180', 'a0000000-0000-4000-8000-000000000180', '2026-07', date '2026-07-01', date '2026-07-31', 'OPEN'),
  ('b1000000-0000-4000-8000-000000000181', 'b0000000-0000-4000-8000-000000000181', '2026-07', date '2026-07-01', date '2026-07-31', 'OPEN')
on conflict (id) do update set status = 'OPEN';

-- auth users + app users: A-maker (MANAGER), A-checker (ACCOUNTANT), B-admin
insert into auth.users (id, email, raw_app_meta_data)
values
  ('a0a00000-0000-4000-8000-000000000180', 'gap18-maker-a@example.com', '{}'::jsonb),
  ('a0c00000-0000-4000-8000-000000000180', 'gap18-checker-a@example.com', '{}'::jsonb),
  ('b0a00000-0000-4000-8000-000000000181', 'gap18-admin-b@example.com', '{}'::jsonb)
on conflict (id) do nothing;

insert into public.users (id, email, name, role, status, is_active)
values
  ('a0a00000-0000-4000-8000-000000000180', 'gap18-maker-a@example.com', 'GAP18 Maker A', 'MANAGER', 'ACTIVE', true),
  ('a0c00000-0000-4000-8000-000000000180', 'gap18-checker-a@example.com', 'GAP18 Checker A', 'ACCOUNTANT', 'ACTIVE', true),
  ('b0a00000-0000-4000-8000-000000000181', 'gap18-admin-b@example.com', 'GAP18 Admin B', 'ADMIN', 'ACTIVE', true)
on conflict (id) do update set role = excluded.role, status = excluded.status, is_active = true;

insert into public.company_members (company_id, user_id, role, is_active)
values
  ('a0000000-0000-4000-8000-000000000180', 'a0a00000-0000-4000-8000-000000000180', 'MEMBER', true),
  ('a0000000-0000-4000-8000-000000000180', 'a0c00000-0000-4000-8000-000000000180', 'MEMBER', true),
  ('b0000000-0000-4000-8000-000000000181', 'b0a00000-0000-4000-8000-000000000181', 'ADMIN', true)
on conflict do nothing;

-- Owners / property / unit / tenant / agreement / contract for company A
insert into public.owners (id, full_name, company_id, is_active)
values ('a2200000-0000-4000-8000-000000000180', 'GAP18 Owner A', 'a0000000-0000-4000-8000-000000000180', true)
on conflict (id) do update set is_active = true;

insert into public.properties (id, title, type, address, status, owner_id, company_id)
values ('a2000000-0000-4000-8000-000000000180', 'GAP18 Prop A', 'residential', 'Muscat', 'active',
        'a2200000-0000-4000-8000-000000000180', 'a0000000-0000-4000-8000-000000000180')
on conflict (id) do nothing;

insert into public.property_owners (id, property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on, company_id)
values ('a2300000-0000-4000-8000-000000000180', 'a2000000-0000-4000-8000-000000000180',
        'a2200000-0000-4000-8000-000000000180', 100, true, date '2026-01-01', date '2026-12-31',
        'a0000000-0000-4000-8000-000000000180')
on conflict (id) do nothing;

insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, company_id)
values ('a2400000-0000-4000-8000-000000000180', 'a2200000-0000-4000-8000-000000000180',
        'a2000000-0000-4000-8000-000000000180', 'property_management', 'RATE', 5,
        date '2026-01-01', date '2026-12-31', 'a0000000-0000-4000-8000-000000000180')
on conflict (id) do nothing;

insert into public.units (id, property_id, unit_number, company_id)
values ('a2100000-0000-4000-8000-000000000180', 'a2000000-0000-4000-8000-000000000180', 'A-01', 'a0000000-0000-4000-8000-000000000180')
on conflict (id) do nothing;

insert into public.people (id, full_name, type, company_id)
values ('a3000000-0000-4000-8000-000000000180', 'GAP18 Tenant A', 'tenant', 'a0000000-0000-4000-8000-000000000180')
on conflict (id) do nothing;

insert into public.contracts (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
values ('a4000000-0000-4000-8000-000000000180', 'a2000000-0000-4000-8000-000000000180',
        'a2100000-0000-4000-8000-000000000180', 'a3000000-0000-4000-8000-000000000180',
        'a2400000-0000-4000-8000-000000000180', date '2026-01-01', date '2026-12-31', 1000, 'active',
        'a0000000-0000-4000-8000-000000000180')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Variance shape 1 — OWNER PAYABLES 12405.000 vs 0.000 (no GL postings at all)
-- ---------------------------------------------------------------------------
insert into public.owner_balances (owner_id, company_id, total_income, total_expenses, commission, net_balance, updated_at)
values ('a2200000-0000-4000-8000-000000000180', 'a0000000-0000-4000-8000-000000000180', 13050.000, 645.000, 0, 12405.000, now())
on conflict (owner_id) do update set net_balance = excluded.net_balance;

-- ---------------------------------------------------------------------------
-- Variance shape 2 — SECURITY DEPOSITS 50.000 vs 100.000 (application unposted)
-- ---------------------------------------------------------------------------
insert into public.tenant_deposits
  (id, contract_id, property_id, unit_id, tenant_id, deposit_amount, deducted_amount, refunded_amount,
   remaining_amount, status, received_date, company_id)
values ('gap18-dep-a-001', 'a4000000-0000-4000-8000-000000000180', 'a2000000-0000-4000-8000-000000000180',
        'a2100000-0000-4000-8000-000000000180', 'a3000000-0000-4000-8000-000000000180',
        100.000, 50.000, 0, 50.000, 'held', date '2026-07-02', 'a0000000-0000-4000-8000-000000000180')
on conflict (id) do update set remaining_amount = excluded.remaining_amount;

select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%1$s', 'source_type', 'gap18_fixture', 'source_id', 'gap18-dep-receipt',
      'event_id', 'gap18-dep-receipt', 'effective_date', '2026-07-02',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%1$s'::uuid and no = '1111'), 'debit', 100.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%1$s'::uuid and no = '2200'), 'debit', 0, 'credit', 100.000)
      )))
  $$, 'a0000000-0000-4000-8000-000000000180'),
  'post deposit receipt 100.000 to 2200'
);

-- ---------------------------------------------------------------------------
-- Variance shape 3 — TENANT RECEIVABLES 3100.000 vs -7230.000 (contra balance)
-- ---------------------------------------------------------------------------
insert into public.invoices (id, contract_id, amount, paid_amount, tax_amount, issue_date, due_date, status, company_id)
values
  ('a5000000-0000-4000-8000-000000000181', 'a4000000-0000-4000-8000-000000000180', 1200.000, 0, 0, date '2026-07-03', date '2026-07-17', 'UNPAID', 'a0000000-0000-4000-8000-000000000180'),
  ('a5000000-0000-4000-8000-000000000182', 'a4000000-0000-4000-8000-000000000180', 1500.000, 0, 0, date '2026-07-05', date '2026-07-19', 'UNPAID', 'a0000000-0000-4000-8000-000000000180'),
  ('a5000000-0000-4000-8000-000000000183', 'a4000000-0000-4000-8000-000000000180',  400.000, 0, 0, date '2026-07-09', date '2026-07-23', 'UNPAID', 'a0000000-0000-4000-8000-000000000180')
on conflict (id) do update set amount = excluded.amount;

-- RC1 deliberately excludes unclassified obligations from 1201 unless their
-- historical invoice source batch proves that they actually created AR. Keep
-- this variance fixture in that explicit legacy-compatibility lane: one source
-- batch per invoice, each containing its real 1201 debit.
select public.post_journal_event(jsonb_build_object(
  'company_id', 'a0000000-0000-4000-8000-000000000180',
  'source_type', 'invoice', 'source_id', 'a5000000-0000-4000-8000-000000000181',
  'event_id', 'issue', 'effective_date', '2026-07-03',
  'lines', jsonb_build_array(
    jsonb_build_object('account_id', (select id from public.accounts where company_id = 'a0000000-0000-4000-8000-000000000180' and no = '1201'), 'debit', 1200.000, 'credit', 0),
    jsonb_build_object('account_id', (select id from public.accounts where company_id = 'a0000000-0000-4000-8000-000000000180' and no = '4100'), 'debit', 0, 'credit', 1200.000)
  )
));
select public.post_journal_event(jsonb_build_object(
  'company_id', 'a0000000-0000-4000-8000-000000000180',
  'source_type', 'invoice', 'source_id', 'a5000000-0000-4000-8000-000000000182',
  'event_id', 'issue', 'effective_date', '2026-07-05',
  'lines', jsonb_build_array(
    jsonb_build_object('account_id', (select id from public.accounts where company_id = 'a0000000-0000-4000-8000-000000000180' and no = '1201'), 'debit', 1500.000, 'credit', 0),
    jsonb_build_object('account_id', (select id from public.accounts where company_id = 'a0000000-0000-4000-8000-000000000180' and no = '4100'), 'debit', 0, 'credit', 1500.000)
  )
));
select public.post_journal_event(jsonb_build_object(
  'company_id', 'a0000000-0000-4000-8000-000000000180',
  'source_type', 'invoice', 'source_id', 'a5000000-0000-4000-8000-000000000183',
  'event_id', 'issue', 'effective_date', '2026-07-09',
  'lines', jsonb_build_array(
    jsonb_build_object('account_id', (select id from public.accounts where company_id = 'a0000000-0000-4000-8000-000000000180' and no = '1201'), 'debit', 400.000, 'credit', 0),
    jsonb_build_object('account_id', (select id from public.accounts where company_id = 'a0000000-0000-4000-8000-000000000180' and no = '4100'), 'debit', 0, 'credit', 400.000)
  )
));

select is(
  (select count(*)::int from public.journal_batches
   where company_id = 'a0000000-0000-4000-8000-000000000180'
     and source_type = 'invoice'
     and source_id in (
       'a5000000-0000-4000-8000-000000000181',
       'a5000000-0000-4000-8000-000000000182',
       'a5000000-0000-4000-8000-000000000183'
     ) and status = 'POSTED'),
  3,
  'post three legacy invoice source batches totalling 3100.000 to 1201'
);

select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%1$s', 'source_type', 'gap18_fixture', 'source_id', 'gap18-unmatched-collection',
      'event_id', 'gap18-unmatched-collection', 'effective_date', '2026-07-20',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%1$s'::uuid and no = '1111'), 'debit', 10330.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%1$s'::uuid and no = '1201'), 'debit', 0, 'credit', 10330.000)
      )))
  $$, 'a0000000-0000-4000-8000-000000000180'),
  'post unmatched collection credits 10330.000 to 1201'
);

-- Company B control: fully reconciled owner payable
insert into public.owners (id, full_name, company_id, is_active)
values ('b2200000-0000-4000-8000-000000000181', 'GAP18 Owner B', 'b0000000-0000-4000-8000-000000000181', true)
on conflict (id) do update set is_active = true;

insert into public.owner_balances (owner_id, company_id, total_income, total_expenses, commission, net_balance, updated_at)
values ('b2200000-0000-4000-8000-000000000181', 'b0000000-0000-4000-8000-000000000181', 700.000, 0, 0, 700.000, now())
on conflict (owner_id) do update set net_balance = excluded.net_balance;

select lives_ok(
  format($$
    select public.post_journal_event(jsonb_build_object(
      'company_id', '%1$s', 'source_type', 'gap18_fixture', 'source_id', 'gap18-owner-b',
      'event_id', 'gap18-owner-b', 'effective_date', '2026-07-10',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%1$s'::uuid and no = '1111'), 'debit', 700.000, 'credit', 0),
        jsonb_build_object('account_id', (select id from public.accounts where company_id = '%1$s'::uuid and no = '2000'), 'debit', 0, 'credit', 700.000)
      )))
  $$, 'b0000000-0000-4000-8000-000000000181'),
  'post reconciled owner payable 700.000 for company B'
);

-- ---------------------------------------------------------------------------
-- 1. Reason-code classification per variance shape
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select reason_code from public.wp05_variance_diagnostics('a0000000-0000-4000-8000-000000000180', date '2026-07-31') where reconciliation_class = 'OWNER_PAYABLES' $$,
  $$ values ('GL_NO_POSTINGS_FOR_ACCOUNT'::text) $$,
  '1. owner payables 12405.000 vs 0.000 → GL_NO_POSTINGS_FOR_ACCOUNT'
);

select results_eq(
  $$ select subledger_balance, gl_balance from public.wp05_variance_diagnostics('a0000000-0000-4000-8000-000000000180', date '2026-07-31') where reconciliation_class = 'OWNER_PAYABLES' $$,
  $$ values (12405.000::numeric, 0.000::numeric) $$,
  '1b. owner payables balances reproduce exactly'
);

select results_eq(
  $$ select reason_code from public.wp05_variance_diagnostics('a0000000-0000-4000-8000-000000000180', date '2026-07-31') where reconciliation_class = 'SECURITY_DEPOSITS' $$,
  $$ values ('SUBLEDGER_MOVEMENT_NOT_POSTED_TO_GL'::text) $$,
  '2. security deposits 50.000 vs 100.000 → SUBLEDGER_MOVEMENT_NOT_POSTED_TO_GL'
);

select results_eq(
  $$ select subledger_balance, gl_balance from public.wp05_variance_diagnostics('a0000000-0000-4000-8000-000000000180', date '2026-07-31') where reconciliation_class = 'SECURITY_DEPOSITS' $$,
  $$ values (50.000::numeric, 100.000::numeric) $$,
  '2b. security deposit balances reproduce exactly'
);

select is(
  (select (evidence->>'deposit_applied_total')::numeric from public.wp05_variance_diagnostics('a0000000-0000-4000-8000-000000000180', date '2026-07-31') where reconciliation_class = 'SECURITY_DEPOSITS'),
  50.000::numeric,
  '2c. deposit evidence carries the 50.000 unposted application'
);

select results_eq(
  $$ select reason_code from public.wp05_variance_diagnostics('a0000000-0000-4000-8000-000000000180', date '2026-07-31') where reconciliation_class = 'TENANT_RECEIVABLES' $$,
  $$ values ('GL_CONTRA_BALANCE_ON_DEBIT_NORMAL'::text) $$,
  '3. tenant receivables 3100.000 vs -7230.000 → GL_CONTRA_BALANCE_ON_DEBIT_NORMAL'
);

select results_eq(
  $$ select subledger_balance, gl_balance from public.wp05_variance_diagnostics('a0000000-0000-4000-8000-000000000180', date '2026-07-31') where reconciliation_class = 'TENANT_RECEIVABLES' $$,
  $$ values (3100.000::numeric, -7230.000::numeric) $$,
  '3b. tenant receivable balances reproduce exactly'
);

select is(
  (select (evidence->>'gl_credits')::numeric > (evidence->>'gl_debits')::numeric from public.wp05_variance_diagnostics('a0000000-0000-4000-8000-000000000180', date '2026-07-31') where reconciliation_class = 'TENANT_RECEIVABLES'),
  true,
  '3c. tenant receivable evidence shows credits exceeding debits'
);

select results_eq(
  $$ select reason_code from public.wp05_variance_diagnostics('a0000000-0000-4000-8000-000000000180', date '2026-07-31') where reconciliation_class = 'DUE_FROM_OWNER' $$,
  $$ values ('RECONCILED'::text) $$,
  '4. reconciled class reports RECONCILED, not a false positive'
);

select results_eq(
  $$ select reason_code from public.wp05_variance_diagnostics('b0000000-0000-4000-8000-000000000181', date '2026-07-31') where reconciliation_class = 'OWNER_PAYABLES' $$,
  $$ values ('RECONCILED'::text) $$,
  '4b. control company B owner payables reconcile'
);

select is(
  (select count(*)::int from public.wp05_variance_diagnostics('b0000000-0000-4000-8000-000000000181', date '2026-07-31') where reconciliation_status = 'FAIL'),
  0,
  '4c. control company B has zero failing classes'
);

-- ---------------------------------------------------------------------------
-- 2. Maker — proposals are generated PENDING_APPROVAL, idempotently
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0a00000-0000-4000-8000-000000000180","role":"authenticated","app_metadata":{"user_role":"MANAGER","company_id":"a0000000-0000-4000-8000-000000000180"}}', true);
set local role authenticated;

select lives_ok(
  $$ select public.wp05_generate_correction_proposals(date '2026-07-31', 'gap18-run-1', 'a1000000-0000-4000-8000-000000000180') $$,
  '5. maker (MANAGER) can generate correction proposals'
);

select is(
  (select count(*)::int from public.wp05_correction_proposals where company_id = 'a0000000-0000-4000-8000-000000000180'),
  3,
  '5b. exactly three proposals raised, one per failing class'
);

select is(
  (select count(*)::int from public.wp05_correction_proposals
    where company_id = 'a0000000-0000-4000-8000-000000000180' and status <> 'PENDING_APPROVAL'),
  0,
  '5c. every proposal is created PENDING_APPROVAL'
);

select results_eq(
  $$ select ((public.wp05_generate_correction_proposals(date '2026-07-31', 'gap18-run-1', 'a1000000-0000-4000-8000-000000000180'))->>'created')::int $$,
  $$ values (0::int) $$,
  '6. re-running the maker creates nothing (idempotent)'
);

select is(
  (select count(*)::int from public.wp05_correction_proposals where company_id = 'a0000000-0000-4000-8000-000000000180'),
  3,
  '6b. proposal count unchanged after idempotent re-run'
);

select results_eq(
  $$ select ((public.wp05_generate_correction_proposals(date '2026-07-31', 'gap18-run-1', 'a1000000-0000-4000-8000-000000000180'))->>'posted_to_gl')::boolean $$,
  $$ values (false::boolean) $$,
  '6c. maker reports posted_to_gl = false'
);

select results_eq(
  $$ select proposal_type from public.wp05_correction_proposals where company_id = 'a0000000-0000-4000-8000-000000000180' and reconciliation_class = 'OWNER_PAYABLES' $$,
  $$ values ('MISSING_GL_POSTING'::text) $$,
  '7. owner payables proposal is typed MISSING_GL_POSTING'
);

select isnt(
  (select maker_user_id from public.wp05_correction_proposals where company_id = 'a0000000-0000-4000-8000-000000000180' and reconciliation_class = 'OWNER_PAYABLES'),
  null,
  '7b. proposal records its maker'
);

-- audit_log is admin-read-only under RLS, so the audit assertion runs
-- unprivileged-role-free (the maker above is a MANAGER, not an ADMIN).
reset role;

select ok(
  (select count(*)::int from public.audit_log where action = 'WP05_PROPOSAL_CREATED') >= 3,
  '7c. proposal creation emits audit events'
);

-- Capture a company A proposal id outside RLS so the cross-company decide test
-- below passes a REAL id (a NULL id would only prove argument validation).
create temporary table if not exists wp05_gap018_test_ids (name text primary key, id uuid);
grant select on wp05_gap018_test_ids to authenticated;
insert into wp05_gap018_test_ids (name, id)
select 'company_a_receivables_proposal', id
from public.wp05_correction_proposals
where company_id = 'a0000000-0000-4000-8000-000000000180'
  and reconciliation_class = 'TENANT_RECEIVABLES'
on conflict (name) do update set id = excluded.id;

-- ---------------------------------------------------------------------------
-- 3. Immutability and lifecycle
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ delete from public.wp05_correction_proposals where reconciliation_class = 'OWNER_PAYABLES' $$,
  '42501',
  null,
  '8. proposals cannot be deleted (append-only)'
);

select throws_ok(
  $$ update public.wp05_correction_proposals set status = 'APPROVED' where reconciliation_class = 'OWNER_PAYABLES' $$,
  '42501',
  null,
  '8b. direct status updates are blocked outside the RPCs'
);

-- ---------------------------------------------------------------------------
-- 4. Maker–checker separation
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0a00000-0000-4000-8000-000000000180","role":"authenticated","app_metadata":{"user_role":"MANAGER","company_id":"a0000000-0000-4000-8000-000000000180"}}', true);

select throws_ok(
  $$ select public.wp05_approve_correction_proposal(
       (select id from public.wp05_correction_proposals where reconciliation_class = 'OWNER_PAYABLES'), 'self approval') $$,
  '42501',
  null,
  '9. the maker cannot approve their own proposal (maker≠checker)'
);

select set_config('request.jwt.claims', '{"sub":"a0c00000-0000-4000-8000-000000000180","role":"authenticated","app_metadata":{"user_role":"ACCOUNTANT","company_id":"a0000000-0000-4000-8000-000000000180"}}', true);

select lives_ok(
  $$ select public.wp05_approve_correction_proposal(
       (select id from public.wp05_correction_proposals where reconciliation_class = 'OWNER_PAYABLES'),
       'Confirmed: owner payable never recognised in GL; route to S09 after S08 approval.') $$,
  '10. an ACCOUNTANT checker can approve'
);

select results_eq(
  $$ select status from public.wp05_correction_proposals where reconciliation_class = 'OWNER_PAYABLES' $$,
  $$ values ('APPROVED'::text) $$,
  '10b. approved proposal is APPROVED'
);

select throws_ok(
  $$ select public.wp05_approve_correction_proposal(
       (select id from public.wp05_correction_proposals where reconciliation_class = 'OWNER_PAYABLES'), 'again') $$,
  '23514',
  null,
  '10c. an already-decided proposal cannot be re-approved'
);

select throws_ok(
  $$ select public.wp05_reject_correction_proposal(
       (select id from public.wp05_correction_proposals where reconciliation_class = 'SECURITY_DEPOSITS'), '  ') $$,
  '22023',
  null,
  '11. rejection requires a non-empty reason'
);

select lives_ok(
  $$ select public.wp05_reject_correction_proposal(
       (select id from public.wp05_correction_proposals where reconciliation_class = 'SECURITY_DEPOSITS'),
       'Deferred: deposit application evidence is still being gathered.') $$,
  '11b. a checker can reject with a reason'
);

select results_eq(
  $$ select status from public.wp05_correction_proposals where reconciliation_class = 'SECURITY_DEPOSITS' $$,
  $$ values ('REJECTED'::text) $$,
  '11c. rejected proposal is REJECTED'
);

-- ---------------------------------------------------------------------------
-- 5. Company isolation
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"b0a00000-0000-4000-8000-000000000181","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"b0000000-0000-4000-8000-000000000181"}}', true);

select throws_ok(
  $$ select public.wp05_variance_diagnostics('a0000000-0000-4000-8000-000000000180', date '2026-07-31') $$,
  '42501',
  null,
  '12. cross-company diagnostics are blocked'
);

select throws_ok(
  $$ select public.wp05_approve_correction_proposal(
       (select id from wp05_gap018_test_ids where name = 'company_a_receivables_proposal'),
       'cross-company approval') $$,
  'P0002',
  null,
  '12b. company B cannot decide a real company A proposal'
);

select is(
  (select jsonb_array_length((public.wp05_list_correction_proposals(null, null))->'proposals')),
  0,
  '12c. company B sees none of company A proposals'
);

select set_config('request.jwt.claims', '{"sub":"a0c00000-0000-4000-8000-000000000180","role":"authenticated","app_metadata":{"user_role":"ACCOUNTANT","company_id":"a0000000-0000-4000-8000-000000000180"}}', true);

select is(
  (select jsonb_array_length((public.wp05_list_correction_proposals(null, null))->'proposals')),
  3,
  '12d. company A sees exactly its own three proposals'
);

select is(
  (select jsonb_array_length((public.wp05_list_correction_proposals('PENDING_APPROVAL', null))->'proposals')),
  1,
  '12e. status filter works (one proposal still pending)'
);

-- ---------------------------------------------------------------------------
-- 6. No unapproved correction was posted to the GL
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select ((public.wp05_assert_no_unapproved_correction_postings('a0000000-0000-4000-8000-000000000180'))->>'success')::boolean $$,
  $$ values (true::boolean) $$,
  '13. proof function reports success for company A'
);

select results_eq(
  $$ select ((public.wp05_assert_no_unapproved_correction_postings('a0000000-0000-4000-8000-000000000180'))->>'proposal_sourced_gl_batches')::int $$,
  $$ values (0::int) $$,
  '13b. zero GL batches originate from the proposal lane'
);

reset role;

select is(
  (select count(*)::int from public.journal_batches
    where company_id = 'a0000000-0000-4000-8000-000000000180'
      and source_type not in ('gap18_fixture', 'invoice')),
  0,
  '13c. the only GL batches for company A are the explicit variance fixtures'
);

select is(
  (select count(*)::int from public.s09_corrections where company_id = 'a0000000-0000-4000-8000-000000000180'),
  0,
  '13d. approving a proposal did not create or apply any S09 correction'
);

select * from finish();
rollback;

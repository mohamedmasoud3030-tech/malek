-- =============================================================================
-- WP-02 / GAP-008 — Due-from-Owner (1300) lifecycle.
-- Canonical rules: FIN-008, OPS-012.
-- Proves: owner expense -> 1300 (never 6100); cash recovery (Dr Cash/Bank /
-- Cr 1300); lawful settlement offset (Dr 2000 / Cr 1300) only with an
-- enforceable offset right and never forcing 2000 negative; the residual owner
-- payout posts through the canonical S03 GL engine for the post-offset
-- effective payable; a fully-offset settlement closes as PAID WITHOUT creating
-- a zero-value journal event; net_payable stays server-derived/immutable;
-- compensating reversal; idempotency conflicts fail closed; company isolation;
-- and 1300 subledger <-> GL 1300 reconciliation.
--
-- The settlements are built through the real governed lifecycle RPCs
-- (create draft -> approve -> pay) so the FA-003 reservation and S02
-- stale-total guards run for real; nothing is bypassed by fixture inserts.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

-- ── Two companies
insert into public.companies (id, name, slug, currency, is_active) values
  ('0a000000-0000-4000-8000-0000000000a1', 'GAP008 Company A', 'gap008-a', 'OMR', true),
  ('0b000000-0000-4000-8000-0000000000b1', 'GAP008 Company B', 'gap008-b', 'OMR', true)
on conflict (id) do nothing;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
  ('0a000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gap008-a1@test.invalid', 'x', now(), now(), now(), '{}', '{}'),
  ('0a000000-0000-0000-0000-000000000aa2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gap008-a2@test.invalid', 'x', now(), now(), now(), '{}', '{}'),
  ('0b000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gap008-b1@test.invalid', 'x', now(), now(), now(), '{}', '{}')
on conflict (id) do nothing;

insert into public.users (id, email, name, role, status, is_active) values
  ('0a000000-0000-0000-0000-000000000aa1', 'gap008-a1@test.invalid', 'GAP008 A Maker', 'ADMIN', 'ACTIVE', true),
  ('0a000000-0000-0000-0000-000000000aa2', 'gap008-a2@test.invalid', 'GAP008 A Checker', 'ADMIN', 'ACTIVE', true),
  ('0b000000-0000-0000-0000-000000000bb1', 'gap008-b1@test.invalid', 'GAP008 B Admin', 'ADMIN', 'ACTIVE', true)
on conflict (id) do update set role = 'ADMIN', status = 'ACTIVE', is_active = true;

insert into public.company_members (company_id, user_id, role) values
  ('0a000000-0000-4000-8000-0000000000a1', '0a000000-0000-0000-0000-000000000aa1', 'ADMIN'),
  ('0a000000-0000-4000-8000-0000000000a1', '0a000000-0000-0000-0000-000000000aa2', 'ADMIN'),
  ('0b000000-0000-4000-8000-0000000000b1', '0b000000-0000-0000-0000-000000000bb1', 'ADMIN')
on conflict (company_id, user_id) do update set role = 'ADMIN';

select public.provision_company_chart_of_accounts('0a000000-0000-4000-8000-0000000000a1');
select public.provision_company_chart_of_accounts('0b000000-0000-4000-8000-0000000000b1');

-- One wide OPEN period per company: covers every fixture effective date AND
-- current_date so the canonical payout batch resolves deterministically.
insert into public.accounting_periods (id, company_id, name, start_date, end_date, status) values
  ('0a100000-0000-4000-8000-0000000000a1', '0a000000-0000-4000-8000-0000000000a1', 'GAP008-A', date '2026-01-01', date '2027-12-31', 'OPEN'),
  ('0b100000-0000-4000-8000-0000000000b1', '0b000000-0000-4000-8000-0000000000b1', 'GAP008-B', date '2026-01-01', date '2027-12-31', 'OPEN')
on conflict (id) do nothing;

insert into public.owners (id, full_name, company_id, is_active) values
  ('0a200000-0000-4000-8000-0000000000a1', 'GAP008 Owner A', '0a000000-0000-4000-8000-0000000000a1', true)
on conflict (id) do nothing;

-- Agreement ownership is an authoritative prerequisite, not a fixture bypass.
insert into public.properties (id, title, name, type, address, status, company_id) values
  ('0a250000-0000-4000-8000-0000000000a1', 'GAP008 Property A', 'GAP008 Property A', 'residential', 'Muscat', 'active', '0a000000-0000-4000-8000-0000000000a1')
on conflict (id) do nothing;

insert into public.property_owners (id, property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on, company_id) values
  ('0a260000-0000-4000-8000-0000000000a1', '0a250000-0000-4000-8000-0000000000a1', '0a200000-0000-4000-8000-0000000000a1', 100, true, date '2026-01-01', null, '0a000000-0000-4000-8000-0000000000a1')
on conflict (id) do nothing;

-- RATE 0 keeps the server-derived settlement tuple exact: gross = net.
insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, company_id) values
  ('0a300000-0000-4000-8000-0000000000a1', '0a200000-0000-4000-8000-0000000000a1', '0a250000-0000-4000-8000-0000000000a1', 'property_management', 'RATE', 0, date '2026-01-01', date '2027-12-31', '0a000000-0000-4000-8000-0000000000a1')
on conflict (id) do nothing;

-- Version with an enforceable offset right (offset_allowed = true) for Company A.
insert into public.owner_agreement_versions (
  id, owner_agreement_id, company_id, version_no, operating_model, collection_role,
  commission_type, commission_value, commission_recognition_basis, effective_from, offset_allowed
) values (
  '0a310000-0000-4000-8000-0000000000a1', '0a300000-0000-4000-8000-0000000000a1',
  '0a000000-0000-4000-8000-0000000000a1', 1, 'OWNER_AGENCY', 'OWNER_IS_CREDITOR',
  'RATE', 0, 'ON_COLLECTION', date '2026-01-01', true
) on conflict (id) do update set offset_allowed = true;

-- Real collected rent so calculate_owner_net_payout derives the settlement
-- tuples exactly: 200.000 for August (settlement S1), 50.000 for September (S2).
insert into public.units (id, property_id, unit_number, company_id) values
  ('0a270000-0000-4000-8000-0000000000a1', '0a250000-0000-4000-8000-0000000000a1', 'U-GAP008', '0a000000-0000-4000-8000-0000000000a1')
on conflict (id) do nothing;

insert into public.people (id, full_name, type, company_id) values
  ('0a280000-0000-4000-8000-0000000000a1', 'GAP008 Tenant', 'tenant', '0a000000-0000-4000-8000-0000000000a1')
on conflict (id) do nothing;

insert into public.contracts (id, property_id, unit_id, tenant_id, start_date, end_date, rent_amount, status, agreement_id, company_id) values
  ('0a290000-0000-4000-8000-0000000000a1', '0a250000-0000-4000-8000-0000000000a1', '0a270000-0000-4000-8000-0000000000a1',
   '0a280000-0000-4000-8000-0000000000a1', '2026-01-01', '2026-12-31', 3000, 'active',
   '0a300000-0000-4000-8000-0000000000a1', '0a000000-0000-4000-8000-0000000000a1')
on conflict (id) do nothing;

insert into public.invoices (id, contract_id, issue_date, due_date, amount, paid_amount, tax_amount, status, company_id) values
  ('0a2a0000-0000-4000-8000-0000000000a1', '0a290000-0000-4000-8000-0000000000a1', '2026-08-01', '2026-08-05', 200, 200, 0, 'PAID', '0a000000-0000-4000-8000-0000000000a1'),
  ('0a2a0000-0000-4000-8000-0000000000a2', '0a290000-0000-4000-8000-0000000000a1', '2026-09-01', '2026-09-05', 50, 50, 0, 'PAID', '0a000000-0000-4000-8000-0000000000a1')
on conflict (id) do nothing;

insert into public.receipts (id, amount, status, company_id) values
  ('0a2b0000-0000-4000-8000-0000000000a1', 200, 'POSTED', '0a000000-0000-4000-8000-0000000000a1'),
  ('0a2b0000-0000-4000-8000-0000000000a2', 50, 'POSTED', '0a000000-0000-4000-8000-0000000000a1')
on conflict (id) do nothing;

insert into public.payments (id, invoice_id, contract_id, amount, payment_method, payment_date, status, receipt_id, company_id) values
  ('0a2b0000-0000-4000-8000-0000000000a1', '0a2a0000-0000-4000-8000-0000000000a1', '0a290000-0000-4000-8000-0000000000a1', 200, 'cash', date '2026-08-05', 'POSTED', '0a2b0000-0000-4000-8000-0000000000a1', '0a000000-0000-4000-8000-0000000000a1'),
  ('0a2b0000-0000-4000-8000-0000000000a2', '0a2a0000-0000-4000-8000-0000000000a2', '0a290000-0000-4000-8000-0000000000a1', 50, 'cash', date '2026-09-05', 'POSTED', '0a2b0000-0000-4000-8000-0000000000a2', '0a000000-0000-4000-8000-0000000000a1')
on conflict (id) do nothing;

update public.receipts set payment_id = id
where id in ('0a2b0000-0000-4000-8000-0000000000a1', '0a2b0000-0000-4000-8000-0000000000a2');

-- These payment rows are intentionally compact settlement fixtures, but RC1's
-- 2000 control must still see their actual economic effect. Post the matching
-- owner-collection journals and append the corresponding owner_funds_events so
-- the later lawful offset/payout tests operate against real Owner Funds Payable
-- rather than synthetic negative 2000 balances.
select public.post_journal_event(jsonb_build_object(
  'company_id', '0a000000-0000-4000-8000-0000000000a1',
  'source_type', 'gap008_owner_collection_fixture',
  'source_id', '0a2b0000-0000-4000-8000-0000000000a1',
  'event_id', 'gap008-collection-aug',
  'effective_date', '2026-08-05',
  'description', 'GAP008 compact owner collection fixture August',
  'lines', jsonb_build_array(
    jsonb_build_object('account_id', public.require_company_account_id('0a000000-0000-4000-8000-0000000000a1','1111'), 'debit', 200.000, 'credit', 0),
    jsonb_build_object('account_id', public.require_company_account_id('0a000000-0000-4000-8000-0000000000a1','2000'), 'debit', 0, 'credit', 200.000)
  )
));

insert into public.owner_funds_events (
  company_id, owner_id, contract_id, invoice_id, source_type, source_id,
  event_id, amount_delta, effective_date, journal_batch_id
)
select
  '0a000000-0000-4000-8000-0000000000a1',
  '0a200000-0000-4000-8000-0000000000a1',
  '0a290000-0000-4000-8000-0000000000a1',
  '0a2a0000-0000-4000-8000-0000000000a1',
  'OWNER_COLLECTION', '0a2b0000-0000-4000-8000-0000000000a1',
  'gap008-collection-aug', 200.000, date '2026-08-05', b.id
from public.journal_batches b
where b.company_id = '0a000000-0000-4000-8000-0000000000a1'
  and b.source_type = 'gap008_owner_collection_fixture'
  and b.source_id = '0a2b0000-0000-4000-8000-0000000000a1'
  and b.event_id = 'gap008-collection-aug';

select public.post_journal_event(jsonb_build_object(
  'company_id', '0a000000-0000-4000-8000-0000000000a1',
  'source_type', 'gap008_owner_collection_fixture',
  'source_id', '0a2b0000-0000-4000-8000-0000000000a2',
  'event_id', 'gap008-collection-sep',
  'effective_date', '2026-09-05',
  'description', 'GAP008 compact owner collection fixture September',
  'lines', jsonb_build_array(
    jsonb_build_object('account_id', public.require_company_account_id('0a000000-0000-4000-8000-0000000000a1','1111'), 'debit', 50.000, 'credit', 0),
    jsonb_build_object('account_id', public.require_company_account_id('0a000000-0000-4000-8000-0000000000a1','2000'), 'debit', 0, 'credit', 50.000)
  )
));

insert into public.owner_funds_events (
  company_id, owner_id, contract_id, invoice_id, source_type, source_id,
  event_id, amount_delta, effective_date, journal_batch_id
)
select
  '0a000000-0000-4000-8000-0000000000a1',
  '0a200000-0000-4000-8000-0000000000a1',
  '0a290000-0000-4000-8000-0000000000a1',
  '0a2a0000-0000-4000-8000-0000000000a2',
  'OWNER_COLLECTION', '0a2b0000-0000-4000-8000-0000000000a2',
  'gap008-collection-sep', 50.000, date '2026-09-05', b.id
from public.journal_batches b
where b.company_id = '0a000000-0000-4000-8000-0000000000a1'
  and b.source_type = 'gap008_owner_collection_fixture'
  and b.source_id = '0a2b0000-0000-4000-8000-0000000000a2'
  and b.event_id = 'gap008-collection-sep';

-- ── S1: governed lifecycle DRAFT (maker A1) -> APPROVED (checker A2), net 200.000
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000aa1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000a1"}}', true);
set local role authenticated;

select public.create_owner_settlement_draft_atomic(jsonb_build_object(
  'owner_id', '0a200000-0000-4000-8000-0000000000a1',
  'property_id', '0a250000-0000-4000-8000-0000000000a1',
  'period_start', '2026-08-01', 'period_end', '2026-08-31',
  'request_id', 'aa000000-0000-4000-8000-000000000101'));

select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000aa2","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000a1"}}', true);
select public.approve_owner_settlement_atomic(jsonb_build_object(
  'settlement_id', (select id from public.owner_settlements where request_id = 'aa000000-0000-4000-8000-000000000101'::uuid),
  'request_id', 'aa000000-0000-4000-8000-000000000102'));

-- ── Test 1: owner expense creates a 1300 receivable (never 6100)
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000aa1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000a1"}}', true);
select lives_ok(
  $$ select public.create_owner_receivable_atomic(jsonb_build_object(
       'owner_id', '0a200000-0000-4000-8000-0000000000a1',
       'owner_agreement_id', '0a300000-0000-4000-8000-0000000000a1',
       'amount', 100.000, 'cash_account_no', '1120', 'effective_date', '2026-08-10',
       'request_id', 'gap008-create-1') ) $$,
  '1. owner expense creates a Due-from-Owner (1300) receivable'
);

reset role;
select is(
  (select amount from public.due_from_owners where request_id = 'gap008-create-1'),
  100.000::numeric, '2. receivable amount is 100.000 (outstanding = amount at creation)'
);
select ok(
  (select lawful_offset_right from public.due_from_owners where request_id = 'gap008-create-1'),
  '3. receivable snapshots the enforceable agreement offset right'
);
select is(
  (select a.no from public.journal_lines l
     join public.journal_batches b on b.id = l.batch_id
     join public.accounts a on a.id = l.account_id
   where b.source_type = 'pm_owner_expense'
     and b.company_id = '0a000000-0000-4000-8000-0000000000a1'
     and l.debit > 0
   order by l.created_at desc limit 1),
  '1300', '4. owner expense debits 1300 Due from Owners'
);
select ok(
  not exists (select 1 from public.journal_lines l
    join public.journal_batches b on b.id = l.batch_id
    join public.accounts a on a.id = l.account_id
    where b.company_id = '0a000000-0000-4000-8000-0000000000a1'
      and b.source_type = 'pm_owner_expense' and a.no = '6100'),
  '5. owner obligation never posts to 6100 company operating expense'
);

-- ── Cash recovery (Dr Cash/Bank / Cr 1300)
set local role authenticated;
select lives_ok(
  $$ select public.recover_owner_receivable_atomic(jsonb_build_object(
       'due_from_owner_id', (select id::text from public.due_from_owners where request_id = 'gap008-create-1'),
       'amount', 40.000, 'cash_account_no', '1120', 'effective_date', '2026-08-15',
       'request_id', 'gap008-recover-1') ) $$,
  '6. cash recovery of 40.000 (Dr Cash/Bank / Cr 1300)'
);

reset role;
select is(
  (select outstanding from public.due_from_owners where request_id = 'gap008-create-1'),
  60.000::numeric, '7. outstanding reduced to 60.000 after recovery'
);

set local role authenticated;
select throws_ok(
  $$ select public.recover_owner_receivable_atomic(jsonb_build_object(
       'due_from_owner_id', (select id::text from public.due_from_owners where request_id = 'gap008-create-1'),
       'amount', 41.000, 'cash_account_no', '1120', 'effective_date', '2026-08-15',
       'request_id', 'gap008-recover-1') ) $$,
  '22023', 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST',
  '8. recovery request key reuse with a different payload fails closed'
);

-- ── Lawful settlement offset (Dr 2000 / Cr 1300), then post-offset payout
select lives_ok(
  $$ select public.offset_owner_receivable_atomic(jsonb_build_object(
       'due_from_owner_id', (select id::text from public.due_from_owners where request_id = 'gap008-create-1'),
       'owner_settlement_id', (select id from public.owner_settlements where request_id = 'aa000000-0000-4000-8000-000000000101'::uuid),
       'amount', 60.000, 'effective_date', '2026-08-20',
       'lawful_offset_evidence', 'Enforceable offset per agreement version 1, settlement netting.',
       'request_id', 'gap008-offset-1') ) $$,
  '9. lawful offset of 60.000 against the APPROVED settlement'
);

reset role;
select is(
  (select outstanding from public.due_from_owners where request_id = 'gap008-create-1'),
  0.000::numeric, '10. receivable fully cleared (outstanding 0) by recovery + offset'
);
select is(
  (select offset_applied from public.owner_settlements where request_id = 'aa000000-0000-4000-8000-000000000101'::uuid),
  60.000::numeric, '11. settlement offset_applied 0 -> 60 (effective payable 200 -> 140; 2000 never forced negative)'
);
select is(
  (select net_payable from public.owner_settlements where request_id = 'aa000000-0000-4000-8000-000000000101'::uuid),
  200.000::numeric, '12. server-derived net_payable preserved (immutable)'
);

-- Payout by the checker (maker-checker: the maker cannot pay).
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000aa2","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000a1"}}', true);
set local role authenticated;
select lives_ok(
  $$ select public.pay_owner_settlement_atomic(jsonb_build_object(
       'settlement_id', (select id from public.owner_settlements where request_id = 'aa000000-0000-4000-8000-000000000101'::uuid),
       'method', 'bank_transfer',
       'request_id', 'aa000000-0000-4000-8000-000000000103')) $$,
  '13. payout uses the post-offset effective payable'
);

reset role;
select is(
  (select amount from public.journal_entries
    where entity_type = 'owner_settlement_payment'
      and entity_id = (select id from public.owner_settlements where request_id = 'aa000000-0000-4000-8000-000000000101'::uuid)
      and type = 'CREDIT'),
  140.000::numeric, '14. cash payout equals net payable less lawful offset (140.000)'
);
select ok(
  exists (
    select 1 from public.journal_batches b
    where b.company_id = '0a000000-0000-4000-8000-0000000000a1'
      and b.source_type = 'owner_settlement_payment'
      and b.source_id = (select id from public.owner_settlements where request_id = 'aa000000-0000-4000-8000-000000000101'::uuid)
      and b.event_id = 'pay'
      and b.status = 'POSTED'
      and b.is_legacy_compat = false
  ),
  '15. payout posted through the canonical S03 GL engine (no legacy journal writer)'
);

-- ── S2: full-clear offset -> settlement closes WITHOUT a zero-value journal event
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000aa1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000a1"}}', true);
set local role authenticated;
select public.create_owner_settlement_draft_atomic(jsonb_build_object(
  'owner_id', '0a200000-0000-4000-8000-0000000000a1',
  'property_id', '0a250000-0000-4000-8000-0000000000a1',
  'period_start', '2026-09-01', 'period_end', '2026-09-30',
  'request_id', 'aa000000-0000-4000-8000-000000000201'));
select public.create_owner_receivable_atomic(jsonb_build_object(
  'owner_id', '0a200000-0000-4000-8000-0000000000a1',
  'owner_agreement_id', '0a300000-0000-4000-8000-0000000000a1',
  'amount', 50.000, 'cash_account_no', '1120', 'effective_date', '2026-09-01',
  'request_id', 'gap008-create-2'));

select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000aa2","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000a1"}}', true);
select public.approve_owner_settlement_atomic(jsonb_build_object(
  'settlement_id', (select id from public.owner_settlements where request_id = 'aa000000-0000-4000-8000-000000000201'::uuid),
  'request_id', 'aa000000-0000-4000-8000-000000000202'));

select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000aa1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000a1"}}', true);
select lives_ok(
  $$ select public.offset_owner_receivable_atomic(jsonb_build_object(
       'due_from_owner_id', (select id::text from public.due_from_owners where request_id = 'gap008-create-2'),
       'owner_settlement_id', (select id from public.owner_settlements where request_id = 'aa000000-0000-4000-8000-000000000201'::uuid),
       'amount', 50.000, 'effective_date', '2026-09-10',
       'lawful_offset_evidence', 'Enforceable offset per agreement version 1: offset fully clears the payable.',
       'request_id', 'gap008-offset-2') ) $$,
  '16. lawful offset fully clears the second settlement payable (effective payable 0)'
);

select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000aa2","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000a1"}}', true);
select lives_ok(
  $$ select public.pay_owner_settlement_atomic(jsonb_build_object(
       'settlement_id', (select id from public.owner_settlements where request_id = 'aa000000-0000-4000-8000-000000000201'::uuid),
       'method', 'bank_transfer',
       'request_id', 'aa000000-0000-4000-8000-000000000203')) $$,
  '17. fully-offset settlement closes as PAID'
);

reset role;
select ok(
  (select status from public.owner_settlements where request_id = 'aa000000-0000-4000-8000-000000000201'::uuid) = 'PAID'
  and not exists (
    select 1 from public.journal_entries
    where entity_type = 'owner_settlement_payment'
      and entity_id = (select id from public.owner_settlements where request_id = 'aa000000-0000-4000-8000-000000000201'::uuid)
  )
  and not exists (
    select 1 from public.journal_batches b
    where b.source_type = 'owner_settlement_payment'
      and b.source_id = (select id from public.owner_settlements where request_id = 'aa000000-0000-4000-8000-000000000201'::uuid)
  ),
  '18. zero effective payable creates NO zero-value journal event (offset was the final economic event)'
);

-- ── 1300 subledger <-> GL reconciliation
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000aa1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000a1"}}', true);
set local role authenticated;
select results_eq(
  $$ select is_reconciled from public.gl_reconcile_subledgers(date '2026-12-31') where account_no = '1300' $$,
  $$ values (true) $$,
  '19. Due-from-Owner (1300) subledger reconciles to GL 1300'
);

-- ── Fail-closed offsets
select public.create_owner_receivable_atomic(jsonb_build_object(
  'owner_id', '0a200000-0000-4000-8000-0000000000a1',
  'amount', 30.000, 'cash_account_no', '1120', 'effective_date', '2026-08-11',
  'request_id', 'gap008-create-no-right'));
select throws_ok(
  $$ select public.offset_owner_receivable_atomic(jsonb_build_object(
       'due_from_owner_id', (select id::text from public.due_from_owners where request_id = 'gap008-create-no-right'),
       'owner_settlement_id', (select id from public.owner_settlements where request_id = 'aa000000-0000-4000-8000-000000000101'::uuid),
       'amount', 30.000, 'effective_date', '2026-08-21',
       'lawful_offset_evidence', 'no enforceable right exists', 'request_id', 'gap008-offset-no-right') ) $$,
  '23514', 'DUE_FROM_OWNER_OFFSET_RIGHT_MISSING: no enforceable contractual/legal offset right on this receivable.',
  '20. offset without an enforceable offset right is rejected (fail closed)'
);

select public.create_owner_receivable_atomic(jsonb_build_object(
  'owner_id', '0a200000-0000-4000-8000-0000000000a1',
  'owner_agreement_id', '0a300000-0000-4000-8000-0000000000a1',
  'amount', 25.000, 'cash_account_no', '1120', 'effective_date', '2026-08-12',
  'request_id', 'gap008-create-postpay'));
select throws_ok(
  $$ select public.offset_owner_receivable_atomic(jsonb_build_object(
       'due_from_owner_id', (select id::text from public.due_from_owners where request_id = 'gap008-create-postpay'),
       'owner_settlement_id', (select id from public.owner_settlements where request_id = 'aa000000-0000-4000-8000-000000000101'::uuid),
       'amount', 25.000, 'effective_date', '2026-08-22',
       'lawful_offset_evidence', 'post-payout offset attempt', 'request_id', 'gap008-offset-postpay') ) $$,
  '22023', 'DUE_FROM_OWNER_OFFSET_SETTLEMENT_NOT_APPROVED: offset is only permitted against an APPROVED (unpaid) owner payable.',
  '21. offset against an already-PAID settlement is refused (2000 never forced negative; cash recovery is the lawful path)'
);

-- ── Compensating reversal of the 40.000 recovery restores outstanding
select public.reverse_owner_receivable_recovery_atomic(jsonb_build_object(
  'recovery_event_id', (select id::text from public.due_from_owner_recoveries where request_id = 'gap008-recover-1'),
  'reason', 'Correction of erroneous recovery.', 'request_id', 'gap008-rev-recover-1'));

reset role;
select is(
  (select outstanding from public.due_from_owners where request_id = 'gap008-create-1'),
  40.000::numeric,
  '22. compensating reversal restores outstanding to 40.000 (100 - 60 offset; the 40 recovery reversed)'
);

-- ── Company isolation: a Company B actor cannot touch Company A''s receivable.
-- The RPC boundary itself must reject the cross-company id with 42501.
select set_config('request.jwt.claims', '{"sub":"0b000000-0000-0000-0000-000000000bb1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0b000000-0000-4000-8000-0000000000b1"}}', true);
select throws_ok(
  $$ select public.recover_owner_receivable_atomic(jsonb_build_object(
       'due_from_owner_id', (select id::text from public.due_from_owners where request_id = 'gap008-create-1'),
       'amount', 5.000, 'cash_account_no', '1120', 'effective_date', '2026-08-15',
       'request_id', 'gap008-cross-co') ) $$,
  '42501', 'DUE_FROM_OWNER_NOT_FOUND_OR_FORBIDDEN',
  '23. cross-company recovery is denied at the RPC boundary'
);

select * from finish();
rollback;

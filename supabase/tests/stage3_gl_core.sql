-- =============================================================================
-- Stage 3 — General Ledger Core: database-level exit-gate assertions.
--
-- Runs inside the release-blocker database gate (supabase test db) against a
-- clean replay of the whole migration chain. Covers the schema, constraints,
-- RLS, the posting engine, period resolution, idempotency and reversals.
--
-- The heavy behavioral matrix lives in rentrix-app/src/s3/*.test.ts (PGlite);
-- this file pins the invariants that must hold on a real Supabase/Postgres.
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(52);

-- ── 1. canonical tables / view / archive exist ───────────────────────────────
select has_table('public', 'journal_batches', 'journal_batches table exists');
select has_table('public', 'journal_lines', 'journal_lines table exists');
select has_table('public', 'accounting_periods', 'accounting_periods table exists');
select has_table('public', 'journal_entries_archive', 'pre-Stage-3 archive table exists');
select has_view('public', 'journal_entries', 'journal_entries compatibility view exists');

-- ── 2. RLS is enabled on every Stage 3 table ─────────────────────────────────
select ok(
  (select relrowsecurity from pg_class where oid = 'public.journal_batches'::regclass),
  'RLS enabled on journal_batches'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.journal_lines'::regclass),
  'RLS enabled on journal_lines'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.accounting_periods'::regclass),
  'RLS enabled on accounting_periods'
);

-- ── 3. chart of accounts: company-scoped uniqueness + OMR precision ─────────
select ok(
  exists (select 1 from pg_constraint where conname = 'accounts_company_no_key'),
  'UNIQUE (company_id, no) exists on accounts'
);
select ok(
  not exists (select 1 from pg_constraint where conname = 'accounts_no_key'),
  'global UNIQUE (no) was removed from accounts'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'accounts_omr_precision_chk'),
  'OMR precision-3 check exists on accounts'
);

insert into public.companies (id, name, slug) values
  ('c9000000-0000-4000-8000-000000000001', 'Stage3 Gate A', 'stage3-gate-a'),
  ('c9000000-0000-4000-8000-000000000002', 'Stage3 Gate B', 'stage3-gate-b');

select lives_ok(
  $$ select public.provision_company_chart_of_accounts('c9000000-0000-4000-8000-000000000001') $$,
  'provisioning company A chart runs'
);
select is(
  (select public.provision_company_chart_of_accounts('c9000000-0000-4000-8000-000000000001') ->> 'created_count')::int,
  0,
  'provisioning is idempotent (second run creates nothing)'
);
select is(
  (select count(*)::int from public.accounts where company_id = 'c9000000-0000-4000-8000-000000000001'),
  18,
  'all 18 required accounts provisioned for company A'
);
select lives_ok(
  $$ select public.provision_company_chart_of_accounts('c9000000-0000-4000-8000-000000000002') $$,
  'company B provisions its own chart (account numbers repeat across companies)'
);
select is(
  (select count(*)::int from public.accounts
    where no = '1111' and company_id in ('c9000000-0000-4000-8000-000000000001', 'c9000000-0000-4000-8000-000000000002')),
  2,
  'account 1111 exists once per company'
);
select throws_ok(
  $$ insert into public.accounts (id, no, name, company_id)
     values ('dup-1111', '1111', 'Dup', 'c9000000-0000-4000-8000-000000000001') $$,
  '23505',
  null,
  'duplicate (company_id, no) is rejected'
);
select is(
  (select precision::int from public.accounts where company_id = 'c9000000-0000-4000-8000-000000000001' and no = '1111'),
  3,
  'OMR accounts carry precision 3'
);

-- ── 4. accounting periods ────────────────────────────────────────────────────
insert into public.accounting_periods (company_id, name, start_date, end_date, status)
values ('c9000000-0000-4000-8000-000000000001', '2026-07', date '2026-07-01', date '2026-07-31', 'OPEN');
insert into public.accounting_periods (company_id, name, start_date, end_date, status)
values ('c9000000-0000-4000-8000-000000000001', '2026-08', date '2026-08-01', date '2026-08-31', 'OPEN');
insert into public.accounting_periods (company_id, name, start_date, end_date, status)
values ('c9000000-0000-4000-8000-000000000002', '2026-07', date '2026-07-01', date '2026-07-31', 'OPEN');

select throws_ok(
  $$ insert into public.accounting_periods (company_id, name, start_date, end_date, status)
     values ('c9000000-0000-4000-8000-000000000001', '2026-07-dup', date '2026-07-15', date '2026-08-15', 'OPEN') $$,
  '23P01',
  null,
  'overlapping periods of the same company are rejected'
);
select lives_ok(
  $$ insert into public.accounting_periods (company_id, name, start_date, end_date, status)
     values ('c9000000-0000-4000-8000-000000000002', '2026-09', date '2026-08-15', date '2026-09-15', 'OPEN') $$,
  'a range overlapping another company''s periods is valid for this company'
);
select throws_ok(
  $$ delete from public.accounting_periods
     where company_id = 'c9000000-0000-4000-8000-000000000001' and name = '2026-07' $$,
  '42501',
  null,
  'accounting periods cannot be deleted'
);
select throws_ok(
  $$ update public.accounting_periods set status = 'HARD_CLOSED'
     where company_id = 'c9000000-0000-4000-8000-000000000001' and name = '2026-07' $$,
  '42501',
  null,
  'direct status changes are blocked by the write guard'
);

-- ── 5. posting engine ────────────────────────────────────────────────────────
select ok(
  not has_function_privilege('authenticated', 'public.post_journal_event(jsonb)', 'EXECUTE'),
  'authenticated cannot execute post_journal_event'
);
select ok(
  not has_function_privilege('authenticated', 'public.gl_post_journal_batch(uuid)', 'EXECUTE'),
  'authenticated cannot execute gl_post_journal_batch'
);
select ok(
  has_function_privilege('service_role', 'public.post_journal_event(jsonb)', 'EXECUTE'),
  'service_role can execute post_journal_event'
);

select lives_ok(
  $$ select public.post_journal_event(jsonb_build_object(
       'company_id', 'c9000000-0000-4000-8000-000000000001',
       'source_type', 'pgtap', 'source_id', 'evt-1', 'event_id', 'evt-1',
       'effective_date', '2026-07-15',
       'lines', jsonb_build_array(
         jsonb_build_object('account_id', 'coa:c9000000-0000-4000-8000-000000000001:1111', 'debit', 100.005),
         jsonb_build_object('account_id', 'coa:c9000000-0000-4000-8000-000000000001:6100', 'credit', 100.005)
       )
     )) $$,
  'a balanced event posts'
);
select is(
  (select status from public.journal_batches where event_id = 'evt-1'),
  'POSTED',
  'the event batch is POSTED'
);
select is(
  (select b.accounting_period_id is not null from public.journal_batches b where b.event_id = 'evt-1'),
  true,
  'the posted batch is resolved into an accounting period'
);
select is(
  (select period_resolution_reason from public.journal_batches where event_id = 'evt-1'),
  'open_period_contains_date',
  'period resolution reason recorded'
);
select throws_ok(
  $$ select public.post_journal_event(jsonb_build_object(
       'company_id', 'c9000000-0000-4000-8000-000000000001',
       'source_type', 'pgtap', 'source_id', 'evt-1', 'event_id', 'evt-1',
       'effective_date', '2026-07-15',
       'lines', jsonb_build_array(
         jsonb_build_object('account_id', 'coa:c9000000-0000-4000-8000-000000000001:1111', 'debit', 999),
         jsonb_build_object('account_id', 'coa:c9000000-0000-4000-8000-000000000001:6100', 'credit', 999)
       )
     )) $$,
  '23505',
  null,
  'same event with different amounts conflicts'
);
select throws_ok(
  $$ select public.post_journal_event(jsonb_build_object(
       'company_id', 'c9000000-0000-4000-8000-000000000001',
       'source_type', 'pgtap', 'source_id', 'evt-2', 'event_id', 'evt-2',
       'effective_date', '2026-07-15',
       'lines', jsonb_build_array(
         jsonb_build_object('account_id', 'coa:c9000000-0000-4000-8000-000000000001:1111', 'debit', 10),
         jsonb_build_object('account_id', 'coa:c9000000-0000-4000-8000-000000000001:6100', 'credit', 9.999)
       )
     )) $$,
  'P0001',
  'JOURNAL_BATCH_UNBALANCED',
  'an unbalanced event is rejected'
);
select throws_ok(
  $$ select public.post_journal_event(jsonb_build_object(
       'company_id', 'c9000000-0000-4000-8000-000000000001',
       'source_type', 'pgtap', 'source_id', 'evt-3', 'event_id', 'evt-3',
       'effective_date', '2026-07-15',
       'lines', jsonb_build_array(
         jsonb_build_object('account_id', 'coa:c9000000-0000-4000-8000-000000000001:1111', 'debit', 10, 'credit', 10)
       )
     )) $$,
  '22023',
  null,
  'a line with both debit and credit is rejected'
);
select throws_ok(
  $$ select public.post_journal_event(jsonb_build_object(
       'company_id', 'c9000000-0000-4000-8000-000000000001',
       'source_type', 'pgtap', 'source_id', 'evt-4', 'event_id', 'evt-4',
       'effective_date', '2026-07-15',
       'lines', jsonb_build_array()
     )) $$,
  '22023',
  null,
  'an empty event is rejected'
);

-- Late event into a closed period: soft-close 2026-07 through the authorized
-- marker so the write-guard trigger accepts the transition (the RPC sets the
-- same marker; the guard itself is asserted in the PGlite suite).
select set_config('malik.accounting_period_change_authorized', 'true', true);
update public.accounting_periods
   set status = 'SOFT_CLOSED'
 where company_id = 'c9000000-0000-4000-8000-000000000001' and name = '2026-07';

select lives_ok(
  $$ select public.post_journal_event(jsonb_build_object(
       'company_id', 'c9000000-0000-4000-8000-000000000001',
       'source_type', 'pgtap', 'source_id', 'evt-5', 'event_id', 'evt-5',
       'effective_date', '2026-07-20',
       'lines', jsonb_build_array(
         jsonb_build_object('account_id', 'coa:c9000000-0000-4000-8000-000000000001:1111', 'debit', 5),
         jsonb_build_object('account_id', 'coa:c9000000-0000-4000-8000-000000000001:6100', 'credit', 5)
       )
     )) $$,
  'a late event posts into an eligible open period'
);
select is(
  (select period_resolution_reason from public.journal_batches where event_id = 'evt-5'),
  'redirected_earliest_open_period',
  'the late event was redirected to the first eligible open period'
);
select is(
  (select effective_date::text from public.journal_batches where event_id = 'evt-5'),
  '2026-07-20',
  'the original business event date is preserved'
);
select is(
  (select p.name from public.journal_batches b
     join public.accounting_periods p on p.id = b.accounting_period_id
    where b.event_id = 'evt-5'),
  '2026-08',
  'the late event landed in the open 2026-08 period, not the closed 2026-07'
);

-- ── 6. database-enforced balance (deferred constraint trigger) ───────────────
select throws_ok(
  $$ insert into public.journal_batches (id, company_id, status, source_type, source_id, event_id, effective_date, accounting_period_id, posted_at)
     values ('c9b00000-0000-4000-8000-000000000001', 'c9000000-0000-4000-8000-000000000001', 'POSTED', 'pgtap', 'unbal', 'unbal', date '2026-08-10',
             (select id from public.accounting_periods where company_id = 'c9000000-0000-4000-8000-000000000001' and name = '2026-08'), now());
     insert into public.journal_lines (id, batch_id, company_id, account_id, debit)
     values ('c9l00000-0000-4000-8000-000000000001', 'c9b00000-0000-4000-8000-000000000001', 'c9000000-0000-4000-8000-000000000001', 'coa:c9000000-0000-4000-8000-000000000001:1111', 7);
     set constraints all immediate; $$,
  'P0001',
  'JOURNAL_BATCH_UNBALANCED',
  'a POSTED batch that ends a transaction unbalanced aborts at COMMIT (deferred constraint trigger)'
);

-- ── 7. reversal ──────────────────────────────────────────────────────────────
select lives_ok(
  $$ select public.reverse_journal_batch((select id from public.journal_batches where event_id = 'evt-1')) $$,
  'a posted batch can be reversed'
);
select is(
  (select status from public.journal_batches where event_id = 'evt-1'),
  'REVERSED',
  'the original batch is marked REVERSED'
);
select is(
  (select count(*)::int from public.journal_batches
    where source_type = 'journal_reversal'
      and source_id = (select id::text from public.journal_batches where event_id = 'evt-1')),
  1,
  'exactly one reversal batch exists'
);
select is(
  (select round(sum(debit), 3) from public.journal_lines
    where batch_id = (select id from public.journal_batches
                       where source_type = 'journal_reversal'
                         and source_id = (select id::text from public.journal_batches where event_id = 'evt-1'))),
  100.005::numeric,
  'reversal lines carry the same amounts on the opposite side'
);

-- ── 8. tenant isolation (RLS) ────────────────────────────────────────────────
select set_config(
  'request.jwt.claims',
  '{"sub":"c9000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"c9000000-0000-4000-8000-000000000001"}}',
  true
);
select lives_ok(
  $$ set local role authenticated $$,
  'session switches to authenticated'
);
select is(
  (select count(*)::int from public.accounts where company_id = 'c9000000-0000-4000-8000-000000000002'),
  0,
  'company A cannot see company B accounts'
);
select is(
  (select count(*)::int from public.journal_batches where company_id = 'c9000000-0000-4000-8000-000000000002'),
  0,
  'company A cannot see company B journal batches'
);
select is(
  (select count(*)::int from public.journal_lines l
     join public.journal_batches b on b.id = l.batch_id
    where b.company_id = 'c9000000-0000-4000-8000-000000000002'),
  0,
  'company A cannot see company B journal lines'
);
select is(
  (select count(*)::int from public.accounting_periods where company_id = 'c9000000-0000-4000-8000-000000000002'),
  0,
  'company A cannot see company B accounting periods'
);
select throws_ok(
  $$ insert into public.journal_batches (company_id, status, source_type, source_id, event_id, effective_date)
     values ('c9000000-0000-4000-8000-000000000001', 'POSTED', 'x', 'y', 'z', date '2026-07-01') $$,
  null,
  null,
  'authenticated cannot write journal batches directly'
);
reset role;

-- ── 9. legacy compatibility view ─────────────────────────────────────────────
select lives_ok(
  $$ insert into public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, company_id)
     values
       ('c9j00000-0000-4000-8000-000000000001', 'PGT-D', '2026-08-05', 'coa:c9000000-0000-4000-8000-000000000001:1111', 20, 'DEBIT', 'pgtap-legacy', 'expense', 'pgtap-exp', 'c9000000-0000-4000-8000-000000000001'),
       ('c9j00000-0000-4000-8000-000000000002', 'PGT-C', '2026-08-05', 'coa:c9000000-0000-4000-8000-000000000001:6100', 20, 'CREDIT', 'pgtap-legacy', 'expense', 'pgtap-exp', 'c9000000-0000-4000-8000-000000000001') $$,
  'legacy RPC-style inserts still land through the compatibility view'
);
select is(
  (select count(*)::int from public.journal_batches where source_id = 'pgtap-legacy'),
  1,
  'compatibility inserts group into one canonical batch'
);
select is(
  (select count(*)::int from public.journal_entries where source_id = 'pgtap-legacy'),
  2,
  'the view exposes the legacy lines'
);
select is(
  (select count(*)::int from public.journal_entries_archive where id::text like 'c9j00000%'),
  0,
  'archive is frozen — new lines never reach the archive'
);

select * from finish();
rollback;

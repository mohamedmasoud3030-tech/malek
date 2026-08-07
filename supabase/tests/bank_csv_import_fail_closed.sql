-- S02 batch-1 fail-closed + tenant-isolation behavioral test for bank CSV
-- import (public.import_bank_statement_batch_atomic).
--
-- The isolated Supabase replay runs every migration from an empty database
-- before executing this file via `supabase test db`. It uses real PostgreSQL
-- roles, JWT request context, RLS, and the SECURITY DEFINER RPC; it is not a
-- source-text inspection.
--
-- Coverage (ADR D16):
--   * missing file_fingerprint           -> 22023, batch blocked
--   * empty / missing rows               -> 22023, batch blocked
--   * file_size missing/too large        -> 22023, batch blocked
--   * row count above server limit        -> 22023, batch blocked
--   * zero amount row                    -> 22023, batch blocked
--   * invalid transaction_date           -> 22023, batch blocked
--   * debit+credit ambiguity             -> 22023, batch blocked
--   * non-OMR / >3dp values              -> 22023, batch blocked
--   * OMR 3dp canonicalization           -> 100.5 and 100.500 are the same line
--   * cross-company bank account         -> 42501, batch blocked
--   * idempotent retry by fingerprint    -> same batch, no silent partial success
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- Two independent tenants and one admin user per tenant.
insert into public.companies (id, name, slug)
values
  ('00000000-0000-4000-8000-0000000000a1', 'CSV Company A', 'csv-company-a'),
  ('00000000-0000-4000-8000-0000000000b1', 'CSV Company B', 'csv-company-b')
on conflict (id) do nothing;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'csv-a@test.invalid', 'not-used', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'csv-b@test.invalid', 'not-used', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into public.users (id, email, name, role, status, is_active)
values
  ('00000000-0000-0000-0000-00000000a001', 'csv-a@test.invalid', 'CSV A Admin', 'ADMIN', 'ACTIVE', true),
  ('00000000-0000-0000-0000-00000000b001', 'csv-b@test.invalid', 'CSV B Admin', 'ADMIN', 'ACTIVE', true)
on conflict (id) do update set role = excluded.role, status = excluded.status, is_active = excluded.is_active;

insert into public.company_members (company_id, user_id, role)
values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000a001', 'ADMIN'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-00000000b001', 'ADMIN')
on conflict (company_id, user_id) do update set role = excluded.role;

insert into public.bank_accounts (id, account_name, currency, company_id)
values
  ('00000000-0000-0000-0000-00000000a401', 'CSV A Bank', 'OMR', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000b401', 'CSV B Bank', 'OMR', '00000000-0000-4000-8000-0000000000b1');

-- Act as Company A admin.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-0000000000a1"}}', true);
set local role authenticated;

-- 1. Missing file_fingerprint blocks the batch (fail-closed).
select throws_ok(
  $$select public.import_bank_statement_batch_atomic('{"bank_account_id":"00000000-0000-0000-0000-00000000a401","rows":[{"transaction_date":"2026-07-01","amount":"10.000"}]}'::jsonb)$$,
  '22023', 'file_fingerprint is required.', 'missing file_fingerprint blocks batch'
);

-- 2. Empty rows block the batch (fail-closed).
select throws_ok(
  $$select public.import_bank_statement_batch_atomic('{"bank_account_id":"00000000-0000-0000-0000-00000000a401","file_fingerprint":"fp-empty","file_size":1,"rows":[]}'::jsonb)$$,
  '22023', 'No rows to import.', 'empty rows block batch'
);
select throws_ok(
  $$select public.import_bank_statement_batch_atomic('{"bank_account_id":"00000000-0000-0000-0000-00000000a401","file_fingerprint":"fp-no-size","rows":[{"transaction_date":"2026-07-01","amount":"10.000"}]}'::jsonb)$$,
  '22023', 'file_size is required.', 'missing file_size blocks batch'
);

select throws_ok(
  $$select public.import_bank_statement_batch_atomic('{"bank_account_id":"00000000-0000-0000-0000-00000000a401","file_fingerprint":"fp-too-large","file_size":5242881,"rows":[{"transaction_date":"2026-07-01","amount":"10.000"}]}'::jsonb)$$,
  '22023', 'file_size exceeds 5242880 byte limit.', 'file_size above server limit blocks batch'
);

select throws_ok(
  $$select public.import_bank_statement_batch_atomic(jsonb_build_object('bank_account_id','00000000-0000-0000-0000-00000000a401','file_fingerprint','fp-too-many','file_size',5000,'rows',(select jsonb_agg(jsonb_build_object('transaction_date','2026-07-01','amount','10.000')) from generate_series(1,5001))))$$,
  '22023', 'Row count exceeds 5000 row limit.', 'row count above server limit blocks batch'
);


-- 3. Zero amount row blocks the batch (fail-closed).
select throws_ok(
  $$select public.import_bank_statement_batch_atomic('{"bank_account_id":"00000000-0000-0000-0000-00000000a401","file_fingerprint":"fp-zero","file_size":1,"rows":[{"transaction_date":"2026-07-01","amount":"0"}]}'::jsonb)$$,
  '22023', 'Amount must be non-zero at row 1', 'zero amount blocks batch'
);

-- 4. Invalid transaction_date blocks the batch (fail-closed).
select throws_ok(
  $$select public.import_bank_statement_batch_atomic('{"bank_account_id":"00000000-0000-0000-0000-00000000a401","file_fingerprint":"fp-date","file_size":1,"rows":[{"transaction_date":"not-a-date","amount":"10.000"}]}'::jsonb)$$,
  '22023', 'Invalid transaction_date at row 1: not-a-date', 'invalid date blocks batch'
);
select throws_ok(
  $$select public.import_bank_statement_batch_atomic('{"bank_account_id":"00000000-0000-0000-0000-00000000a401","file_fingerprint":"fp-debit-credit","file_size":1,"rows":[{"transaction_date":"2026-07-01","amount":"10.000","debit":"10.000","credit":"10.000"}]}'::jsonb)$$,
  '22023', 'Rows must not contain both debit and credit at row 1', 'debit+credit ambiguity blocks batch'
);

select throws_ok(
  $$select public.import_bank_statement_batch_atomic('{"bank_account_id":"00000000-0000-0000-0000-00000000a401","file_fingerprint":"fp-usd","file_size":1,"rows":[{"transaction_date":"2026-07-01","amount":"10.000","currency":"USD"}]}'::jsonb)$$,
  '22023', 'Unsupported currency at row 1: USD', 'non-OMR currency blocks batch'
);

select throws_ok(
  $$select public.import_bank_statement_batch_atomic('{"bank_account_id":"00000000-0000-0000-0000-00000000a401","file_fingerprint":"fp-scale","file_size":1,"rows":[{"transaction_date":"2026-07-01","amount":"10.0001"}]}'::jsonb)$$,
  '22023', 'Amount must have at most 3 decimals at row 1', 'amount scale above OMR 3dp blocks batch'
);


-- 5. Cross-company bank account is rejected (tenant isolation).
select throws_ok(
  $$select public.import_bank_statement_batch_atomic('{"bank_account_id":"00000000-0000-0000-0000-00000000b401","file_fingerprint":"fp-x-company","file_size":1,"rows":[{"transaction_date":"2026-07-01","amount":"10.000"}]}'::jsonb)$$,
  '42501', 'Bank account not found or not in your company.', 'cross-company bank account rejected'
);

-- 6. Valid batch is accepted with authoritative server counts.
select lives_ok(
  $$select public.import_bank_statement_batch_atomic('{"bank_account_id":"00000000-0000-0000-0000-00000000a401","file_name":"stmt.csv","file_fingerprint":"fp-valid","file_size":12,"rows":[{"transaction_date":"2026-07-01","amount":"100.500","description":"Rent A","reference":"REF1"},{"transaction_date":"2026-07-02","amount":"200.000","description":"Fee A","reference":"REF2"}]}'::jsonb)$$,
  'valid batch accepted'
);
select is((select count(*) from public.bank_statement_lines where company_id = '00000000-0000-4000-8000-0000000000a1'), 2::bigint, 'two lines written for company A');
select is((select total_rows from public.bank_statement_imports where company_id = '00000000-0000-4000-8000-0000000000a1' and file_fingerprint = 'fp-valid'), 2, 'import records server-side total_rows');
select is((select accepted_rows from public.bank_statement_imports where company_id = '00000000-0000-4000-8000-0000000000a1' and file_fingerprint = 'fp-valid'), 2, 'import records server-side accepted_rows');

-- 7. Idempotent retry: the same file_fingerprint returns the same batch, no
--    silent partial success and no duplicate rows.
select lives_ok(
  $$select public.import_bank_statement_batch_atomic('{"bank_account_id":"00000000-0000-0000-0000-00000000a401","file_name":"stmt.csv","file_fingerprint":"fp-valid","file_size":12,"rows":[{"transaction_date":"2026-07-01","amount":"100.500","description":"Rent A","reference":"REF1"},{"transaction_date":"2026-07-02","amount":"200.000","description":"Fee A","reference":"REF2"}]}'::jsonb)$$,
  'idempotent retry by fingerprint is accepted'
);
select is((select count(*) from public.bank_statement_imports where company_id = '00000000-0000-4000-8000-0000000000a1' and file_fingerprint = 'fp-valid' and deleted_at is null), 1::bigint, 'same fingerprint does not create a second import');
select is((select count(*) from public.bank_statement_lines where company_id = '00000000-0000-4000-8000-0000000000a1'), 2::bigint, 'no duplicate lines after idempotent retry');

-- 8. OMR 3dp canonicalization: 100.5 and 100.500 (same other fields) collapse
--    to the same fingerprint, so the second row is a duplicate (accepted=1).
select lives_ok(
  $$select public.import_bank_statement_batch_atomic('{"bank_account_id":"00000000-0000-0000-0000-00000000a401","file_name":"3dp.csv","file_fingerprint":"fp-3dp","file_size":8,"rows":[{"transaction_date":"2026-08-01","amount":"100.5","description":"Three dp","reference":"R3"},{"transaction_date":"2026-08-01","amount":"100.500","description":"Three dp","reference":"R3"}]}'::jsonb)$$,
  '3dp batch accepted'
);
select is((select duplicate_rows from public.bank_statement_imports where company_id = '00000000-0000-4000-8000-0000000000a1' and file_fingerprint = 'fp-3dp'), 1, '3dp-equivalent rows are counted as duplicates');
select is((select accepted_rows from public.bank_statement_imports where company_id = '00000000-0000-4000-8000-0000000000a1' and file_fingerprint = 'fp-3dp'), 1, '3dp-equivalent rows accepted only once');

-- 9. Blank descriptions are canonicalized identically in counting and insert passes.
select lives_ok(
  $$select public.import_bank_statement_batch_atomic('{"bank_account_id":"00000000-0000-0000-0000-00000000a401","file_name":"blank-a.csv","file_fingerprint":"fp-blank-a","file_size":11,"rows":[{"transaction_date":"2026-09-01","amount":"11.000","description":"","reference":" REF-BLANK "},{"transaction_date":"2026-09-02","amount":"12.000","description":"   ","reference":" REF-SPACE "}]}'::jsonb)$$,
  'blank-description batch accepted'
);
select is((select accepted_rows from public.bank_statement_imports where company_id = '00000000-0000-4000-8000-0000000000a1' and file_fingerprint = 'fp-blank-a'), 2, 'blank-description first file accepts both rows');
select is((select count(*) from public.bank_statement_lines where company_id = '00000000-0000-4000-8000-0000000000a1' and transaction_date in ('2026-09-01','2026-09-02') and description = 'حركة مستوردة'), 2::bigint, 'blank and whitespace descriptions store canonical fallback');
select is((
  select count(*)
  from public.bank_statement_lines
  where company_id = '00000000-0000-4000-8000-0000000000a1'
    and transaction_date in ('2026-09-01','2026-09-02')
    and fingerprint <> md5(
      company_id::text || '|' || bank_account_id::text || '|' || transaction_date::text || '|' ||
      to_char(amount, 'FM9999999999990.000') || '|' || currency || '|' || coalesce(reference,'') || '|' || lower(description)
    )
), 0::bigint, 'stored fingerprint matches canonical inserted values');
select lives_ok(
  $$select public.import_bank_statement_batch_atomic('{"bank_account_id":"00000000-0000-0000-0000-00000000a401","file_name":"blank-b.csv","file_fingerprint":"fp-blank-b","file_size":11,"rows":[{"transaction_date":"2026-09-01","amount":"11.000","description":"","reference":" REF-BLANK "},{"transaction_date":"2026-09-02","amount":"12.000","description":"   ","reference":" REF-SPACE "}]}'::jsonb)$$,
  'same logical blank-description rows in another file are accepted as a duplicate batch result'
);
select is((select accepted_rows from public.bank_statement_imports where company_id = '00000000-0000-4000-8000-0000000000a1' and file_fingerprint = 'fp-blank-b'), 0, 'same logical rows from different file are not counted accepted');
select is((select duplicate_rows from public.bank_statement_imports where company_id = '00000000-0000-4000-8000-0000000000a1' and file_fingerprint = 'fp-blank-b'), 2, 'same logical rows from different file are counted duplicate');
select is((select count(*) from public.bank_statement_lines where company_id = '00000000-0000-4000-8000-0000000000a1' and transaction_date in ('2026-09-01','2026-09-02')), 2::bigint, 'duplicate blank-description import creates no extra lines');

-- 10. Tenant isolation of written lines: Company A cannot read Company B's
--    lines through the RLS boundary (B has no lines yet).
select is((select count(*) from public.bank_statement_lines where company_id = '00000000-0000-4000-8000-0000000000b1'), 0::bigint, 'company B has no imported lines (unaffected by A)');

reset role;

-- 10. Company B imports independently into its own company scope.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b001","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-0000000000b1"}}', true);
set local role authenticated;
select lives_ok(
  $$select public.import_bank_statement_batch_atomic('{"bank_account_id":"00000000-0000-0000-0000-00000000b401","file_name":"b.csv","file_fingerprint":"fp-b","file_size":9,"rows":[{"transaction_date":"2026-07-10","amount":"50.000","description":"B line","reference":"BR1"}]}'::jsonb)$$,
  'company B can import into its own account'
);
select is((select count(*) from public.bank_statement_lines where company_id = '00000000-0000-4000-8000-0000000000b1'), 1::bigint, 'company B wrote exactly one line');

-- Restore the test-runner role before checking Company A. Under Company B's
-- authenticated RLS context the correct visible count for Company A is zero,
-- which cannot prove that B's import left A's five persisted lines unchanged.
reset role;
select is((select count(*) from public.bank_statement_lines where company_id = '00000000-0000-4000-8000-0000000000a1'), 5::bigint, 'company A lines are untouched');

select * from finish();
rollback;

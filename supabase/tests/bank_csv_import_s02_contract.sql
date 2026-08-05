-- S02-T07/T08 pgTAP contract checks for bank CSV imports.
-- These are static database-contract assertions around the SECURITY DEFINER RPC;
-- behavioral execution is covered by application migration-contract tests.

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select has_function(
  'public',
  'import_bank_statement_batch_atomic',
  array['jsonb'],
  'bank CSV import RPC exists'
);

select ok(
  lower(pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure)) like '%security definer%'
  and lower(pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure)) like '%set search_path to%public%pg_temp%',
  'RPC is SECURITY DEFINER with pinned search_path'
);

select ok(
  pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure) like '%jsonb_array_length(v_errors) > 0%'
  and pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure) like '%Bank CSV import rejected fail-closed%'
  and pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure) like '%Validation pass: collect every row error and compute canonical identity before any write%'
  and position('insert into public.bank_statement_imports' in pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure))
      > position('jsonb_array_length(v_errors) > 0' in pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure)),
  'RPC validates all rows and raises before any batch write'
);

select ok(
  pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure) like '%v_total, v_total, 0, 0%'
  and pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure) not like '%accepted_rows%payload%'
  and pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure) not like '%rejected_rows%payload%',
  'server recomputes authoritative counts instead of trusting client counts'
);

select ok(
  pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure) like '%c_max_file_size integer := 5 * 1024 * 1024%'
  and pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure) like '%c_max_rows integer := 10000%'
  and pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure) like '%c_max_text_length integer := 512%',
  'server-side file, row and text limits are present'
);

select ok(
  pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure) like '%bank-import-v1|%'
  and pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure) like '%v_company_id::text%'
  and pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure) like '%v_bank_account_id::text%'
  and pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure) not like '%random()%'
  and pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure) not like '%gen_random_uuid()%file_fingerprint%',
  'import fingerprint is deterministic and scoped by company/account/content'
);

select ok(
  pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure) like '%pg_advisory_xact_lock%'
  and pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure) like '%is_duplicate_file%true%'
  and position('select * into v_existing_import' in pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure))
      < position('exact_duplicate_existing_line' in pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure)),
  'concurrent/exact retry checks existing batch before duplicate-line rejection'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'ux_bank_imports_company_fingerprint'
      and indexdef like '%company_id%file_fingerprint%'
  )
  and exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'ux_bank_lines_company_fingerprint'
      and indexdef like '%company_id%fingerprint%'
  ),
  'unique import/line fingerprints are company scoped for cross-company isolation'
);

select * from finish();

rollback;

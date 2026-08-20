-- Runtime repair applied to the experimental Malek database on 2026-08-19.
-- journal_entries.id is UUID; these legacy RPC journal INSERTs still emitted
-- gen_random_uuid()::text and failed with PostgreSQL 42804.

do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.create_expense_with_journal_atomic_phase3a1a_impl(jsonb)'::regprocedure) into v_def;
  v_def := replace(v_def, '(gen_random_uuid()::text, v_expense_no || ''-D''', '(gen_random_uuid(), v_expense_no || ''-D''');
  v_def := replace(v_def, '(gen_random_uuid()::text, v_expense_no || ''-C''', '(gen_random_uuid(), v_expense_no || ''-C''');
  execute v_def;

  select pg_get_functiondef('public.create_deposit_atomic(jsonb)'::regprocedure) into v_def;
  v_def := replace(v_def, '(gen_random_uuid()::text, ''DEP-''||substr(v_deposit_id,1,6)||''-D''', '(gen_random_uuid(), ''DEP-''||substr(v_deposit_id,1,6)||''-D''');
  v_def := replace(v_def, '(gen_random_uuid()::text, ''DEP-''||substr(v_deposit_id,1,6)||''-C''', '(gen_random_uuid(), ''DEP-''||substr(v_deposit_id,1,6)||''-C''');
  execute v_def;

  select pg_get_functiondef('public.deduct_deposit_atomic_phase3a1a_impl(jsonb)'::regprocedure) into v_def;
  v_def := replace(v_def, '(gen_random_uuid()::text, ''DEP-DED-''||substr(v_deposit_id,1,6)||''-D''', '(gen_random_uuid(), ''DEP-DED-''||substr(v_deposit_id,1,6)||''-D''');
  v_def := replace(v_def, '(gen_random_uuid()::text, ''DEP-DED-''||substr(v_deposit_id,1,6)||''-C''', '(gen_random_uuid(), ''DEP-DED-''||substr(v_deposit_id,1,6)||''-C''');
  execute v_def;

  select pg_get_functiondef('public.refund_deposit_atomic_phase3a1a_impl(jsonb)'::regprocedure) into v_def;
  v_def := replace(v_def, '(gen_random_uuid()::text, ''DEP-REF-''||substr(v_deposit_id,1,6)||''-D''', '(gen_random_uuid(), ''DEP-REF-''||substr(v_deposit_id,1,6)||''-D''');
  v_def := replace(v_def, '(gen_random_uuid()::text, ''DEP-REF-''||substr(v_deposit_id,1,6)||''-C''', '(gen_random_uuid(), ''DEP-REF-''||substr(v_deposit_id,1,6)||''-C''');
  execute v_def;
end $$;

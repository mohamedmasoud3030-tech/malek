-- Fix runtime schema drift in the expense/deposit financial RPCs.
--
-- journal_entries.id is UUID in the current schema, while four legacy RPC
-- implementations still emitted gen_random_uuid()::text for journal row IDs.
-- PostgreSQL does not implicitly cast text back to uuid in INSERT expressions,
-- so real expense/deposit posting failed at runtime.
--
-- Also stop deriving expense display numbers from the wrapper's internal
-- request-id prefix ("phase3a1a:..."). Use the generated expense UUID prefix so
-- independently created expenses receive distinct display numbers.

begin;

do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  -- Expense creation: journal row PKs must remain UUID values.
  select pg_get_functiondef(
    'public.create_expense_with_journal_atomic_phase3a1a_impl(jsonb)'::regprocedure
  ) into v_def;

  v_def := replace(
    v_def,
    '(gen_random_uuid()::text, v_expense_no || ''-D''',
    '(gen_random_uuid(), v_expense_no || ''-D'''
  );
  v_def := replace(
    v_def,
    '(gen_random_uuid()::text, v_expense_no || ''-C''',
    '(gen_random_uuid(), v_expense_no || ''-C'''
  );

  v_old := 'v_expense_no := ''EXP-'' || to_char(now(), ''YYYYMMDD'') || ''-'' || substr(replace(v_request_id, ''-'', ''''), 1, 6);';
  v_new := 'v_expense_no := ''EXP-'' || to_char(now(), ''YYYYMMDD'') || ''-'' || substr(replace(v_expense_id::text, ''-'', ''''), 1, 8);';
  if position(v_old in v_def) > 0 then
    v_def := replace(v_def, v_old, v_new);
  elsif position(v_new in v_def) = 0 then
    raise exception 'Unexpected create_expense_with_journal_atomic implementation; expense-number patch cannot be applied safely';
  end if;

  execute v_def;

  -- Deposit receipt: journal row PKs must remain UUID values.
  select pg_get_functiondef('public.create_deposit_atomic(jsonb)'::regprocedure)
    into v_def;
  v_def := replace(
    v_def,
    '(gen_random_uuid()::text, ''DEP-''||substr(v_deposit_id,1,6)||''-D''',
    '(gen_random_uuid(), ''DEP-''||substr(v_deposit_id,1,6)||''-D'''
  );
  v_def := replace(
    v_def,
    '(gen_random_uuid()::text, ''DEP-''||substr(v_deposit_id,1,6)||''-C''',
    '(gen_random_uuid(), ''DEP-''||substr(v_deposit_id,1,6)||''-C'''
  );
  execute v_def;

  -- Deposit deduction: journal row PKs must remain UUID values.
  select pg_get_functiondef(
    'public.deduct_deposit_atomic_phase3a1a_impl(jsonb)'::regprocedure
  ) into v_def;
  v_def := replace(
    v_def,
    '(gen_random_uuid()::text, ''DEP-DED-''||substr(v_deposit_id,1,6)||''-D''',
    '(gen_random_uuid(), ''DEP-DED-''||substr(v_deposit_id,1,6)||''-D'''
  );
  v_def := replace(
    v_def,
    '(gen_random_uuid()::text, ''DEP-DED-''||substr(v_deposit_id,1,6)||''-C''',
    '(gen_random_uuid(), ''DEP-DED-''||substr(v_deposit_id,1,6)||''-C'''
  );
  execute v_def;

  -- Deposit refund: journal row PKs must remain UUID values.
  select pg_get_functiondef(
    'public.refund_deposit_atomic_phase3a1a_impl(jsonb)'::regprocedure
  ) into v_def;
  v_def := replace(
    v_def,
    '(gen_random_uuid()::text, ''DEP-REF-''||substr(v_deposit_id,1,6)||''-D''',
    '(gen_random_uuid(), ''DEP-REF-''||substr(v_deposit_id,1,6)||''-D'''
  );
  v_def := replace(
    v_def,
    '(gen_random_uuid()::text, ''DEP-REF-''||substr(v_deposit_id,1,6)||''-C''',
    '(gen_random_uuid(), ''DEP-REF-''||substr(v_deposit_id,1,6)||''-C'''
  );
  execute v_def;
end $$;

commit;

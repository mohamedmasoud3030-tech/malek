-- The company-isolation wrapper namespaces request IDs as
-- phase3a1a:<company>:<request>. The legacy implementation used the first six
-- characters of that internal value for the display number, producing repeated
-- EXP-YYYYMMDD-phase3 values. Derive the suffix from the generated expense UUID.

do $$
declare
  v_def text;
  v_old text := 'v_expense_no := ''EXP-'' || to_char(now(), ''YYYYMMDD'') || ''-'' || substr(replace(v_request_id, ''-'', ''''), 1, 6);';
  v_new text := 'v_expense_no := ''EXP-'' || to_char(now(), ''YYYYMMDD'') || ''-'' || substr(replace(v_expense_id::text, ''-'', ''''), 1, 8);';
begin
  select pg_get_functiondef('public.create_expense_with_journal_atomic_phase3a1a_impl(jsonb)'::regprocedure) into v_def;
  if position(v_old in v_def) = 0 then
    raise exception 'Expense number patch did not match current function definition';
  end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end $$;

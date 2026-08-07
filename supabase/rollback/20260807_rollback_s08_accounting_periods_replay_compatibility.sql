-- MANUAL ROLLBACK ONLY — DO NOT APPLY AUTOMATICALLY.
-- Reverses: supabase/migrations/20260807015000_s08_accounting_periods_replay_compatibility.sql
--
-- Safety: drop only replay compatibility VIEWs. Never drop canonical Stage 3
-- TABLEs. This rollback is relation-kind aware and is a no-op for real tables.

begin;

do $rollback$
declare
  v_relation text;
  v_relkind "char";
begin
  foreach v_relation in array array[
    'journal_lines',
    'journal_batches',
    'accounting_periods'
  ]
  loop
    select c.relkind
      into v_relkind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = v_relation;

    if v_relkind = 'v' then
      execute format('drop view public.%I', v_relation);
    end if;

    v_relkind := null;
  end loop;
end
$rollback$;

commit;

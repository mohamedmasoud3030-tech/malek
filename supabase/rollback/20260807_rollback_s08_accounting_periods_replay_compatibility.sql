-- MANUAL ROLLBACK ONLY — DO NOT APPLY AUTOMATICALLY.
-- Reverses: supabase/migrations/20260807015000_s08_accounting_periods_replay_compatibility.sql
--
-- Safety: drop only the replay compatibility VIEW. Never drop the canonical
-- Stage 3 accounting_periods TABLE. This rollback is intentionally relation-
-- kind aware and is a no-op when the canonical table exists.

begin;

do $rollback$
declare
  v_relkind "char";
begin
  select c.relkind
    into v_relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'accounting_periods';

  if v_relkind = 'v' then
    execute 'drop view public.accounting_periods';
  end if;
end
$rollback$;

commit;

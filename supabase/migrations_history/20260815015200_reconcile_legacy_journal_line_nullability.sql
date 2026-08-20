-- The live S03 hotfix requires its legacy line_no projection on every insert.
-- Canonical Stage 3 writes the equivalent `no` column instead. Relax only the
-- legacy projection so canonical backfill can preserve its own evidence;
-- existing line numbers are unchanged.

do $reconcile$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'journal_lines'
      and column_name = 'line_no'
      and is_nullable = 'NO'
  ) then
    alter table public.journal_lines alter column line_no drop not null;
  end if;
end;
$reconcile$;

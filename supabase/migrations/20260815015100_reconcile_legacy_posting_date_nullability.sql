-- The live S03 hotfix made journal_batches.posting_date NOT NULL before the
-- canonical legacy backfill existed. Canonical Stage 3 permits NULL during
-- backfill and resolves posting metadata in the later late-posting migration.
-- Dropping NOT NULL preserves every existing value and is idempotent.

do $reconcile$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'journal_batches'
      and column_name = 'posting_date'
      and is_nullable = 'NO'
  ) then
    alter table public.journal_batches
      alter column posting_date drop not null;
  end if;
end;
$reconcile$;

-- Three historical live receipts use an empty string as "no reference". The
-- canonical document-reference contract treats missing references as NULL so
-- the deterministic backfill can assign unique RCT references. Normalize only
-- blank values; non-blank business references are never changed.

do $reconcile$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'receipts'
      and column_name = 'reference'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'receipts'
        and column_name = 'reference'
        and is_generated = 'ALWAYS'
    ) then
      -- The legacy compatibility shape projects reference from `ref` as a
      -- stored generated column. Convert it to an ordinary column while
      -- preserving every generated value so the canonical trigger/backfill can
      -- own the business-reference lifecycle from this point forward.
      alter table public.receipts
        alter column reference drop expression;
    end if;

    update public.receipts
    set reference = null
    where reference is not null
      and btrim(reference) = '';
  end if;
end;
$reconcile$;

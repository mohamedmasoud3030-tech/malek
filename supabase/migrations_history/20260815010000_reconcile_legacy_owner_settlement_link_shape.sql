-- Reconcile the pre-canonical live hotfix shape for FA-003 reservation links.
--
-- A historical live-only hotfix created these two tables before the canonical
-- 20260804010000 migration was recorded. Its shape used expense_id text and a
-- reduced audit surface. The canonical migration cannot safely adopt that
-- shape. The legacy tables are reservation infrastructure only and this repair
-- is deliberately fail-closed: it removes them only when both are present,
-- carry the legacy created_by marker, and contain no rows. On a clean replay,
-- or on any database with canonical tables or reservation data, it is a no-op.

do $reconcile$
declare
  v_payment_count bigint;
  v_expense_count bigint;
  v_legacy_payment boolean;
  v_legacy_expense boolean;
begin
  if to_regclass('public.owner_settlement_payment_links') is null
     or to_regclass('public.owner_settlement_expense_links') is null then
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'owner_settlement_payment_links'
      and column_name = 'created_by'
  ) into v_legacy_payment;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'owner_settlement_expense_links'
      and column_name = 'created_by'
  ) into v_legacy_expense;

  if not (v_legacy_payment and v_legacy_expense) then
    return;
  end if;

  execute 'select count(*) from public.owner_settlement_payment_links'
    into v_payment_count;
  execute 'select count(*) from public.owner_settlement_expense_links'
    into v_expense_count;

  if v_payment_count <> 0 or v_expense_count <> 0 then
    raise exception
      'LEGACY_OWNER_SETTLEMENT_LINKS_NOT_EMPTY: payment=%, expense=%',
      v_payment_count,
      v_expense_count
      using errcode = 'P0001';
  end if;

  drop table public.owner_settlement_payment_links;
  drop table public.owner_settlement_expense_links;
end;
$reconcile$;

-- FIN-002 (OMR 3-decimal integrity); completes the owner-balance work of
-- 20260909000019.
--
-- `public.owner_balances` stores the four owner money columns as
-- numeric(14,2). OMR is a 3-decimal currency (1000 baisa) and every canonical
-- helper in this schema rounds to 3 (`public._r3`, `public.wp05_round_omr`,
-- and the numeric(18,3) columns used by `owner_funds_events`,
-- `due_from_owners` and the settlement tables).
--
-- The 2-decimal column silently truncates that third decimal on write. Proved
-- against real SQL before this repair: a single POSTED owner expense of 12.345
-- recalculated through `public.recalculate_owner_balance` produced
--
--   owner_balances.total_expenses = 12.35   (stored)
--   rpt_owner_statement expense    = 12.345  (authoritative)
--
-- a 0.005 disagreement — 5 baisa — between the persisted balance and the
-- statement it is supposed to reconcile to. `recalculate_owner_balance`
-- already applies `public._r3(...)` to every value it writes, so the loss is
-- introduced purely by the column type, after the correct 3-decimal figure has
-- been computed. Aggregated across many owners this is a real reconciliation
-- break, and it is exactly the drift shape 20260909000019 set out to remove.
--
-- Widening numeric(14,2) -> numeric(18,3) is LOSSLESS and non-destructive:
--   * every existing value is representable in the wider type, so no stored
--     figure changes and no history is rewritten;
--   * 18 total digits keeps the same integer headroom as the other money
--     columns in the schema;
--   * two S08 reconciliation views read `net_balance`
--     (`public.s08_liability_balances_by_period`, and
--     `public.s08_subledger_gl_reconciliation` which is layered on top of it).
--     PostgreSQL will not widen a column underneath a view, so both are
--     captured verbatim -- definition, `security_invoker`, ownership and every
--     grant -- dropped in dependency order, and recreated byte-identically
--     from the captured text. Nothing about them is retyped or redesigned
--     here; if the capture does not round-trip, the migration aborts.
--
-- This migration does NOT recompute or backfill any balance row. Existing rows
-- keep the (possibly 2-decimal-rounded) values they already hold until their
-- owner's next lawful recalculation, which is the same rule 20260909000019
-- followed. Correcting a stored figure is a governed accounting action, not a
-- side effect of a type change.
--
-- Precedent: 20260909000012 widened `public.maintenance_records.cost` to
-- numeric(18,3) for the same reason.
begin;

do $precision$
declare
  r record;
  v_before bigint;
  v_after bigint;
  v_acl text;
  v_grantee text;
begin
  -- Fail closed if the table is not the shape this migration was written
  -- against, rather than silently altering something unexpected.
  if to_regclass('public.owner_balances') is null then
    raise exception 'OWNER_BALANCE_PRECISION_PRECONDITION: public.owner_balances is missing';
  end if;

  select count(*) into v_before
  from pg_attribute a
  where a.attrelid = 'public.owner_balances'::regclass
    and a.attname in ('total_income','total_expenses','commission','net_balance')
    and not a.attisdropped
    and format_type(a.atttypid, a.atttypmod) = 'numeric(14,2)';

  -- Already migrated (idempotent replay) -> nothing to do.
  if v_before = 0 then
    return;
  end if;

  if v_before <> 4 then
    raise exception 'OWNER_BALANCE_PRECISION_PRECONDITION: expected 4 numeric(14,2) money columns, found %', v_before;
  end if;

  -- Capture every dependent view verbatim before touching the column type.
  -- Only the two known S08 reconciliation views may participate; anything else
  -- means the schema has changed under this migration and it must not guess.
  create temp table _ob_views on commit drop as
  select c.oid,
         c.relname::text                              as view_name,
         pg_get_viewdef(c.oid, true)                  as definition,
         pg_get_userbyid(c.relowner)                  as view_owner,
         c.reloptions                                 as options,
         coalesce(c.relacl::text[], array[]::text[])  as acl
  from pg_depend d
  join pg_rewrite rw on rw.oid = d.objid
  join pg_class c on c.oid = rw.ev_class
  where d.refobjid = 'public.owner_balances'::regclass
    and d.refobjsubid > 0
    and c.relkind = 'v'
  group by c.oid, c.relowner, c.reloptions, c.relacl;

  if exists (
    select 1 from _ob_views
    where view_name not in ('s08_liability_balances_by_period', 's08_subledger_gl_reconciliation')
  ) then
    raise exception 'OWNER_BALANCE_PRECISION_PRECONDITION: unexpected dependent view %',
      (select string_agg(view_name, ', ') from _ob_views
        where view_name not in ('s08_liability_balances_by_period', 's08_subledger_gl_reconciliation'));
  end if;

  if exists (select 1 from _ob_views where definition is null or btrim(definition) = '') then
    raise exception 'OWNER_BALANCE_PRECISION_PRECONDITION: could not capture a dependent view definition';
  end if;

  -- Dependency order: the reconciliation view is layered on the balances view.
  drop view if exists public.s08_subledger_gl_reconciliation;
  drop view if exists public.s08_liability_balances_by_period;

  for r in
    select unnest(array['total_income','total_expenses','commission','net_balance']) as col
  loop
    execute format(
      'alter table public.owner_balances alter column %I type numeric(18,3)',
      r.col);
    execute format(
      'alter table public.owner_balances alter column %I set default 0',
      r.col);
  end loop;

  -- Recreate both views from the captured text, restoring security_invoker,
  -- owner and ACLs exactly as they were.
  for r in
    select * from _ob_views
    order by case view_name when 's08_liability_balances_by_period' then 1 else 2 end
  loop
    execute format('create view public.%I %s as %s',
      r.view_name,
      case when r.options is null then ''
           else 'with (' || array_to_string(r.options, ', ') || ')' end,
      r.definition);
    execute format('alter view public.%I owner to %I', r.view_name, r.view_owner);
    foreach v_acl in array r.acl loop
      -- aclitem text form: grantee=privs/grantor
      v_grantee := split_part(v_acl, '=', 1);
      if v_grantee <> '' then
        execute format('grant all on table public.%I to %I', r.view_name, v_grantee);
      end if;
    end loop;
  end loop;

  if to_regclass('public.s08_liability_balances_by_period') is null
     or to_regclass('public.s08_subledger_gl_reconciliation') is null then
    raise exception 'OWNER_BALANCE_PRECISION_POSTCONDITION: a dependent view was not restored';
  end if;

  select count(*) into v_after
  from pg_attribute a
  where a.attrelid = 'public.owner_balances'::regclass
    and a.attname in ('total_income','total_expenses','commission','net_balance')
    and not a.attisdropped
    and format_type(a.atttypid, a.atttypmod) = 'numeric(18,3)';

  if v_after <> 4 then
    raise exception 'OWNER_BALANCE_PRECISION_POSTCONDITION: % of 4 columns are numeric(18,3)', v_after;
  end if;
end; $precision$;

comment on table public.owner_balances is
  'Derived owner balance snapshot maintained by public.recalculate_owner_balance. Money columns are numeric(18,3): OMR carries 3 decimals (baisa) and a 2-decimal column silently truncated the third, making the stored balance disagree with rpt_owner_statement. Rows are recomputed from canonical sources by the recalculation function; this table is never the authority for owner money, and widening the columns did not recompute or backfill any existing row.';

notify pgrst, 'reload schema';
commit;

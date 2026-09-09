-- FIN-002 (OMR 3-decimal integrity), continued from 20260909000020.
--
-- `pnpm db0:audit` reported 28 MAJOR DB0-07 precision findings. Four were
-- `public.owner_balances` and were repaired by 20260909000020. The remaining 24
-- were each checked individually against the LIVE column type rather than
-- treated as one undifferentiated list, because the audit rule flags any column
-- that is not exactly 3 decimals and that includes columns which lose nothing:
--
--   * UNCONSTRAINED `numeric` (no typmod) keeps every decimal it is given and
--     therefore cannot truncate baisa. This covers all five
--     `public.owner_settlements` money columns, `public.tenant_balances`,
--     `public.commissions` and `public.lands`. They are NOT changed here:
--     imposing numeric(18,3) on them would be a narrowing that could round
--     posted settlement history, which is exactly what must never happen.
--   * DELIBERATELY WIDER scales are rates and snapshots, not OMR amounts:
--     `owner_agreements.commission_value` / `owner_agreement_versions.
--     commission_value` / `fixed_monthly_daily_accruals.monthly_contract_amount`
--     are numeric(14,4), and the contract-registration fee columns are
--     numeric(18,6). A commission RATE legitimately needs more than 3 decimals;
--     narrowing them to 3 would change agreed commercial terms. NOT changed.
--
-- That leaves exactly SEVEN columns that genuinely truncate a real OMR amount.
-- Proved at the storage layer before this repair — writing 12.345 into each and
-- reading it back returned 12.35, losing 5 baisa:
--
--   public.contract_balances.total_paid          numeric(14,2)
--   public.contract_balances.total_invoiced      numeric(14,2)
--   public.contract_balances.balance_due         numeric(14,2)
--   public.bank_accounts.opening_balance         numeric(14,2)
--   public.units.rent_amount                     numeric(14,2)
--   public.utility_bills.paid_amount             numeric(14,2)
--   public.properties.purchase_value             numeric(14,2)
--
-- `public.contract_balances` is the most serious of these and is the SAME
-- defect shape 20260909000020 fixed on `owner_balances`: a persisted, DERIVED
-- table maintained by `public.recalculate_all_balances`,
-- `public.update_contract_balance_from_invoice` and
-- `public.update_contract_balance_from_allocation`. The recalculation computes
-- a correct figure from payments and invoices and the column then rounds it, so
-- the stored balance can disagree with the invoices and receipts that back it.
--
-- Widening numeric(14,2) -> numeric(18,3) is LOSSLESS: every existing value is
-- representable, so no stored figure changes and no history is rewritten. NO
-- row is recomputed or backfilled by this migration; derived rows keep their
-- current values until their next lawful recalculation, exactly as
-- 20260909000019 and 20260909000020 did. Correcting an already-stored figure is
-- a governed accounting action, not a side effect of a type change.
--
-- `public.properties.purchase_value` and `public.units.rent_amount` are
-- user-entered commercial terms rather than derived balances; widening them
-- only removes a silent input truncation and cannot alter an existing value.
--
-- As in 20260909000020, the two S08 reconciliation views read one of these
-- columns (`contract_balances.balance_due` feeds the 1300 subledger line), and
-- PostgreSQL will not widen a column underneath a view. Both views are captured
-- verbatim -- definition, `security_invoker`, owner and every grant -- dropped
-- in dependency order, and recreated byte-identically from the captured text.
-- Nothing about them is retyped or redesigned, and the migration aborts if any
-- view other than those two turns out to depend on the columns.
begin;

do $money$
declare
  r record;
  v_remaining int;
  v_view text;
  v_acl text;
  v_grantee text;
begin
  -- Capture dependent views once, before any type change.
  create temp table _mc_views on commit drop as
  select distinct
         c.relname::text                              as view_name,
         pg_get_viewdef(c.oid, true)                  as definition,
         pg_get_userbyid(c.relowner)                  as view_owner,
         c.reloptions                                 as options,
         coalesce(c.relacl::text[], array[]::text[])  as acl
  from pg_depend d
  join pg_rewrite rw on rw.oid = d.objid
  join pg_class c on c.oid = rw.ev_class
  join pg_attribute a on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
  where d.refobjsubid > 0
    and c.relkind = 'v'
    -- Only the SEVEN columns actually being widened. A view that merely reads
    -- some other column of the same table is untouched by an ALTER of these.
    and (d.refobjid, a.attname) in (
      ('public.contract_balances'::regclass, 'total_paid'),
      ('public.contract_balances'::regclass, 'total_invoiced'),
      ('public.contract_balances'::regclass, 'balance_due'),
      ('public.bank_accounts'::regclass,     'opening_balance'),
      ('public.units'::regclass,             'rent_amount'),
      ('public.utility_bills'::regclass,     'paid_amount'),
      ('public.properties'::regclass,        'purchase_value'));

  if exists (
    select 1 from _mc_views
    where view_name not in ('s08_liability_balances_by_period', 's08_subledger_gl_reconciliation')
  ) then
    raise exception 'MONEY_PRECISION_PRECONDITION: unexpected dependent view %',
      (select string_agg(view_name, ', ') from _mc_views
        where view_name not in ('s08_liability_balances_by_period', 's08_subledger_gl_reconciliation'));
  end if;

  if exists (select 1 from _mc_views where definition is null or btrim(definition) = '') then
    raise exception 'MONEY_PRECISION_PRECONDITION: could not capture a dependent view definition';
  end if;

  drop view if exists public.s08_subledger_gl_reconciliation;
  drop view if exists public.s08_liability_balances_by_period;
  for r in
    select * from (values
      ('contract_balances','total_paid'),
      ('contract_balances','total_invoiced'),
      ('contract_balances','balance_due'),
      ('bank_accounts','opening_balance'),
      ('units','rent_amount'),
      ('utility_bills','paid_amount'),
      ('properties','purchase_value')
    ) as t(tbl, col)
  loop
    if to_regclass('public.' || quote_ident(r.tbl)) is null then
      raise exception 'MONEY_PRECISION_PRECONDITION: public.% is missing', r.tbl;
    end if;

    -- Idempotent replay: skip anything already widened.
    if not exists (
      select 1 from pg_attribute a
      where a.attrelid = ('public.' || quote_ident(r.tbl))::regclass
        and a.attname = r.col
        and not a.attisdropped
        and format_type(a.atttypid, a.atttypmod) = 'numeric(14,2)'
    ) then
      continue;
    end if;

    execute format('alter table public.%I alter column %I type numeric(18,3)', r.tbl, r.col);
  end loop;

  -- Restore both views exactly as captured.
  for r in
    select * from _mc_views
    order by case view_name when 's08_liability_balances_by_period' then 1 else 2 end
  loop
    execute format('create view public.%I %s as %s',
      r.view_name,
      case when r.options is null then ''
           else 'with (' || array_to_string(r.options, ', ') || ')' end,
      r.definition);
    execute format('alter view public.%I owner to %I', r.view_name, r.view_owner);
    foreach v_acl in array r.acl loop
      v_grantee := split_part(v_acl, '=', 1);
      if v_grantee <> '' then
        execute format('grant all on table public.%I to %I', r.view_name, v_grantee);
      end if;
    end loop;
  end loop;

  if to_regclass('public.s08_liability_balances_by_period') is null
     or to_regclass('public.s08_subledger_gl_reconciliation') is null then
    raise exception 'MONEY_PRECISION_POSTCONDITION: a dependent view was not restored';
  end if;

  select count(*) into v_remaining
  from (values
    ('contract_balances','total_paid'),
    ('contract_balances','total_invoiced'),
    ('contract_balances','balance_due'),
    ('bank_accounts','opening_balance'),
    ('units','rent_amount'),
    ('utility_bills','paid_amount'),
    ('properties','purchase_value')
  ) as t(tbl, col)
  join pg_attribute a
    on a.attrelid = ('public.' || quote_ident(t.tbl))::regclass
   and a.attname = t.col
   and not a.attisdropped
  where format_type(a.atttypid, a.atttypmod) <> 'numeric(18,3)';

  if v_remaining <> 0 then
    raise exception 'MONEY_PRECISION_POSTCONDITION: % column(s) are still not numeric(18,3)', v_remaining;
  end if;
end; $money$;

comment on table public.contract_balances is
  'Derived contract balance snapshot maintained by public.recalculate_all_balances and the invoice/allocation updaters. Money columns are numeric(18,3): OMR carries 3 decimals (baisa) and the previous 2-decimal columns truncated the third after the correct figure had been computed, letting the stored balance disagree with the invoices and receipts backing it. This table is never the authority for contract money; widening did not recompute or backfill any existing row.';

notify pgrst, 'reload schema';
commit;

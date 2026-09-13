-- FIN-002 follow-up: remove the last silent 3-decimal truncation in a
-- human-entered monetary column.
--
-- WHY THIS IS A DEFECT, NOT A DOCUMENTED EXCEPTION
-- docs/execution/RECONSTRUCTION_INVENTORY.md records `properties.current_value`
-- among "7 scale-2 columns, none of which is OMR ledger money", and treats that
-- as intentional. That classification is about *stored history*, and it is
-- correct: widening cannot change a value that was already rounded.
--
-- It does not, however, describe the WRITE path. Live measurement on
-- `nnggcnpcuomwfuupupwg` (2026-09-13) showed the property form renders this
-- field with the shared OMR money step:
--
--   rentrix-app/src/lib/money.ts            getCurrencyStep('OMR') = '0.001'
--   property-form-core-fields.tsx:46        <Input type="number" step={MONEY_STEP} ...>
--   property-schema.ts:22                  current_value: optionalMoney  (no scale check)
--
-- so the UI invites a third decimal, validation accepts it, and the column
-- discards it on the way in:
--
--   760000.123::numeric(14,2) = 760000.12   -- one baisa lost, no error
--   0.001::numeric(14,2)      = 0.00        -- the whole amount vanishes
--
-- Its sibling `purchase_value` is already numeric(18,3), so the two halves of
-- any capital-gain or yield comparison are held at different precisions.
--
-- WHAT THIS DOES
-- Widen `current_value` to numeric(18,3), matching `purchase_value` and the
-- canonical OMR rule (DATABASE_RULES.md line 36). This is a pure widening:
-- every existing value is representable, so no stored figure is recomputed,
-- rounded, or backfilled.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   * No change to the other six scale-2 columns: `vat_rate`, `tax_rate`,
--     `response_time_hours` and the three `utility_bills` reading columns are
--     rates, durations and meter readings, not amounts.
--   * No narrowing of any unconstrained `numeric` (owner_settlements,
--     tenant_balances, commissions, lands) - that would round posted history.
--   * No application-layer change. Once the column holds 3 decimals,
--     MONEY_STEP 0.001 is already correct and consistent.
--   * `properties.purchase_value` / `current_value` are NOT added to any ledger
--     aggregate; they remain descriptive property facts, not postings.

begin;

do $preflight$
declare
  v_precision integer;
  v_scale integer;
begin
  select c.numeric_precision, c.numeric_scale
    into v_precision, v_scale
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'properties'
    and c.column_name = 'current_value'
    and c.data_type = 'numeric';

  if not found then
    raise exception 'PROPERTIES_CURRENT_VALUE_NUMERIC_REQUIRED'
      using errcode = '42703';
  end if;

  -- Idempotent by design: an already-widened column is a no-op, so a re-run
  -- (or a repository applied ahead of this migration) cannot fail the chain.
  if v_scale in (2, 3) then
    return;
  end if;

  raise exception 'PROPERTIES_CURRENT_VALUE_UNEXPECTED_SCALE: expected 2 or 3, found %', v_scale
    using errcode = '22003';
end
$preflight$;

alter table public.properties
  alter column current_value type numeric(18,3)
  using current_value::numeric(18,3);

-- Postcondition: fail the transaction rather than leave a half-applied type.
do $postcheck$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from information_schema.columns c
  join pg_class pc on pc.relname = c.table_name and pc.relnamespace = 'public'::regnamespace
  join pg_attribute a on a.attrelid = pc.oid and a.attname = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'properties'
    and c.column_name = 'current_value'
    and format_type(a.atttypid, a.atttypmod) <> 'numeric(18,3)';

  if v_bad <> 0 then
    raise exception 'PROPERTY_VALUATION_PRECISION_POSTCONDITION: current_value is still not numeric(18,3)'
      using errcode = 'P0001';
  end if;
end
$postcheck$;

comment on column public.properties.current_value is
  'Owner-entered current valuation in OMR. numeric(18,3) to match purchase_value and the canonical 3-decimal money rule; it is a descriptive valuation, not a ledger posting, and is never summed into contract or owner balances.';

commit;

notify pgrst, 'reload schema';

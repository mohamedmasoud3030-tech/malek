-- Financial precision hardening: fix the independently-proven OMR precision defect
-- in bank reconciliation without performing a broad, name-based schema rewrite.
--
-- bank_reconciliation_matches.matched_amount is an authoritative monetary amount
-- compared against bank_statement_lines.amount by the reconciliation RPC. OMR uses
-- three decimal places, while the canonical baseline defined this column as
-- numeric(14,2). Widening to numeric(15,3) preserves the same 12 integer digits
-- and is exact for every existing numeric(14,2) value.
--
-- Other historical numeric columns with scale > 3 or unconstrained numeric are
-- intentionally NOT changed here. Their business semantics must be audited
-- individually before any precision conversion; a column-name regex is not enough
-- authority to round or constrain posted financial history.

begin;

do $preflight$
declare
  v_precision integer;
  v_scale integer;
begin
  select numeric_precision, numeric_scale
    into v_precision, v_scale
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'bank_reconciliation_matches'
    and column_name = 'matched_amount'
    and data_type = 'numeric';

  if not found then
    raise exception 'BANK_RECONCILIATION_MATCHED_AMOUNT_NUMERIC_REQUIRED'
      using errcode = '42703';
  end if;

  if v_scale not in (2, 3) then
    raise exception 'BANK_RECONCILIATION_MATCHED_AMOUNT_UNEXPECTED_SCALE: expected 2 or 3, found %', v_scale
      using errcode = '22003';
  end if;
end
$preflight$;

alter table public.bank_reconciliation_matches
  alter column matched_amount type numeric(15,3)
  using matched_amount::numeric(15,3);

do $verify$
declare
  v_precision integer;
  v_scale integer;
begin
  select numeric_precision, numeric_scale
    into v_precision, v_scale
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'bank_reconciliation_matches'
    and column_name = 'matched_amount';

  if v_precision <> 15 or v_scale <> 3 then
    raise exception 'BANK_RECONCILIATION_MATCHED_AMOUNT_PRECISION_DRIFT: numeric(%,%)', v_precision, v_scale
      using errcode = '23514';
  end if;
end
$verify$;

commit;

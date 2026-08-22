-- Financial precision hardening: fix the independently-proven OMR precision defect
-- in bank reconciliation without performing a broad, name-based schema rewrite.
--
-- bank_reconciliation_matches.matched_amount is an authoritative monetary amount
-- compared against bank_statement_lines.amount by the reconciliation RPC. OMR uses
-- three decimal places, while the canonical baseline defined this column as
-- numeric(14,2). Widening to numeric(15,3) preserves the same 12 integer digits
-- and is exact for every existing numeric(14,2) value.
--
-- Migration 00027 installs a reconciliation integrity trigger that reads
-- matched_amount. PostgreSQL does not allow ALTER COLUMN TYPE while a trigger
-- definition depends on that column, so this migration removes only that trigger
-- for the duration of the transactional type widening and recreates it immediately
-- before commit. The trigger function itself and its ACL remain unchanged.
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

  if to_regprocedure('public.guard_bank_reconciliation_match_integrity()') is null then
    raise exception 'BANK_RECONCILIATION_INTEGRITY_GUARD_REQUIRED_BEFORE_PRECISION_CHANGE'
      using errcode = '42883';
  end if;
end
$preflight$;

drop trigger if exists trg_bank_reconciliation_match_integrity
  on public.bank_reconciliation_matches;

alter table public.bank_reconciliation_matches
  alter column matched_amount type numeric(15,3)
  using matched_amount::numeric(15,3);

create trigger trg_bank_reconciliation_match_integrity
before insert or update of matched_entity_type, matched_entity_id, matched_amount, company_id
on public.bank_reconciliation_matches
for each row
execute function public.guard_bank_reconciliation_match_integrity();

do $verify$
declare
  v_precision integer;
  v_scale integer;
  v_trigger_exists boolean;
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

  select exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'bank_reconciliation_matches'
      and t.tgname = 'trg_bank_reconciliation_match_integrity'
      and not t.tgisinternal
  ) into v_trigger_exists;

  if not v_trigger_exists then
    raise exception 'BANK_RECONCILIATION_INTEGRITY_TRIGGER_NOT_RESTORED'
      using errcode = '23514';
  end if;
end
$verify$;

commit;

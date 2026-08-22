-- FOM-013 follow-up — enforce one bank match per economic source, not merely per statement line.
-- Forward-only. No historical rows are rewritten or deleted.

begin;

-- Fail closed if existing data already violates the economic-source identity that
-- this migration is about to enforce. Payments and receipts share one collection
-- identity in the current schema, so they intentionally collapse to COLLECTION.
do $$
declare
  v_duplicate_count bigint;
begin
  select count(*) into v_duplicate_count
  from (
    select
      company_id,
      case when matched_entity_type in ('payment', 'receipt') then 'collection' else matched_entity_type end as economic_type,
      matched_entity_id
    from public.bank_reconciliation_matches
    group by 1, 2, 3
    having count(*) > 1
  ) d;

  if v_duplicate_count > 0 then
    raise exception 'BANK_RECONCILIATION_DUPLICATE_ECONOMIC_SOURCES: % duplicate source groups must be resolved before migration', v_duplicate_count
      using errcode = '23514';
  end if;
end
$$;

-- Database backstop against races and against callers other than the normal RPC.
-- A collection cannot be reconciled once as payment and again as receipt.
create unique index if not exists ux_bank_reconciliation_matches_economic_source
  on public.bank_reconciliation_matches (
    company_id,
    (case when matched_entity_type in ('payment', 'receipt') then 'collection' else matched_entity_type end),
    matched_entity_id
  );

create or replace function public.guard_bank_reconciliation_match_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt_status text;
  v_batch_status text;
  v_batch_source_type text;
  v_batch_company_id uuid;
  v_cash_movement numeric(18,3);
begin
  -- Receipt is evidence of the same collection represented by payment. If a
  -- caller explicitly matches a receipt, it must be an eligible posted receipt.
  if new.matched_entity_type = 'receipt' then
    select upper(coalesce(r.status, ''))
      into v_receipt_status
    from public.receipts r
    where r.id::text = new.matched_entity_id
      and r.company_id = new.company_id
      and r.deleted_at is null;

    if not found then
      raise exception 'Matched receipt was not found in the active company.' using errcode = 'P0002';
    end if;

    if v_receipt_status <> 'POSTED' then
      raise exception 'Receipt must be POSTED to be reconciled.' using errcode = '23514';
    end if;
  end if;

  -- Manual adjustment is not a free-form escape hatch. It must point to a real,
  -- posted manual-adjustment journal batch and the signed 1111/1120 movement in
  -- that batch must equal the signed bank-line match amount exactly at OMR 3dp.
  if new.matched_entity_type = 'manual_adjustment' then
    select b.company_id, upper(coalesce(b.status, '')), lower(coalesce(b.source_type, ''))
      into v_batch_company_id, v_batch_status, v_batch_source_type
    from public.journal_batches b
    where b.id::text = new.matched_entity_id
      and b.company_id = new.company_id;

    if not found then
      raise exception 'Manual adjustment must reference a real journal batch in the active company.' using errcode = 'P0002';
    end if;

    if v_batch_status <> 'POSTED' or v_batch_source_type <> 'manual_adjustment' then
      raise exception 'Manual adjustment must reference a POSTED manual_adjustment journal batch.' using errcode = '23514';
    end if;

    select round(coalesce(sum(round(jl.debit, 3) - round(jl.credit, 3)), 0), 3)
      into v_cash_movement
    from public.journal_lines jl
    join public.accounts a
      on a.id = jl.account_id
     and a.company_id = jl.company_id
    where jl.batch_id = new.matched_entity_id::uuid
      and jl.company_id = new.company_id
      and a.no in ('1111', '1120');

    if v_cash_movement = 0 then
      raise exception 'Manual adjustment has no governed 1111/1120 cash-bank movement.' using errcode = '23514';
    end if;

    if round(v_cash_movement, 3) <> round(new.matched_amount, 3) then
      raise exception 'Manual adjustment cash-bank movement does not equal the bank statement amount.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

alter function public.guard_bank_reconciliation_match_integrity() owner to postgres;
revoke all on function public.guard_bank_reconciliation_match_integrity() from public, anon, authenticated;
grant execute on function public.guard_bank_reconciliation_match_integrity() to service_role;

drop trigger if exists trg_bank_reconciliation_match_integrity on public.bank_reconciliation_matches;
create trigger trg_bank_reconciliation_match_integrity
before insert or update of matched_entity_type, matched_entity_id, matched_amount, company_id
on public.bank_reconciliation_matches
for each row
execute function public.guard_bank_reconciliation_match_integrity();

comment on index public.ux_bank_reconciliation_matches_economic_source is
  'One reconciliation match per economic source. payment and receipt collapse to the same collection identity to prevent double reconciliation.';

comment on function public.guard_bank_reconciliation_match_integrity() is
  'Fail-closed reconciliation backstop: posted receipt eligibility and exact governed 1111/1120 amount for manual adjustments.';

commit;

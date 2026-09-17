-- Utility-bill settlement flag must agree with the amount/paid_amount balance.
--
-- THE DEFECT
--
-- `public.utility_bills.status` is a stored register flag, but nothing in the
-- database keeps it consistent with the two amounts that determine whether a
-- bill is actually settled. The only triggers on the table are
-- `trg_utility_bills_reference` (reference assignment) and
-- `trg_utility_bills_updated_at` (timestamp). There is no update path in the
-- application either — `rentrix-app/src/features/utilities/utilities-service.ts`
-- writes the flag only on INSERT, derived from the amounts, and afterwards the
-- billed/paid amounts can only be changed directly in the database.
--
-- So a direct edit of `paid_amount` leaves the flag behind, and the owner
-- financial report then prints two mutually exclusive claims in one row:
-- "إجمالي الفاتورة 360.000 | المدفوع 360.000 | المتبقي 0.000" beside the status
-- "مستحقة السداد" (unpaid) — or the reverse, a bill shown as "مسددة بالكامل"
-- next to a non-zero remainder. The report is reading the register honestly;
-- the register is what disagrees with itself.
--
-- THE INVARIANT ENFORCED HERE
--
--   status = 'PAID'  ⟺  paid_amount >= amount
--
-- `OVERDUE` and `UNPAID` are both *unsettled* states and are deliberately left
-- alone. `OVERDUE` is a genuine business state (a bill past its due date) that
-- the amounts cannot reconstruct, so collapsing it would destroy information
-- rather than reconcile it. Only the contradiction between "settled" and the
-- balance is repaired.
--
-- WHAT THIS DOES NOT TOUCH
--
--   * No amount is read, written, rounded or recalculated. `amount` and
--     `paid_amount` are never modified.
--   * No row is inserted or deleted.
--   * No overdue marking is downgraded: an `OVERDUE` bill with a remaining
--     balance keeps `OVERDUE`.
--   * Deterministic and idempotent — re-running changes nothing.

begin;

-- 1. Convergence. Repair only rows where the flag contradicts the balance.
do $utility_status_convergence$
declare
  v_marked_paid   integer := 0;
  v_unmarked_paid integer := 0;
begin
  -- 1a. Fully settled but not marked PAID -> PAID.
  with corrected as (
    update public.utility_bills b
       set status = 'PAID'::public.utility_status
     where b.status is distinct from 'PAID'::public.utility_status
       and coalesce(b.amount, 0) > 0
       and coalesce(b.paid_amount, 0) >= coalesce(b.amount, 0)
    returning 1
  )
  select count(*) into v_marked_paid from corrected;

  -- 1b. Marked PAID but the register does not prove it -> UNPAID.
  --     Deliberately UNPAID rather than OVERDUE: the amounts prove only that
  --     the bill is not settled, not when it fell due.
  with corrected as (
    update public.utility_bills b
       set status = 'UNPAID'::public.utility_status
     where b.status = 'PAID'::public.utility_status
       and coalesce(b.paid_amount, 0) < coalesce(b.amount, 0)
    returning 1
  )
  select count(*) into v_unmarked_paid from corrected;

  raise notice 'utility_bills status convergence: % marked PAID from amounts, % unmarked (amounts do not prove payment)',
    v_marked_paid, v_unmarked_paid;
end
$utility_status_convergence$;

-- 2. Post-condition: the invariant must now hold exactly.
do $utility_status_invariant$
declare
  v_offenders text;
begin
  select string_agg(b.id::text || ' (' || b.status || ', amount=' || b.amount || ', paid=' || coalesce(b.paid_amount, 0) || ')', ', ')
    into v_offenders
  from public.utility_bills b
  where (b.status = 'PAID'::public.utility_status) <> (coalesce(b.paid_amount, 0) >= coalesce(b.amount, 0))
    and coalesce(b.amount, 0) > 0;

  if v_offenders is not null then
    raise exception 'utility_bills settlement flag still contradicts the balance for: %', v_offenders
      using errcode = 'P0001';
  end if;
end
$utility_status_invariant$;

-- 3. Keep it true on every future write, so the reconciliation is not a
--    one-off that the next direct edit silently undoes.
create or replace function public.enforce_utility_bill_settlement_status()
returns trigger
language plpgsql
as $enforce_utility_bill_settlement_status$
begin
  -- Overdue marking is a business state the amounts cannot reconstruct, so it
  -- survives untouched while a balance remains.
  if new.status = 'OVERDUE'::public.utility_status and coalesce(new.amount, 0) > 0 then
    if coalesce(new.paid_amount, 0) >= coalesce(new.amount, 0) then
      new.status := 'PAID'::public.utility_status;
    end if;
    return new;
  end if;

  if new.status = 'PAID'::public.utility_status then
    -- A PAID claim is only accepted when the recorded payment supports it.
    if coalesce(new.amount, 0) > 0 and coalesce(new.paid_amount, 0) < coalesce(new.amount, 0) then
      new.status := 'UNPAID'::public.utility_status;
    end if;
    return new;
  end if;

  -- UNPAID is only truthful while a balance remains.
  if coalesce(new.amount, 0) > 0 and coalesce(new.paid_amount, 0) >= coalesce(new.amount, 0) then
    new.status := 'PAID'::public.utility_status;
  end if;

  return new;
end;
$enforce_utility_bill_settlement_status$;

drop trigger if exists trg_utility_bills_settlement_status on public.utility_bills;
create trigger trg_utility_bills_settlement_status
  before insert or update of amount, paid_amount, status on public.utility_bills
  for each row execute function public.enforce_utility_bill_settlement_status();

commit;

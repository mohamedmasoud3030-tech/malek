-- FIN-007/008/013; DOM-007. Completion of 20260909000018.
--
-- Migration18 moved three legacy owner-expense selectors onto the shared
-- `public.owner_is_sole_property_owner_on` predicate so an unallocated
-- co-owned expense is attributed to nobody rather than in full to everybody.
-- It missed one selector that carries the IDENTICAL bare-EXISTS flaw:
-- `public.recalculate_owner_balance`, which maintains `public.owner_balances`.
--
-- Verified before this repair: on a 60/40 property with one unallocated 100
-- OWNER expense, `owner_balances.total_expenses` was 100 for BOTH owners even
-- though migration18 had already removed that cost from the statement and the
-- settlement derivation. The stored balance therefore disagreed with every
-- other owner surface — the worst kind of drift, because `owner_balances` is a
-- persisted table that outlives the request.
--
-- `20260909000012_owner_expense_allocation_source.sql` patched FIVE selectors
-- for adopted-source exclusion; migration18 covered only three of them. The
-- fifth, `public.wp05_subledger_due_from_owner`, is deliberately NOT changed
-- here: it is a COMPANY-level 1300 control total keyed only on
-- `company_id`/`expense_date`, with no owner argument, so it counts each
-- expense exactly once and never double counts. Making it owner-aware would
-- change a reconciliation control, not fix a defect.
--
-- Read-path change only: no balance row is recomputed or backfilled by this
-- migration, and no expense is modified. Existing `owner_balances` rows keep
-- their current values until their owner's next lawful recalculation, exactly
-- as before; nothing here rewrites posted history.
begin;

do $balance$
declare d text; needle text;
begin
  d := pg_get_functiondef('public.recalculate_owner_balance(uuid)'::regprocedure);

  -- Guard the adopted-source filter installed by migration12 so this rewrite
  -- cannot silently revert it.
  if position('(select * from public.expenses where owner_allocation_version is null) e' in d) = 0 then
    raise exception 'OWNER_BALANCE_COOWNERSHIP_ADOPTION_PRECONDITION: governed allocation source filter not found';
  end if;

  needle := '        AND EXISTS (
          SELECT 1 FROM public.property_owners po
          WHERE po.property_id = e.property_id AND po.owner_id = $1
            AND (po.starts_on IS NULL OR po.starts_on <= public._safe_date(e.date_time))
            AND (po.ends_on IS NULL OR po.ends_on >= public._safe_date(e.date_time))
        )';
  if (length(d) - length(replace(d, needle, ''))) / length(needle) <> 1 then
    raise exception 'OWNER_BALANCE_COOWNERSHIP_PRECONDITION';
  end if;

  -- Same predicate, same date semantics, as the statement/settlement paths:
  -- ownership is evaluated AS OF THE EXPENSE DATE, never as of today, and
  -- ownership_percentage is never read as an apportionment basis.
  d := replace(d, needle,
    '        AND public.owner_is_sole_property_owner_on($2, e.property_id, $1, public._safe_date(e.date_time))');

  execute d;
end; $balance$;

comment on function public.recalculate_owner_balance(uuid) is
  'Recomputes public.owner_balances for one owner from canonical sources. Owner-charged expenses are attributed only when the owner was the SOLE owner of the property as of the expense date (public.owner_is_sole_property_owner_on); an unallocated expense on a co-owned property belongs to nobody until governed adoption supplies the authoritative per-owner allocation, and is never apportioned by the current ownership_percentage. Adopted sources (owner_allocation_version = 1) are excluded because they live in the owner-receivable subledger.';

notify pgrst, 'reload schema';
commit;

-- FIN-007/008/013; DOM-007; SEC-001/002.
--
-- Co-owned property expenses: an UNALLOCATED historical expense on a property
-- with more than one owner at the expense date must NOT be attributed to any
-- single owner, and must NOT be apportioned by today's ownership share.
--
-- Proven defect (see
-- rentrix-app/src/features/financials/reports/owner-statement-coownership-allocation.test.ts):
-- the legacy owner-expense selectors test ownership with a bare EXISTS against
-- `property_owners` and never read `ownership_percentage`. On a property owned
-- 60/40 a single 100 OWNER expense was charged in FULL to BOTH owners — 200
-- reported against 100 actually incurred.
--
-- APPROVED RESOLUTION (Option 2). Do not invent an apportionment rule:
--
--   * `ownership_percentage` is a CURRENT attribute with `starts_on`/`ends_on`.
--     Splitting a historical cost by today's share would derive historical
--     ownership from present state — exactly the retroactive derivation the
--     governance constraints forbid. No selector here reads it.
--   * An unallocated co-owned expense therefore attaches to NOBODY. It stays
--     unallocated until the governed adoption workflow supplies the
--     authoritative per-owner allocation (`owner_allocation_version = 1`,
--     whose completeness constraint already requires the allocations to total
--     the expense exactly). Adopted expenses are already excluded from these
--     legacy selectors and flow through the owner-receivable subledger.
--   * Sole-owner expenses are untouched: exactly one owner at the expense date
--     is unambiguous, so today's behaviour is already correct for them.
--
-- Ownership is evaluated AS OF THE EXPENSE DATE, never as of today, so a
-- historical cutoff is preserved: a property that is co-owned now but had a
-- single owner when the cost was incurred still reports to that historical
-- owner, and vice versa.
--
-- Nothing is hidden. Suppressing a double count must not silently delete the
-- cost, so this migration also adds `public.owner_unallocated_shared_expenses`,
-- a permission-checked read that surfaces every such expense as unresolved
-- work for governed adoption.
--
-- No posted history is rewritten, no expense row is modified, no backfill is
-- performed, and the existing fail-closed money path
-- (OWNER_SETTLEMENT_LEGACY_EXPENSE_REVIEW_REQUIRED) is left exactly as it is.
begin;

-- Shared, single-source predicate. Written once and reused by every selector
-- so the three read paths cannot drift apart again.
--
-- Returns TRUE when the owner is the ONLY owner of the property on that date.
-- Company-scoped explicitly: the callers are SECURITY DEFINER, which suppresses
-- the invoker's RLS on `property_owners`.
create function public.owner_is_sole_property_owner_on(
  p_company_id uuid,
  p_property_id uuid,
  p_owner_id uuid,
  p_on date
) returns boolean
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select exists (
           select 1 from public.property_owners po
            where po.company_id = p_company_id
              and po.property_id = p_property_id
              and po.owner_id = p_owner_id
              and (po.starts_on is null or po.starts_on <= p_on)
              and (po.ends_on is null or po.ends_on >= p_on)
         )
     and (
           select count(distinct po.owner_id) from public.property_owners po
            where po.company_id = p_company_id
              and po.property_id = p_property_id
              and (po.starts_on is null or po.starts_on <= p_on)
              and (po.ends_on is null or po.ends_on >= p_on)
         ) = 1
$$;

revoke all on function public.owner_is_sole_property_owner_on(uuid, uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.owner_is_sole_property_owner_on(uuid, uuid, uuid, date) to service_role;

comment on function public.owner_is_sole_property_owner_on(uuid, uuid, uuid, date) is
  'True when the owner is the ONLY owner of the property AS OF the given date. Ownership is evaluated at the event date, never as of today, so historical cutoffs are preserved. Used by the legacy owner-expense selectors to refuse attributing an unallocated co-owned expense to any single owner; ownership_percentage is deliberately NOT read, because apportioning a historical cost by a current share would derive historical ownership from present state.';

-- 1. Owner statement expense source.
do $statement_expenses$
declare d text; needle text;
begin
  d := pg_get_functiondef('public._owner_statement_expenses(uuid,date,date,uuid)'::regprocedure);

  needle := '        AND EXISTS (
          SELECT 1 FROM public.property_owners po
          WHERE po.property_id = e.property_id AND po.owner_id = $1
            AND po.company_id = $4
            AND (po.starts_on IS NULL OR po.starts_on <= public._safe_date(e.date_time))
            AND (po.ends_on IS NULL OR po.ends_on >= public._safe_date(e.date_time))
        )';
  if (length(d) - length(replace(d, needle, ''))) / length(needle) <> 1 then
    raise exception 'OWNER_EXPENSE_COOWNERSHIP_STATEMENT_PRECONDITION';
  end if;

  d := replace(d, needle,
    '        AND public.owner_is_sole_property_owner_on($4, e.property_id, $1, public._safe_date(e.date_time))');
  execute d;
end; $statement_expenses$;

-- 2. Settlement derivation authority.
do $net_payout$
declare d text; needle text;
begin
  d := pg_get_functiondef('public.calculate_owner_net_payout(uuid,date,date,text)'::regprocedure);

  needle := '    and exists (
      select 1 from public.property_owners po
      where po.property_id = e.property_id
        and po.owner_id = p_owner_id
        and (po.starts_on is null or po.starts_on <= public._safe_date(e.date_time))
        and (po.ends_on is null or po.ends_on >= public._safe_date(e.date_time))
    );';
  if (length(d) - length(replace(d, needle, ''))) / length(needle) <> 1 then
    raise exception 'OWNER_EXPENSE_COOWNERSHIP_PAYOUT_PRECONDITION';
  end if;

  d := replace(d, needle,
    '    and public.owner_is_sole_property_owner_on(v_company_id, e.property_id, p_owner_id, public._safe_date(e.date_time));');
  execute d;
end; $net_payout$;

-- 3. Settlement reservation selector. This also narrows what the existing
-- OWNER_SETTLEMENT_LEGACY_EXPENSE_REVIEW_REQUIRED guard scans, so the guard
-- keeps firing for genuinely reviewable sole-owner legacy expenses while a
-- co-owned expense — which no longer belongs to this owner at all — stops
-- blocking an unrelated owner's settlement. The money path stays fail-closed:
-- a co-owned expense can only ever reach a settlement through governed
-- adoption, which produces an explicit allocation.
do $reservable$
declare d text; needle text;
begin
  d := pg_get_functiondef('public.owner_settlement_reservable_expenses(uuid,uuid,date,date,text)'::regprocedure);

  needle := '       and exists (
         select 1
           from public.property_owners po
          where po.property_id = e.property_id
            and po.owner_id = p_owner_id
            and (po.starts_on is null or po.starts_on <= public._safe_date(e.date_time))
            and (po.ends_on is null or po.ends_on >= public._safe_date(e.date_time))
       );';
  if (length(d) - length(replace(d, needle, ''))) / length(needle) <> 1 then
    raise exception 'OWNER_EXPENSE_COOWNERSHIP_RESERVABLE_PRECONDITION';
  end if;

  d := replace(d, needle,
    '       and public.owner_is_sole_property_owner_on(p_company_id, e.property_id, p_owner_id, public._safe_date(e.date_time));');
  execute d;
end; $reservable$;

-- 4. Visibility. Removing a wrong number must never silently remove the cost.
-- Every unallocated expense on a property that had more than one owner at the
-- expense date is surfaced here as outstanding work for governed adoption.
create function public.owner_unallocated_shared_expenses(
  p_from date default null,
  p_to date default null,
  p_property_id uuid default null
) returns jsonb
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_company_id uuid;
  v_rows jsonb;
begin
  if auth.uid() is null
     or not public.current_user_has_effective_app_permission('financial.reports.view') then
    raise exception 'OWNER_SHARED_EXPENSE_PERMISSION_REQUIRED' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'OWNER_SHARED_EXPENSE_PERIOD_INVALID' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(x order by x->>'expense_date', x->>'expense_id'), '[]'::jsonb)
    into v_rows
  from (
    select jsonb_build_object(
             'expense_id', e.id,
             'expense_no', coalesce(e.no, e.id::text),
             'property_id', e.property_id,
             'property_name', coalesce(pr.title, ''),
             'expense_date', public._safe_date(e.date_time),
             'amount', public._r3(e.amount),
             'description', coalesce(e.description, e.category),
             'owners_at_expense_date', (
               select count(distinct po.owner_id) from public.property_owners po
                where po.company_id = v_company_id
                  and po.property_id = e.property_id
                  and (po.starts_on is null or po.starts_on <= public._safe_date(e.date_time))
                  and (po.ends_on is null or po.ends_on >= public._safe_date(e.date_time))
             ),
             'resolution', 'GOVERNED_ADOPTION_REQUIRED'
           ) as x
      from public.expenses e
      left join public.properties pr on pr.id = e.property_id and pr.company_id = v_company_id
     where e.deleted_at is null
       and e.company_id = v_company_id
       and e.owner_allocation_version is null
       and upper(coalesce(e.status, '')) = 'POSTED'
       and upper(coalesce(e.charged_to, '')) = 'OWNER'
       and (p_property_id is null or e.property_id = p_property_id)
       and (p_from is null or public._safe_date(e.date_time) >= p_from)
       and (p_to is null or public._safe_date(e.date_time) <= p_to)
       and (
         select count(distinct po.owner_id) from public.property_owners po
          where po.company_id = v_company_id
            and po.property_id = e.property_id
            and (po.starts_on is null or po.starts_on <= public._safe_date(e.date_time))
            and (po.ends_on is null or po.ends_on >= public._safe_date(e.date_time))
       ) > 1
  ) s;

  return jsonb_build_object(
    'company_id', v_company_id,
    'period_from', p_from,
    'period_to', p_to,
    'source', 'owner_unallocated_shared_expenses',
    'authority', 'unallocated co-owned expense; ownership_percentage is NOT an apportionment basis',
    'count', jsonb_array_length(v_rows),
    'total_amount', public._r3((select coalesce(sum((r->>'amount')::numeric), 0) from jsonb_array_elements(v_rows) r)),
    'expenses', v_rows);
end;
$$;

revoke all on function public.owner_unallocated_shared_expenses(date, date, uuid) from public, anon;
grant execute on function public.owner_unallocated_shared_expenses(date, date, uuid) to authenticated, service_role;

comment on function public.owner_unallocated_shared_expenses(date, date, uuid) is
  'Unallocated POSTED owner-charged expenses on properties that had MORE THAN ONE owner at the expense date. These are deliberately excluded from per-owner statements and settlement derivations because attributing or apportioning them would invent an accounting rule; they remain visible here as outstanding governed-adoption work so suppressing a double count never silently drops the cost.';

notify pgrst, 'reload schema';
commit;

-- =============================================================================
-- S02-T05 / D-002 — reject stale owner-settlement totals at approve and pay
-- =============================================================================
-- A settlement draft stores a server-derived monetary tuple, but the underlying
-- payment / owner-expense rows can still change before approval or payment.
-- This migration makes the lifecycle fail closed:
--   * the currently reservable item set must equal the settlement's active links;
--   * the linked payment/expense source rows are locked for the transaction;
--   * gross/fee/expense/tax/net are re-derived from calculate_owner_net_payout;
--   * any >= 0.001 difference raises deterministic SQLSTATE 22023 before a first
--     approval/payment effect. Current payment/expense source columns are 2dp,
--     so 0.010 is their smallest persisted positive delta; the 0.001 guard is
--     intentionally forward-compatible with a future 3dp monetary migration;
--   * the same assertion runs again after the existing lifecycle body, so any
--     unexpected in-transaction drift rolls the entire operation back atomically;
--   * idempotent retries keep the existing cached-response semantics and do not
--     get reclassified as a new stale-input attempt.
--
-- Existing FA-003 lifecycle bodies are preserved verbatim by renaming them to
-- internal implementation functions. Browser/service callers can execute only
-- the guarded public wrappers; EXECUTE on the internal implementations is revoked.
--
-- Rollback: supabase/rollback/20260807_rollback_s02_owner_settlement_stale_total_rejection.sql
-- =============================================================================

begin;

-- Preserve the already-reviewed FA-003 bodies without copying/re-forking them.
alter function public.approve_owner_settlement_atomic(jsonb)
  rename to approve_owner_settlement_atomic_s02_base;
alter function public.pay_owner_settlement_atomic(jsonb)
  rename to pay_owner_settlement_atomic_s02_base;

-- The renamed implementations are internal only. Their prior grants follow the
-- function OID during RENAME, so revoke them explicitly before exposing wrappers.
revoke all on function public.approve_owner_settlement_atomic_s02_base(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.pay_owner_settlement_atomic_s02_base(jsonb)
  from public, anon, authenticated, service_role;

alter function public.approve_owner_settlement_atomic_s02_base(jsonb) owner to postgres;
alter function public.pay_owner_settlement_atomic_s02_base(jsonb) owner to postgres;

-- Internal assertion shared by approve and pay. It deliberately derives company
-- context from the authenticated JWT rather than accepting company_id as input.
create or replace function public.assert_owner_settlement_totals_fresh(
  p_settlement_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_row public.owner_settlements%rowtype;
  v_gross numeric;
  v_fee numeric;
  v_expenses numeric;
  v_tax numeric;
  v_net numeric;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to validate owner settlements.'
      using errcode = '42501';
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'Company context is required (no company_id claim in JWT).'
      using errcode = '42501';
  end if;

  select *
    into v_row
    from public.owner_settlements s
   where s.id::text = p_settlement_id
     and s.company_id = v_company_id
   for update;

  if not found then
    raise exception 'Owner settlement not found.'
      using errcode = 'P0002';
  end if;

  -- Lock every currently linked source row. A concurrent UPDATE of a linked
  -- amount/status cannot slip between the freshness check and lifecycle commit.
  perform 1
    from public.payments p
    join public.owner_settlement_payment_links l
      on l.payment_id = p.id
     and l.company_id = p.company_id
   where l.settlement_id = v_row.id::text
     and l.company_id = v_company_id
     and l.released_at is null
   order by p.id
   for update of p;

  perform 1
    from public.expenses e
    join public.owner_settlement_expense_links l
      on l.expense_id = e.id
     and l.company_id = e.company_id
   where l.settlement_id = v_row.id::text
     and l.company_id = v_company_id
     and l.released_at is null
   order by e.id
   for update of e;

  -- Exact set equality in BOTH directions. This uses the shared FA-003 helpers,
  -- so membership cannot drift independently from create/approve/pay semantics.
  if exists (
    select 1
      from (
        select rp.item_id
          from public.owner_settlement_reservable_payments(
            v_company_id,
            v_row.owner_id::uuid,
            v_row.period_start,
            v_row.period_end,
            v_row.property_id::text
          ) as rp(item_id)
        except
        select l.payment_id
          from public.owner_settlement_payment_links l
         where l.settlement_id = v_row.id::text
           and l.company_id = v_company_id
           and l.released_at is null
      ) missing_payment
  ) or exists (
    select 1
      from (
        select l.payment_id
          from public.owner_settlement_payment_links l
         where l.settlement_id = v_row.id::text
           and l.company_id = v_company_id
           and l.released_at is null
        except
        select rp.item_id
          from public.owner_settlement_reservable_payments(
            v_company_id,
            v_row.owner_id::uuid,
            v_row.period_start,
            v_row.period_end,
            v_row.property_id::text
          ) as rp(item_id)
      ) extra_payment
  ) or exists (
    select 1
      from (
        select re.item_id
          from public.owner_settlement_reservable_expenses(
            v_company_id,
            v_row.owner_id::uuid,
            v_row.period_start,
            v_row.period_end,
            v_row.property_id::text
          ) as re(item_id)
        except
        select l.expense_id
          from public.owner_settlement_expense_links l
         where l.settlement_id = v_row.id::text
           and l.company_id = v_company_id
           and l.released_at is null
      ) missing_expense
  ) or exists (
    select 1
      from (
        select l.expense_id
          from public.owner_settlement_expense_links l
         where l.settlement_id = v_row.id::text
           and l.company_id = v_company_id
           and l.released_at is null
        except
        select re.item_id
          from public.owner_settlement_reservable_expenses(
            v_company_id,
            v_row.owner_id::uuid,
            v_row.period_start,
            v_row.period_end,
            v_row.property_id::text
          ) as re(item_id)
      ) extra_expense
  ) then
    raise exception 'OWNER_SETTLEMENT_INPUT_SET_DRIFT: reserved source membership changed after draft creation; cancel and recreate the settlement.'
      using errcode = '22023';
  end if;

  select c.gross_collected, c.office_fee, c.owner_expenses, c.tax_amount, c.net_payable
    into v_gross, v_fee, v_expenses, v_tax, v_net
    from public.calculate_owner_net_payout(
      v_row.owner_id::uuid,
      v_row.period_start,
      v_row.period_end,
      v_row.property_id::text
    ) as c;

  -- Compare the stored tuple to the current server-derived tuple. The stale guard
  -- is 0.001-sensitive even though today's payment/expense source columns persist
  -- only 2dp; this avoids weakening the invariant when those sources move to 3dp.
  if v_row.gross_collected is null
     or v_row.office_fee is null
     or v_row.owner_expenses is null
     or v_row.tax_amount is null
     or v_row.net_payable is null
     or v_gross is null
     or v_fee is null
     or v_expenses is null
     or v_tax is null
     or v_net is null
     or abs(v_row.gross_collected - v_gross) >= 0.001
     or abs(v_row.office_fee - v_fee) >= 0.001
     or abs(v_row.owner_expenses - v_expenses) >= 0.001
     or abs(v_row.tax_amount - v_tax) >= 0.001
     or abs(v_row.net_payable - v_net) >= 0.001 then
    raise exception 'OWNER_SETTLEMENT_STALE_TOTALS: source amounts changed after draft creation; cancel and recreate the settlement.'
      using errcode = '22023';
  end if;
end;
$function$;

alter function public.assert_owner_settlement_totals_fresh(text) owner to postgres;
revoke all on function public.assert_owner_settlement_totals_fresh(text)
  from public, anon, authenticated, service_role;

comment on function public.assert_owner_settlement_totals_fresh(text) is
  'S02-T05 internal fail-closed guard: exact FA-003 reserved-set parity plus live gross/fee/expense/tax/net re-derivation. Raises 22023 on stale differences at or above 0.001.';

-- Guarded public approval entry point. For a first DRAFT -> APPROVED transition,
-- assert before the existing implementation. Re-assert afterwards so any failure
-- rolls back the status/audit/idempotency writes from the internal body.
create or replace function public.approve_owner_settlement_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_id text := nullif(p_payload->>'settlement_id', '');
  v_status text;
  v_result jsonb;
begin
  v_company_id := public.current_company_id();

  if v_id is not null and v_company_id is not null then
    select s.status
      into v_status
      from public.owner_settlements s
     where s.id::text = v_id
       and s.company_id = v_company_id;

    if v_status = 'DRAFT' then
      perform public.assert_owner_settlement_totals_fresh(v_id);
    end if;
  end if;

  v_result := public.approve_owner_settlement_atomic_s02_base(p_payload);

  if not coalesce((v_result->>'idempotent')::boolean, false) then
    perform public.assert_owner_settlement_totals_fresh(v_result->>'settlement_id');
  end if;

  return v_result;
end;
$function$;

alter function public.approve_owner_settlement_atomic(jsonb) owner to postgres;
revoke all on function public.approve_owner_settlement_atomic(jsonb) from public, anon;
grant execute on function public.approve_owner_settlement_atomic(jsonb) to authenticated, service_role;

comment on function public.approve_owner_settlement_atomic(jsonb) is
  'S02-T05 guarded approval: FA-003 lifecycle semantics plus exact reserved-set parity and live stale-total rejection before first approval.';

-- Guarded public payment entry point. A first APPROVED -> PAID attempt is checked
-- before the internal function can write the journal batch. The post-check makes
-- unexpected drift fail atomically and roll back every effect in the same call.
create or replace function public.pay_owner_settlement_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_id text := nullif(p_payload->>'settlement_id', '');
  v_status text;
  v_result jsonb;
begin
  v_company_id := public.current_company_id();

  if v_id is not null and v_company_id is not null then
    select s.status
      into v_status
      from public.owner_settlements s
     where s.id::text = v_id
       and s.company_id = v_company_id;

    if v_status = 'APPROVED' then
      perform public.assert_owner_settlement_totals_fresh(v_id);
    end if;
  end if;

  v_result := public.pay_owner_settlement_atomic_s02_base(p_payload);

  if not coalesce((v_result->>'idempotent')::boolean, false) then
    perform public.assert_owner_settlement_totals_fresh(v_result->>'settlement_id');
  end if;

  return v_result;
end;
$function$;

alter function public.pay_owner_settlement_atomic(jsonb) owner to postgres;
revoke all on function public.pay_owner_settlement_atomic(jsonb) from public, anon;
grant execute on function public.pay_owner_settlement_atomic(jsonb) to authenticated, service_role;

comment on function public.pay_owner_settlement_atomic(jsonb) is
  'S02-T05 guarded payment: FA-003 lifecycle semantics plus exact reserved-set parity and live stale-total rejection before first payment effect.';

commit;
-- Owner funds held: expose the balance only when the register can prove it.
--
-- THE PROBLEM
--
-- `rpt_owner_financial_position` reported `owner_funds.held` as
-- `coalesce(sum(owner_funds_events.amount_delta), 0)`. That collapses two very
-- different states into the same output:
--
--   * the append-only funds register has events and they net to zero, and
--   * the register has NO events at all for this owner.
--
-- Both rendered as a confident "0.000", and the professional owner report
-- printed that as a confirmed balance ("أموال مالك محتجزة لدى المكتب"). An
-- owner with no recorded fund movements is not an owner proven to hold nothing;
-- it is an owner whose held balance is unproven. Presenting the second as the
-- first is exactly the kind of invented figure this codebase already refuses to
-- produce elsewhere.
--
-- There is a precedent in this same function. When settlement cash cannot be
-- proven, `paid_cash` is returned as `null` and the caller is told how many
-- settlements are unproven, via `paid_cash_proven_total` and
-- `paid_cash_evidence_missing_count` (see
-- 20260909000016_owner_position_cash_evidence.sql). This migration applies that
-- same contract to held funds rather than inventing a second convention.
--
-- THE FIX
--
-- `owner_funds` now carries three fields:
--
--   held                          the proven net balance, or NULL when the
--                                 register holds no evidence (was: always 0)
--   held_proven_total             the net of whatever events DO exist
--   held_evidence_missing_count   1 when there is no evidence, 0 otherwise
--
-- The authority is unchanged: `public.owner_funds_events` remains the only
-- source, and the `events` array is untouched. Nothing is backfilled, no event
-- is created, no amount is altered. Only the *presentation of authority*
-- changes: an unproven balance is now reported as unproven instead of as zero.
--
-- This migration is forward-only and deterministic. It redefines the function
-- in full (rather than patching it by string replacement, as an earlier
-- migration had to) so the canonical implementation is reproducible from Git
-- alone, and it refuses to apply if the live function does not match the
-- expected pre-image — a mismatch means production has drifted and must be
-- understood before this overwrites it.

begin;

do $owner_funds_authority$
declare
  v_existing text;
begin
  -- Pre-image guard: only a function whose signature matches exactly what we
  -- are replacing may be overwritten. Anything else is drift to be understood,
  -- not silently replaced.
  if to_regprocedure('public.rpt_owner_financial_position(uuid,date,date)') is null then
    raise exception 'rpt_owner_financial_position(uuid,date,date) does not exist; refusing to create it blind'
      using errcode = '42883';
  end if;

  v_existing := pg_get_functiondef('public.rpt_owner_financial_position(uuid,date,date)'::regprocedure);

  -- The pre-image must still compute held funds without evidence gating.
  if position('v_funds_held numeric := 0;' in v_existing) = 0 then
    raise exception 'owner-funds pre-image mismatch: v_funds_held declaration not found; production has drifted'
      using errcode = 'P0001';
  end if;
  if position('''held'', public._r3(v_funds_held)' in v_existing) = 0 then
    raise exception 'owner-funds pre-image mismatch: unconditional held field not found; production has drifted'
      using errcode = 'P0001';
  end if;
end
$owner_funds_authority$;

create or replace function public.rpt_owner_financial_position(p_owner_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company_id uuid := public.require_company_id();
  v_period record;
  v_settlements jsonb;
  v_funds jsonb;
  v_settled_net numeric := 0;
  v_paid_net numeric := 0;
  v_paid_cash numeric := 0;
  v_missing_cash bigint := 0;
  v_remaining numeric := 0;
  v_draft_count bigint := 0;
  v_approved_count bigint := 0;
  v_paid_count bigint := 0;
  v_cancelled_count bigint := 0;
  v_funds_held numeric := 0;
  v_funds_event_count bigint := 0;
begin
  if auth.uid() is null or not coalesce(public.is_app_user(), false) then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'A valid position period is required.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.owners o
    where o.id = p_owner_id and o.company_id = v_company_id and o.deleted_at is null
  ) then
    raise exception 'Position target owner is not in your company.' using errcode = '42501';
  end if;

  -- ── Period derivation: EXACTLY the settlement write-path authority. ───────
  select * into v_period
  from public.calculate_owner_net_payout(p_owner_id, p_from, p_to, null);

  -- ── All-time settlement lifecycle aggregates + bounded drill-down rows. ───
  -- CONTRACT (R13): this section is intentionally ALL-TIME — an outstanding
  -- DRAFT/APPROVED settlement from a prior period is still payable to the
  -- owner, and paid history is lifetime history. It is never scoped to
  -- p_from/p_to, and the key lifecycle_all_time makes that explicit.
  select
    coalesce(sum(s.net_payable-s.offset_applied) filter (where upper(coalesce(s.status, '')) in ('DRAFT', 'APPROVED')), 0),
    coalesce(sum(s.net_payable) filter (where upper(coalesce(s.status, '')) = 'PAID'), 0),
    count(*) filter (where upper(coalesce(s.status, '')) = 'DRAFT'),
    count(*) filter (where upper(coalesce(s.status, '')) = 'APPROVED'),
    count(*) filter (where upper(coalesce(s.status, '')) = 'PAID'),
    count(*) filter (where upper(coalesce(s.status, '')) = 'CANCELLED')
  into v_settled_net, v_paid_net, v_draft_count, v_approved_count, v_paid_count, v_cancelled_count
  from public.owner_settlements s
  where s.company_id = v_company_id
    and s.owner_id::text = p_owner_id::text;

  -- Lifetime cash is independent of period economics and of the current
  -- offset header. Materialize the shared proof once per paid settlement.
  with evidence as materialized (
    select app_private.owner_settlement_paid_cash(v_company_id,s.id) as cash
    from public.owner_settlements s where s.company_id=v_company_id
      and s.owner_id::text=p_owner_id::text and s.status='PAID'
  )
  select coalesce(sum(cash),0),count(*) filter(where cash is null)
  into v_paid_cash,v_missing_cash from evidence;
  v_remaining := public._r3(v_settled_net);

  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
  into v_settlements
  from (
    select
      jsonb_build_object(
        'id', s.id,
        'reference', s.no,
        'property_id', s.property_id,
        'period_start', s.period_start,
        'period_end', s.period_end,
        'gross_collected', public._r3(coalesce(s.gross_collected, 0)),
        'management_fee', public._r3(coalesce(s.office_fee, 0)),
        'owner_expenses', public._r3(coalesce(s.owner_expenses, 0)),
        'fee_vat', public._r3(coalesce(s.tax_amount, 0)),
        'net_payable', public._r3(coalesce(s.net_payable, 0)),
        'status', upper(coalesce(s.status, 'DRAFT')),
        'approved_at', s.approved_at,
        'paid_at', s.paid_at,
        'payment_reference', s.payment_reference,
        'cancelled_at', s.cancelled_at,
        'cancellation_reason', s.cancellation_reason
      ) as row_data,
      s.created_at
    from public.owner_settlements s
    where s.company_id = v_company_id
      and s.owner_id::text = p_owner_id::text
    order by s.created_at desc
    limit 24
  ) recent;

  -- ── Owner funds held: RC1 append-only control. ────────────────────────────
  -- The net AND the evidence count are read together: a sum of zero over an
  -- empty register is indistinguishable from a genuine zero unless the count
  -- is carried alongside it.
  select coalesce(sum(e.amount_delta), 0), count(*)
  into v_funds_held, v_funds_event_count
  from public.owner_funds_events e
  where e.company_id = v_company_id
    and e.owner_id = p_owner_id;

  select coalesce(jsonb_agg(row_data order by effective_date desc), '[]'::jsonb)
  into v_funds
  from (
    select
      jsonb_build_object(
        'id', e.id,
        'source_type', e.source_type,
        'source_id', e.source_id,
        'amount_delta', public._r3(e.amount_delta),
        'effective_date', e.effective_date,
        'journal_batch_id', e.journal_batch_id
      ) as row_data,
      e.effective_date
    from public.owner_funds_events e
    where e.company_id = v_company_id
      and e.owner_id = p_owner_id
    order by e.effective_date desc, e.created_at desc
    limit 24
  ) recent_events;

  return jsonb_build_object(
    'meta', jsonb_build_object(
      'owner_id', p_owner_id,
      'from', p_from,
      'to', p_to,
      'source', 'rpt_owner_financial_position',
      'derivation_authority', 'calculate_owner_net_payout (ADR 0001)'
    ),
    'period', jsonb_build_object(
      'tenant_collections', public._r3(coalesce(v_period.gross_collected, 0)),
      'management_fees', jsonb_build_object(
        'amount', public._r3(coalesce(v_period.office_fee, 0)),
        'breakdown', coalesce(v_period.breakdown, '{}'::jsonb)
      ),
      'owner_expenses', public._r3(coalesce(v_period.owner_expenses, 0)),
      'fee_vat', public._r3(coalesce(v_period.tax_amount, 0)),
      'authorized_adjustments', 0,
      'adjustments_note', 'no_adjustments_authority_defined',
      'net_payable', public._r3(coalesce(v_period.net_payable, 0))
    ),
    'lifecycle_all_time', jsonb_build_object(
      'settled_pending_net', public._r3(v_settled_net),
      'paid_net', public._r3(v_paid_net),
      'paid_cash', case when v_missing_cash=0 then public._r3(v_paid_cash) else null end,
      'paid_cash_proven_total', public._r3(v_paid_cash),
      'paid_cash_evidence_missing_count', v_missing_cash,
      'remaining_payable', v_remaining,
      'draft_count', v_draft_count,
      'approved_count', v_approved_count,
      'paid_count', v_paid_count,
      'cancelled_count', v_cancelled_count
    ),
    'owner_funds', jsonb_build_object(
      -- Proven only when the register actually carries evidence for this owner.
      'held', case when v_funds_event_count > 0 then public._r3(v_funds_held) else null end,
      'held_proven_total', public._r3(v_funds_held),
      'held_evidence_missing_count', case when v_funds_event_count = 0 then 1 else 0 end,
      'events', v_funds
    ),
    'settlements', v_settlements
  );
end;
$function$;

notify pgrst, 'reload schema';

commit;

-- ============================================================================
-- R2 — Owner Financial Position & Settlements: authoritative position read model
-- ============================================================================
--
-- Roadmap V2 / R2. The application model still carried legacy settlement
-- semantics: the browser mapped settlement tax_amount into a fabricated
-- "utility_deductions" bucket and displayed fabricated management_fee_rate=0 /
-- management_fee_type='fixed'. R2's final business model is a server-derived
-- Owner Financial Position that the UI renders WITHOUT reinterpretation:
--
--   Owner
--    └─ Financial Position
--         ├─ Tenant collections          (collected-cash, period scoped)
--         ├─ Owner funds held            (owner_funds_events control)
--         ├─ Management fees             (basis + RATE/FIXED_MONTHLY + VAT)
--         ├─ Owner expenses
--         ├─ Authorized adjustments      (reserved: 0 until an adjustments
--         │                               authority exists — never fabricated)
--         ├─ Net payable                 (period derivation)
--         ├─ Settled                     (settlement lifecycle: draft/approved)
--         ├─ Paid                        (paid settlements)
--         └─ Remaining payable           (draft+approved net not yet paid)
--
-- Sources of truth (NOT reinvented — composed):
--   * public.calculate_owner_net_payout — the ONLY period derivation authority
--     (ADR 0001 collected-cash). The write path stores exactly its output, so
--     using it here guarantees position == settlement == statement parity.
--   * public.owner_settlements          — settlement lifecycle documents.
--   * public.owner_funds_events         — RC1 append-only owner-funds control.
--
-- Every aggregate is company-isolated and OMR 3dp (_r3). Drill-down: each
-- settlement row carries its id/reference; funds events carry source ids.
-- ============================================================================

begin;

create or replace function public.rpt_owner_financial_position(
  p_owner_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid := public.require_company_id();
  v_period record;
  v_settlements jsonb;
  v_funds jsonb;
  v_settled_net numeric := 0;
  v_paid_net numeric := 0;
  v_remaining numeric := 0;
  v_draft_count bigint := 0;
  v_approved_count bigint := 0;
  v_paid_count bigint := 0;
  v_cancelled_count bigint := 0;
  v_funds_held numeric := 0;
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

  -- ── Settlement lifecycle aggregates + bounded drill-down rows. ────────────
  select
    coalesce(sum(s.net_payable) filter (where upper(coalesce(s.status, '')) in ('DRAFT', 'APPROVED')), 0),
    coalesce(sum(s.net_payable) filter (where upper(coalesce(s.status, '')) = 'PAID'), 0),
    count(*) filter (where upper(coalesce(s.status, '')) = 'DRAFT'),
    count(*) filter (where upper(coalesce(s.status, '')) = 'APPROVED'),
    count(*) filter (where upper(coalesce(s.status, '')) = 'PAID'),
    count(*) filter (where upper(coalesce(s.status, '')) = 'CANCELLED')
  into v_settled_net, v_paid_net, v_draft_count, v_approved_count, v_paid_count, v_cancelled_count
  from public.owner_settlements s
  where s.company_id = v_company_id
    and s.owner_id::text = p_owner_id::text;

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

  -- ── Owner funds held: RC1 append-only control (0 when no events exist). ───
  select coalesce(sum(e.amount_delta), 0)
  into v_funds_held
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
        -- basis/RATE/FIXED_MONTHLY/VAT come from the derivation breakdown —
        -- never fabricated client-side defaults.
        'breakdown', coalesce(v_period.breakdown, '{}'::jsonb)
      ),
      'owner_expenses', public._r3(coalesce(v_period.owner_expenses, 0)),
      'fee_vat', public._r3(coalesce(v_period.tax_amount, 0)),
      -- Reserved: no adjustments authority exists yet. Explicit 0 with an
      -- explicit reason is honest; a silent fabricated bucket is not.
      'authorized_adjustments', 0,
      'adjustments_note', 'no_adjustments_authority_defined',
      'net_payable', public._r3(coalesce(v_period.net_payable, 0))
    ),
    'lifecycle', jsonb_build_object(
      'settled_pending_net', public._r3(v_settled_net),
      'paid_net', public._r3(v_paid_net),
      'remaining_payable', v_remaining,
      'draft_count', v_draft_count,
      'approved_count', v_approved_count,
      'paid_count', v_paid_count,
      'cancelled_count', v_cancelled_count
    ),
    'owner_funds', jsonb_build_object(
      'held', public._r3(v_funds_held),
      'events', v_funds
    ),
    'settlements', v_settlements
  );
end;
$function$;

comment on function public.rpt_owner_financial_position(uuid, date, date) is
  'R2 Owner Financial Position: single server-derived breakdown (collections, fees+VAT, '
  'expenses, net/settled/paid/remaining, owner-funds control) composed from the canonical '
  'derivation authority calculate_owner_net_payout — the UI never reinterprets it.';

alter function public.rpt_owner_financial_position(uuid, date, date) owner to postgres;
revoke all on function public.rpt_owner_financial_position(uuid, date, date) from public, anon;
grant execute on function public.rpt_owner_financial_position(uuid, date, date) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;

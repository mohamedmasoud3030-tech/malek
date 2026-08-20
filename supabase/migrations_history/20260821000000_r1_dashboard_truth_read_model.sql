-- ============================================================================
-- R1 — Dashboard Truth: authoritative dashboard read model
-- ============================================================================
--
-- Roadmap V2 / R1. The dashboard previously assembled "truth" in the browser:
--   * active contracts came from a 500-row page and used rows.length,
--   * maintenance KPIs were client filter().length over a full-table read,
--   * financial and arrears KPIs were derived client-side from full invoice /
--     payment / expense dataset reads (and ignored invoices.credited_amount),
--   * bank/settlement action counts were full-table fetches counted client-side.
--
-- This migration introduces ONE authoritative, company-isolated read model:
-- public.rpt_dashboard_snapshot(p_from, p_to, p_as_of). Every KPI is an SQL
-- aggregate — no PostgREST row cap can truncate a KPI — and every monetary
-- amount uses public._r3 (OMR 3dp) plus the Phase-3 credit-aware remaining:
--   remaining = amount + tax_amount - paid_amount - credited_amount.
--
-- KPI business definitions (single source of truth for the dashboard):
--   portfolio.properties        active (deleted_at is null) properties.
--   portfolio.units             active units.
--   occupancy.occupied_units    active units with lower(status)='occupied'.
--   occupancy.vacant_units      active units with lower(status) in
--                               ('available','vacant').
--   occupancy.occupancy_rate    round(occupied/units*100) — 0 when no units.
--   contracts.active            active contracts with upper(status)='ACTIVE'.
--   contracts.expiring_30/60/90 ACTIVE contracts whose end_date falls in
--                               [as_of, as_of + N days] (cumulative windows,
--                               defensively cast — live rows may carry text).
--   billing.invoiced_amount     sum(amount + tax) of invoices issued in
--                               [from, to], status not VOID/CANCELLED.
--   billing.invoices_count      count of the same set.
--   billing.invoices_total_count all-time active invoices (onboarding truth).
--   collections.collected_amount sum(payments.amount) in [from, to],
--                               status <> VOID (matches rpt_financial_summary).
--   collections.outstanding_amount sum(credit-aware remaining) of the period
--                               invoice set where remaining > 0.001.
--   collections.collection_rate round(collected/invoiced*100), 0 when no
--                               invoiced amount.
--   expenses.total_amount       sum(expenses.amount) in [from, to].
--   net_cash                    collected_amount - expenses.total_amount.
--   arrears.*                   invoices with due_date < as_of, status not in
--                               (PAID, VOID, CANCELLED), credit-aware
--                               remaining > 0.001 — the same predicate as
--                               public.rpt_overdue_invoices, evaluated on the
--                               invoice rows themselves (no context joins can
--                               drop a KPI row).
--   arrears.buckets             receivables (due or not) bucketed by
--                               (as_of - due_date): current <= 0, 1_30,
--                               31_60, 61_90, 90_plus.
--   owner_funds.net_payable     sum(net_payable) of DRAFT/APPROVED
--                               owner_settlements.
--   owner_funds.settlements_draft / settlements_approved  counts by status.
--   maintenance.open            active maintenance_records whose lower(status)
--                               is one of open/new/reported/assigned.
--   maintenance.in_progress     lower(status) = 'in_progress'.
--   maintenance.urgent_open     priority='urgent' and status in the open or
--                               in-progress sets.
--   exceptions.unmatched_bank_lines  active bank_statement_lines with
--                               lower(status)='unmatched'.
--   exceptions.pending_settlements   DRAFT + APPROVED owner settlements.
--
-- queues.* are bounded (limit 5) presentation rows for the dashboard work
-- queues. They use LEFT joins so missing context never hides a row, and they
-- are never a KPI source.
-- ============================================================================

begin;

create or replace function public.rpt_dashboard_snapshot(
  p_from date,
  p_to date,
  p_as_of date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid := public.require_company_id();
  v_portfolio jsonb;
  v_occupancy jsonb;
  v_contracts jsonb;
  v_billing jsonb;
  v_collections jsonb;
  v_expenses jsonb;
  v_arrears jsonb;
  v_owner_funds jsonb;
  v_maintenance jsonb;
  v_exceptions jsonb;
  v_queues jsonb;
  v_invoiced numeric;
  v_outstanding numeric;
  v_collected numeric;
  v_payments_count bigint;
  v_expense_total numeric;
begin
  if auth.uid() is null or not coalesce(public.is_app_user(), false) then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'A valid dashboard period is required.' using errcode = '22023';
  end if;

  -- ── Portfolio ─────────────────────────────────────────────────────────────
  select jsonb_build_object(
    'properties', (select count(*) from public.properties
                    where deleted_at is null and company_id = v_company_id),
    'units',      (select count(*) from public.units
                    where deleted_at is null and company_id = v_company_id)
  ) into v_portfolio;

  -- ── Occupancy ─────────────────────────────────────────────────────────────
  select jsonb_build_object(
    'occupied_units', count(*) filter (where lower(coalesce(status::text, '')) = 'occupied'),
    'vacant_units',   count(*) filter (where lower(coalesce(status::text, '')) in ('available', 'vacant')),
    'occupancy_rate', case when count(*) > 0
      then round((count(*) filter (where lower(coalesce(status::text, '')) = 'occupied'))::numeric
                 / count(*)::numeric * 100)
      else 0 end
  ) into v_occupancy
  from public.units
  where deleted_at is null and company_id = v_company_id;

  -- ── Contracts ─────────────────────────────────────────────────────────────
  with active_contracts as (
    select
      public._safe_date(btrim(coalesce(end_date::text, ''))) as end_date_safe
    from public.contracts
    where deleted_at is null
      and company_id = v_company_id
      and upper(coalesce(status::text, '')) = 'ACTIVE'
  )
  select jsonb_build_object(
    'active', count(*),
    'expiring_30', count(*) filter (where end_date_safe between p_as_of and (p_as_of + 30)),
    'expiring_60', count(*) filter (where end_date_safe between p_as_of and (p_as_of + 60)),
    'expiring_90', count(*) filter (where end_date_safe between p_as_of and (p_as_of + 90))
  ) into v_contracts
  from active_contracts;

  -- ── Billing (period) ──────────────────────────────────────────────────────
  with period_invoices as (
    select
      (i.amount + coalesce(i.tax_amount, 0)) as gross,
      (i.amount + coalesce(i.tax_amount, 0) - i.paid_amount - coalesce(i.credited_amount, 0)) as remaining
    from public.invoices i
    where i.deleted_at is null
      and i.company_id = v_company_id
      and i.issue_date between p_from and p_to
      and upper(coalesce(i.status, '')) not in ('VOID', 'CANCELLED')
  )
  select
    jsonb_build_object(
      'invoiced_amount', public._r3(coalesce(sum(gross), 0)),
      'invoices_count', count(*),
      'invoices_total_count', (
        select count(*) from public.invoices
         where deleted_at is null and company_id = v_company_id
      )
    ),
    public._r3(coalesce(sum(gross), 0)),
    public._r3(coalesce(sum(remaining) filter (where remaining > 0.001), 0))
  into v_billing, v_invoiced, v_outstanding
  from period_invoices;

  select public._r3(coalesce(sum(p.amount), 0)), count(*)
  into v_collected, v_payments_count
  from public.payments p
  where p.deleted_at is null
    and p.company_id = v_company_id
    and p.payment_date between p_from and p_to
    and upper(coalesce(p.status, 'POSTED')) <> 'VOID';

  select jsonb_build_object(
    'collected_amount', v_collected,
    'payments_count', v_payments_count,
    'outstanding_amount', v_outstanding,
    'collection_rate', case when v_invoiced > 0
      then round(least(v_collected / v_invoiced, 1) * 100)
      else 0 end
  ) into v_collections;

  -- ── Expenses (period) ─────────────────────────────────────────────────────
  select
    jsonb_build_object(
      'total_amount', public._r3(coalesce(sum(e.amount), 0)),
      'count', count(*)
    ),
    public._r3(coalesce(sum(e.amount), 0))
  into v_expenses, v_expense_total
  from public.expenses e
  where e.deleted_at is null
    and e.company_id = v_company_id
    and e.expense_date between p_from and p_to;

  -- ── Arrears / receivables aging (credit-aware, as of p_as_of) ────────────
  with receivables as (
    select
      (i.amount + coalesce(i.tax_amount, 0) - i.paid_amount - coalesce(i.credited_amount, 0)) as remaining,
      (p_as_of - i.due_date)::int as days_overdue
    from public.invoices i
    where i.deleted_at is null
      and i.company_id = v_company_id
      and upper(coalesce(i.status, '')) not in ('PAID', 'VOID', 'CANCELLED')
      and (i.amount + coalesce(i.tax_amount, 0) - i.paid_amount - coalesce(i.credited_amount, 0)) > 0.001
  )
  select jsonb_build_object(
    'total_overdue', public._r3(coalesce(sum(remaining) filter (where days_overdue >= 1), 0)),
    'overdue_count', count(*) filter (where days_overdue >= 1),
    'average_days_overdue', coalesce(round(avg(days_overdue) filter (where days_overdue >= 1)), 0),
    'over_90_amount', public._r3(coalesce(sum(remaining) filter (where days_overdue > 90), 0)),
    'over_90_count', count(*) filter (where days_overdue > 90),
    'total_outstanding', public._r3(coalesce(sum(remaining), 0)),
    'buckets', jsonb_build_object(
      'current', jsonb_build_object(
        'total', public._r3(coalesce(sum(remaining) filter (where days_overdue <= 0), 0)),
        'count', count(*) filter (where days_overdue <= 0)),
      'days_1_30', jsonb_build_object(
        'total', public._r3(coalesce(sum(remaining) filter (where days_overdue between 1 and 30), 0)),
        'count', count(*) filter (where days_overdue between 1 and 30)),
      'days_31_60', jsonb_build_object(
        'total', public._r3(coalesce(sum(remaining) filter (where days_overdue between 31 and 60), 0)),
        'count', count(*) filter (where days_overdue between 31 and 60)),
      'days_61_90', jsonb_build_object(
        'total', public._r3(coalesce(sum(remaining) filter (where days_overdue between 61 and 90), 0)),
        'count', count(*) filter (where days_overdue between 61 and 90)),
      'days_90_plus', jsonb_build_object(
        'total', public._r3(coalesce(sum(remaining) filter (where days_overdue > 90), 0)),
        'count', count(*) filter (where days_overdue > 90))
    )
  ) into v_arrears
  from receivables;

  -- ── Owner funds (settlement lifecycle) ────────────────────────────────────
  select jsonb_build_object(
    'net_payable', public._r3(coalesce(sum(net_payable) filter (where upper(coalesce(status, '')) in ('DRAFT', 'APPROVED')), 0)),
    'settlements_draft', count(*) filter (where upper(coalesce(status, '')) = 'DRAFT'),
    'settlements_approved', count(*) filter (where upper(coalesce(status, '')) = 'APPROVED')
  ) into v_owner_funds
  from public.owner_settlements
  where company_id = v_company_id;

  -- ── Maintenance ───────────────────────────────────────────────────────────
  select jsonb_build_object(
    'open', count(*) filter (where lower(coalesce(status, 'open')) in ('open', 'new', 'reported', 'assigned')),
    'in_progress', count(*) filter (where lower(coalesce(status, '')) = 'in_progress'),
    'urgent_open', count(*) filter (
      where lower(coalesce(priority, '')) = 'urgent'
        and lower(coalesce(status, 'open')) in ('open', 'new', 'reported', 'assigned', 'in_progress'))
  ) into v_maintenance
  from public.maintenance_records
  where deleted_at is null and company_id = v_company_id;

  -- ── Exceptions requiring management action ────────────────────────────────
  select jsonb_build_object(
    'unmatched_bank_lines', (
      select count(*) from public.bank_statement_lines
       where deleted_at is null
         and company_id = v_company_id
         and lower(coalesce(status, '')) = 'unmatched'
    ),
    'pending_settlements', (
      select count(*) from public.owner_settlements
       where company_id = v_company_id
         and upper(coalesce(status, '')) in ('DRAFT', 'APPROVED')
    )
  ) into v_exceptions;

  -- ── Bounded work-queue rows (presentation only, never a KPI source) ──────
  select jsonb_build_object(
    'expiring_contracts', coalesce((
      select jsonb_agg(row_data order by end_date_safe asc)
      from (
        select
          jsonb_build_object(
            'id', c.id,
            'reference', c.reference,
            'end_date', public._safe_date(btrim(c.end_date::text))::text,
            'days_remaining', greatest(0, (public._safe_date(btrim(c.end_date::text)) - p_as_of)::int),
            'tenant_name', t.full_name,
            'property_title', pr.title,
            'unit_number', u.unit_number
          ) as row_data,
          public._safe_date(btrim(c.end_date::text)) as end_date_safe
        from public.contracts c
        left join public.people t on t.id = c.tenant_id and t.deleted_at is null
        left join public.properties pr on pr.id = c.property_id and pr.deleted_at is null
        left join public.units u on u.id = c.unit_id and u.deleted_at is null
        where c.deleted_at is null
          and c.company_id = v_company_id
          and upper(coalesce(c.status::text, '')) = 'ACTIVE'
          and public._safe_date(btrim(coalesce(c.end_date::text, ''))) between p_as_of and (p_as_of + 30)
        order by public._safe_date(btrim(c.end_date::text)) asc, c.id asc
        limit 5
      ) expiring
    ), '[]'::jsonb),
    'overdue_invoices', coalesce((
      select jsonb_agg(row_data order by days_overdue desc)
      from (
        select
          jsonb_build_object(
            'invoice_id', i.id,
            'reference', i.reference,
            'due_date', i.due_date,
            'days_overdue', (p_as_of - i.due_date)::int,
            'remaining_amount', public._r3(i.amount + coalesce(i.tax_amount, 0) - i.paid_amount - coalesce(i.credited_amount, 0)),
            'tenant_name', t.full_name,
            'property_title', pr.title,
            'unit_number', u.unit_number
          ) as row_data,
          (p_as_of - i.due_date)::int as days_overdue
        from public.invoices i
        left join public.contracts c on c.id = i.contract_id
        left join public.people t on t.id = c.tenant_id and t.deleted_at is null
        left join public.properties pr on pr.id = c.property_id and pr.deleted_at is null
        left join public.units u on u.id = c.unit_id and u.deleted_at is null
        where i.deleted_at is null
          and i.company_id = v_company_id
          and upper(coalesce(i.status, '')) not in ('PAID', 'VOID', 'CANCELLED')
          and (i.amount + coalesce(i.tax_amount, 0) - i.paid_amount - coalesce(i.credited_amount, 0)) > 0.001
          and i.due_date < p_as_of
        order by (p_as_of - i.due_date) desc,
                 (i.amount + coalesce(i.tax_amount, 0) - i.paid_amount - coalesce(i.credited_amount, 0)) desc,
                 i.id asc
        limit 5
      ) overdue
    ), '[]'::jsonb),
    'urgent_maintenance', coalesce((
      select jsonb_agg(row_data)
      from (
        select jsonb_build_object(
            'id', m.id,
            'title', m.title,
            'priority', m.priority,
            'property_title', pr.title,
            'unit_number', u.unit_number
          ) as row_data
        from public.maintenance_records m
        left join public.properties pr on pr.id = m.property_id and pr.deleted_at is null
        left join public.units u on u.id = m.unit_id and u.deleted_at is null
        where m.deleted_at is null
          and m.company_id = v_company_id
          and lower(coalesce(m.priority, '')) = 'urgent'
          and lower(coalesce(m.status, 'open')) in ('open', 'new', 'reported', 'assigned', 'in_progress')
        order by m.created_at desc nulls last, m.id asc
        limit 5
      ) urgent
    ), '[]'::jsonb)
  ) into v_queues;

  return jsonb_build_object(
    'meta', jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'as_of', p_as_of,
      'source', 'rpt_dashboard_snapshot'
    ),
    'portfolio', v_portfolio,
    'occupancy', v_occupancy,
    'contracts', v_contracts,
    'billing', v_billing,
    'collections', v_collections,
    'expenses', v_expenses,
    'net_cash', public._r3(v_collected - v_expense_total),
    'arrears', v_arrears,
    'owner_funds', v_owner_funds,
    'maintenance', v_maintenance,
    'exceptions', v_exceptions,
    'queues', v_queues
  );
end;
$function$;

comment on function public.rpt_dashboard_snapshot(date, date, date) is
  'R1 Dashboard Truth: single authoritative, company-isolated dashboard read model. '
  'Every KPI is an SQL aggregate (no client row caps), amounts are OMR 3dp via _r3, '
  'and receivable remaining is credit-aware (amount + tax - paid - credited).';

alter function public.rpt_dashboard_snapshot(date, date, date) owner to postgres;
revoke all on function public.rpt_dashboard_snapshot(date, date, date) from public, anon;
grant execute on function public.rpt_dashboard_snapshot(date, date, date) to authenticated, service_role;

-- ============================================================================
-- Reports parity: rpt_aged_receivables predates invoices.credited_amount
-- (Phase 3) and still computed remaining = amount + tax - paid. That breaks
-- Dashboard = Reports reconciliation the moment a credit exists. Redefine the
-- remaining formula credit-aware; everything else (shape, grouping, ordering,
-- security posture) is unchanged.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpt_aged_receivables(p_as_of date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lines jsonb;
  v_totals jsonb;
  v_company_id uuid := public.require_company_id();
BEGIN
  WITH aged AS (
    SELECT t.id tenant_id, t.full_name tenant_name, t.phone tenant_phone,
      pr.title property_name, u.unit_number unit_name,
      public._r3(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount - COALESCE(i.credited_amount, 0)) remaining,
      (p_as_of - i.due_date)::int days_overdue
    FROM public.invoices i
    JOIN public.contracts c ON c.id::text = i.contract_id::text AND c.deleted_at IS NULL
    JOIN public.people t ON t.id::text = c.tenant_id::text AND t.type = 'tenant' AND t.deleted_at IS NULL
    JOIN public.units u ON u.id::text = c.unit_id::text AND u.deleted_at IS NULL
    JOIN public.properties pr ON pr.id::text = c.property_id::text AND pr.deleted_at IS NULL
    WHERE upper(COALESCE(i.status, '')) NOT IN ('PAID', 'VOID', 'CANCELLED')
      AND i.deleted_at IS NULL
      AND i.company_id = v_company_id
      AND i.due_date <= p_as_of
      AND (i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount - COALESCE(i.credited_amount, 0)) > 0.001
  ), bucketed AS (
    SELECT tenant_id, tenant_name, tenant_phone, property_name, unit_name,
      public._r3(sum(remaining)) total,
      public._r3(sum(CASE WHEN days_overdue <= 0 THEN remaining ELSE 0 END)) bucket_current,
      public._r3(sum(CASE WHEN days_overdue BETWEEN 1 AND 30 THEN remaining ELSE 0 END)) bucket_1_30,
      public._r3(sum(CASE WHEN days_overdue BETWEEN 31 AND 60 THEN remaining ELSE 0 END)) bucket_31_60,
      public._r3(sum(CASE WHEN days_overdue BETWEEN 61 AND 90 THEN remaining ELSE 0 END)) bucket_61_90,
      public._r3(sum(CASE WHEN days_overdue > 90 THEN remaining ELSE 0 END)) bucket_90plus
    FROM aged
    GROUP BY tenant_id, tenant_name, tenant_phone, property_name, unit_name
    HAVING sum(remaining) > 0
  )
  SELECT jsonb_agg(jsonb_build_object(
      'tenant_id', tenant_id, 'tenant_name', tenant_name, 'tenant_phone', tenant_phone,
      'property_name', property_name, 'unit_name', unit_name, 'total', total,
      'current', bucket_current, '1_30', bucket_1_30, '31_60', bucket_31_60,
      '61_90', bucket_61_90, '90plus', bucket_90plus) ORDER BY total DESC),
    jsonb_build_object('total', public._r3(sum(total)), 'current', public._r3(sum(bucket_current)),
      '1_30', public._r3(sum(bucket_1_30)), '31_60', public._r3(sum(bucket_31_60)),
      '61_90', public._r3(sum(bucket_61_90)), '90plus', public._r3(sum(bucket_90plus)))
  INTO v_lines, v_totals FROM bucketed;

  RETURN jsonb_build_object(
    'lines', COALESCE(v_lines, '[]'::jsonb),
    'totals', COALESCE(v_totals, '{"total":0,"current":0,"1_30":0,"31_60":0,"61_90":0,"90plus":0}'::jsonb),
    'as_of', p_as_of);
END;
$$;

REVOKE ALL ON FUNCTION public.rpt_aged_receivables(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_aged_receivables(date) TO authenticated, service_role;

notify pgrst, 'reload schema';

commit;

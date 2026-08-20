-- ============================================================================
-- R13 — Post-roadmap financial & data correctness hardening
-- ============================================================================
--
-- Three independently confirmed defects from the post-roadmap correctness
-- audit, each fixed forward-only with an authoritative business invariant:
--
--   A. rpt_dashboard_snapshot.collections.collection_rate compared mismatched
--      economic cohorts: numerator = cash collected this period (payments by
--      payment_date), denominator = invoices ISSUED this period, ignoring
--      credits. A payment collected now that settles a prior-period invoice
--      entered the numerator while its invoice was absent from the
--      denominator, and a credit reduced the collectible obligation without
--      reducing the denominator. The metric is now invoice-cohort realization:
--        collected_against_period / collectible_period
--      where (over the period invoice set, excluding VOID/CANCELLED):
--        collectible          = amount + tax - credited_amount
--        collected_against    = least(paid_amount, collectible)
--      The cash-collection KPI (collections.collected_amount) is unchanged —
--      it remains "cash collected this period" and still reconciles with
--      rpt_financial_summary. Only the ratio is made economically coherent.
--
--   C. create_maintenance_atomic implemented idempotency as SELECT-then-INSERT.
--      Under concurrent identical requests both callers could SELECT "none",
--      then one INSERT succeeded and the other raised a unique-violation error
--      instead of returning the canonical cached row. The path is now
--      race-safe via INSERT ... ON CONFLICT (company_id, request_id)
--      [partial index] DO NOTHING + reload of the canonical existing row. The
--      unique index is preserved (never weakened), audit is written only for a
--      real insert, and company isolation + cross-company validation order are
--      unchanged.
--
--   D. rpt_owner_financial_position returned period-scoped economics (the
--      "period" section) next to ALL-TIME settlement lifecycle aggregates (the
--      "lifecycle" section) without making the scope distinction explicit.
--      The all-time lifecycle is intentional (an outstanding DRAFT/APPROVED
--      settlement from a prior period is still payable). The contract is now
--      explicit: the JSON key is renamed lifecycle -> lifecycle_all_time so a
--      period-scoped caller can never mistake lifetime settlement position for
--      period economics.
-- ============================================================================

begin;

-- ══════════════════════════════════════════════════════════════════════════
-- A. Dashboard collection rate: invoice-cohort realization (credit-aware)
-- ══════════════════════════════════════════════════════════════════════════
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
  v_collectible numeric;
  v_period_collected numeric;
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
  -- collectible = gross obligation net of posted credits; the period invoice
  -- cohort is the single economic cohort for the collection-rate metric.
  with period_invoices as (
    select
      (i.amount + coalesce(i.tax_amount, 0)) as gross,
      (i.amount + coalesce(i.tax_amount, 0) - coalesce(i.credited_amount, 0)) as collectible,
      i.paid_amount as paid,
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
    public._r3(coalesce(sum(remaining) filter (where remaining > 0.001), 0)),
    public._r3(coalesce(sum(collectible), 0)),
    public._r3(coalesce(sum(least(paid, collectible)), 0))
  into v_billing, v_invoiced, v_outstanding, v_collectible, v_period_collected
  from period_invoices;

  -- Cash collected this period (unchanged: reconciles with rpt_financial_summary).
  select public._r3(coalesce(sum(p.amount), 0)), count(*)
  into v_collected, v_payments_count
  from public.payments p
  where p.deleted_at is null
    and p.company_id = v_company_id
    and p.payment_date between p_from and p_to
    and upper(coalesce(p.status, 'POSTED')) <> 'VOID';

  -- Collection rate is invoice-cohort realization: the fraction of the
  -- period's collectible obligation (net of credits) that has been collected.
  select jsonb_build_object(
    'collected_amount', v_collected,
    'payments_count', v_payments_count,
    'outstanding_amount', v_outstanding,
    'collection_rate', case when v_collectible > 0
      then round(v_period_collected / v_collectible * 100)
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
  'R13: collection_rate is now invoice-cohort realization (collected_against/collectible '
  'over the period invoice set, credit-aware); every KPI remains a company-isolated SQL '
  'aggregate with OMR 3dp via _r3. collected_amount stays period cash and reconciles '
  'with rpt_financial_summary.';

alter function public.rpt_dashboard_snapshot(date, date, date) owner to postgres;
revoke all on function public.rpt_dashboard_snapshot(date, date, date) from public, anon;
grant execute on function public.rpt_dashboard_snapshot(date, date, date) to authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════════
-- C. Maintenance creation: race-safe idempotency (INSERT ... ON CONFLICT)
-- ══════════════════════════════════════════════════════════════════════════
create or replace function public.create_maintenance_atomic(
  p_property_id text,
  p_unit_id text default null,
  p_title text default null,
  p_description text default null,
  p_priority text default 'medium',
  p_assigned_to text default null,
  p_technician_name text default null,
  p_scheduled_date date default null,
  p_attachment_url text default null,
  p_request_id text default null,
  p_service_provider_category_id uuid default null,
  p_service_provider_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_property public.properties%rowtype;
  v_unit public.units%rowtype;
  v_priority text;
  v_title text;
  v_record public.maintenance_records;
  v_audit_id text;
begin
  if auth.uid() is null then
    raise exception 'غير مصرح: يجب تسجيل الدخول' using errcode = '42501';
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'لم يتم تحديد الشركة الحالية' using errcode = '42501';
  end if;

  v_title := btrim(coalesce(p_title, ''));
  if v_title = '' then raise exception 'عنوان طلب الصيانة مطلوب'; end if;

  v_priority := lower(coalesce(p_priority, 'medium'));
  if v_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'أولوية غير صحيحة';
  end if;

  -- ::text comparisons: correct on clean uuid schemas AND live text schemas.
  select * into v_property
  from public.properties
  where id::text = p_property_id and company_id = v_company_id and deleted_at is null;
  if not found then raise exception 'العقار غير موجود أو تابع لشركة أخرى أو مؤرشف'; end if;

  if p_unit_id is not null and btrim(p_unit_id) <> '' then
    select * into v_unit
    from public.units
    where id::text = p_unit_id
      and property_id::text = v_property.id::text
      and company_id = v_company_id
      and deleted_at is null;
    if not found then raise exception 'الوحدة غير موجودة أو لا تتبع العقار المحدد'; end if;
  end if;

  -- Validate both assignment records before the write so an invalid
  -- cross-company retry cannot use the RPC as an existence oracle.
  if p_service_provider_category_id is not null and not exists (
    select 1 from public.service_provider_categories c
    where c.id = p_service_provider_category_id and c.company_id = v_company_id
      and c.is_active and c.deleted_at is null
  ) then
    raise exception 'نوع الخدمة غير متاح للشركة الحالية' using errcode = '23503';
  end if;
  if p_service_provider_id is not null and not exists (
    select 1 from public.service_providers p
    where p.id = p_service_provider_id and p.company_id = v_company_id
      and p.is_active and p.deleted_at is null
  ) then
    raise exception 'مزود الخدمة غير متاح للشركة الحالية' using errcode = '23503';
  end if;
  if p_service_provider_id is not null and p_service_provider_category_id is not null
     and not exists (
       select 1 from public.service_provider_category_links link
       where link.company_id = v_company_id
         and link.service_provider_id = p_service_provider_id
         and link.category_id = p_service_provider_category_id
     ) then
    raise exception 'مزود الخدمة المحدد لا يدعم نوع الخدمة المختار' using errcode = '23514';
  end if;

  -- Race-safe idempotency: INSERT ... ON CONFLICT DO NOTHING is atomic with
  -- respect to the company-scoped unique index, so two concurrent identical
  -- requests can never both insert; the "loser" reloads the canonical existing
  -- row and returns the same semantic result instead of a unique violation.
  v_record := null;
  insert into public.maintenance_records (
    company_id, property_id, unit_id, title, description, priority,
    assigned_to, technician_name, scheduled_date, attachment_url,
    request_id, status, request_date, service_provider_category_id, service_provider_id
  ) values (
    v_company_id, v_property.id, v_unit.id, v_title,
    nullif(btrim(coalesce(p_description, '')), ''), v_priority,
    nullif(btrim(coalesce(p_assigned_to, '')), ''),
    nullif(btrim(coalesce(p_technician_name, '')), ''),
    p_scheduled_date, nullif(btrim(coalesce(p_attachment_url, '')), ''),
    nullif(btrim(coalesce(p_request_id, '')), ''), 'open', current_date,
    p_service_provider_category_id, p_service_provider_id
  )
  on conflict (company_id, request_id) where request_id is not null and deleted_at is null
  do nothing
  returning * into v_record;

  if v_record.id is null then
    -- A concurrent identical request already created the row: return the
    -- canonical cached result (same semantic outcome, idempotent).
    select * into v_record
    from public.maintenance_records
    where request_id = nullif(btrim(coalesce(p_request_id, '')), '')
      and company_id = v_company_id
      and deleted_at is null
    limit 1;
    return jsonb_build_object('maintenance', to_jsonb(v_record), 'idempotent', true);
  end if;

  insert into public.audit_log(user_id, action, entity, entity_id, note, "table", details)
  values (
    auth.uid(), 'create', 'maintenance_record', v_record.id::text,
    'create_maintenance_atomic: ' || v_title || ' (company=' || v_company_id || ')',
    'maintenance_records',
    jsonb_strip_nulls(jsonb_build_object(
      'company_id', v_company_id,
      'service_provider_id', p_service_provider_id,
      'service_provider_category_id', p_service_provider_category_id
    ))::text
  ) returning id into v_audit_id;

  return jsonb_build_object('maintenance', to_jsonb(v_record), 'idempotent', false);
end;
$$;

revoke all on function public.create_maintenance_atomic(
  text, text, text, text, text, text, text, date, text, text, uuid, uuid
) from public, anon;
grant execute on function public.create_maintenance_atomic(
  text, text, text, text, text, text, text, date, text, text, uuid, uuid
) to authenticated, service_role;

comment on function public.create_maintenance_atomic(
  text, text, text, text, text, text, text, date, text, text, uuid, uuid
) is
  'R13: race-safe canonical maintenance creation. Idempotency is INSERT ... ON CONFLICT '
  '(company_id, request_id) DO NOTHING + reload of the canonical row, so concurrent '
  'identical requests return the same deterministic result without a unique violation. '
  'Company isolation, cross-company validation order, audit behavior and ::text-safe '
  'identifier comparisons are preserved.';

-- ══════════════════════════════════════════════════════════════════════════
-- D. Owner financial position: explicit all-time lifecycle contract
-- ══════════════════════════════════════════════════════════════════════════
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

  -- ── All-time settlement lifecycle aggregates + bounded drill-down rows. ───
  -- CONTRACT (R13): this section is intentionally ALL-TIME — an outstanding
  -- DRAFT/APPROVED settlement from a prior period is still payable to the
  -- owner, and paid history is lifetime history. It is never scoped to
  -- p_from/p_to, and the key lifecycle_all_time makes that explicit.
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
  'R13 Owner Financial Position: "period" is period-scoped economics (calculate_owner_net_payout); '
  '"lifecycle_all_time" is the lifetime settlement position (settled/paid/remaining/counts) — the '
  'scope distinction is explicit so period truth and lifetime truth are never conflated.';

alter function public.rpt_owner_financial_position(uuid, date, date) owner to postgres;
revoke all on function public.rpt_owner_financial_position(uuid, date, date) from public, anon;
grant execute on function public.rpt_owner_financial_position(uuid, date, date) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;

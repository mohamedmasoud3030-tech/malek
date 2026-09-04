-- Bound the anonymous portal projections.
--
-- The tenant/owner portal snapshots are the only anon-executable SECURITY
-- DEFINER surface in the schema (audited by scripts/supabase-tests/rls-matrix
-- struct.no_anon_definers). The bearer token authenticates, but until now every
-- list inside a snapshot (invoices, utility bills, receipts, documents,
-- maintenance, properties, units, settlements) was an UNLIMITED jsonb_agg
-- over all history for the scoped contract/owner. A long-lived link therefore
-- projected the complete financial ledger into one anonymous JSON response:
-- an unbounded-data exposure on the least-trusted surface.
--
-- This migration bounds every list to the newest (or, for the tenant due
-- schedule, the earliest-due) 50 rows per section — matching each section's
-- existing display order — while ALL summary aggregates (invoiced/paid/
-- remaining/overdue, settlement totals, portfolio counts, occupancy) continue
-- to be computed over the complete scoped row set, so displayed totals stay
-- true. Each bounded section also reports its full row count so the portal UI
-- can disclose that it renders a recent window instead of pretending a
-- truncated list is complete (same fail-honest doctrine as the frontend
-- paged-read contract in lib/paginatedRead.ts).
--
-- Owner Portal additionally stops re-exporting the v44 "legacy" projection:
-- the public function is now self-contained (the same pattern the Tenant
-- Portal already follows since migration 46), and the internal
-- app_private.get_owner_portal_snapshot_legacy wrapper — whose only two
-- consumers were the migration-45/-62 public wrappers replaced here — is
-- dropped. The client contract is unchanged: same function names/signatures,
-- same snapshot keys (one additive *Total count per bounded section), same
-- token/revocation/expiry rules, same metadata-only document projection, same
-- DRAFT+APPROVED net-payable semantics, same link telemetry write.
--
-- Bug fix inherited by the rewrite: owner_settlements.owner_id and
-- .property_id are TEXT columns, while the superseded 44/45/62 code compared
-- them directly against uuid variables/joins ("operator does not exist:
-- text = uuid"). Settlement scope now uses the repository's canonical
-- explicit ::text comparisons, which the PGlite replay regression proves on
-- the real schema.

begin;

-- ---------------------------------------------------------------------------
-- Tenant Portal: bounded canonical projection (replaces migration 46 logic).
-- ---------------------------------------------------------------------------

create or replace function public.get_tenant_portal_snapshot(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_link_id uuid;
  v_company uuid;
  v_tenant_id uuid;
  v_full_name text;
  v_phone text;
  v_email text;
  v_contract_id uuid;
  v_contract_reference text;
  v_contract_status text;
  v_contract_start date;
  v_contract_end date;
  v_rent_amount numeric;
  v_unit_id uuid;
  v_property_id uuid;
  v_unit_number text;
  v_unit_status text;
  v_property_title text;
  v_due_schedule jsonb := '[]'::jsonb;
  v_due_schedule_total integer := 0;
  v_services jsonb := '[]'::jsonb;
  v_services_total integer := 0;
  v_receipts jsonb := '[]'::jsonb;
  v_receipts_total integer := 0;
  v_documents jsonb := '[]'::jsonb;
  v_documents_total integer := 0;
  v_maintenance jsonb := '[]'::jsonb;
  v_maintenance_total integer := 0;
  v_invoiced numeric := 0;
  v_paid numeric := 0;
  v_remaining numeric := 0;
  v_overdue numeric := 0;
begin
  select l.id, l.company_id, l.tenant_id
    into v_link_id, v_company, v_tenant_id
  from public.tenant_portal_links l
  where l.token = p_token
    and l.revoked_at is null
    and l.expires_at > now()
  limit 1;

  if v_link_id is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  select p.full_name, p.phone, p.email
    into v_full_name, v_phone, v_email
  from public.people p
  where p.id = v_tenant_id
    and p.company_id = v_company
    and p.type::text = 'tenant'
    and p.deleted_at is null;

  if v_full_name is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  select
    c.id,
    c.reference,
    c.status::text,
    c.start_date,
    c.end_date,
    c.rent_amount,
    c.unit_id,
    c.property_id
  into
    v_contract_id,
    v_contract_reference,
    v_contract_status,
    v_contract_start,
    v_contract_end,
    v_rent_amount,
    v_unit_id,
    v_property_id
  from public.contracts c
  where c.company_id = v_company
    and c.tenant_id = v_tenant_id
    and c.deleted_at is null
  order by
    case when lower(c.status::text) = 'active' then 0 else 1 end,
    c.end_date desc nulls last,
    c.created_at desc
  limit 1;

  if v_contract_id is not null then
    if v_unit_id is not null then
      select u.unit_number, u.status::text
        into v_unit_number, v_unit_status
      from public.units u
      where u.id = v_unit_id
        and u.company_id = v_company
        and u.deleted_at is null;
    end if;

    if v_property_id is not null then
      select p.title
        into v_property_title
      from public.properties p
      where p.id = v_property_id
        and p.company_id = v_company
        and p.deleted_at is null;
    end if;

    -- Due schedule: list window = earliest-due 50 (the actionable horizon);
    -- totals below stay computed over the COMPLETE contract invoice set.
    with scoped as (
      select i.id, i.reference, i.due_date, i.amount, i.paid_amount
      from public.invoices i
      where i.company_id = v_company
        and i.contract_id = v_contract_id
        and i.deleted_at is null
    ),
    ranked as (
      select s.*,
             row_number() over (order by s.due_date, s.id) as rn,
             count(*) over () as total
      from scoped s
    )
    select
      coalesce(jsonb_agg(jsonb_build_object(
        'label', coalesce(r.reference, 'استحقاق'),
        'dueDate', r.due_date,
        'amount', r.amount,
        'currency', 'OMR',
        'status', case
          when greatest(r.amount - r.paid_amount, 0) <= 0 then 'paid'
          when r.due_date < current_date then 'overdue'
          else 'open'
        end
      ) order by r.rn) filter (where r.rn <= 50), '[]'::jsonb),
      coalesce(max(r.total), 0)::integer,
      coalesce(sum(r.amount), 0),
      coalesce(sum(r.paid_amount), 0),
      coalesce(sum(greatest(r.amount - r.paid_amount, 0)), 0),
      coalesce(sum(case when r.due_date < current_date then greatest(r.amount - r.paid_amount, 0) else 0 end), 0)
    into v_due_schedule, v_due_schedule_total, v_invoiced, v_paid, v_remaining, v_overdue
    from ranked r;

    -- Services (utility bills): newest-due 50 window over the same scope.
    with scoped as (
      select ub.id,
             coalesce(nullif(ub.reference_no, ''), nullif(ub.reference, ''), nullif(ub.type, ''), 'خدمة / مرفق') as label,
             ub.billing_period_start, ub.billing_period_end, ub.due_date,
             coalesce(ub.amount, 0) as amount,
             coalesce(ub.paid_amount, 0) as paid_amount
      from public.utility_bills ub
      where ub.company_id = v_company
        and ub.contract_id = v_contract_id
        and ub.deleted_at is null
    ),
    ranked as (
      select s.*,
             row_number() over (order by s.due_date desc, s.id desc) as rn,
             count(*) over () as total
      from scoped s
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'label', r.label,
      'periodStart', r.billing_period_start,
      'periodEnd', r.billing_period_end,
      'dueDate', r.due_date,
      'amount', r.amount,
      'paid', r.paid_amount,
      'remaining', greatest(r.amount - r.paid_amount, 0),
      'currency', 'OMR',
      'status', case
        when greatest(r.amount - r.paid_amount, 0) <= 0 then 'paid'
        when r.due_date < current_date then 'overdue'
        else 'open'
      end
    ) order by r.rn) filter (where r.rn <= 50), '[]'::jsonb),
    coalesce(max(r.total), 0)::integer
    into v_services, v_services_total
    from ranked r;

    -- Receipts: newest 50 window over the contract-scoped set.
    with scoped as (
      select r.id,
             coalesce(r.reference, r.no, 'إيصال') as reference,
             r.date_time,
             r.amount,
             lower(r.status::text) as status
      from public.receipts r
      where r.company_id = v_company
        and r.tenant_id = v_tenant_id
        and r.contract_id = v_contract_id
        and r.deleted_at is null
    ),
    ranked as (
      select s.*,
             row_number() over (order by s.date_time desc, s.id desc) as rn,
             count(*) over () as total
      from scoped s
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'reference', r.reference,
      'date', r.date_time,
      'amount', r.amount,
      'currency', 'OMR',
      'status', case when r.status = 'void' then 'void' else 'posted' end
    ) order by r.rn) filter (where r.rn <= 50), '[]'::jsonb),
    coalesce(max(r.total), 0)::integer
    into v_receipts, v_receipts_total
    from ranked r;

    -- Documents: canonical vault metadata only, newest 50 — never file_url
    -- or storage_path cross the external portal boundary.
    with scoped as (
      select vd.id, vd.title, vd.category::text as category, vd.created_at, vd.file_name
      from public.vault_documents vd
      where vd.company_id = v_company
        and vd.deleted_at is null
        and (
          (lower(coalesce(vd.related_entity_type, '')) in ('contract', 'contracts') and vd.related_entity_id = v_contract_id::text)
          or
          (lower(coalesce(vd.related_entity_type, '')) in ('tenant', 'tenants', 'person', 'people') and vd.related_entity_id = v_tenant_id::text)
        )
    ),
    ranked as (
      select s.*,
             row_number() over (order by s.created_at desc, s.id desc) as rn,
             count(*) over () as total
      from scoped s
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'title', r.title,
      'type', r.category,
      'createdAt', r.created_at,
      'reference', r.file_name
    ) order by r.rn) filter (where r.rn <= 50), '[]'::jsonb),
    coalesce(max(r.total), 0)::integer
    into v_documents, v_documents_total
    from ranked r;

    -- Maintenance: same unit + within contract dates + charged to TENANT.
    -- Unit-only maintenance stays intentionally unexposed (it can belong to
    -- another occupant or to the owner/office). Newest 50 window.
    if v_unit_id is not null then
      with scoped as (
        select m.id,
               coalesce(nullif(m.title, ''), nullif(m.no, ''), 'طلب صيانة') as label,
               coalesce(m.status::text, 'unknown') as status,
               btrim(coalesce(m.request_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$' as has_request_date,
               btrim(coalesce(m.request_date::text, '')) as request_date_text,
               case
                 when btrim(coalesce(m.request_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$' then btrim(m.request_date::text)::date
                 else m.created_at::date
               end as occurred_on,
               m.created_at
        from public.maintenance_records m
        where m.company_id = v_company
          and m.unit_id = v_unit_id
          and m.deleted_at is null
          and upper(coalesce(m.charged_to::text, '')) = 'TENANT'
          and (
            case
              when btrim(coalesce(m.request_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$' then btrim(m.request_date::text)::date
              else m.created_at::date
            end
          ) between v_contract_start and v_contract_end
      ),
      ranked as (
        select s.*,
               row_number() over (order by s.occurred_on desc nulls last, s.id desc) as rn,
               count(*) over () as total
        from scoped s
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'label', r.label,
        'status', r.status,
        'createdAt', case when r.has_request_date then r.request_date_text else r.created_at::text end
      ) order by r.rn) filter (where r.rn <= 50), '[]'::jsonb),
      coalesce(max(r.total), 0)::integer
      into v_maintenance, v_maintenance_total
      from ranked r;
    end if;
  end if;

  update public.tenant_portal_links
  set last_used_at = now()
  where id = v_link_id;

  return jsonb_build_object(
    'status', 'ready',
    'snapshot', jsonb_build_object(
      'tenantId', v_tenant_id,
      'companyId', v_company,
      'asOf', now(),
      'identity', jsonb_build_object('fullName', v_full_name, 'phone', v_phone, 'email', v_email),
      'unit', case when v_unit_number is not null then jsonb_build_object(
        'title', coalesce(v_property_title, 'العقار'),
        'unitNumber', v_unit_number,
        'status', coalesce(v_unit_status, 'unknown')
      ) else null end,
      'contract', case when v_contract_id is not null then jsonb_build_object(
        'reference', coalesce(v_contract_reference, v_contract_id::text),
        'status', coalesce(v_contract_status, 'unknown'),
        'startDate', v_contract_start,
        'endDate', v_contract_end,
        'rentAmount', coalesce(v_rent_amount, 0),
        'currency', 'OMR'
      ) else null end,
      'dueSchedule', v_due_schedule,
      'dueScheduleTotal', v_due_schedule_total,
      'paidPosition', case when v_contract_id is not null then jsonb_build_object(
        'invoiced', v_invoiced,
        'paid', v_paid,
        'remaining', v_remaining,
        'overdue', v_overdue,
        'currency', 'OMR'
      ) else null end,
      'services', v_services,
      'servicesTotal', v_services_total,
      'receipts', v_receipts,
      'receiptsTotal', v_receipts_total,
      'documents', v_documents,
      'documentsTotal', v_documents_total,
      'maintenance', v_maintenance,
      'maintenanceTotal', v_maintenance_total
    )
  );
end;
$function$;

comment on function public.get_tenant_portal_snapshot(uuid) is
  'Read-only Tenant Portal snapshot. Token-scoped; every list is a bounded recent window (50 rows max) and every *Total key reports the full row count. Totals are computed over the complete scoped set.';

revoke all on function public.get_tenant_portal_snapshot(uuid) from public;
grant execute on function public.get_tenant_portal_snapshot(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Owner Portal: bounded, self-contained canonical projection.
-- Supersedes the migration-45/-62 wrapper over the v44 legacy projection;
-- all preserved semantics: token scope, DRAFT+APPROVED payable rule,
-- vault-metadata-only documents with company scoping, link telemetry write.
-- ---------------------------------------------------------------------------

create or replace function public.get_owner_portal_snapshot(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_link_id uuid;
  v_company uuid;
  v_owner_id uuid;
  v_full_name text;
  v_phone text;
  v_email text;
  v_properties jsonb := '[]'::jsonb;
  v_property_total integer := 0;
  v_property_count integer := 0;
  v_unit_count integer := 0;
  v_occupied integer := 0;
  v_vacant integer := 0;
  v_occupancy_rate numeric := 0;
  v_units jsonb := '[]'::jsonb;
  v_units_total integer := 0;
  v_settlements jsonb := '[]'::jsonb;
  v_settlements_total integer := 0;
  v_maintenance jsonb := '[]'::jsonb;
  v_maintenance_total integer := 0;
  v_documents jsonb := '[]'::jsonb;
  v_documents_total integer := 0;
  v_gross_collected numeric := 0;
  v_owner_expenses numeric := 0;
  v_net_payable numeric := 0;
begin
  select l.id, l.company_id, l.owner_id
    into v_link_id, v_company, v_owner_id
  from public.owner_portal_links l
  where l.token = p_token
    and l.revoked_at is null
    and l.expires_at > now()
  limit 1;

  if v_link_id is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  select o.full_name, o.phone, o.email
    into v_full_name, v_phone, v_email
  from public.owners o
  where o.id = v_owner_id
    and o.company_id = v_company
    and o.deleted_at is null;

  if v_full_name is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  with owner_properties as (
    select p.id, p.title, p.address, po.ownership_percentage
    from public.property_owners po
    join public.properties p
      on p.id = po.property_id
     and p.company_id = po.company_id
    where po.company_id = v_company
      and po.owner_id = v_owner_id
      and p.deleted_at is null
      and (po.starts_on is null or po.starts_on <= current_date)
      and (po.ends_on is null or po.ends_on >= current_date)
  ),
  property_stats as (
    select
      op.id,
      op.title,
      op.address,
      op.ownership_percentage,
      count(u.id)::integer as units,
      count(u.id) filter (
        where exists (
          select 1
          from public.contracts c
          where c.company_id = v_company
            and c.unit_id = u.id
            and c.deleted_at is null
            and lower(c.status::text) = 'active'
            and (c.end_date is null or c.end_date >= current_date)
        )
      )::integer as occupied_units
    from owner_properties op
    left join public.units u
      on u.company_id = v_company
     and u.property_id = op.id
     and u.deleted_at is null
    group by op.id, op.title, op.address, op.ownership_percentage
  ),
  ranked as (
    select ps.*,
           row_number() over (order by ps.title, ps.id) as rn,
           count(*) over () as total
    from property_stats ps
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id,
      'title', r.title,
      'address', r.address,
      'ownershipPercentage', coalesce(r.ownership_percentage, 100),
      'units', r.units,
      'occupiedUnits', r.occupied_units,
      'vacantUnits', greatest(r.units - r.occupied_units, 0)
    ) order by r.rn) filter (where r.rn <= 50), '[]'::jsonb),
    coalesce(max(r.total), 0)::integer,
    count(*)::integer,
    coalesce(sum(r.units), 0)::integer,
    coalesce(sum(r.occupied_units), 0)::integer
  into v_properties, v_property_total, v_property_count, v_unit_count, v_occupied
  from ranked r;

  v_vacant := greatest(v_unit_count - v_occupied, 0);
  v_occupancy_rate := case when v_unit_count > 0 then round((v_occupied::numeric / v_unit_count::numeric) * 100, 1) else 0 end;

  with owner_properties as (
    select p.id, p.title
    from public.property_owners po
    join public.properties p on p.id = po.property_id and p.company_id = po.company_id
    where po.company_id = v_company
      and po.owner_id = v_owner_id
      and p.deleted_at is null
      and (po.starts_on is null or po.starts_on <= current_date)
      and (po.ends_on is null or po.ends_on >= current_date)
  ),
  scoped as (
    select u.id, u.property_id, op.title as property_title, u.unit_number,
           coalesce(u.status::text, 'unknown') as status,
           coalesce(u.rent_amount, 0) as reference_rent
    from owner_properties op
    join public.units u
      on u.company_id = v_company
     and u.property_id = op.id
     and u.deleted_at is null
  ),
  ranked as (
    select s.*,
           row_number() over (
             order by
               s.property_title,
               s.unit_number,
               s.id
           ) as rn,
           count(*) over () as total
    from scoped s
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'propertyId', r.property_id,
    'propertyTitle', r.property_title,
    'unitNumber', r.unit_number,
    'status', r.status,
    'referenceRent', r.reference_rent,
    'occupied', exists (
      select 1 from public.contracts c
      where c.company_id = v_company
        and c.unit_id = r.id
        and c.deleted_at is null
        and lower(c.status::text) = 'active'
        and (c.end_date is null or c.end_date >= current_date)
    ),
    'contractEnd', (
      select max(c.end_date)
      from public.contracts c
      where c.company_id = v_company
        and c.unit_id = r.id
        and c.deleted_at is null
        and lower(c.status::text) = 'active'
    ),
    'currency', 'OMR'
  ) order by r.rn) filter (where r.rn <= 50), '[]'::jsonb),
  coalesce(max(r.total), 0)::integer
  into v_units, v_units_total
  from ranked r;

  -- Settlements: newest 50 window; portfolio totals below (grossCollected,
  -- ownerExpenses, netPayable) stay computed over the COMPLETE set.
  -- "netPayable" means the amount still payable now. Paid settlements must
  -- never inflate it; canonical owner-settlement semantics count DRAFT and
  -- APPROVED only.
  with scoped as (
    select s.id, s.no, s.date, s.status, s.period_start, s.period_end,
           s.gross_collected, s.office_fee, s.owner_expenses, s.tax_amount,
           s.net_payable, p.title as property_title
    from public.owner_settlements s
    left join public.properties p
      on p.id::text = s.property_id::text
     and p.company_id = s.company_id
    where s.company_id = v_company
      and s.owner_id::text = v_owner_id::text
  ),
  ranked as (
    select s.*,
           row_number() over (
             order by s.period_end desc nulls last, s.date desc nulls last, s.id desc
           ) as rn,
           count(*) over () as total
    from scoped s
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id,
      'number', coalesce(r.no, r.id::text),
      'date', r.date,
      'status', coalesce(r.status::text, 'UNKNOWN'),
      'propertyTitle', r.property_title,
      'periodStart', r.period_start,
      'periodEnd', r.period_end,
      'grossCollected', coalesce(r.gross_collected, 0),
      'officeFee', coalesce(r.office_fee, 0),
      'ownerExpenses', coalesce(r.owner_expenses, 0),
      'taxAmount', coalesce(r.tax_amount, 0),
      'netPayable', coalesce(r.net_payable, 0),
      'currency', 'OMR'
    ) order by r.rn) filter (where r.rn <= 50), '[]'::jsonb),
    coalesce(max(r.total), 0)::integer,
    coalesce(sum(case when upper(coalesce(r.status::text, '')) in ('APPROVED','PAID') then r.gross_collected else 0 end), 0),
    coalesce(sum(case when upper(coalesce(r.status::text, '')) in ('APPROVED','PAID') then r.owner_expenses else 0 end), 0)
  into v_settlements, v_settlements_total, v_gross_collected, v_owner_expenses
  from ranked r;

  select coalesce(sum(coalesce(s.net_payable, 0)), 0)
  into v_net_payable
  from public.owner_settlements s
  where s.company_id = v_company
    and s.owner_id::text = v_owner_id::text
    and upper(coalesce(s.status::text, '')) in ('DRAFT', 'APPROVED');

  with owner_properties as (
    select p.id, p.title
    from public.property_owners po
    join public.properties p on p.id = po.property_id and p.company_id = po.company_id
    where po.company_id = v_company
      and po.owner_id = v_owner_id
      and p.deleted_at is null
      and (po.starts_on is null or po.starts_on <= current_date)
      and (po.ends_on is null or po.ends_on >= current_date)
  ),
  scoped as (
    select m.id, op.title as property_title, u.unit_number,
           m.title,
           coalesce(m.status::text, 'unknown') as status,
           m.priority::text as priority,
           m.created_at
    from public.maintenance_records m
    join owner_properties op on op.id = m.property_id
    left join public.units u
      on u.id = m.unit_id
     and u.company_id = v_company
    where m.company_id = v_company
      and m.deleted_at is null
  ),
  ranked as (
    select s.*,
           row_number() over (order by s.created_at desc, s.id desc) as rn,
           count(*) over () as total
    from scoped s
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'propertyTitle', r.property_title,
    'unitNumber', r.unit_number,
    'title', r.title,
    'status', r.status,
    'priority', r.priority,
    'createdAt', r.created_at
  ) order by r.rn) filter (where r.rn <= 50), '[]'::jsonb),
  coalesce(max(r.total), 0)::integer
  into v_maintenance, v_maintenance_total
  from ranked r;

  -- Canonical document source is vault_documents. Metadata only: no storage
  -- path, file URL, signed URL, or bytes ever cross the external portal
  -- boundary. Company-scoped (migration-62 invariant preserved).
  with owner_property_ids as (
    select po.property_id
    from public.property_owners po
    join public.properties p
      on p.id = po.property_id
     and p.company_id = po.company_id
    where po.company_id = v_company
      and po.owner_id = v_owner_id
      and p.deleted_at is null
      and (po.starts_on is null or po.starts_on <= current_date)
      and (po.ends_on is null or po.ends_on >= current_date)
  ),
  scoped as (
    select vd.id, vd.title, vd.file_name, vd.mime_type,
           lower(coalesce(vd.related_entity_type, '')) as entity_type,
           vd.created_at
    from public.vault_documents vd
    where vd.company_id = v_company
      and vd.deleted_at is null
      and (
        (
          lower(coalesce(vd.related_entity_type, '')) = 'owner'
          and vd.related_entity_id::text = v_owner_id::text
        )
        or (
          lower(coalesce(vd.related_entity_type, '')) = 'property'
          and exists (
            select 1
            from owner_property_ids opi
            where opi.property_id::text = vd.related_entity_id::text
          )
        )
      )
  ),
  ranked as (
    select s.*,
           row_number() over (order by s.created_at desc nulls last, s.id desc) as rn,
           count(*) over () as total
    from scoped s
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'title', coalesce(nullif(r.title, ''), r.file_name, 'مستند'),
    'mime', r.mime_type,
    'scope', case
      when r.entity_type = 'owner' then 'owner'
      else 'property'
    end,
    'createdAt', r.created_at
  ) order by r.rn) filter (where r.rn <= 50), '[]'::jsonb),
  coalesce(max(r.total), 0)::integer
  into v_documents, v_documents_total
  from ranked r;

  update public.owner_portal_links
  set last_used_at = now()
  where id = v_link_id;

  return jsonb_build_object(
    'status', 'ready',
    'snapshot', jsonb_build_object(
      'ownerId', v_owner_id,
      'companyId', v_company,
      'asOf', now(),
      'identity', jsonb_build_object('fullName', v_full_name, 'phone', v_phone, 'email', v_email),
      'summary', jsonb_build_object(
        'properties', v_property_count,
        'units', v_unit_count,
        'occupiedUnits', v_occupied,
        'vacantUnits', v_vacant,
        'occupancyRate', v_occupancy_rate,
        'grossCollected', v_gross_collected,
        'ownerExpenses', v_owner_expenses,
        'netPayable', v_net_payable,
        'currency', 'OMR'
      ),
      'properties', v_properties,
      'propertiesTotal', v_property_total,
      'units', v_units,
      'unitsTotal', v_units_total,
      'settlements', v_settlements,
      'settlementsTotal', v_settlements_total,
      'maintenance', v_maintenance,
      'maintenanceTotal', v_maintenance_total,
      'documents', v_documents,
      'documentsTotal', v_documents_total
    )
  );
end;
$function$;

comment on function public.get_owner_portal_snapshot(uuid) is
  'Read-only Owner Portal snapshot. Token scope is server-resolved; payable excludes PAID settlements and documents expose vault metadata only. Every list is a bounded recent window (50 rows max) and every *Total key reports the full row count; summary totals cover the complete scoped set.';

revoke all on function public.get_owner_portal_snapshot(uuid)
  from public, anon, authenticated;
grant execute on function public.get_owner_portal_snapshot(uuid)
  to anon, authenticated;

-- The legacy projection seam is superseded: its only consumers were the
-- migration-45/-62 public wrappers, both replaced self-contained above.
-- (Verified: no other reference in supabase/, scripts/, or app code;
-- the browser never held execute on it — migration 45 already revoked it.)
drop function if exists app_private.get_owner_portal_snapshot_legacy(uuid);

commit;

-- Null-safe final form of the Tenant Portal projection. Scalar variables avoid
-- touching an unassigned RECORD when a tenant has no contract/unit/property.

begin;

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
  v_receipts jsonb := '[]'::jsonb;
  v_invoiced numeric := 0;
  v_paid numeric := 0;
  v_remaining numeric := 0;
  v_overdue numeric := 0;
begin
  -- Scope comes only from a currently valid private bearer link.
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

    select
      coalesce(jsonb_agg(jsonb_build_object(
        'label', coalesce(i.reference, 'استحقاق'),
        'dueDate', i.due_date,
        'amount', i.amount,
        'currency', 'OMR',
        'status', case
          when greatest(i.amount - i.paid_amount, 0) <= 0 then 'paid'
          when i.due_date < current_date then 'overdue'
          else 'open'
        end
      ) order by i.due_date, i.id), '[]'::jsonb),
      coalesce(sum(i.amount), 0),
      coalesce(sum(i.paid_amount), 0),
      coalesce(sum(greatest(i.amount - i.paid_amount, 0)), 0),
      coalesce(sum(case when i.due_date < current_date then greatest(i.amount - i.paid_amount, 0) else 0 end), 0)
    into v_due_schedule, v_invoiced, v_paid, v_remaining, v_overdue
    from public.invoices i
    where i.company_id = v_company
      and i.contract_id = v_contract_id
      and i.deleted_at is null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'reference', coalesce(r.reference, r.no, 'إيصال'),
    'date', r.date_time,
    'amount', r.amount,
    'currency', 'OMR',
    'status', case when lower(r.status::text) = 'void' then 'void' else 'posted' end
  ) order by r.date_time desc, r.id desc), '[]'::jsonb)
  into v_receipts
  from public.receipts r
  where r.company_id = v_company
    and r.tenant_id = v_tenant_id
    and r.deleted_at is null;

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
      'paidPosition', case when v_contract_id is not null then jsonb_build_object(
        'invoiced', v_invoiced,
        'paid', v_paid,
        'remaining', v_remaining,
        'overdue', v_overdue,
        'currency', 'OMR'
      ) else null end,
      -- Intentionally empty until those domains carry a tenant-owned canonical
      -- FK. Unit-wide joins would risk leaking another occupant/owner's data.
      'services', '[]'::jsonb,
      'receipts', v_receipts,
      'documents', '[]'::jsonb,
      'maintenance', '[]'::jsonb
    )
  );
end;
$function$;

revoke all on function public.get_tenant_portal_snapshot(uuid) from public;
grant execute on function public.get_tenant_portal_snapshot(uuid) to anon, authenticated;

commit;

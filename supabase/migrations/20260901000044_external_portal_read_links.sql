-- External portals: exported, revocable, read-only links for owner and tenant surfaces.
-- Office users may issue links only through explicit effective permissions. Portal
-- visitors never authenticate to the office and can only execute scoped snapshot RPCs.

begin;

insert into public.app_permission_catalog (permission, label_ar, admin_only, requestable)
values
  ('owner.portal.link', 'تصدير رابط عرض بوابة المالك', false, true),
  ('tenant.portal.link', 'تصدير رابط عرض بوابة المستأجر', false, true)
on conflict (permission) do update set
  label_ar = excluded.label_ar,
  admin_only = excluded.admin_only,
  requestable = excluded.requestable;

create or replace function public.create_tenant_portal_link(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_actor uuid := auth.uid();
  v_token uuid := gen_random_uuid();
  v_expires timestamptz := now() + interval '30 days';
begin
  if v_actor is null or not public.current_user_has_effective_app_permission('tenant.portal.link') then
    raise exception 'TENANT_PORTAL_LINK_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.people p
    where p.id = p_tenant_id
      and p.company_id = v_company
      and p.type::text = 'tenant'
      and p.deleted_at is null
  ) then
    raise exception 'TENANT_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.tenant_portal_links
  set revoked_at = now()
  where company_id = v_company
    and tenant_id = p_tenant_id
    and revoked_at is null;

  insert into public.tenant_portal_links(company_id, tenant_id, token, issued_by, expires_at)
  values (v_company, p_tenant_id, v_token, v_actor, v_expires);

  return jsonb_build_object('token', v_token, 'expires_at', v_expires);
end;
$function$;

create or replace function public.revoke_tenant_portal_link(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_count integer;
begin
  if auth.uid() is null or not public.current_user_has_effective_app_permission('tenant.portal.link') then
    raise exception 'TENANT_PORTAL_LINK_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  update public.tenant_portal_links
  set revoked_at = now()
  where company_id = v_company
    and tenant_id = p_tenant_id
    and revoked_at is null;
  get diagnostics v_count = row_count;

  return jsonb_build_object('revoked', v_count > 0);
end;
$function$;

create table if not exists public.owner_portal_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  issued_by uuid not null references public.users(id),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  last_used_at timestamptz,
  check (expires_at > issued_at)
);

create index if not exists ix_owner_portal_links_scope
  on public.owner_portal_links(company_id, owner_id)
  where revoked_at is null;

alter table public.owner_portal_links enable row level security;
revoke all on table public.owner_portal_links from public, anon, authenticated;

comment on table public.owner_portal_links is
  'Private bearer credentials for the isolated read-only Owner Portal. Direct client reads/writes are prohibited.';

create or replace function public.create_owner_portal_link(p_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_actor uuid := auth.uid();
  v_token uuid := gen_random_uuid();
  v_expires timestamptz := now() + interval '30 days';
begin
  if v_actor is null or not public.current_user_has_effective_app_permission('owner.portal.link') then
    raise exception 'OWNER_PORTAL_LINK_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.owners o
    where o.id = p_owner_id
      and o.company_id = v_company
      and o.deleted_at is null
  ) then
    raise exception 'OWNER_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.owner_portal_links
  set revoked_at = now()
  where company_id = v_company
    and owner_id = p_owner_id
    and revoked_at is null;

  insert into public.owner_portal_links(company_id, owner_id, token, issued_by, expires_at)
  values (v_company, p_owner_id, v_token, v_actor, v_expires);

  return jsonb_build_object('token', v_token, 'expires_at', v_expires);
end;
$function$;

create or replace function public.revoke_owner_portal_link(p_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_count integer;
begin
  if auth.uid() is null or not public.current_user_has_effective_app_permission('owner.portal.link') then
    raise exception 'OWNER_PORTAL_LINK_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  update public.owner_portal_links
  set revoked_at = now()
  where company_id = v_company
    and owner_id = p_owner_id
    and revoked_at is null;
  get diagnostics v_count = row_count;

  return jsonb_build_object('revoked', v_count > 0);
end;
$function$;

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
  v_units jsonb := '[]'::jsonb;
  v_settlements jsonb := '[]'::jsonb;
  v_maintenance jsonb := '[]'::jsonb;
  v_documents jsonb := '[]'::jsonb;
  v_property_count integer := 0;
  v_unit_count integer := 0;
  v_occupied integer := 0;
  v_vacant integer := 0;
  v_occupancy_rate numeric := 0;
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
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', ps.id,
      'title', ps.title,
      'address', ps.address,
      'ownershipPercentage', coalesce(ps.ownership_percentage, 100),
      'units', ps.units,
      'occupiedUnits', ps.occupied_units,
      'vacantUnits', greatest(ps.units - ps.occupied_units, 0)
    ) order by ps.title, ps.id), '[]'::jsonb),
    count(*)::integer,
    coalesce(sum(ps.units), 0)::integer,
    coalesce(sum(ps.occupied_units), 0)::integer
  into v_properties, v_property_count, v_unit_count, v_occupied
  from property_stats ps;

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
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id,
    'propertyId', u.property_id,
    'propertyTitle', op.title,
    'unitNumber', u.unit_number,
    'status', coalesce(u.status::text, 'unknown'),
    'referenceRent', coalesce(u.rent_amount, 0),
    'occupied', exists (
      select 1 from public.contracts c
      where c.company_id = v_company
        and c.unit_id = u.id
        and c.deleted_at is null
        and lower(c.status::text) = 'active'
        and (c.end_date is null or c.end_date >= current_date)
    ),
    'contractEnd', (
      select max(c.end_date)
      from public.contracts c
      where c.company_id = v_company
        and c.unit_id = u.id
        and c.deleted_at is null
        and lower(c.status::text) = 'active'
    ),
    'currency', 'OMR'
  ) order by op.title, u.unit_number, u.id), '[]'::jsonb)
  into v_units
  from owner_properties op
  join public.units u
    on u.company_id = v_company
   and u.property_id = op.id
   and u.deleted_at is null;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'number', coalesce(s.no, s.id::text),
      'date', s.date,
      'status', coalesce(s.status::text, 'UNKNOWN'),
      'propertyTitle', p.title,
      'periodStart', s.period_start,
      'periodEnd', s.period_end,
      'grossCollected', coalesce(s.gross_collected, 0),
      'officeFee', coalesce(s.office_fee, 0),
      'ownerExpenses', coalesce(s.owner_expenses, 0),
      'taxAmount', coalesce(s.tax_amount, 0),
      'netPayable', coalesce(s.net_payable, 0),
      'currency', 'OMR'
    ) order by s.period_end desc nulls last, s.date desc nulls last, s.id desc), '[]'::jsonb),
    coalesce(sum(case when upper(coalesce(s.status::text, '')) in ('APPROVED','PAID') then s.gross_collected else 0 end), 0),
    coalesce(sum(case when upper(coalesce(s.status::text, '')) in ('APPROVED','PAID') then s.owner_expenses else 0 end), 0),
    coalesce(sum(case when upper(coalesce(s.status::text, '')) in ('APPROVED','PAID') then s.net_payable else 0 end), 0)
  into v_settlements, v_gross_collected, v_owner_expenses, v_net_payable
  from public.owner_settlements s
  left join public.properties p
    on p.id = s.property_id
   and p.company_id = s.company_id
  where s.company_id = v_company
    and s.owner_id = v_owner_id;

  with owner_properties as (
    select p.id, p.title
    from public.property_owners po
    join public.properties p on p.id = po.property_id and p.company_id = po.company_id
    where po.company_id = v_company
      and po.owner_id = v_owner_id
      and p.deleted_at is null
      and (po.starts_on is null or po.starts_on <= current_date)
      and (po.ends_on is null or po.ends_on >= current_date)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'propertyTitle', op.title,
    'unitNumber', u.unit_number,
    'title', m.title,
    'status', coalesce(m.status::text, 'unknown'),
    'priority', m.priority::text,
    'createdAt', m.created_at
  ) order by m.created_at desc, m.id desc), '[]'::jsonb)
  into v_maintenance
  from public.maintenance_records m
  join owner_properties op on op.id = m.property_id
  left join public.units u
    on u.id = m.unit_id
   and u.company_id = v_company
  where m.company_id = v_company
    and m.deleted_at is null;

  with owner_property_ids as (
    select po.property_id
    from public.property_owners po
    join public.properties p on p.id = po.property_id and p.company_id = po.company_id
    where po.company_id = v_company
      and po.owner_id = v_owner_id
      and p.deleted_at is null
      and (po.starts_on is null or po.starts_on <= current_date)
      and (po.ends_on is null or po.ends_on >= current_date)
  ),
  owner_settlement_ids as (
    select s.id
    from public.owner_settlements s
    where s.company_id = v_company
      and s.owner_id = v_owner_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'title', coalesce(a.name, 'مستند'),
    'mime', a.mime,
    'scope', case
      when lower(coalesce(a.entity_type, '')) = 'owner' then 'owner'
      when lower(coalesce(a.entity_type, '')) in ('owner_settlement', 'owner-settlement', 'settlement') then 'settlement'
      else 'property'
    end,
    'createdAt', a.created_at
  ) order by a.created_at desc nulls last, a.id desc), '[]'::jsonb)
  into v_documents
  from public.attachments a
  where a.company_id = v_company
    and (
      (lower(coalesce(a.entity_type, '')) = 'owner' and a.entity_id = v_owner_id)
      or (lower(coalesce(a.entity_type, '')) = 'property' and a.entity_id in (select property_id from owner_property_ids))
      or (
        lower(coalesce(a.entity_type, '')) in ('owner_settlement', 'owner-settlement', 'settlement')
        and a.entity_id in (select id from owner_settlement_ids)
      )
    );

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
      'units', v_units,
      'settlements', v_settlements,
      'maintenance', v_maintenance,
      'documents', v_documents
    )
  );
end;
$function$;

revoke all on function public.create_tenant_portal_link(uuid) from public, anon;
revoke all on function public.revoke_tenant_portal_link(uuid) from public, anon;
revoke all on function public.create_owner_portal_link(uuid) from public, anon;
revoke all on function public.revoke_owner_portal_link(uuid) from public, anon;
revoke all on function public.get_owner_portal_snapshot(uuid) from public;

grant execute on function public.create_tenant_portal_link(uuid) to authenticated;
grant execute on function public.revoke_tenant_portal_link(uuid) to authenticated;
grant execute on function public.create_owner_portal_link(uuid) to authenticated;
grant execute on function public.revoke_owner_portal_link(uuid) to authenticated;
grant execute on function public.get_owner_portal_snapshot(uuid) to anon, authenticated;

commit;

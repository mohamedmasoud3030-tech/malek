-- Tenant Portal v1: isolated bearer-link authorization + read-only projection.
-- The portal lives outside the office shell. A high-entropy UUID link is the
-- tenant credential; the backing table is never readable by anon/authenticated.
-- Only the Office Owner can issue/rotate a link. The public read RPC scopes
-- every selected row by BOTH the link's company_id and tenant_id.

begin;

create table if not exists public.tenant_portal_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tenant_id uuid not null references public.people(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  issued_by uuid not null references public.users(id),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  last_used_at timestamptz,
  check (expires_at > issued_at)
);

create index if not exists ix_tenant_portal_links_scope
  on public.tenant_portal_links(company_id, tenant_id)
  where revoked_at is null;

alter table public.tenant_portal_links enable row level security;
revoke all on table public.tenant_portal_links from public, anon, authenticated;

comment on table public.tenant_portal_links is
  'Private bearer credentials for the isolated read-only Tenant Portal. Direct client reads/writes are prohibited; use owner issuance and public scoped snapshot RPCs only.';

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
  if v_actor is null or not coalesce(public.is_admin(), false) then
    raise exception 'OFFICE_OWNER_REQUIRED' using errcode = '42501';
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

  -- Rotation is intentional: only the newest owner-issued link remains valid.
  update public.tenant_portal_links
  set revoked_at = now()
  where company_id = v_company
    and tenant_id = p_tenant_id
    and revoked_at is null;

  insert into public.tenant_portal_links(
    company_id, tenant_id, token, issued_by, expires_at
  ) values (
    v_company, p_tenant_id, v_token, v_actor, v_expires
  );

  return jsonb_build_object(
    'token', v_token,
    'expires_at', v_expires
  );
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
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'OFFICE_OWNER_REQUIRED' using errcode = '42501';
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

create or replace function public.get_tenant_portal_snapshot(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_link public.tenant_portal_links%rowtype;
  v_tenant public.people%rowtype;
  v_contract record;
  v_unit record;
  v_property record;
  v_due_schedule jsonb := '[]'::jsonb;
  v_receipts jsonb := '[]'::jsonb;
  v_invoiced numeric := 0;
  v_paid numeric := 0;
  v_remaining numeric := 0;
  v_overdue numeric := 0;
begin
  -- The token is the sole portal credential. Never infer tenant/company from
  -- an office session, query-string tenant id, or client-supplied company id.
  select * into v_link
  from public.tenant_portal_links l
  where l.token = p_token
    and l.revoked_at is null
    and l.expires_at > now()
  limit 1;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into v_tenant
  from public.people p
  where p.id = v_link.tenant_id
    and p.company_id = v_link.company_id
    and p.type::text = 'tenant'
    and p.deleted_at is null;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  select
    c.id,
    c.reference,
    c.status::text as status,
    c.start_date,
    c.end_date,
    c.rent_amount,
    c.unit_id,
    c.property_id
  into v_contract
  from public.contracts c
  where c.company_id = v_link.company_id
    and c.tenant_id = v_link.tenant_id
    and c.deleted_at is null
  order by
    case when lower(c.status::text) = 'active' then 0 else 1 end,
    c.end_date desc nulls last,
    c.created_at desc
  limit 1;

  if found then
    if v_contract.unit_id is not null then
      select u.id, u.unit_number, u.status::text as status, u.property_id
      into v_unit
      from public.units u
      where u.id = v_contract.unit_id
        and u.company_id = v_link.company_id
        and u.deleted_at is null;
    end if;

    if v_contract.property_id is not null then
      select p.id, p.title
      into v_property
      from public.properties p
      where p.id = v_contract.property_id
        and p.company_id = v_link.company_id
        and p.deleted_at is null;
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
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
    where i.company_id = v_link.company_id
      and i.contract_id = v_contract.id
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
  where r.company_id = v_link.company_id
    and r.tenant_id = v_link.tenant_id
    and r.deleted_at is null;

  update public.tenant_portal_links
  set last_used_at = now()
  where id = v_link.id;

  return jsonb_build_object(
    'status', 'ready',
    'snapshot', jsonb_build_object(
      'tenantId', v_link.tenant_id,
      'companyId', v_link.company_id,
      'asOf', now(),
      'identity', jsonb_build_object(
        'fullName', v_tenant.full_name,
        'phone', v_tenant.phone,
        'email', v_tenant.email
      ),
      'unit', case when v_contract.id is not null and v_unit.id is not null then jsonb_build_object(
        'title', coalesce(v_property.title, 'العقار'),
        'unitNumber', v_unit.unit_number,
        'status', v_unit.status
      ) else null end,
      'contract', case when v_contract.id is not null then jsonb_build_object(
        'reference', coalesce(v_contract.reference, v_contract.id::text),
        'status', v_contract.status,
        'startDate', v_contract.start_date,
        'endDate', v_contract.end_date,
        'rentAmount', v_contract.rent_amount,
        'currency', 'OMR'
      ) else null end,
      'dueSchedule', v_due_schedule,
      'paidPosition', case when v_contract.id is not null then jsonb_build_object(
        'invoiced', v_invoiced,
        'paid', v_paid,
        'remaining', v_remaining,
        'overdue', v_overdue,
        'currency', 'OMR'
      ) else null end,
      -- These stay empty until a tenant-owned canonical FK exists. Exposing
      -- unit-wide records would risk leaking another occupant/owner's data.
      'services', '[]'::jsonb,
      'receipts', v_receipts,
      'documents', '[]'::jsonb,
      'maintenance', '[]'::jsonb
    )
  );
end;
$function$;

revoke all on function public.create_tenant_portal_link(uuid) from public, anon;
revoke all on function public.revoke_tenant_portal_link(uuid) from public, anon;
revoke all on function public.get_tenant_portal_snapshot(uuid) from public;

grant execute on function public.create_tenant_portal_link(uuid) to authenticated;
grant execute on function public.revoke_tenant_portal_link(uuid) to authenticated;
grant execute on function public.get_tenant_portal_snapshot(uuid) to anon, authenticated;

commit;

-- Service Providers — canonical company-scoped domain and Maintenance integration.
--
-- Repository evidence used for this change:
--   * company scope is resolved by current_company_id()/require_company_id();
--   * semantic permissions are registered in app_permission_catalog and resolved
--     through role_has_app_permission/current_user_has_effective_app_permission;
--   * operational master data uses soft archive (deleted_at) and updated_at triggers;
--   * Maintenance creation remains the existing atomic, audited RPC boundary;
--   * entity documents use vault_documents.related_entity_type.
--
-- No accounting, GL, settlement, payment, expense-resolution, or Maintenance
-- lifecycle/status semantics are changed by this migration.
begin;

-- ---------------------------------------------------------------------------
-- Canonical provider and maintainable service-type model
-- ---------------------------------------------------------------------------
create table public.service_providers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id()
    references public.companies(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  legal_name text check (legal_name is null or char_length(btrim(legal_name)) between 1 and 200),
  registration_number text check (registration_number is null or char_length(btrim(registration_number)) between 1 and 100),
  tax_number text check (tax_number is null or char_length(btrim(tax_number)) between 1 and 100),
  contact_name text check (contact_name is null or char_length(btrim(contact_name)) between 1 and 200),
  phone text check (phone is null or char_length(btrim(phone)) between 1 and 50),
  alternate_phone text check (alternate_phone is null or char_length(btrim(alternate_phone)) between 1 and 50),
  email text check (email is null or char_length(btrim(email)) between 1 and 320),
  website text check (website is null or char_length(btrim(website)) between 1 and 500),
  address text check (address is null or char_length(btrim(address)) between 1 and 1000),
  service_area text check (service_area is null or char_length(btrim(service_area)) between 1 and 500),
  availability_notes text check (availability_notes is null or char_length(btrim(availability_notes)) between 1 and 1000),
  notes text check (notes is null or char_length(btrim(notes)) between 1 and 2000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint service_providers_id_company_key unique (id, company_id)
);

create table public.service_provider_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id()
    references public.companies(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (description is null or char_length(btrim(description)) between 1 and 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint service_provider_categories_id_company_key unique (id, company_id)
);

create table public.service_provider_category_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id()
    references public.companies(id) on delete restrict,
  service_provider_id uuid not null,
  category_id uuid not null,
  created_at timestamptz not null default now(),
  constraint service_provider_category_links_unique unique (company_id, service_provider_id, category_id),
  constraint service_provider_category_links_provider_fk
    foreign key (service_provider_id, company_id)
    references public.service_providers(id, company_id) on delete cascade,
  constraint service_provider_category_links_category_fk
    foreign key (category_id, company_id)
    references public.service_provider_categories(id, company_id) on delete restrict
);

create index service_providers_company_active_idx
  on public.service_providers(company_id, is_active, created_at desc)
  where deleted_at is null;
create index service_providers_company_name_idx
  on public.service_providers(company_id, lower(name))
  where deleted_at is null;
create unique index service_provider_categories_company_name_key
  on public.service_provider_categories(company_id, lower(btrim(name)))
  where deleted_at is null;
create index service_provider_category_links_provider_idx
  on public.service_provider_category_links(company_id, service_provider_id);
create index service_provider_category_links_category_idx
  on public.service_provider_category_links(company_id, category_id);

create trigger set_service_providers_updated_at
before update on public.service_providers
for each row execute function public.set_updated_at();

create trigger set_service_provider_categories_updated_at
before update on public.service_provider_categories
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Semantic permissions: same catalog + role-default architecture as the rest
-- of the application. ADMIN receives catalog capabilities; MANAGER receives
-- operational view/write defaults; USER remains fail-closed unless granted.
-- ---------------------------------------------------------------------------
insert into public.app_permission_catalog(permission, label_ar, admin_only, requestable) values
  ('service_providers.view', 'عرض مزودي الخدمات', false, true),
  ('service_providers.write', 'إضافة وتعديل وأرشفة مزودي الخدمات', false, true)
on conflict (permission) do update set
  label_ar = excluded.label_ar,
  admin_only = excluded.admin_only,
  requestable = excluded.requestable;

create or replace function public.role_has_app_permission(p_role text, p_permission text)
returns boolean language sql stable security invoker set search_path = public, pg_temp
as $$
  select case upper(coalesce(p_role, ''))
    when 'ADMIN' then exists(select 1 from public.app_permission_catalog c where c.permission = p_permission)
    when 'MANAGER' then p_permission = any(array[
      'app.dashboard.view','maintenance.view','permission_requests.review','cost_centers.manage','documents.write',
      'owners.hub.view','owners.detail.view','lands.view','leads.view','commissions.view','communication.view',
      'automation.view','auth.password.change','properties.write','contracts.write','expenses.view','expenses.write',
      'arrears.view','financial.deposits.view','financial.invoices.generate','financial.invoices.export',
      'financial.payments.create','financial.receipts.void','financial.reports.export',
      'financial.bank_reconciliation.view','financial.bank_reconciliation.match','financial.owner_settlements.view',
      'service_providers.view','service_providers.write'
    ]::text[])
    when 'USER' then p_permission = any(array['app.dashboard.view','auth.password.change']::text[])
    else false
  end
$$;
revoke all on function public.role_has_app_permission(text,text) from public, anon;
grant execute on function public.role_has_app_permission(text,text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS and grants. Every policy combines semantic authority with the active
-- company; no client payload can choose a different company_id.
-- ---------------------------------------------------------------------------
alter table public.service_providers enable row level security;
alter table public.service_provider_categories enable row level security;
alter table public.service_provider_category_links enable row level security;

create policy service_providers_read_company on public.service_providers
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_has_effective_app_permission('service_providers.view')
  );
create policy service_providers_insert_company on public.service_providers
  for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_has_effective_app_permission('service_providers.write')
  );
create policy service_providers_update_company on public.service_providers
  for update to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_has_effective_app_permission('service_providers.write')
  )
  with check (
    company_id = public.current_company_id()
    and public.current_user_has_effective_app_permission('service_providers.write')
  );

create policy service_provider_categories_read_company on public.service_provider_categories
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_has_effective_app_permission('service_providers.view')
  );
create policy service_provider_categories_insert_company on public.service_provider_categories
  for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_has_effective_app_permission('service_providers.write')
  );
create policy service_provider_categories_update_company on public.service_provider_categories
  for update to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_has_effective_app_permission('service_providers.write')
  )
  with check (
    company_id = public.current_company_id()
    and public.current_user_has_effective_app_permission('service_providers.write')
  );

create policy service_provider_category_links_read_company on public.service_provider_category_links
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_has_effective_app_permission('service_providers.view')
  );
create policy service_provider_category_links_insert_company on public.service_provider_category_links
  for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_has_effective_app_permission('service_providers.write')
  );
create policy service_provider_category_links_delete_company on public.service_provider_category_links
  for delete to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_has_effective_app_permission('service_providers.write')
  );

grant select, insert, update on public.service_providers, public.service_provider_categories to authenticated;
grant select, insert, delete on public.service_provider_category_links to authenticated;
revoke delete on public.service_providers, public.service_provider_categories from authenticated, anon;
revoke all on public.service_providers, public.service_provider_categories, public.service_provider_category_links from anon;

-- Operational master-data changes are recorded using the existing audit_log.
-- The trigger stores only identifiers/company scope, not provider contact PII.
create or replace function public.audit_service_provider_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row jsonb;
  v_company_id text;
  v_entity text;
  v_entity_id text;
  v_action text;
  v_category_id text;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_company_id := v_row ->> 'company_id';
  v_category_id := v_row ->> 'category_id';

  if tg_table_name = 'service_provider_category_links' then
    v_entity := 'service_provider';
    v_entity_id := v_row ->> 'service_provider_id';
    v_action := case when tg_op = 'INSERT' then 'SERVICE_PROVIDER_CATEGORY_LINKED' else 'SERVICE_PROVIDER_CATEGORY_UNLINKED' end;
  elsif tg_table_name = 'service_provider_categories' then
    v_entity := 'service_provider_category';
    v_entity_id := v_row ->> 'id';
    v_action := case
      when tg_op = 'INSERT' then 'SERVICE_PROVIDER_CATEGORY_CREATED'
      when old.deleted_at is null and new.deleted_at is not null then 'SERVICE_PROVIDER_CATEGORY_ARCHIVED'
      else 'SERVICE_PROVIDER_CATEGORY_UPDATED'
    end;
  else
    v_entity := 'service_provider';
    v_entity_id := v_row ->> 'id';
    v_action := case
      when tg_op = 'INSERT' then 'SERVICE_PROVIDER_CREATED'
      when old.deleted_at is null and new.deleted_at is not null then 'SERVICE_PROVIDER_ARCHIVED'
      else 'SERVICE_PROVIDER_UPDATED'
    end;
  end if;

  insert into public.audit_log(
    id, ts, user_id, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(), v_action,
    v_entity, v_entity_id, v_action, tg_table_name,
    jsonb_strip_nulls(jsonb_build_object('company_id', v_company_id, 'category_id', v_category_id))::text,
    now()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function public.audit_service_provider_change() from public, anon, authenticated;
grant execute on function public.audit_service_provider_change() to service_role;

create trigger audit_service_providers_change
after insert or update on public.service_providers
for each row execute function public.audit_service_provider_change();
create trigger audit_service_provider_categories_change
after insert or update on public.service_provider_categories
for each row execute function public.audit_service_provider_change();
create trigger audit_service_provider_category_links_change
after insert or delete on public.service_provider_category_links
for each row execute function public.audit_service_provider_change();

-- ---------------------------------------------------------------------------
-- Maintenance assignment integration. Both foreign keys include company_id,
-- making cross-company assignment impossible even for privileged SQL callers.
-- Existing rows remain valid because both columns are nullable.
-- ---------------------------------------------------------------------------
alter table public.maintenance_records
  add column service_provider_id uuid,
  add column service_provider_category_id uuid,
  add constraint maintenance_service_provider_company_fk
    foreign key (service_provider_id, company_id)
    references public.service_providers(id, company_id) on delete restrict,
  add constraint maintenance_service_provider_category_company_fk
    foreign key (service_provider_category_id, company_id)
    references public.service_provider_categories(id, company_id) on delete restrict;

create index maintenance_service_provider_idx
  on public.maintenance_records(company_id, service_provider_id, status)
  where deleted_at is null and service_provider_id is not null;
create index maintenance_service_provider_category_idx
  on public.maintenance_records(company_id, service_provider_category_id, status)
  where deleted_at is null and service_provider_category_id is not null;

create or replace function public.validate_maintenance_service_provider_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.service_provider_category_id is not null and not exists (
    select 1
    from public.service_provider_categories c
    where c.id = new.service_provider_category_id
      and c.company_id = new.company_id
      and c.is_active
      and c.deleted_at is null
  ) then
    raise exception 'نوع الخدمة غير متاح للشركة الحالية' using errcode = '23503';
  end if;

  if new.service_provider_id is not null and not exists (
    select 1
    from public.service_providers p
    where p.id = new.service_provider_id
      and p.company_id = new.company_id
      and p.is_active
      and p.deleted_at is null
  ) then
    raise exception 'مزود الخدمة غير متاح للشركة الحالية' using errcode = '23503';
  end if;

  if new.service_provider_id is not null
     and new.service_provider_category_id is not null
     and not exists (
       select 1
       from public.service_provider_category_links link
       where link.company_id = new.company_id
         and link.service_provider_id = new.service_provider_id
         and link.category_id = new.service_provider_category_id
     ) then
    raise exception 'مزود الخدمة المحدد لا يدعم نوع الخدمة المختار' using errcode = '23514';
  end if;

  return new;
end;
$$;
revoke all on function public.validate_maintenance_service_provider_assignment() from public, anon, authenticated;
grant execute on function public.validate_maintenance_service_provider_assignment() to service_role;

create trigger validate_maintenance_service_provider_assignment
before insert or update of company_id, service_provider_id, service_provider_category_id
on public.maintenance_records
for each row execute function public.validate_maintenance_service_provider_assignment();

-- Replace the existing Maintenance create RPC in place. Its original parameter
-- names/defaults remain valid; the two new optional parameters are appended.
drop function if exists public.create_maintenance_atomic(
  text, text, text, text, text, text, text, date, text, text
);

create function public.create_maintenance_atomic(
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
  v_existing public.maintenance_records;
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

  select * into v_property
  from public.properties
  where id = p_property_id and company_id = v_company_id and deleted_at is null;
  if not found then raise exception 'العقار غير موجود أو تابع لشركة أخرى أو مؤرشف'; end if;

  if p_unit_id is not null and btrim(p_unit_id) <> '' then
    select * into v_unit
    from public.units
    where id = p_unit_id
      and property_id = v_property.id
      and company_id = v_company_id
      and deleted_at is null;
    if not found then raise exception 'الوحدة غير موجودة أو لا تتبع العقار المحدد'; end if;
  end if;

  -- Validate both assignment records before idempotency lookup so an invalid
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

  if p_request_id is not null and btrim(p_request_id) <> '' then
    select * into v_existing
    from public.maintenance_records
    where request_id = p_request_id and company_id = v_company_id and deleted_at is null
    limit 1;
    if found then
      return jsonb_build_object('maintenance', to_jsonb(v_existing), 'idempotent', true);
    end if;
  end if;

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
  ) returning * into v_record;

  insert into public.audit_log(user_id, action, entity, entity_id, note, "table", details)
  values (
    auth.uid(), 'create', 'maintenance_record', v_record.id,
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

-- ---------------------------------------------------------------------------
-- Existing document platform extension (one platform; no provider-only store)
-- ---------------------------------------------------------------------------
alter table public.vault_documents
  drop constraint if exists vault_documents_related_entity_type_check;
alter table public.vault_documents
  add constraint vault_documents_related_entity_type_check
  check (related_entity_type is null or related_entity_type in (
    'property','unit','land','person','contract','invoice','payment','receipt',
    'expense','maintenance','utility_bill','tenant','owner','service_provider'
  ));

commit;

-- Manual rollback for 20260810170000_service_providers_production_grade.sql —
-- not auto-applied; run by hand only during an approved incident response.
-- WARNING: this removes the Service Provider schema after detaching Maintenance
-- and document references. Provider contact/category data will be destroyed.
begin;

-- Stop new use of the feature permissions and preserve grant/request history.
update public.user_permission_grants
set revoked_at = coalesce(revoked_at, now())
where permission in ('service_providers.view', 'service_providers.write')
  and revoked_at is null;

update public.permission_requests
set status = 'REJECTED',
    decision_reason = coalesce(decision_reason, 'Service Providers feature rollback'),
    decided_at = coalesce(decided_at, now()),
    updated_at = now()
where permission in ('service_providers.view', 'service_providers.write')
  and status = 'PENDING';

delete from public.app_permission_catalog
where permission in ('service_providers.view', 'service_providers.write');

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
      'financial.bank_reconciliation.view','financial.bank_reconciliation.match','financial.owner_settlements.view'
    ]::text[])
    when 'USER' then p_permission = any(array['app.dashboard.view','auth.password.change']::text[])
    else false
  end
$$;
revoke all on function public.role_has_app_permission(text,text) from public, anon;
grant execute on function public.role_has_app_permission(text,text) to authenticated, service_role;

-- Restore the previous Maintenance RPC signature before dropping assignment
-- columns. The original validation, idempotency, company isolation and audit
-- behavior are preserved exactly.
drop function if exists public.create_maintenance_atomic(
  text, text, text, text, text, text, text, date, text, text, uuid, uuid
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
  p_request_id text default null
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
    request_id, status, request_date
  ) values (
    v_company_id, v_property.id, v_unit.id, v_title,
    nullif(btrim(coalesce(p_description, '')), ''), v_priority,
    nullif(btrim(coalesce(p_assigned_to, '')), ''),
    nullif(btrim(coalesce(p_technician_name, '')), ''),
    p_scheduled_date, nullif(btrim(coalesce(p_attachment_url, '')), ''),
    nullif(btrim(coalesce(p_request_id, '')), ''), 'open', current_date
  ) returning * into v_record;

  insert into public.audit_log(user_id, action, entity, entity_id, note)
  values (
    auth.uid(), 'create', 'maintenance_record', v_record.id,
    'create_maintenance_atomic: ' || v_title || ' (company=' || v_company_id || ')'
  ) returning id into v_audit_id;

  return jsonb_build_object('maintenance', to_jsonb(v_record), 'idempotent', false);
end;
$$;
revoke all on function public.create_maintenance_atomic(
  text, text, text, text, text, text, text, date, text, text
) from public, anon;
grant execute on function public.create_maintenance_atomic(
  text, text, text, text, text, text, text, date, text, text
) to authenticated, service_role;

drop trigger if exists validate_maintenance_service_provider_assignment on public.maintenance_records;
drop function if exists public.validate_maintenance_service_provider_assignment();
drop index if exists public.maintenance_service_provider_idx;
drop index if exists public.maintenance_service_provider_category_idx;
alter table public.maintenance_records
  drop constraint if exists maintenance_service_provider_company_fk,
  drop constraint if exists maintenance_service_provider_category_company_fk,
  drop column if exists service_provider_id,
  drop column if exists service_provider_category_id;

-- Preserve uploaded files while detaching references whose entity type is being
-- removed, then restore the pre-feature document type constraint.
update public.vault_documents
set related_entity_type = null,
    related_entity_id = null,
    updated_at = now()
where related_entity_type = 'service_provider';

alter table public.vault_documents
  drop constraint if exists vault_documents_related_entity_type_check;
alter table public.vault_documents
  add constraint vault_documents_related_entity_type_check
  check (related_entity_type is null or related_entity_type in (
    'property','unit','land','person','contract','invoice','payment','receipt',
    'expense','maintenance','utility_bill','tenant','owner'
  ));

drop trigger if exists audit_service_provider_category_links_change on public.service_provider_category_links;
drop trigger if exists audit_service_provider_categories_change on public.service_provider_categories;
drop trigger if exists audit_service_providers_change on public.service_providers;
drop function if exists public.audit_service_provider_change();

drop table if exists public.service_provider_category_links;
drop table if exists public.service_provider_categories;
drop table if exists public.service_providers;

commit;

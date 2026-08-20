-- ============================================================================
-- R8 fix-forward — create_maintenance_atomic works on a clean replayed chain
-- ============================================================================
--
-- Root cause (two stacked defects on the clean chain):
--   1. 20260731190948_rollback_create_maintenance_atomic_rpc.sql sits INSIDE
--      the forward migration chain and drops maintenance_records.request_id
--      (+ its unique index). The later redefinition of the RPC
--      (20260810170000) still SELECTs by request_id → the RPC references a
--      missing column on clean replays.
--   2. The same redefinition compares `id = p_property_id` / `id = p_unit_id`
--      where the columns are uuid and the parameters are text → SQLSTATE
--      42883 (`operator does not exist: uuid = text`) on clean uuid schemas.
--
-- This migration is forward-only and restores the production contract:
--   * re-adds request_id (text) + the company-scoped unique idempotency index
--     (both IF NOT EXISTS — live databases that still have them are no-ops),
--   * redefines create_maintenance_atomic verbatim EXCEPT:
--       - every entity lookup compares via ::text (clean uuid schemas and
--         live text schemas both work),
--       - the insert casts identifiers through the destination column types.
--   * privileges/behavior otherwise unchanged (idempotency, cross-company
--     validation order, audit row).
-- ============================================================================

begin;

-- ── 1. Restore the idempotency column + index ───────────────────────────────
alter table public.maintenance_records
  add column if not exists request_id text;

create unique index if not exists maintenance_records_company_request_id_key
  on public.maintenance_records (company_id, request_id)
  where request_id is not null and deleted_at is null;

-- ── 2. Redefine the RPC with type-safe comparisons ──────────────────────────
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
  'R8 fix-forward: canonical maintenance creation. request_id idempotency restored on '
  'clean chains; every identifier comparison is ::text-safe on uuid and text schemas.';

notify pgrst, 'reload schema';

commit;

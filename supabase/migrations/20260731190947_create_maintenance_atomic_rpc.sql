-- ============================================================================
-- Maintenance atomic creation + company/audit hardening
-- ============================================================================
--
-- 1. Adds company_id (default current_company_id()) and idempotency
--    request_id (text, unique-per-company) to public.maintenance_records.
-- 2. Adds a forward index on request_id scoped to company_id so retries
--    can detect duplicates fast.
-- 3. Creates public.create_maintenance_atomic() that:
--      - validates the active user and company,
--      - verifies the property belongs to the company and is not archived,
--      - verifies the unit (if provided) belongs to that property and is
--        not archived,
--      - validates the title (after trim) and the priority enum,
--      - implements idempotency: when p_request_id is supplied, an
--        existing row with the same id inside the same company is
--        returned untouched instead of writing a second row,
--      - writes a single INSERT inside the transaction,
--      - appends a matching audit_log row for traceability.
--
-- 4. Updates the existing manager_write_maintenance_records policy to
--    require company_id to match the active company on every write,
--    so even a direct INSERT that bypasses the RPC cannot leak a row
--    across companies.
--
-- The RLS tightening is the rollback lever if a regression appears:
-- the new RPC remains the only safe write path; raw INSERTs without
-- a matching company_id will be rejected by the policy check.
-- ============================================================================

begin;

-- 1. Add company_id (idempotent, no default for existing rows to avoid
--    silently mis-stamping historical data).
alter table public.maintenance_records
  add column if not exists company_id uuid;

-- 2. Backfill any historical rows that pre-date the column, but only
--    when the joined property has a resolvable company_id. Rows that
--    cannot be traced to a company are left NULL and reported by the
--    P0 audit; they are filtered out by company-scoped reads until
--    they are reconciled.
update public.maintenance_records mr
  set company_id = p.company_id
  from public.properties p
  where mr.property_id = p.id
    and mr.company_id is null
    and p.company_id is not null
    and mr.deleted_at is null;

-- 3. Idempotency column
alter table public.maintenance_records
  add column if not exists request_id text;

-- 4. Forward index (company-scoped uniqueness for retries)
create unique index if not exists maintenance_records_company_request_id_key
  on public.maintenance_records (company_id, request_id)
  where request_id is not null and deleted_at is null;

-- 5. Default company_id for future writes
alter table public.maintenance_records
  alter column company_id set default public.current_company_id();

-- 6. Forward function
CREATE OR REPLACE FUNCTION public.create_maintenance_atomic(
  p_property_id text,
  p_unit_id text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_priority text DEFAULT 'medium',
  p_assigned_to text DEFAULT NULL,
  p_technician_name text DEFAULT NULL,
  p_scheduled_date date DEFAULT NULL,
  p_attachment_url text DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_company_id text;
  v_property public.properties%ROWTYPE;
  v_unit public.units%ROWTYPE;
  v_priority text;
  v_title text;
  v_record public.maintenance_records;
  v_existing public.maintenance_records;
  v_audit_id text;
BEGIN
  -- 1. Authentication gate
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول' USING ERRCODE = '42501';
  END IF;

  -- 2. Resolve active company from the trusted context, never from payload
  v_company_id := public.current_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية' USING ERRCODE = '42501';
  END IF;

  -- 3. Title must be present after trim()
  v_title := btrim(coalesce(p_title, ''));
  IF v_title = '' THEN
    RAISE EXCEPTION 'عنوان طلب الصيانة مطلوب';
  END IF;

  -- 4. Validate priority against the canonical enum
  v_priority := lower(coalesce(p_priority, 'medium'));
  IF v_priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
    RAISE EXCEPTION 'أولوية غير صحيحة';
  END IF;

  -- 5. Property must exist, belong to the active company, and not be archived
  SELECT * INTO v_property
  FROM public.properties
  WHERE id = p_property_id
    AND company_id = v_company_id
    AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'العقار غير موجود أو تابع لشركة أخرى أو مؤرشف';
  END IF;

  -- 6. If a unit is provided, it must belong to the same property + company,
  --    and must not be archived.
  IF p_unit_id IS NOT NULL AND btrim(p_unit_id) <> '' THEN
    SELECT * INTO v_unit
    FROM public.units
    WHERE id = p_unit_id
      AND property_id = v_property.id
      AND company_id = v_company_id
      AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'الوحدة غير موجودة أو لا تتبع العقار المحدد';
    END IF;
  END IF;

  -- 7. Idempotency: if p_request_id is provided and a row with that
  --    request_id already exists in the same company, return it
  --    unchanged instead of writing a second row.
  IF p_request_id IS NOT NULL AND btrim(p_request_id) <> '' THEN
    SELECT * INTO v_existing
    FROM public.maintenance_records
    WHERE request_id = p_request_id
      AND company_id = v_company_id
      AND deleted_at IS NULL
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'maintenance', to_jsonb(v_existing),
        'idempotent', true
      );
    END IF;
  END IF;

  -- 8. Insert the maintenance record in a single transaction
  INSERT INTO public.maintenance_records (
    company_id, property_id, unit_id, title, description, priority,
    assigned_to, technician_name, scheduled_date, attachment_url,
    request_id, status, request_date
  ) VALUES (
    v_company_id, v_property.id, v_unit.id, v_title,
    nullif(btrim(coalesce(p_description, '')), ''),
    v_priority,
    nullif(btrim(coalesce(p_assigned_to, '')), ''),
    nullif(btrim(coalesce(p_technician_name, '')), ''),
    p_scheduled_date,
    nullif(btrim(coalesce(p_attachment_url, '')), ''),
    nullif(btrim(coalesce(p_request_id, '')), ''),
    'open', CURRENT_DATE
  )
  RETURNING * INTO v_record;

  -- 9. Append audit trail
  INSERT INTO public.audit_log (
    user_id, action, entity, entity_id, note
  ) VALUES (
    auth.uid(), 'create', 'maintenance_record', v_record.id,
    'create_maintenance_atomic: ' || v_title || ' (company=' || v_company_id || ')'
  )
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'maintenance', to_jsonb(v_record),
    'idempotent', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_maintenance_atomic(
  text, text, text, text, text, text, text, date, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_maintenance_atomic(
  text, text, text, text, text, text, text, date, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_maintenance_atomic(
  text, text, text, text, text, text, text, date, text, text
) TO service_role;

-- 10. Tighten RLS so a raw INSERT that omits or mis-states company_id
--     is rejected. The RPC is SECURITY DEFINER and bypasses RLS, so
--     the policy is the safety net for the raw path.
drop policy if exists manager_write_maintenance_records on public.maintenance_records;
create policy manager_write_maintenance_records on public.maintenance_records
  for all to authenticated
  using (public.is_admin_or_manager() and company_id = public.current_company_id())
  with check (public.is_admin_or_manager() and company_id = public.current_company_id());

commit;

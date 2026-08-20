-- Repair the compatibility projections that still exist in the live schema
-- and enforce the Owner -> Property -> OwnerAgreement contract at the database
-- boundary. The modern fields remain canonical; legacy fields are maintained
-- only because older reports and live NOT NULL constraints still use them.

CREATE OR REPLACE FUNCTION public.sync_owner_compatibility_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.full_name IS DISTINCT FROM OLD.full_name AND NEW.name IS NOT DISTINCT FROM OLD.name THEN
      NEW.name := NEW.full_name;
    ELSIF NEW.name IS DISTINCT FROM OLD.name AND NEW.full_name IS NOT DISTINCT FROM OLD.full_name THEN
      NEW.full_name := NEW.name;
    END IF;
  END IF;

  NEW.full_name := COALESCE(NULLIF(btrim(NEW.full_name), ''), NULLIF(btrim(NEW.name), ''), NULLIF(btrim(NEW.display_name), ''));
  NEW.name := COALESCE(NULLIF(btrim(NEW.name), ''), NEW.full_name);

  IF NEW.name IS NULL OR NEW.full_name IS NULL THEN
    RAISE EXCEPTION 'اسم المالك مطلوب';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_owner_compatibility_fields ON public.owners;
CREATE TRIGGER trg_sync_owner_compatibility_fields
BEFORE INSERT OR UPDATE OF name, full_name, display_name ON public.owners
FOR EACH ROW EXECUTE FUNCTION public.sync_owner_compatibility_fields();

CREATE OR REPLACE FUNCTION public.sync_property_compatibility_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.title IS DISTINCT FROM OLD.title AND NEW.name IS NOT DISTINCT FROM OLD.name THEN
      NEW.name := NEW.title;
    ELSIF NEW.name IS DISTINCT FROM OLD.name AND NEW.title IS NOT DISTINCT FROM OLD.title THEN
      NEW.title := NEW.name;
    END IF;
  END IF;

  NEW.title := COALESCE(NULLIF(btrim(NEW.title), ''), NULLIF(btrim(NEW.name), ''));
  NEW.name := COALESCE(NULLIF(btrim(NEW.name), ''), NEW.title);

  IF NEW.name IS NULL OR NEW.title IS NULL THEN
    RAISE EXCEPTION 'اسم العقار مطلوب';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_property_compatibility_fields ON public.properties;
CREATE TRIGGER trg_sync_property_compatibility_fields
BEFORE INSERT OR UPDATE OF name, title ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.sync_property_compatibility_fields();

CREATE OR REPLACE FUNCTION public.refresh_property_owner_projection(p_property_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id uuid;
  v_owner_name text;
BEGIN
  SELECT po.owner_id, COALESCE(NULLIF(btrim(o.display_name), ''), NULLIF(btrim(o.full_name), ''), o.name)
    INTO v_owner_id, v_owner_name
  FROM public.property_owners po
  JOIN public.owners o ON o.id = po.owner_id
  WHERE po.property_id::text = p_property_id
    AND (po.starts_on IS NULL OR po.starts_on <= current_date)
    AND (po.ends_on IS NULL OR po.ends_on >= current_date)
  ORDER BY po.is_primary DESC, po.starts_on DESC NULLS LAST, po.created_at
  LIMIT 1;

  UPDATE public.properties
  SET owner_id = v_owner_id,
      owner_name = v_owner_name,
      updated_at = now()
  WHERE id::text = p_property_id
    AND (owner_id IS DISTINCT FROM v_owner_id OR owner_name IS DISTINCT FROM v_owner_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_property_owner_projection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.refresh_property_owner_projection(OLD.property_id::text);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.property_id IS DISTINCT FROM OLD.property_id) THEN
    PERFORM public.refresh_property_owner_projection(NEW.property_id::text);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_property_owner_projection ON public.property_owners;
CREATE TRIGGER trg_sync_property_owner_projection
AFTER INSERT OR UPDATE OR DELETE ON public.property_owners
FOR EACH ROW EXECUTE FUNCTION public.sync_property_owner_projection();

CREATE OR REPLACE FUNCTION public.assert_owner_agreement_has_ownership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.property_owners po
    WHERE po.property_id = NEW.property_id
      AND po.owner_id = NEW.owner_id
      AND (po.starts_on IS NULL OR po.starts_on <= NEW.starts_on)
      AND (
        po.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND po.ends_on >= NEW.ends_on)
      )
  ) THEN
    RAISE EXCEPTION 'مالك الاتفاقية لا يملك العقار طوال فترة الاتفاقية.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_owner_agreement_requires_ownership ON public.owner_agreements;
CREATE TRIGGER trg_owner_agreement_requires_ownership
BEFORE INSERT OR UPDATE OF owner_id, property_id, starts_on, ends_on ON public.owner_agreements
FOR EACH ROW EXECUTE FUNCTION public.assert_owner_agreement_has_ownership();

CREATE OR REPLACE FUNCTION public.create_property_with_agreement(
  p_title text,
  p_type text,
  p_address text,
  p_owner_id uuid,
  p_agreement_type text,
  p_commission_type text,
  p_commission_value numeric,
  p_agreement_starts_on date,
  p_agreement_ends_on date DEFAULT NULL,
  p_owner_name text DEFAULT NULL,
  p_purchase_value numeric DEFAULT NULL,
  p_current_value numeric DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_property_id public.properties.id%TYPE;
  v_agreement_id uuid;
  v_owner_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنشاء عقار' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_title), '') IS NULL THEN RAISE EXCEPTION 'اسم العقار مطلوب'; END IF;
  IF p_commission_type = 'RATE' AND (p_commission_value < 0 OR p_commission_value > 100) THEN
    RAISE EXCEPTION 'نسبة العمولة يجب أن تكون بين 0 و100 عند نوع RATE';
  END IF;
  IF p_commission_type = 'FIXED_MONTHLY' AND p_commission_value < 0 THEN
    RAISE EXCEPTION 'قيمة العمولة الثابتة لا يمكن أن تكون سالبة';
  END IF;

  SELECT COALESCE(NULLIF(btrim(p_owner_name), ''), NULLIF(btrim(o.display_name), ''), NULLIF(btrim(o.full_name), ''), o.name)
    INTO v_owner_name
  FROM public.owners o
  WHERE o.id = p_owner_id AND o.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'المالك غير موجود أو مؤرشف'; END IF;

  INSERT INTO public.properties (name, title, type, address, owner_id, owner_name, purchase_value, current_value, status, notes)
  VALUES (btrim(p_title), btrim(p_title), p_type, p_address, p_owner_id, v_owner_name, p_purchase_value, p_current_value, p_status, p_notes)
  RETURNING id INTO v_property_id;

  INSERT INTO public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on)
  VALUES (v_property_id, p_owner_id, 100, true, p_agreement_starts_on, p_agreement_ends_on);

  INSERT INTO public.owner_agreements (owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on)
  VALUES (p_owner_id, v_property_id, p_agreement_type, p_commission_type, p_commission_value, p_agreement_starts_on, p_agreement_ends_on)
  RETURNING id INTO v_agreement_id;

  RETURN jsonb_build_object('property_id', v_property_id, 'agreement_id', v_agreement_id);
END;
$$;

ALTER FUNCTION public.create_property_with_agreement(text,text,text,uuid,text,text,numeric,date,date,text,numeric,numeric,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_property_with_agreement(text,text,text,uuid,text,text,numeric,date,date,text,numeric,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_property_with_agreement(text,text,text,uuid,text,text,numeric,date,date,text,numeric,numeric,text,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.refresh_property_owner_projection(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_property_owner_projection() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_owner_compatibility_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_property_compatibility_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_owner_agreement_has_ownership() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.refresh_property_owner_projection(text) IS
  'Maintains properties.owner_id/owner_name as compatibility projections of the current property_owners relationship.';

NOTIFY pgrst, 'reload schema';

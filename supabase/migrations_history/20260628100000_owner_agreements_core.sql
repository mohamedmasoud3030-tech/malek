-- Enable btree_gist so text and uuid columns work in EXCLUDE constraints.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- owner_agreements: one operational owner per property at a time
--
-- Historical environments used text property identifiers while the code-first
-- baseline uses UUIDs. Derive the agreement property key from properties(id)
-- so clean replay and existing supported schemas remain consistent.
-- ============================================================

DO $$
DECLARE
  v_property_id_type text;
  v_agreement_property_id_type text;
BEGIN
  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_property_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation
    ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'properties'
    AND attribute.attname = 'id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_property_id_type IS NULL THEN
    RAISE EXCEPTION 'Cannot create owner agreements: public.properties(id) was not found';
  END IF;

  IF v_property_id_type NOT IN ('uuid', 'text') THEN
    RAISE EXCEPTION
      'Cannot create owner agreements: unsupported public.properties(id) type %',
      v_property_id_type;
  END IF;

  IF to_regclass('public.owner_agreements') IS NULL THEN
    EXECUTE format(
      $sql$
        CREATE TABLE public.owner_agreements (
          id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          owner_id         uuid NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
          property_id      %s NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
          agreement_type   text NOT NULL CHECK (agreement_type IN ('property_management', 'master_lease')),
          commission_type  text NOT NULL CHECK (commission_type IN ('FIXED_MONTHLY', 'RATE')),
          commission_value numeric(14,4) NOT NULL CHECK (
            (commission_type = 'RATE' AND commission_value >= 0 AND commission_value <= 100) OR
            (commission_type = 'FIXED_MONTHLY' AND commission_value >= 0)
          ),
          starts_on        date NOT NULL,
          ends_on          date CHECK (ends_on IS NULL OR ends_on >= starts_on),
          notes            text,
          created_at       timestamptz NOT NULL DEFAULT now(),
          updated_at       timestamptz NOT NULL DEFAULT now()
        )
      $sql$,
      v_property_id_type
    );
  END IF;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_agreement_property_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation
    ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'owner_agreements'
    AND attribute.attname = 'property_id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_agreement_property_id_type IS NULL THEN
    RAISE EXCEPTION 'Cannot validate owner agreements: public.owner_agreements(property_id) was not found';
  END IF;

  IF v_agreement_property_id_type <> v_property_id_type THEN
    RAISE EXCEPTION
      'Cannot link owner agreements: properties.id type % differs from owner_agreements.property_id type %',
      v_property_id_type,
      v_agreement_property_id_type;
  END IF;
END
$$;

ALTER TABLE public.owner_agreements
  DROP CONSTRAINT IF EXISTS owner_agreements_no_overlap;
ALTER TABLE public.owner_agreements
  ADD CONSTRAINT owner_agreements_no_overlap
  EXCLUDE USING gist (
    property_id WITH =,
    daterange(starts_on, COALESCE(ends_on, '9999-12-31'::date), '[]') WITH &&
  );

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS agreement_id uuid REFERENCES public.owner_agreements(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS owner_agreements_property_range_idx
  ON public.owner_agreements (property_id, starts_on, ends_on);
CREATE INDEX IF NOT EXISTS contracts_agreement_id_idx
  ON public.contracts (agreement_id);

ALTER TABLE public.owner_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_agreements_select" ON public.owner_agreements;
CREATE POLICY "owner_agreements_select"
  ON public.owner_agreements FOR SELECT TO authenticated USING (is_app_user());

DROP POLICY IF EXISTS "owner_agreements_insert" ON public.owner_agreements;
CREATE POLICY "owner_agreements_insert"
  ON public.owner_agreements FOR INSERT TO authenticated WITH CHECK (is_admin_or_manager());

DROP POLICY IF EXISTS "owner_agreements_update" ON public.owner_agreements;
CREATE POLICY "owner_agreements_update"
  ON public.owner_agreements FOR UPDATE TO authenticated
  USING (is_admin_or_manager()) WITH CHECK (is_admin_or_manager());

DROP POLICY IF EXISTS "owner_agreements_delete" ON public.owner_agreements;
CREATE POLICY "owner_agreements_delete"
  ON public.owner_agreements FOR DELETE TO authenticated USING (is_admin_or_manager());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_agreements TO authenticated;

CREATE OR REPLACE FUNCTION public.create_property_with_agreement(
  p_title               text,
  p_type                text,
  p_address             text,
  p_owner_id            uuid,
  p_agreement_type      text,
  p_commission_type     text,
  p_commission_value    numeric,
  p_agreement_starts_on date,
  p_agreement_ends_on   date    DEFAULT NULL,
  p_owner_name          text    DEFAULT NULL,
  p_purchase_value      numeric DEFAULT NULL,
  p_current_value       numeric DEFAULT NULL,
  p_status              text    DEFAULT 'active',
  p_notes               text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_property_id  public.properties.id%TYPE;
  v_agreement_id uuid;
BEGIN
  IF NOT is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنشاء عقار';
  END IF;
  IF p_commission_type = 'RATE' AND (p_commission_value < 0 OR p_commission_value > 100) THEN
    RAISE EXCEPTION 'نسبة العمولة يجب أن تكون بين 0 و100 عند نوع RATE (القيمة المدخلة: %)', p_commission_value;
  END IF;
  INSERT INTO public.properties (title, type, address, owner_id, owner_name, purchase_value, current_value, status, notes)
  VALUES (p_title, p_type, p_address, p_owner_id, p_owner_name, p_purchase_value, p_current_value, p_status, p_notes)
  RETURNING id INTO v_property_id;
  INSERT INTO public.owner_agreements (owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on)
  VALUES (p_owner_id, v_property_id, p_agreement_type, p_commission_type, p_commission_value, p_agreement_starts_on, p_agreement_ends_on)
  RETURNING id INTO v_agreement_id;
  INSERT INTO public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on)
  VALUES (v_property_id, p_owner_id, 100, true, p_agreement_starts_on, p_agreement_ends_on)
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('property_id', v_property_id, 'agreement_id', v_agreement_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_property_with_agreement FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_property_with_agreement TO authenticated;

CREATE OR REPLACE VIEW public.vw_active_owner_agreements AS
SELECT DISTINCT ON (property_id)
  id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on
FROM public.owner_agreements
WHERE ends_on IS NULL OR ends_on >= CURRENT_DATE
ORDER BY property_id, starts_on DESC;

CREATE OR REPLACE FUNCTION public.set_owner_agreements_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_owner_agreements_updated_at ON public.owner_agreements;
CREATE TRIGGER trg_owner_agreements_updated_at
  BEFORE UPDATE ON public.owner_agreements
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_agreements_updated_at();

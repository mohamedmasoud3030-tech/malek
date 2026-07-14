-- Migration: add_cost_centers
-- Description: Adds hierarchical cost centers and links them to expenses and journal entries.
--
-- The repository baseline uses UUID identifiers while an older live snapshot used text
-- identifiers. This migration derives its identifier type from public.properties(id)
-- instead of hard-coding either representation, then fails closed on unsupported or
-- internally inconsistent schemas.

DO $$
DECLARE
  v_property_id_type text;
  v_cost_center_id_type text;
  v_existing_column_type text;
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
    RAISE EXCEPTION 'Cannot create cost centers: public.properties(id) was not found';
  END IF;

  IF v_property_id_type NOT IN ('uuid', 'text') THEN
    RAISE EXCEPTION
      'Cannot create cost centers: unsupported public.properties(id) type %',
      v_property_id_type;
  END IF;

  IF to_regclass('public.cost_centers') IS NULL THEN
    IF v_property_id_type = 'uuid' THEN
      EXECUTE $sql$
        CREATE TABLE public.cost_centers (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL,
          property_id uuid REFERENCES public.properties(id),
          parent_id uuid REFERENCES public.cost_centers(id),
          is_active boolean DEFAULT true,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now(),
          deleted_at timestamptz
        )
      $sql$;
    ELSE
      EXECUTE $sql$
        CREATE TABLE public.cost_centers (
          id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
          name text NOT NULL,
          property_id text REFERENCES public.properties(id),
          parent_id text REFERENCES public.cost_centers(id),
          is_active boolean DEFAULT true,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now(),
          deleted_at timestamptz
        )
      $sql$;
    END IF;
  END IF;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_cost_center_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation
    ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'cost_centers'
    AND attribute.attname = 'id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_cost_center_id_type IS NULL THEN
    RAISE EXCEPTION 'Cannot link cost centers: public.cost_centers(id) was not found';
  END IF;

  IF v_cost_center_id_type <> v_property_id_type THEN
    RAISE EXCEPTION
      'Cannot link cost centers: properties.id type % differs from cost_centers.id type %',
      v_property_id_type,
      v_cost_center_id_type;
  END IF;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_existing_column_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation
    ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'expenses'
    AND attribute.attname = 'cost_center_id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_existing_column_type IS NULL THEN
    EXECUTE format(
      'ALTER TABLE public.expenses ADD COLUMN cost_center_id %s REFERENCES public.cost_centers(id)',
      v_cost_center_id_type
    );
  ELSIF v_existing_column_type <> v_cost_center_id_type THEN
    RAISE EXCEPTION
      'Cannot link expenses: expenses.cost_center_id type % differs from cost_centers.id type %',
      v_existing_column_type,
      v_cost_center_id_type;
  END IF;

  v_existing_column_type := NULL;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_existing_column_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation
    ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'journal_entries'
    AND attribute.attname = 'cost_center_id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_existing_column_type IS NULL THEN
    EXECUTE format(
      'ALTER TABLE public.journal_entries ADD COLUMN cost_center_id %s REFERENCES public.cost_centers(id)',
      v_cost_center_id_type
    );
  ELSIF v_existing_column_type <> v_cost_center_id_type THEN
    RAISE EXCEPTION
      'Cannot link journal entries: journal_entries.cost_center_id type % differs from cost_centers.id type %',
      v_existing_column_type,
      v_cost_center_id_type;
  END IF;
END
$$;

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view cost centers" ON public.cost_centers;
CREATE POLICY "Users can view cost centers" ON public.cost_centers
  FOR SELECT TO authenticated
  USING (public.is_app_user());

DROP POLICY IF EXISTS "Admins and managers can manage cost centers" ON public.cost_centers;
CREATE POLICY "Admins and managers can manage cost centers" ON public.cost_centers
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

CREATE INDEX IF NOT EXISTS idx_cost_centers_property_id
  ON public.cost_centers(property_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_parent_id
  ON public.cost_centers(parent_id);
CREATE INDEX IF NOT EXISTS idx_expenses_cost_center_id
  ON public.expenses(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_cost_center_id
  ON public.journal_entries(cost_center_id);

DROP TRIGGER IF EXISTS update_cost_centers_updated_at ON public.cost_centers;
CREATE TRIGGER update_cost_centers_updated_at
  BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

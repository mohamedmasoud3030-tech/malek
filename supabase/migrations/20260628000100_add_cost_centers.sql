-- Migration: add_cost_centers
-- Description: Adds hierarchical cost centers table and links it to expenses and journal entries.
--
-- Corrections made before live apply (verified against live schema on nnggcnpcuomwfuupupwg):
-- 1) Original draft used `uuid` for id/property_id/parent_id. Every Rentrix single-office table
--    (properties, expenses, contracts, invoices, journal_entries, accounts) uses
--    `id text PRIMARY KEY DEFAULT (gen_random_uuid())::text`, NOT native uuid. The original SQL
--    would fail at apply time: "foreign key constraint cannot be implemented: property_id (uuid)
--    vs properties.id (text)". Fixed to use text ids matching the established convention.
-- 2) Original CREATE POLICY / CREATE TRIGGER statements were not idempotent (no DROP IF EXISTS),
--    breaking the project's migration idempotency requirement. Fixed.
-- 3) Original created a duplicate `update_updated_at_column()` trigger function. The project
--    already has `public.update_updated_at()` used by other tables' updated_at triggers. Reused
--    it instead of duplicating.

-- 1. Create cost_centers table
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  name text NOT NULL,
  property_id text REFERENCES public.properties(id),
  parent_id text REFERENCES public.cost_centers(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- 2. Add FK to expenses
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' AND column_name='cost_center_id') THEN
    ALTER TABLE public.expenses ADD COLUMN cost_center_id text REFERENCES public.cost_centers(id);
  END IF;
END $$;

-- 3. Add FK to journal_entries
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='journal_entries' AND column_name='cost_center_id') THEN
    ALTER TABLE public.journal_entries ADD COLUMN cost_center_id text REFERENCES public.cost_centers(id);
  END IF;
END $$;

-- 4. Enable RLS
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (idempotent: drop-then-create)
DROP POLICY IF EXISTS "Users can view cost centers" ON public.cost_centers;
CREATE POLICY "Users can view cost centers" ON public.cost_centers
  FOR SELECT TO authenticated USING (public.is_app_user());

DROP POLICY IF EXISTS "Admins and managers can manage cost centers" ON public.cost_centers;
CREATE POLICY "Admins and managers can manage cost centers" ON public.cost_centers
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_cost_centers_property_id ON public.cost_centers(property_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_parent_id ON public.cost_centers(parent_id);
CREATE INDEX IF NOT EXISTS idx_expenses_cost_center_id ON public.expenses(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_cost_center_id ON public.journal_entries(cost_center_id);

-- 7. Trigger for updated_at — reuse existing public.update_updated_at(), no duplicate function
DROP TRIGGER IF EXISTS update_cost_centers_updated_at ON public.cost_centers;
CREATE TRIGGER update_cost_centers_updated_at
    BEFORE UPDATE ON public.cost_centers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- Migration: add_payment_terms
-- Description: Adds payment terms templates and links them to contracts.
--
-- Corrections made before live apply: same text-id fix and idempotency/trigger-reuse fix as
-- 20260628000100_add_cost_centers.sql (see that file's header for the full rationale).

-- 1. Create payment_terms_templates table
CREATE TABLE IF NOT EXISTS public.payment_terms_templates (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  name text NOT NULL, -- e.g., "Quarterly", "Biannual", "Annual"
  installments integer DEFAULT 1,
  interval_type text CHECK (interval_type IN ('monthly', 'quarterly', 'biannual', 'annual', 'custom')),
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- 2. Add FK to contracts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contracts' AND column_name='payment_terms_id') THEN
    ALTER TABLE public.contracts ADD COLUMN payment_terms_id text REFERENCES public.payment_terms_templates(id);
  END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE public.payment_terms_templates ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies (idempotent)
DROP POLICY IF EXISTS "Users can view payment terms" ON public.payment_terms_templates;
CREATE POLICY "Users can view payment terms" ON public.payment_terms_templates
  FOR SELECT TO authenticated USING (public.is_app_user());

DROP POLICY IF EXISTS "Admins and managers can manage payment terms" ON public.payment_terms_templates;
CREATE POLICY "Admins and managers can manage payment terms" ON public.payment_terms_templates
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_contracts_payment_terms_id ON public.contracts(payment_terms_id);

-- 6. Trigger for updated_at — reuse existing public.update_updated_at()
DROP TRIGGER IF EXISTS update_payment_terms_updated_at ON public.payment_terms_templates;
CREATE TRIGGER update_payment_terms_updated_at
    BEFORE UPDATE ON public.payment_terms_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

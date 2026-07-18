-- Recalculate owner balances from canonical payments and contract agreements.
-- FIXED_MONTHLY is intentionally not converted to a percentage; its accrual
-- remains an explicit owner-settlement input until that accounting policy is
-- decided. RATE agreements continue to accrue from collected payments.

CREATE OR REPLACE FUNCTION public.recalculate_owner_balance(p_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_income numeric := 0;
  v_expenses numeric := 0;
  v_commission numeric := 0;
  v_balance_owner_id public.owner_balances.owner_id%TYPE := p_owner_id;
BEGIN
  SELECT COALESCE(sum(p.amount), 0),
    COALESCE(sum(CASE WHEN oa.commission_type = 'RATE'
      THEN p.amount * oa.commission_value / 100 ELSE 0 END), 0)
  INTO v_income, v_commission
  FROM public.payments p
  JOIN public.contracts c ON c.id = p.contract_id AND c.deleted_at IS NULL
  JOIN public.owner_agreements oa ON oa.id = c.agreement_id AND oa.owner_id = p_owner_id
  WHERE p.deleted_at IS NULL AND upper(COALESCE(p.status, '')) <> 'VOID';

  -- The clean canonical expense table deliberately has no owner/office charge
  -- classifier. Do not guess ownership there. The legacy live table can still
  -- contribute explicitly classified OWNER expenses until it is converged.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'charged_to'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'status'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'date_time'
  ) THEN
    EXECUTE $owner_expenses$
      SELECT COALESCE(sum(e.amount), 0)
      FROM public.expenses e
      WHERE e.deleted_at IS NULL
        AND upper(COALESCE(e.status, '')) = 'POSTED'
        AND upper(COALESCE(e.charged_to, '')) = 'OWNER'
        AND EXISTS (
          SELECT 1 FROM public.property_owners po
          WHERE po.property_id = e.property_id AND po.owner_id = $1
            AND (po.starts_on IS NULL OR po.starts_on <= public._safe_date(e.date_time))
            AND (po.ends_on IS NULL OR po.ends_on >= public._safe_date(e.date_time))
        )
    $owner_expenses$ INTO v_expenses USING p_owner_id;
  ELSE
    v_expenses := 0;
  END IF;

  INSERT INTO public.owner_balances(owner_id, total_income, total_expenses, commission, net_balance, updated_at)
  VALUES (v_balance_owner_id, public._r3(v_income), public._r3(v_expenses), public._r3(v_commission),
    public._r3(v_income - v_expenses - v_commission), now())
  ON CONFLICT (owner_id) DO UPDATE SET
    total_income = EXCLUDED.total_income,
    total_expenses = EXCLUDED.total_expenses,
    commission = EXCLUDED.commission,
    net_balance = EXCLUDED.net_balance,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.update_owner_balance_from_operation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_contract_id public.contracts.id%TYPE;
  v_old_contract_id public.contracts.id%TYPE;
  v_new_property_id public.properties.id%TYPE;
  v_old_property_id public.properties.id%TYPE;
  v_owner_id uuid;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF TG_TABLE_NAME = 'payments' THEN
      v_new_contract_id := NEW.contract_id;
    ELSE
      v_new_property_id := NEW.property_id;
    END IF;
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF TG_TABLE_NAME = 'payments' THEN
      v_old_contract_id := OLD.contract_id;
    ELSE
      v_old_property_id := OLD.property_id;
    END IF;
  END IF;

  FOR v_owner_id IN
    SELECT DISTINCT candidate.owner_id
    FROM (
      SELECT oa.owner_id
      FROM public.contracts c JOIN public.owner_agreements oa ON oa.id = c.agreement_id
      WHERE c.id IN (v_new_contract_id, v_old_contract_id)
      UNION ALL
      SELECT po.owner_id
      FROM public.property_owners po
      WHERE po.property_id IN (v_new_property_id, v_old_property_id)
    ) candidate
  LOOP
    PERFORM public.recalculate_owner_balance(v_owner_id);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_owner_balance_on_receipt ON public.receipts;
DROP TRIGGER IF EXISTS trigger_update_owner_balance_on_payment ON public.payments;
CREATE TRIGGER trigger_update_owner_balance_on_payment
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_owner_balance_from_operation();

DROP TRIGGER IF EXISTS trigger_update_owner_balance_on_expense ON public.expenses;
CREATE TRIGGER trigger_update_owner_balance_on_expense
AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.update_owner_balance_from_operation();

REVOKE ALL ON FUNCTION public.recalculate_owner_balance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_owner_balance_from_operation() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.recalculate_owner_balance(uuid) IS
  'Collected-basis owner balance from non-VOID payments, owner expenses, and RATE agreement fees. FIXED_MONTHLY accrual is settlement-controlled.';

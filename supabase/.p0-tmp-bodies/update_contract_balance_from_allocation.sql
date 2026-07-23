CREATE OR REPLACE FUNCTION public.update_contract_balance_from_allocation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_contract_id text;
  v_total_invoiced numeric;
  v_total_paid numeric;
  v_tenant_id text;
  v_unit_id text;
BEGIN
  -- Get contract_id from the invoice referenced by this allocation
  IF TG_OP = 'DELETE' THEN
    SELECT i.contract_id::text INTO v_contract_id
    FROM public.invoices i
    WHERE i.id::text = OLD.invoice_id::text;
  ELSE
    SELECT i.contract_id::text INTO v_contract_id
    FROM public.invoices i
    WHERE i.id::text = NEW.invoice_id::text;
  END IF;

  IF v_contract_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate totals for this contract
  SELECT 
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0),
    COALESCE(SUM(i.paid_amount), 0),
    c.tenant_id::text,
    c.unit_id::text
  INTO v_total_invoiced, v_total_paid, v_tenant_id, v_unit_id
  FROM public.contracts c
  LEFT JOIN public.invoices i ON i.contract_id::text = c.id::text AND i.deleted_at IS NULL
  WHERE c.id::text = v_contract_id::text
  GROUP BY c.tenant_id, c.unit_id;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Upsert contract_balances
  INSERT INTO public.contract_balances (
    contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at
  ) VALUES (
    v_contract_id::uuid,
    v_tenant_id::uuid,
    v_unit_id::uuid,
    v_total_invoiced,
    v_total_paid,
    v_total_invoiced - v_total_paid,
    now()
  )
  ON CONFLICT (contract_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    unit_id = EXCLUDED.unit_id,
    total_invoiced = EXCLUDED.total_invoiced,
    total_paid = EXCLUDED.total_paid,
    balance_due = EXCLUDED.balance_due,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$function$;

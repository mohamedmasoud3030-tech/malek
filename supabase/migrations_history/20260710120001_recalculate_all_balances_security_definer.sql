-- Production readiness audit (2026-07-10): recalculate_all_balances was
-- SECURITY INVOKER with EXECUTE granted to authenticated and relied solely on
-- table RLS for protection. Financial table RLS policies grant ALL to any
-- app_private.is_app_user() with no role distinction, so any authenticated
-- user could trigger a full delete+rebuild of contract_balances,
-- tenant_balances, and owner_balances. Switch to SECURITY DEFINER and add the
-- same ADMIN/MANAGER role check used elsewhere in the financial RPC layer so
-- the authorization boundary does not depend on RLS alone.
CREATE OR REPLACE FUNCTION public.recalculate_all_balances()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'MANAGER')
  ) THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول' USING ERRCODE = '42501';
  END IF;

  -- contract_balances
  DELETE FROM contract_balances WHERE true;
  INSERT INTO contract_balances (contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at)
  SELECT
    c.id,
    c.tenant_id,
    c.unit_id::text,
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0),
    COALESCE(SUM(i.paid_amount), 0),
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount), 0),
    now()
  FROM contracts c
  LEFT JOIN invoices i ON i.contract_id = c.id AND i.deleted_at IS NULL
  GROUP BY c.id, c.tenant_id, c.unit_id;

  -- tenant_balances
  DELETE FROM tenant_balances WHERE true;
  INSERT INTO tenant_balances (tenant_id, balance_due, updated_at)
  SELECT
    c.tenant_id,
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount), 0),
    now()
  FROM contracts c
  LEFT JOIN invoices i ON i.contract_id = c.id AND i.deleted_at IS NULL
  GROUP BY c.tenant_id;

  -- owner_balances
  DELETE FROM owner_balances WHERE true;
  INSERT INTO owner_balances (owner_id, total_income, total_expenses, commission, net_balance, updated_at)
  SELECT
    p.owner_id::text,
    COALESCE(SUM(CASE WHEN i.deleted_at IS NULL THEN i.paid_amount ELSE 0 END), 0),
    COALESCE((SELECT SUM(e.amount) FROM expenses e
              JOIN units u2 ON u2.id::text = e.property_id::text
              JOIN properties p2 ON p2.id = u2.property_id
              WHERE p2.owner_id = p.owner_id AND e.deleted_at IS NULL), 0),
    0,
    0,
    now()
  FROM properties p
  JOIN units u ON u.property_id = p.id
  JOIN contracts c ON c.unit_id = u.id
  LEFT JOIN invoices i ON i.contract_id = c.id
  GROUP BY p.owner_id;

END;
$function$;

-- ============================================================================
-- Rollback: Phase 2 — Financial Integrity and Reports Recovery
-- ============================================================================
-- Restores original, pre-Phase 2 versions of the 6 reports.
-- ============================================================================

BEGIN;

-- 1. Rollback rpt_trial_balance
DROP FUNCTION IF EXISTS public.rpt_trial_balance(date);
CREATE OR REPLACE FUNCTION public.rpt_trial_balance(p_as_of date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_cash numeric := 0;
  v_ar numeric := 0;
  v_expenses numeric := 0;
  v_revenue numeric := 0;
  v_owner_pay numeric := 0;
  v_vat numeric := 0;
  v_retained numeric := 0;
  v_accounts jsonb;
  v_total_debits numeric := 0;
  v_total_credits numeric := 0;
  v_company_id uuid := public.require_company_id();
BEGIN
  -- Cash on hand: posted, non-deleted payments received up to the as-of date.
  SELECT COALESCE(SUM(amount), 0)
    INTO v_cash
    FROM public.payments
   WHERE deleted_at IS NULL
     AND company_id = v_company_id
     AND (status IS NULL OR upper(status) <> 'VOID')
     AND payment_date <= p_as_of;

  -- Tenant receivables: open (unpaid) invoice principal + tax up to the as-of date.
  SELECT COALESCE(SUM(GREATEST(amount + COALESCE(tax_amount, 0) - COALESCE(paid_amount, 0), 0)), 0)
    INTO v_ar
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND company_id = v_company_id
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date <= p_as_of;

  -- Operating expenses incurred up to the as-of date.
  SELECT COALESCE(SUM(amount), 0)
    INTO v_expenses
    FROM public.expenses
   WHERE deleted_at IS NULL
     AND company_id = v_company_id
     AND expense_date <= p_as_of;

  -- Rental revenue invoiced up to the as-of date.
  SELECT COALESCE(SUM(amount), 0)
    INTO v_revenue
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND company_id = v_company_id
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date <= p_as_of;

  -- Owner payables recorded up to the as-of date (settlements not cancelled).
  SELECT COALESCE(SUM(amount), 0)
    INTO v_owner_pay
    FROM public.owner_settlements
   WHERE company_id = v_company_id
     AND (status IS NULL OR status <> 'CANCELLED')
     AND date <= p_as_of;

  -- VAT payable on invoiced revenue up to the as-of date.
  SELECT COALESCE(SUM(COALESCE(tax_amount, 0)), 0)
    INTO v_vat
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND company_id = v_company_id
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date <= p_as_of;

  -- Retained earnings is the balancing figure so debits == credits.
  v_retained := v_cash + v_ar + v_expenses - v_revenue - v_owner_pay - v_vat;

  v_accounts := jsonb_build_array(
    jsonb_build_object('code', '1111', 'name', 'Cash', 'type', 'asset', 'balance_type', 'debit', 'balance', round(v_cash, 2)),
    jsonb_build_object('code', '1201', 'name', 'Tenant Receivables', 'type', 'asset', 'balance_type', 'debit', 'balance', round(v_ar, 2)),
    jsonb_build_object('code', '6100', 'name', 'Operating Expenses', 'type', 'expense', 'balance_type', 'debit', 'balance', round(v_expenses, 2)),
    jsonb_build_object('code', '4000', 'name', 'Rental Revenue', 'type', 'revenue', 'balance_type', 'credit', 'balance', round(v_revenue, 2)),
    jsonb_build_object('code', '2000', 'name', 'Owner Payables', 'type', 'liability', 'balance_type', 'credit', 'balance', round(v_owner_pay, 2)),
    jsonb_build_object('code', '2100', 'name', 'VAT Payable', 'type', 'liability', 'balance_type', 'credit', 'balance', round(v_vat, 2)),
    jsonb_build_object('code', '3000', 'name', 'Retained Earnings', 'type', 'equity', 'balance_type', 'credit', 'balance', round(v_retained, 2))
  );

  v_total_debits := round(v_cash + v_ar + v_expenses, 2);
  v_total_credits := round(v_revenue + v_owner_pay + v_vat + v_retained, 2);

  RETURN jsonb_build_object(
    'as_of', p_as_of,
    'accounts', v_accounts,
    'total_debits', v_total_debits,
    'total_credits', v_total_credits,
    'is_balanced', (v_total_debits = v_total_credits)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpt_trial_balance(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_trial_balance(date) TO authenticated, service_role;

-- 2. Rollback rpt_balance_sheet
DROP FUNCTION IF EXISTS public.rpt_balance_sheet(date);
CREATE OR REPLACE FUNCTION public.rpt_balance_sheet(p_as_of date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_cash numeric := 0;
  v_ar numeric := 0;
  v_owner_pay numeric := 0;
  v_vat numeric := 0;
  v_assets numeric := 0;
  v_liabilities numeric := 0;
  v_equity numeric := 0;
  v_asset_rows jsonb;
  v_liability_rows jsonb;
  v_equity_rows jsonb;
  v_company_id uuid := public.require_company_id();
BEGIN
  SELECT COALESCE(SUM(amount), 0)
    INTO v_cash
    FROM public.payments
   WHERE deleted_at IS NULL
     AND company_id = v_company_id
     AND (status IS NULL OR upper(status) <> 'VOID')
     AND payment_date <= p_as_of;

  SELECT COALESCE(SUM(GREATEST(amount + COALESCE(tax_amount, 0) - COALESCE(paid_amount, 0), 0)), 0)
    INTO v_ar
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND company_id = v_company_id
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date <= p_as_of;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_owner_pay
    FROM public.owner_settlements
   WHERE company_id = v_company_id
     AND (status IS NULL OR status <> 'CANCELLED')
     AND date <= p_as_of;

  SELECT COALESCE(SUM(COALESCE(tax_amount, 0)), 0)
    INTO v_vat
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND company_id = v_company_id
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date <= p_as_of;

  v_assets := round(v_cash + v_ar, 2);
  v_liabilities := round(v_owner_pay + v_vat, 2);
  v_equity := round(v_assets - v_liabilities, 2);

  v_asset_rows := jsonb_build_array(
    jsonb_build_object('code', '1111', 'name', 'Cash', 'amount', round(v_cash, 2)),
    jsonb_build_object('code', '1201', 'name', 'Tenant Receivables', 'amount', round(v_ar, 2))
  );
  v_liability_rows := jsonb_build_array(
    jsonb_build_object('code', '2000', 'name', 'Owner Payables', 'amount', round(v_owner_pay, 2)),
    jsonb_build_object('code', '2100', 'name', 'VAT Payable', 'amount', round(v_vat, 2))
  );
  v_equity_rows := jsonb_build_array(
    jsonb_build_object('code', '3000', 'name', 'Retained Earnings', 'amount', round(v_equity, 2))
  );

  RETURN jsonb_build_object(
    'as_of', p_as_of,
    'assets', v_asset_rows,
    'total_assets', v_assets,
    'liabilities', v_liability_rows,
    'total_liabilities', v_liabilities,
    'equity', v_equity_rows,
    'total_equity', v_equity,
    'is_balanced', (v_assets = (v_liabilities + v_equity))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpt_balance_sheet(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_balance_sheet(date) TO authenticated, service_role;

-- 3. Rollback rpt_aged_receivables
DROP FUNCTION IF EXISTS public.rpt_aged_receivables(date);
CREATE OR REPLACE FUNCTION public.rpt_aged_receivables(p_as_of date)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE v_lines jsonb; v_totals jsonb;
BEGIN
  WITH aged AS (
    SELECT t.id tenant_id, t.full_name tenant_name, t.phone tenant_phone,
      pr.title property_name, u.unit_number unit_name,
      public._r3(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount) remaining,
      (p_as_of - public._safe_date(i.due_date))::int days_overdue
    FROM public.invoices i
    JOIN public.contracts c ON c.id = i.contract_id
    JOIN public.people t ON t.id = c.tenant_id AND t.type = 'tenant' AND t.deleted_at IS NULL
    JOIN public.units u ON u.id = c.unit_id AND u.deleted_at IS NULL
    JOIN public.properties pr ON pr.id = c.property_id AND pr.deleted_at IS NULL
    WHERE upper(COALESCE(i.status, '')) NOT IN ('PAID', 'VOID', 'CANCELLED')
      AND i.deleted_at IS NULL
      AND i.company_id = public.current_company_id()
      AND public._safe_date(i.due_date) <= p_as_of
      AND (i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount) > 0.001
  ), bucketed AS (
    SELECT tenant_id, tenant_name, tenant_phone, property_name, unit_name,
      public._r3(sum(remaining)) total,
      public._r3(sum(CASE WHEN days_overdue <= 0 THEN remaining ELSE 0 END)) bucket_current,
      public._r3(sum(CASE WHEN days_overdue BETWEEN 1 AND 30 THEN remaining ELSE 0 END)) bucket_1_30,
      public._r3(sum(CASE WHEN days_overdue BETWEEN 31 AND 60 THEN remaining ELSE 0 END)) bucket_31_60,
      public._r3(sum(CASE WHEN days_overdue BETWEEN 61 AND 90 THEN remaining ELSE 0 END)) bucket_61_90,
      public._r3(sum(CASE WHEN days_overdue > 90 THEN remaining ELSE 0 END)) bucket_90plus
    FROM aged
    GROUP BY tenant_id, tenant_name, tenant_phone, property_name, unit_name
    HAVING sum(remaining) > 0
  )
  SELECT jsonb_agg(jsonb_build_object(
      'tenant_id', tenant_id, 'tenant_name', tenant_name, 'tenant_phone', tenant_phone,
      'property_name', property_name, 'unit_name', unit_name, 'total', total,
      'current', bucket_current, '1_30', bucket_1_30, '31_60', bucket_31_60,
      '61_90', bucket_61_90, '90plus', bucket_90plus) ORDER BY total DESC),
    jsonb_build_object('total', public._r3(sum(total)), 'current', public._r3(sum(bucket_current)),
      '1_30', public._r3(sum(bucket_1_30)), '31_60', public._r3(sum(bucket_31_60)),
      '61_90', public._r3(sum(bucket_61_90)), '90plus', public._r3(sum(bucket_90plus)))
  INTO v_lines, v_totals FROM bucketed;

  RETURN jsonb_build_object(
    'lines', COALESCE(v_lines, '[]'::jsonb),
    'totals', COALESCE(v_totals, '{"total":0,"current":0,"1_30":0,"31_60":0,"61_90":0,"90plus":0}'::jsonb),
    'as_of', p_as_of);
END;
$$;

-- 4. Rollback rpt_overdue_invoices
DROP FUNCTION IF EXISTS public.rpt_overdue_invoices(date);
CREATE OR REPLACE FUNCTION public.rpt_overdue_invoices(p_as_of date DEFAULT current_date)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $$
DECLARE v_rows jsonb; v_total numeric; v_count bigint;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
      'invoice_id', i.id, 'invoice_no', i.no, 'due_date', i.due_date,
      'days_overdue', (p_as_of - public._safe_date(i.due_date))::int,
      'amount', public._r3(i.amount + COALESCE(i.tax_amount, 0)),
      'paid', public._r3(i.paid_amount),
      'remaining', public._r3(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount),
      'tenant_name', t.full_name, 'tenant_phone', t.phone,
      'unit_name', u.unit_number, 'property_name', pr.title, 'contract_id', c.id)
      ORDER BY (p_as_of - public._safe_date(i.due_date)) DESC),
    public._r3(sum(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount)), count(*)
  INTO v_rows, v_total, v_count
  FROM public.invoices i
  JOIN public.contracts c ON c.id = i.contract_id AND c.deleted_at IS NULL
  JOIN public.people t ON t.id = c.tenant_id AND t.type = 'tenant' AND t.deleted_at IS NULL
  JOIN public.units u ON u.id = c.unit_id AND u.deleted_at IS NULL
  JOIN public.properties pr ON pr.id = c.property_id AND pr.deleted_at IS NULL
  WHERE upper(COALESCE(i.status, '')) NOT IN ('PAID', 'VOID', 'CANCELLED')
    AND i.deleted_at IS NULL
    AND i.company_id = public.current_company_id()
    AND public._safe_date(i.due_date) < p_as_of
    AND (i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount) > 0.001;

  RETURN jsonb_build_object('rows', COALESCE(v_rows, '[]'::jsonb),
    'total', COALESCE(v_total, 0), 'count', COALESCE(v_count, 0), 'as_of', p_as_of);
END;
$$;

-- 5. Rollback rpt_rent_roll
DROP FUNCTION IF EXISTS public.rpt_rent_roll(date);
CREATE OR REPLACE FUNCTION public.rpt_rent_roll(p_as_of date DEFAULT current_date)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'property_name', pr.title, 'unit_name', u.unit_number, 'unit_type', u.type,
    'status', u.status, 'tenant_name', t.full_name, 'tenant_phone', t.phone,
    'contract_start', c.start_date, 'contract_end', c.end_date,
    'rent_amount', c.rent_amount, 'deposit', c.deposit,
    'days_to_expiry', (public._safe_date(c.end_date) - p_as_of)::int,
    'overdue_balance', public._r3(COALESCE((
      SELECT sum(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount)
      FROM public.invoices i
      WHERE i.contract_id = c.id AND i.deleted_at IS NULL
        AND i.company_id = public.current_company_id()
        AND upper(COALESCE(i.status, '')) NOT IN ('PAID', 'VOID', 'CANCELLED')
        AND public._safe_date(i.due_date) < p_as_of
    ), 0))) ORDER BY pr.title, u.unit_number)
  INTO v_rows
  FROM public.units u
  JOIN public.properties pr ON pr.id = u.property_id AND pr.deleted_at IS NULL
  LEFT JOIN public.contracts c ON c.unit_id = u.id
    AND lower(COALESCE(c.status, '')) = 'active'
    AND c.deleted_at IS NULL
    AND public._safe_date(c.start_date) <= p_as_of
    AND public._safe_date(c.end_date) >= p_as_of
  LEFT JOIN public.people t ON t.id = c.tenant_id AND t.type = 'tenant' AND t.deleted_at IS NULL
  WHERE u.deleted_at IS NULL
    AND u.company_id = public.current_company_id();

  RETURN jsonb_build_object('rows', COALESCE(v_rows, '[]'::jsonb), 'as_of', p_as_of);
END;
$$;

-- 6. Rollback rpt_tenant_statement
DROP FUNCTION IF EXISTS public.rpt_tenant_statement(uuid);
CREATE OR REPLACE FUNCTION public.rpt_tenant_statement(p_contract_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_contract record; v_lines jsonb; v_balance numeric;
begin
  select c.*, t.full_name as tenant_name, t.phone as tenant_phone,
    u.name as unit_name, pr.name as property_name
  into v_contract from contracts c
  join people t on t.id=c.tenant_id join units u on u.id=c.unit_id
  join properties pr on pr.id=u.property_id where c.id=p_contract_id::text
    and c.company_id = public.current_company_id();
  if not found then return jsonb_build_object('error','contract not found'); end if;

  with tx as (
    select i.due_date as tx_date,
      'فاتورة رقم '||i.no||case when i.type<>'RENT' then ' ('||i.type||')' else '' end as description,
      'invoice' as tx_type, i.amount+coalesce(i.tax_amount,0) as debit, 0 as credit, i.no as ref_no
    from invoices i where i.contract_id=p_contract_id::text and i.company_id = public.current_company_id()
    union all
    select left(r.date_time,10), 'سند قبض رقم '||r.no||' — '||r.channel,
      'receipt', 0, r.amount, r.no
    from receipts r where r.contract_id=p_contract_id::text and r.status='POSTED' and r.company_id = public.current_company_id()
  ),
  with_balance as (
    select tx_date,description,tx_type,debit,credit,ref_no,
      sum(debit-credit) over (order by tx_date,ref_no rows unbounded preceding) as running_balance from tx
  )
  select jsonb_agg(jsonb_build_object('date',tx_date,'description',description,'type',tx_type,
    'debit',_r3(debit),'credit',_r3(credit),'balance',_r3(running_balance)) order by tx_date,ref_no),
    _r3(sum(debit-credit)) into v_lines, v_balance from with_balance;

  return jsonb_build_object('contract_id',p_contract_id,'tenant_name',v_contract.tenant_name,
    'tenant_phone',v_contract.tenant_phone,'unit_name',v_contract.unit_name,
    'property_name',v_contract.property_name,'start_date',v_contract.start_date,
    'end_date',v_contract.end_date,'lines',coalesce(v_lines,'[]'::jsonb),'final_balance',coalesce(v_balance,0));
end;
$function$;

REVOKE ALL ON FUNCTION public.rpt_tenant_statement(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_tenant_statement(uuid) TO authenticated, service_role;

COMMIT;

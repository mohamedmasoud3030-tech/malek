-- FIN-009 / SEC-009: report real settlement sources, not cash-only balances.
-- Forward function replacement only: no historical writes, signature changes,
-- new grants or duplicate report authority. Existing owner/ACLs are retained.
-- Preserve the existing due-date basis for invoice presentation; settlement
-- dates come from their governed events. Reversals remain explicit movements.
begin;

CREATE OR REPLACE FUNCTION "public"."rpt_tenant_statement"("p_contract_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE 
  v_contract record; 
  v_lines jsonb; 
  v_balance numeric;
  v_company_id uuid := public.require_company_id();
BEGIN
  PERFORM app_private.require_financial_reports_view();
  -- Select contract with correct title field from properties
  SELECT c.*, t.full_name as tenant_name, t.phone as tenant_phone,
    u.name as unit_name, pr.title as property_name
  INTO v_contract 
  FROM public.contracts c
  JOIN public.people t ON t.id::text = c.tenant_id::text AND t.deleted_at IS NULL
  JOIN public.units u ON u.id::text = c.unit_id::text AND u.deleted_at IS NULL
  JOIN public.properties pr ON pr.id::text = u.property_id::text AND pr.deleted_at IS NULL 
  WHERE c.id::text = p_contract_id::text
    AND c.company_id = v_company_id;
    
  IF NOT FOUND THEN 
    RETURN jsonb_build_object('error', 'contract not found'); 
  END IF;

  -- Cash, credit notes and deposit applications are distinct sources. Never
  -- infer cash from paid_amount (which also includes deposit applications).
  WITH scoped_invoices AS (
    SELECT i.* FROM public.invoices i
    WHERE i.contract_id = p_contract_id AND i.company_id = v_company_id
      AND i.deleted_at IS NULL
      AND upper(coalesce(i.status, '')) NOT IN ('VOID', 'VOIDED', 'CANCELLED')
  ), credits AS (
    SELECT c.* FROM public.invoice_credits c
    JOIN scoped_invoices i ON i.id = c.invoice_id
    WHERE c.company_id = v_company_id AND c.status IN ('POSTED', 'REVERSED')
  ), applications AS (
    SELECT c.* FROM public.deposit_application_claims c
    JOIN scoped_invoices i ON i.id::text = c.invoice_id
    WHERE c.company_id = v_company_id AND c.contract_id = p_contract_id::text
      AND c.claim_kind = 'INVOICE_ARREARS' AND c.target_account_no = '1201'
      AND c.status IN ('APPLIED', 'REVERSED')
  ), tx AS (
    SELECT i.due_date::text as tx_date,
      'فاتورة رقم ' || coalesce(nullif(i.no, ''), i.id::text) as description,
      'invoice'::text as tx_type, i.amount + coalesce(i.tax_amount, 0) as debit,
      0::numeric as credit, i.id::text as source_id, 0 as sort_rank
    FROM scoped_invoices i
    UNION ALL
    SELECT coalesce(p.payment_date, public._safe_date(p.created_at::text))::text,
      'سند قبض رقم ' || coalesce(r.no, p.id::text) || coalesce(' — ' || p.payment_method, ''),
      'receipt', 0, p.amount, p.id::text, 1
    FROM public.payments p
    LEFT JOIN public.receipts r ON r.id::text = p.receipt_id::text
      AND r.deleted_at IS NULL AND r.company_id = v_company_id
    WHERE p.contract_id::text = p_contract_id::text AND p.company_id = v_company_id
      AND p.deleted_at IS NULL AND upper(coalesce(p.status, '')) = 'POSTED'
    UNION ALL
    SELECT c.effective_date::text, 'إشعار دائن — ' || c.reason,
      'invoice_credit', 0, c.amount, c.id::text, 2 FROM credits c
    UNION ALL
    SELECT coalesce(b.effective_date, c.reversed_at::date)::text,
      'عكس إشعار دائن — ' || c.reversal_reason,
      'invoice_credit_reversal', c.amount, 0, c.id::text, 4
    FROM credits c
    LEFT JOIN public.journal_batches b ON b.id = c.reversal_journal_batch_id AND b.company_id = v_company_id
    WHERE c.status = 'REVERSED'
    UNION ALL
    SELECT c.application_effective_date::text, 'تسوية من التأمين — ' || c.id::text,
      'deposit_application', 0, c.allocation_amount, c.id::text, 3 FROM applications c
    UNION ALL
    SELECT b.effective_date::text, 'عكس تسوية من التأمين — ' || c.reversal_reason,
      'deposit_application_reversal', c.allocation_amount, 0, c.id::text, 5
    FROM applications c
    JOIN public.journal_batches b ON b.id = c.reversal_journal_batch_id AND b.company_id = v_company_id
    WHERE c.status = 'REVERSED'
  ), with_balance AS (
    SELECT *, SUM(debit-credit) OVER (
      ORDER BY tx_date, sort_rank, source_id ROWS UNBOUNDED PRECEDING
    ) as running_balance FROM tx
  )
  SELECT jsonb_agg(jsonb_build_object(
    'date', tx_date, 'description', description, 'type', tx_type,
    'debit', public._r3(debit), 'credit', public._r3(credit),
    'balance', public._r3(running_balance)
  ) ORDER BY tx_date, sort_rank, source_id), public._r3(SUM(debit-credit))
  INTO v_lines, v_balance FROM with_balance;

  RETURN jsonb_build_object(
    'contract_id', p_contract_id,
    'tenant_name', v_contract.tenant_name,
    'tenant_phone', v_contract.tenant_phone,
    'unit_name', v_contract.unit_name,
    'property_name', v_contract.property_name,
    'start_date', v_contract.start_date,
    'end_date', v_contract.end_date,
    'lines', COALESCE(v_lines, '[]'::jsonb),
    'final_balance', COALESCE(v_balance, 0)
  );
END;
$$;


commit;

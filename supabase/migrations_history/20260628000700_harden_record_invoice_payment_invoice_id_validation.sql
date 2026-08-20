-- Migration: harden_record_invoice_payment_invoice_id_validation
--
-- Task 3 audit finding (2026-06-28):
--   record_invoice_payment_atomic cast payload->>'invoice_id' directly to uuid without
--   validating format first. invoices.id is text, not uuid. All live IDs are valid UUID
--   format (verified: 0 non-UUID ids), but a caller supplying a malformed id would receive
--   a cryptic Postgres "invalid input syntax for type uuid" before any guard logic ran.
--
--   Fix: introduce v_invoice_id_raw text, validate UUID regex, then cast. Also corrects
--   the contract_id lookup to use text comparison (v_invoice->>'contract_id' without ::uuid
--   cast) matching the actual contracts.id text column type.
--
--   All other behavior preserved exactly: auth, role, advisory lock, idempotency, account
--   resolution, journal entries, grants, search_path.
--
-- Other functions audited — no changes needed:
--   find_payment_account_id: search_path pinned, raises on multiple matches, NULL on zero ✅
--   rpt_cash_flow: search_path pinned, correct columns (payments.payment_date) ✅
--   rpt_vat_return: search_path pinned, correct columns (invoices.issue_date) ✅

CREATE OR REPLACE FUNCTION public.record_invoice_payment_atomic(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  actor_id uuid;
  v_invoice_id_raw text;
  v_invoice_id uuid;
  v_amount numeric;
  v_method text;
  v_date date;
  v_reference text;
  v_request_id text;
  v_invoice jsonb;
  v_contract jsonb;
  v_total_due numeric;
  v_paid_amount numeric;
  v_outstanding numeric;
  v_receipt_id uuid := gen_random_uuid();
  v_allocation_id uuid := gen_random_uuid();
  v_payment_id uuid := gen_random_uuid();
  v_debit_account_id text;
  v_credit_account_id text;
  v_internal_payload jsonb;
  v_internal_result jsonb;
  v_existing_result jsonb;
  v_payment_columns text[];
  v_payment_insert_columns text;
  v_payment_insert_values text;
  v_result jsonb;
BEGIN
  actor_id := auth.uid();
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to record invoice payments';
  END IF;

  IF NOT coalesce(public.is_admin_or_manager(), false) THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to record invoice payments'
      USING errcode = '42501';
  END IF;

  v_request_id := nullif(payload->>'request_id', '');
  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'request_id is required for idempotent payment recording';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'record_invoice_payment_atomic:' || v_request_id,
      0
    )
  );

  SELECT response_payload
    INTO v_existing_result
  FROM public.financial_operation_idempotency
  WHERE operation_name = 'record_invoice_payment_atomic'
    AND request_id = v_request_id
  FOR UPDATE;

  IF v_existing_result IS NOT NULL THEN
    RETURN v_existing_result;
  END IF;

  -- Validate invoice_id format before casting to avoid cryptic Postgres cast errors
  v_invoice_id_raw := nullif(payload->>'invoice_id', '');
  IF v_invoice_id_raw IS NULL THEN
    RAISE EXCEPTION 'invoice_id is required';
  END IF;
  IF v_invoice_id_raw !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'invoice_id is not a valid identifier: %', v_invoice_id_raw;
  END IF;
  v_invoice_id := v_invoice_id_raw::uuid;

  v_amount := coalesce((payload->>'amount')::numeric, 0);
  v_method := nullif(payload->>'method', '');
  v_date := coalesce(nullif(payload->>'date', '')::date, current_date);
  v_reference := nullif(payload->>'reference', '');

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  SELECT to_jsonb(i)
    INTO v_invoice
  FROM public.invoices i
  WHERE i.id = v_invoice_id::text
    AND coalesce((to_jsonb(i)->>'deleted_at')::timestamptz, NULL) IS NULL
  FOR UPDATE;

  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  SELECT to_jsonb(c)
    INTO v_contract
  FROM public.contracts c
  WHERE c.id = (v_invoice->>'contract_id')
    AND coalesce((to_jsonb(c)->>'deleted_at')::timestamptz, NULL) IS NULL
  FOR UPDATE;

  IF v_contract IS NULL THEN
    RAISE EXCEPTION 'Contract for invoice not found';
  END IF;

  v_total_due := coalesce((v_invoice->>'amount')::numeric, 0) + coalesce((v_invoice->>'tax_amount')::numeric, 0);
  v_paid_amount := coalesce((v_invoice->>'paid_amount')::numeric, 0);
  v_outstanding := v_total_due - v_paid_amount;

  IF v_amount > v_outstanding + 0.001 THEN
    RAISE EXCEPTION 'Payment amount exceeds outstanding invoice balance';
  END IF;

  v_debit_account_id := public.find_payment_account_id('cash');
  v_credit_account_id := public.find_payment_account_id('receivable');

  IF v_debit_account_id IS NULL OR v_credit_account_id IS NULL THEN
    RAISE EXCEPTION 'Payment accounting accounts are not configured';
  END IF;

  v_internal_payload := jsonb_build_object(
    'request_id', v_request_id,
    'receipt', jsonb_build_object(
      'id', v_receipt_id,
      'contract_id', v_invoice->>'contract_id',
      'date_time', v_date::text,
      'channel', v_method,
      'amount', v_amount,
      'ref', coalesce(v_reference, v_request_id),
      'notes', 'Invoice payment ' || v_invoice_id::text,
      'status', 'POSTED',
      'created_at', timezone('utc', now()),
      'request_id', v_request_id
    ),
    'allocations', jsonb_build_array(jsonb_build_object(
      'id', v_allocation_id,
      'invoice_id', v_invoice_id,
      'amount', v_amount,
      'created_at', timezone('utc', now())
    )),
    'journal_entries', jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'PAY-' || left(replace(v_request_id, '-', ''), 12) || '-D',
        'date', v_date::text,
        'account_id', v_debit_account_id,
        'amount', v_amount,
        'type', 'DEBIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice->>'contract_id',
        'created_at', timezone('utc', now())
      ),
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'PAY-' || left(replace(v_request_id, '-', ''), 12) || '-C',
        'date', v_date::text,
        'account_id', v_credit_account_id,
        'amount', v_amount,
        'type', 'CREDIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice->>'contract_id',
        'created_at', timezone('utc', now())
      )
    )
  );

  v_internal_result := public.post_receipt_atomic(v_internal_payload);
  v_payment_id := coalesce(nullif(v_internal_result->>'payment_id', '')::uuid, v_payment_id);

  IF v_internal_result ? 'payment_id' THEN
    v_payment_id := (v_internal_result->>'payment_id')::uuid;
  ELSE
    SELECT array_agg(column_name ORDER BY ordinal_position)
      INTO v_payment_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payments'
      AND column_name IN ('id', 'invoice_id', 'amount', 'payment_method', 'payment_date', 'reference_number', 'payment_reference');

    v_payment_insert_columns := array_to_string(v_payment_columns, ', ');
    v_payment_insert_values := array_to_string(array(
      SELECT CASE column_name
        WHEN 'id' THEN quote_literal(v_payment_id)
        WHEN 'invoice_id' THEN quote_literal(v_invoice_id)
        WHEN 'amount' THEN quote_literal(round(v_amount, 2))
        WHEN 'payment_method' THEN quote_literal(v_method)
        WHEN 'payment_date' THEN quote_literal(v_date)
        WHEN 'reference_number' THEN quote_nullable(v_reference)
        WHEN 'payment_reference' THEN quote_nullable(v_reference)
      END
      FROM unnest(v_payment_columns) AS column_name
    ), ', ');

    EXECUTE format('INSERT INTO public.payments (%s) VALUES (%s)', v_payment_insert_columns, v_payment_insert_values);
  END IF;

  v_result := coalesce(v_internal_result, '{}'::jsonb)
    || jsonb_build_object(
      'status', 'recorded',
      'request_id', v_request_id,
      'invoice_id', v_invoice_id,
      'payment_id', v_payment_id,
      'receipt_id', coalesce(nullif(v_internal_result->>'receipt_id', '')::uuid, v_receipt_id)
    );

  INSERT INTO public.financial_operation_idempotency(operation_name, request_id, response_payload)
  VALUES ('record_invoice_payment_atomic', v_request_id, v_result)
  ON CONFLICT (operation_name, request_id) DO NOTHING;

  RETURN v_result;
END;
$function$;

-- Preserve grants (unchanged from prior hardening)
REVOKE ALL ON FUNCTION public.record_invoice_payment_atomic(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment_atomic(jsonb) TO authenticated, service_role;

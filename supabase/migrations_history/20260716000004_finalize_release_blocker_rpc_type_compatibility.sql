-- Finalize launch-critical RPC compatibility across the two repository-backed
-- identifier layouts:
--   * clean baseline identifiers stored as uuid;
--   * historical production identifiers stored as text UUID strings.
--
-- Public signatures remain unchanged. Internally, create_contract_atomic uses
-- target-column %TYPE variables, while record_invoice_payment_atomic compares
-- JSON/UUID identifiers through explicit text representations.

CREATE OR REPLACE FUNCTION public.create_contract_atomic(
  p_property_id text,
  p_unit_id uuid,
  p_tenant_id uuid,
  p_agreement_id uuid,
  p_start_date date,
  p_end_date date,
  p_rent_amount numeric,
  p_payment_cycle text,
  p_payment_terms_id uuid,
  p_status text,
  p_cancellation_reason text,
  p_notes text,
  p_attachment_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_contract_id public.contracts.id%TYPE;
  v_property_id public.contracts.property_id%TYPE;
  v_unit_id public.contracts.unit_id%TYPE;
  v_tenant_id public.contracts.tenant_id%TYPE;
  v_agreement_id public.contracts.agreement_id%TYPE;
  v_payment_terms_id public.contracts.payment_terms_id%TYPE;
  v_start_date public.contracts.start_date%TYPE;
  v_end_date public.contracts.end_date%TYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنشاء عقد'
      USING ERRCODE = '42501';
  END IF;

  v_property_id := p_property_id;
  v_unit_id := p_unit_id;
  v_tenant_id := p_tenant_id;
  v_agreement_id := p_agreement_id;
  v_payment_terms_id := p_payment_terms_id;
  v_start_date := p_start_date;
  v_end_date := p_end_date;

  IF NOT EXISTS (
    SELECT 1
    FROM public.people AS person_record
    WHERE person_record.id::text = v_tenant_id::text
      AND person_record.type = 'tenant'
      AND person_record.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'المستأجر غير موجود أو نوعه غير صحيح';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.properties AS property_record
    WHERE property_record.id::text = v_property_id::text
      AND property_record.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'العقار غير موجود';
  END IF;

  IF v_unit_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.units AS unit_record
    WHERE unit_record.id::text = v_unit_id::text
      AND unit_record.property_id::text = v_property_id::text
      AND unit_record.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'الوحدة لا تنتمي إلى العقار المحدد';
  END IF;

  IF v_unit_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.contracts AS contract_record
    WHERE contract_record.unit_id::text = v_unit_id::text
      AND contract_record.deleted_at IS NULL
      AND lower(contract_record.status) IN ('active', 'draft')
      AND nullif(contract_record.start_date::text, '')::date < p_end_date
      AND nullif(contract_record.end_date::text, '')::date > p_start_date
  ) THEN
    RAISE EXCEPTION 'الوحدة محجوزة خلال هذه الفترة';
  END IF;

  IF v_agreement_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد اتفاقية مالك نشطة تغطي فترة العقد — أنشئ اتفاقية مالك أولاً';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.owner_agreements AS agreement_record
    WHERE agreement_record.id::text = v_agreement_id::text
      AND agreement_record.property_id::text = v_property_id::text
      AND agreement_record.starts_on <= p_start_date
      AND (agreement_record.ends_on IS NULL OR agreement_record.ends_on >= p_end_date)
  ) THEN
    RAISE EXCEPTION 'اتفاقية المالك لا تغطي فترة العقد بالكامل أو لا تنتمي لهذا العقار';
  END IF;

  INSERT INTO public.contracts (
    property_id,
    unit_id,
    tenant_id,
    agreement_id,
    start_date,
    end_date,
    rent_amount,
    payment_cycle,
    payment_terms_id,
    status,
    cancellation_reason,
    notes,
    attachment_url
  ) VALUES (
    v_property_id,
    v_unit_id,
    v_tenant_id,
    v_agreement_id,
    v_start_date,
    v_end_date,
    p_rent_amount,
    p_payment_cycle,
    v_payment_terms_id,
    p_status,
    p_cancellation_reason,
    p_notes,
    p_attachment_url
  )
  RETURNING id INTO v_contract_id;

  RETURN (
    SELECT to_jsonb(contract_record)
    FROM public.contracts AS contract_record
    WHERE contract_record.id::text = v_contract_id::text
  );
END;
$function$;

ALTER FUNCTION public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text)
  TO authenticated, service_role;

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
  v_payment_id uuid := gen_random_uuid();
  v_receipt_id uuid := v_payment_id;
  v_allocation_id uuid := gen_random_uuid();
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
      USING ERRCODE = '42501';
  END IF;

  v_request_id := nullif(payload->>'request_id', '');
  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'request_id is required for idempotent payment recording';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('record_invoice_payment_atomic:' || v_request_id, 0)
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

  SELECT to_jsonb(invoice_record)
    INTO v_invoice
  FROM public.invoices AS invoice_record
  WHERE invoice_record.id::text = v_invoice_id::text
    AND coalesce((to_jsonb(invoice_record)->>'deleted_at')::timestamptz, NULL) IS NULL
  FOR UPDATE;

  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  SELECT to_jsonb(contract_record)
    INTO v_contract
  FROM public.contracts AS contract_record
  WHERE contract_record.id::text = (v_invoice->>'contract_id')
    AND coalesce((to_jsonb(contract_record)->>'deleted_at')::timestamptz, NULL) IS NULL
  FOR UPDATE;

  IF v_contract IS NULL THEN
    RAISE EXCEPTION 'Contract for invoice not found';
  END IF;

  v_total_due := coalesce((v_invoice->>'amount')::numeric, 0)
    + coalesce((v_invoice->>'tax_amount')::numeric, 0);
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
  v_payment_id := coalesce(
    nullif(v_internal_result->>'payment_id', '')::uuid,
    v_payment_id
  );

  IF v_internal_result ? 'payment_id' THEN
    v_payment_id := (v_internal_result->>'payment_id')::uuid;
  ELSE
    SELECT array_agg(column_name ORDER BY ordinal_position)
      INTO v_payment_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payments'
      AND column_name IN (
        'id',
        'invoice_id',
        'contract_id',
        'amount',
        'payment_method',
        'payment_date',
        'reference_number',
        'payment_reference',
        'status',
        'receipt_id'
      );

    v_payment_insert_columns := array_to_string(v_payment_columns, ', ');
    v_payment_insert_values := array_to_string(array(
      SELECT CASE column_name
        WHEN 'id' THEN quote_literal(v_payment_id)
        WHEN 'invoice_id' THEN quote_literal(v_invoice_id)
        WHEN 'contract_id' THEN quote_literal(v_invoice->>'contract_id')
        WHEN 'amount' THEN quote_literal(round(v_amount, 2))
        WHEN 'payment_method' THEN quote_literal(v_method)
        WHEN 'payment_date' THEN quote_literal(v_date)
        WHEN 'reference_number' THEN quote_nullable(v_reference)
        WHEN 'payment_reference' THEN quote_nullable(v_reference)
        WHEN 'status' THEN quote_literal('POSTED')
        WHEN 'receipt_id' THEN quote_literal(v_receipt_id)
      END
      FROM unnest(v_payment_columns) AS column_name
    ), ', ');

    EXECUTE format(
      'INSERT INTO public.payments (%s) VALUES (%s)',
      v_payment_insert_columns,
      v_payment_insert_values
    );
  END IF;

  v_result := coalesce(v_internal_result, '{}'::jsonb)
    || jsonb_build_object(
      'status', 'recorded',
      'request_id', v_request_id,
      'invoice_id', v_invoice_id,
      'payment_id', v_payment_id,
      'receipt_id', coalesce(
        nullif(v_internal_result->>'receipt_id', '')::uuid,
        v_receipt_id
      )
    );

  INSERT INTO public.financial_operation_idempotency(
    operation_name,
    request_id,
    response_payload
  ) VALUES (
    'record_invoice_payment_atomic',
    v_request_id,
    v_result
  )
  ON CONFLICT (operation_name, request_id) DO NOTHING;

  RETURN v_result;
END;
$function$;

ALTER FUNCTION public.record_invoice_payment_atomic(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.record_invoice_payment_atomic(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment_atomic(jsonb)
  TO authenticated, service_role;

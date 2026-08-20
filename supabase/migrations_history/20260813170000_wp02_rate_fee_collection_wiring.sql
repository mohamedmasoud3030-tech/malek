-- WP-02 / GAP-006: wire actual invoice collection to frozen owner-agency RATE terms.
-- The payment RPC resolves agreement terms server-side and posts collection plus
-- management fee in one receipt-owned GL batch so the canonical VOID reversal
-- reverses the complete economic event.
--
-- Tax remains governed by WP-02/GAP-010; this slice recognizes the configured
-- net management fee only and does not invent a statutory rate.

begin;

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
  v_debit_account_id text;
  v_credit_account_id text;
  v_internal_payload jsonb;
  v_internal_result jsonb;
  v_existing_result jsonb;
  v_result jsonb;
  v_company_id uuid;
  v_request_fingerprint text;
  v_cached_fingerprint text;
  v_cached_target_id text;
  v_operating_model text;
  v_collection_role text;
  v_commission_type text;
  v_commission_value numeric;
  v_commission_net numeric := 0;
  v_owner_payable_account_id text;
  v_fee_revenue_account_id text;
  v_journal_entries jsonb;
BEGIN
  actor_id := auth.uid();
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to record invoice payments';
  END IF;

  IF NOT coalesce(public.is_admin_or_manager(), false) THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to record invoice payments'
      USING ERRCODE = '42501';
  END IF;

  -- P0 (F-WR): bind the operation to the caller's company.
  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company context is required (no company_id claim in JWT).' USING ERRCODE = '42501';
  END IF;

  v_request_id := nullif(payload->>'request_id', '');
  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'request_id is required for idempotent payment recording';
  END IF;

  -- Parse and validate the immutable logical request before considering replay.
  v_invoice_id_raw := nullif(payload->>'invoice_id', '');
  IF v_invoice_id_raw IS NULL THEN
    RAISE EXCEPTION 'invoice_id is required';
  END IF;

  IF v_invoice_id_raw !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'invoice_id is not a valid identifier: %', v_invoice_id_raw;
  END IF;

  v_invoice_id := v_invoice_id_raw::uuid;
  v_amount := coalesce((payload->>'amount')::numeric, 0);
  v_method := coalesce(nullif(payload->>'method', ''), nullif(payload->>'channel', ''), nullif(payload->>'payment_method', ''), 'cash');
  v_date := coalesce(nullif(payload->>'date', '')::date, current_date);
  v_reference := nullif(payload->>'reference', '');

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  v_request_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'invoice_id', v_invoice_id::text,
    'amount', trim_scale(v_amount),
    'method', v_method,
    -- Preserve omission as NULL: current_date is an execution default, not part
    -- of the immutable client request.
    'date', nullif(payload->>'date', '')::date,
    'reference', v_reference
  )::text, 'UTF8')), 'hex');

  PERFORM pg_advisory_xact_lock(
    hashtextextended('record_invoice_payment_atomic:' || v_company_id::text || ':' || v_request_id, 0)
  );

  SELECT response_payload
    INTO v_existing_result
  FROM public.financial_operation_idempotency
  WHERE operation_name = 'record_invoice_payment_atomic:' || v_company_id::text
    AND request_id = v_request_id
  FOR UPDATE;

  IF v_existing_result IS NOT NULL THEN
    v_cached_fingerprint := v_existing_result->>'_request_fingerprint';
    v_cached_target_id := v_existing_result->>'_target_id';
    IF v_cached_fingerprint IS NULL
       OR v_cached_target_id IS NULL
       OR NOT (v_existing_result ? 'response') THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED'
        USING ERRCODE = '22023';
    END IF;
    IF v_cached_fingerprint <> v_request_fingerprint
       OR v_cached_target_id <> v_invoice_id::text THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST'
        USING ERRCODE = '22023';
    END IF;
    RETURN v_existing_result->'response';
  END IF;

  SELECT to_jsonb(invoice_record)
    INTO v_invoice
  FROM public.invoices AS invoice_record
  WHERE invoice_record.id::text = v_invoice_id::text
    AND coalesce((to_jsonb(invoice_record)->>'deleted_at')::timestamptz, NULL) IS NULL
    AND coalesce(to_jsonb(invoice_record)->>'company_id', '') = v_company_id::text
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

  -- WP-02: resolve the immutable agreement snapshot server-side. Browser
  -- payloads never choose the accounting model, collection role or fee rate.
  SELECT version_record.operating_model,
         version_record.collection_role,
         version_record.commission_type,
         version_record.commission_value
    INTO v_operating_model,
         v_collection_role,
         v_commission_type,
         v_commission_value
  FROM public.owner_agreement_versions AS version_record
  WHERE version_record.id::text = nullif(v_contract->>'agreement_version_id', '')
    AND version_record.company_id = v_company_id;

  IF coalesce(v_contract->>'operating_model_snapshot', '') = 'OWNER_AGENCY'
     AND v_operating_model IS NULL THEN
    RAISE EXCEPTION 'OWNER_AGENCY_COLLECTION_TERMS_MISSING'
      USING ERRCODE = '23514';
  END IF;

  IF v_operating_model = 'OWNER_AGENCY'
     AND v_commission_type = 'RATE' THEN
    IF v_collection_role NOT IN ('OWNER_IS_CREDITOR', 'OFFICE_IS_CREDITOR')
       OR v_commission_value IS NULL
       OR v_commission_value < 0
       OR v_commission_value > 100 THEN
      RAISE EXCEPTION 'OWNER_AGENCY_RATE_TERMS_INVALID'
        USING ERRCODE = '23514';
    END IF;
    v_commission_net := round(v_amount * v_commission_value / 100, 3);
  END IF;

  v_total_due := coalesce((v_invoice->>'amount')::numeric, 0)
    + coalesce((v_invoice->>'tax_amount')::numeric, 0);
  v_paid_amount := coalesce((v_invoice->>'paid_amount')::numeric, 0);
  v_outstanding := v_total_due - v_paid_amount;

  IF v_amount > v_outstanding + 0.001 THEN
    RAISE EXCEPTION 'Payment amount exceeds outstanding invoice balance';
  END IF;

  v_debit_account_id := public.find_payment_account_id('cash');

  IF v_operating_model = 'OWNER_AGENCY'
     AND v_collection_role = 'OWNER_IS_CREDITOR' THEN
    v_credit_account_id := public.require_company_account_id(v_company_id, '2000');
  ELSE
    v_credit_account_id := public.find_payment_account_id('receivable');
  END IF;

  IF v_commission_net > 0 THEN
    v_owner_payable_account_id := public.require_company_account_id(v_company_id, '2000');
    v_fee_revenue_account_id := public.require_company_account_id(v_company_id, '4100');
  END IF;

  IF v_debit_account_id IS NULL OR v_credit_account_id IS NULL THEN
    RAISE EXCEPTION 'Payment accounting accounts are not configured';
  END IF;

  -- Keep collection and RATE-fee recognition in the same canonical receipt
  -- batch. The existing receipt VOID reversal therefore reverses both effects.
  v_journal_entries := jsonb_build_array(
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
  );

  IF v_commission_net > 0 THEN
    v_journal_entries := v_journal_entries || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'FEE-' || left(replace(v_request_id, '-', ''), 12) || '-D',
        'date', v_date::text,
        'account_id', v_owner_payable_account_id,
        'amount', v_commission_net,
        'type', 'DEBIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice->>'contract_id',
        'created_at', timezone('utc', now())
      ),
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'FEE-' || left(replace(v_request_id, '-', ''), 12) || '-C',
        'date', v_date::text,
        'account_id', v_fee_revenue_account_id,
        'amount', v_commission_net,
        'type', 'CREDIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice->>'contract_id',
        'created_at', timezone('utc', now())
      )
    );
  END IF;

  -- Delegate fully to post_receipt_atomic — it now creates payments row automatically
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
    'journal_entries', v_journal_entries
  );

  v_internal_result := public.post_receipt_atomic(v_internal_payload);

  v_result := v_internal_result || jsonb_build_object(
    'status', 'recorded',
    'request_id', v_request_id,
    'invoice_id', v_invoice_id,
    'receipt_id', coalesce(
      nullif(v_internal_result->>'receipt_id', '')::uuid,
      v_receipt_id
    ),
    'accounting_model', coalesce(v_operating_model, 'STANDARD'),
    'collection_role', v_collection_role,
    'management_fee_net', v_commission_net
  );

  INSERT INTO public.financial_operation_idempotency(
    operation_name,
    request_id,
    response_payload
  ) VALUES (
    'record_invoice_payment_atomic:' || v_company_id::text,
    v_request_id,
    jsonb_build_object(
      '_request_fingerprint', v_request_fingerprint,
      '_target_id', v_invoice_id::text,
      'response', v_result
    )
  )
  ON CONFLICT (operation_name, request_id) DO NOTHING;

  RETURN v_result;
END;
$function$;

comment on function public.record_invoice_payment_atomic(jsonb) is
  'WP-02 collection authority: resolves frozen owner-agency collection role and RATE terms server-side; posts collection and net fee in the same reversible receipt GL batch.';

commit;

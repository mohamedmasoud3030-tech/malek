-- Fix (v2): post_receipt_atomic never inserted a row into public.payments,
-- and never returned a payment_id in its result.
--
-- Consequences of the missing payments row:
--   1. void_receipt_atomic requires a matching public.payments row (joined via
--      receipt_id) and raises "Linked payment and receipt were not found" for
--      any receipt posted directly through post_receipt_atomic (no payments
--      row ever existed for it).
--   2. rpt_owner_statement reads exclusively from public.payments, so owner
--      statements never reflected such collections.
--   3. trigger_update_owner_balance_on_payment only fires on public.payments
--      writes, so owner balances were never updated for such receipts.
--
-- v1 of this fix (reverted) added the payments insert but caused a real
-- regression: record_invoice_payment_atomic (the wrapper actually used by
-- release_blockers.sql and, per its own code, apparently the primary path)
-- calls post_receipt_atomic internally, then checks
-- `IF v_internal_result ? 'payment_id'` — if absent, it does its OWN
-- dynamic INSERT into public.payments as a fallback. Since post_receipt_atomic
-- never returned payment_id, that fallback always fired, and v1 additionally
-- inserting into payments produced a DUPLICATE payments row for every
-- record_invoice_payment_atomic call. CI (release-blocker-database) caught
-- this via the owner_balances assertions (total_income/commission checks)
-- diverging from expected totals.
--
-- v2 fix: post_receipt_atomic inserts exactly one payments row (as before)
-- AND returns 'payment_id' in its result. This makes
-- record_invoice_payment_atomic's existing `IF v_internal_result ? 'payment_id'`
-- branch take the "use the internal result" path instead of its fallback
-- insert, eliminating the duplicate-insert risk entirely — no change to
-- record_invoice_payment_atomic itself is required.
--
-- No signature change, so no DROP FUNCTION needed.

CREATE OR REPLACE FUNCTION public.post_receipt_atomic(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_receipt jsonb;
  v_allocations jsonb;
  v_journal_entries jsonb;
  v_request_id text;
  v_existing_id public.receipts.id%TYPE;
  v_invoice_id_text text;
  v_invoice record;
  v_allocation_total numeric;

  v_receipt_id public.receipts.id%TYPE;
  v_receipt_contract_id public.receipts.contract_id%TYPE;
  v_receipt_date_time public.receipts.date_time%TYPE;
  v_receipt_tenant_id public.receipts.tenant_id%TYPE;
  v_receipt_check_date public.receipts.check_date%TYPE;

  v_allocation jsonb;
  v_allocation_id public.receipt_allocations.id%TYPE;
  v_allocation_receipt_id public.receipt_allocations.receipt_id%TYPE;
  v_allocation_invoice_id public.receipt_allocations.invoice_id%TYPE;
  v_allocation_tenant_id public.receipt_allocations.tenant_id%TYPE;

  v_journal jsonb;
  v_journal_id public.journal_entries.id%TYPE;
  v_journal_date public.journal_entries.date%TYPE;
  v_journal_source_id public.journal_entries.source_id%TYPE;

  v_first_invoice_id text;
  v_payment_id uuid;
  v_payment_amount numeric;
  v_payment_date date;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS app_user
    WHERE app_user.id = auth.uid()
      AND app_user.role::text IN ('ADMIN', 'MANAGER')
      AND app_user.status::text = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول'
      USING ERRCODE = '42501';
  END IF;

  v_receipt := coalesce(payload->'receipt', '{}'::jsonb);
  v_allocations := coalesce(payload->'allocations', '[]'::jsonb);
  v_journal_entries := coalesce(payload->'journal_entries', '[]'::jsonb);
  v_request_id := nullif(coalesce(payload->>'request_id', v_receipt->>'request_id'), '');

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'معرّف الطلب مطلوب لضمان عدم التكرار.';
  END IF;

  SELECT receipt_record.id
    INTO v_existing_id
  FROM public.receipts AS receipt_record
  WHERE receipt_record.request_id = v_request_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Idempotent replay: surface the payment_id linked to the existing
    -- receipt too, so callers relying on it (e.g. record_invoice_payment_atomic)
    -- don't take a fallback path on retries.
    SELECT p.id
      INTO v_payment_id
    FROM public.payments AS p
    WHERE p.receipt_id::text = v_existing_id::text
    ORDER BY p.created_at DESC NULLS LAST
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'request_id', v_request_id,
      'receipt_id', v_existing_id,
      'payment_id', v_payment_id
    );
  END IF;

  FOR v_invoice_id_text IN
    SELECT DISTINCT allocation_record.value->>'invoice_id'
    FROM jsonb_array_elements(v_allocations) AS allocation_record(value)
    ORDER BY 1
  LOOP
    SELECT
      invoice_record.id,
      invoice_record.amount,
      invoice_record.tax_amount,
      invoice_record.paid_amount,
      invoice_record.status
    INTO v_invoice
    FROM public.invoices AS invoice_record
    WHERE invoice_record.id::text = v_invoice_id_text
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'فاتورة غير موجودة: %', v_invoice_id_text;
    END IF;

    SELECT sum((allocation_record->>'amount')::numeric)
      INTO v_allocation_total
    FROM jsonb_array_elements(v_allocations) AS allocation_record
    WHERE allocation_record->>'invoice_id' = v_invoice_id_text;

    IF coalesce(v_invoice.paid_amount, 0) + v_allocation_total
         > coalesce(v_invoice.amount, 0) + coalesce(v_invoice.tax_amount, 0) + 0.001 THEN
      RAISE EXCEPTION 'قيمة السداد تتجاوز المتبقي على الفاتورة: %', v_invoice_id_text;
    END IF;
  END LOOP;

  v_receipt_id := coalesce(v_receipt->>'id', gen_random_uuid()::text);
  v_receipt_contract_id := nullif(v_receipt->>'contract_id', '');
  v_receipt_tenant_id := nullif(v_receipt->>'tenant_id', '');
  v_receipt_check_date := nullif(v_receipt->>'check_date', '');

  IF nullif(v_receipt->>'date_time', '') IS NULL THEN
    v_receipt_date_time := now();
  ELSE
    v_receipt_date_time := v_receipt->>'date_time';
  END IF;

  INSERT INTO public.receipts(
    id,
    no,
    contract_id,
    date_time,
    channel,
    amount,
    ref,
    notes,
    status,
    check_number,
    check_bank,
    check_date,
    check_status,
    created_at,
    request_id,
    tenant_id
  ) VALUES (
    v_receipt_id,
    v_receipt->>'no',
    v_receipt_contract_id,
    v_receipt_date_time,
    v_receipt->>'channel',
    (v_receipt->>'amount')::numeric,
    coalesce(v_receipt->>'ref', ''),
    coalesce(v_receipt->>'notes', ''),
    coalesce(v_receipt->>'status', 'POSTED'),
    nullif(v_receipt->>'check_number', ''),
    nullif(v_receipt->>'check_bank', ''),
    v_receipt_check_date,
    nullif(v_receipt->>'check_status', ''),
    now(),
    v_request_id,
    v_receipt_tenant_id
  );

  FOR v_allocation IN
    SELECT allocation_record.value
    FROM jsonb_array_elements(v_allocations) AS allocation_record(value)
  LOOP
    v_allocation_id := coalesce(v_allocation->>'id', gen_random_uuid()::text);
    v_allocation_receipt_id := v_receipt_id;
    v_allocation_invoice_id := v_allocation->>'invoice_id';
    v_allocation_tenant_id := nullif(v_allocation->>'tenant_id', '');

    INSERT INTO public.receipt_allocations(
      id,
      receipt_id,
      invoice_id,
      amount,
      created_at,
      tenant_id
    ) VALUES (
      v_allocation_id,
      v_allocation_receipt_id,
      v_allocation_invoice_id,
      (v_allocation->>'amount')::numeric,
      now(),
      v_allocation_tenant_id
    );
  END LOOP;

  WITH allocation_totals AS (
    SELECT
      allocation_record->>'invoice_id' AS invoice_id,
      sum((allocation_record->>'amount')::numeric) AS total
    FROM jsonb_array_elements(v_allocations) AS allocation_record
    GROUP BY 1
  )
  UPDATE public.invoices AS invoice_record
  SET
    paid_amount = coalesce(invoice_record.paid_amount, 0) + allocation_totals.total,
    status = CASE
      WHEN coalesce(invoice_record.paid_amount, 0) + allocation_totals.total
        >= coalesce(invoice_record.amount, 0) + coalesce(invoice_record.tax_amount, 0) - 0.001
        THEN 'PAID'
      WHEN coalesce(invoice_record.paid_amount, 0) + allocation_totals.total > 0
        THEN 'PARTIALLY_PAID'
      ELSE invoice_record.status
    END
  FROM allocation_totals
  WHERE invoice_record.id::text = allocation_totals.invoice_id;

  FOR v_journal IN
    SELECT journal_record.value
    FROM jsonb_array_elements(v_journal_entries) AS journal_record(value)
  LOOP
    v_journal_id := coalesce(v_journal->>'id', gen_random_uuid()::text);
    v_journal_date := v_journal->>'date';
    v_journal_source_id := nullif(v_journal->>'source_id', '');

    INSERT INTO public.journal_entries(
      id,
      no,
      date,
      account_id,
      amount,
      type,
      source_id,
      entity_type,
      entity_id,
      created_at
    ) VALUES (
      v_journal_id,
      v_journal->>'no',
      v_journal_date,
      v_journal->>'account_id',
      (v_journal->>'amount')::numeric,
      v_journal->>'type',
      v_journal_source_id,
      nullif(v_journal->>'entity_type', ''),
      nullif(v_journal->>'entity_id', ''),
      now()
    );
  END LOOP;

  -- Sync a public.payments row so that void_receipt_atomic, rpt_owner_statement,
  -- and the owner-balance trigger all have the record they depend on. Return
  -- payment_id so record_invoice_payment_atomic's existing
  -- `IF v_internal_result ? 'payment_id'` branch uses this row instead of
  -- inserting a second, duplicate payments row itself.
  SELECT allocation_record.value->>'invoice_id'
    INTO v_first_invoice_id
  FROM jsonb_array_elements(v_allocations) AS allocation_record(value)
  ORDER BY (allocation_record.value->>'invoice_id')
  LIMIT 1;

  v_payment_id := gen_random_uuid();
  v_payment_amount := (v_receipt->>'amount')::numeric;
  v_payment_date := coalesce(
    nullif(v_receipt->>'date_time', '')::date,
    current_date
  );

  INSERT INTO public.payments(
    id,
    contract_id,
    invoice_id,
    receipt_id,
    amount,
    payment_date,
    payment_method,
    channel,
    date_time,
    status,
    notes,
    reference_no,
    reference_number,
    created_at
  ) VALUES (
    v_payment_id,
    v_receipt_contract_id,
    v_first_invoice_id,
    v_receipt_id,
    v_payment_amount,
    v_payment_date,
    v_receipt->>'channel',
    v_receipt->>'channel',
    v_receipt_date_time,
    coalesce(v_receipt->>'status', 'POSTED'),
    coalesce(v_receipt->>'notes', ''),
    v_receipt->>'ref',
    v_receipt->>'ref',
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'request_id', v_request_id,
    'receipt_id', v_receipt_id,
    'payment_id', v_payment_id
  );
END;
$function$
;

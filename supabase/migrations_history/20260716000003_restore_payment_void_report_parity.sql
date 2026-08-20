-- Financial safety lock: restore payment-backed collection reporting and make
-- payment/receipt voiding complete, atomic, auditable, and permission-aligned.
--
-- Live read-only verification on 2026-07-14 found that:
--   1. rpt_daily_collection(date,date) had drifted back to public.receipts even
--      though payments are the canonical collection source.
--   2. void_receipt_atomic(jsonb) had lost payment-id resolution.
--   3. the frontend passed no reverse journal entries, so a void could leave the
--      original collection journal posted without a balancing reversal.
--
-- This is a forward-only repair. Historical migrations remain immutable.

DROP FUNCTION IF EXISTS public.rpt_daily_collection(date, date);

CREATE FUNCTION public.rpt_daily_collection(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rows jsonb;
  v_total numeric := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_app_user(), false) THEN
    RAISE EXCEPTION 'Authenticated app user is required to run daily collection reports.'
      USING ERRCODE = '42501';
  END IF;

  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'A valid report date range is required.'
      USING ERRCODE = '22023';
  END IF;

  WITH reportable_payments AS (
    SELECT
      coalesce(p.payment_date, public._safe_date(p.date_time)) AS collection_date,
      upper(coalesce(nullif(p.payment_method, ''), nullif(p.channel, ''), 'OTHER')) AS method,
      coalesce(p.amount, 0)::numeric AS amount
    FROM public.payments p
    WHERE p.deleted_at IS NULL
      AND upper(coalesce(p.status, 'POSTED')) <> 'VOID'
      AND coalesce(p.payment_date, public._safe_date(p.date_time)) BETWEEN p_from AND p_to
  ), daily AS (
    SELECT
      collection_date,
      sum(amount)::numeric AS day_total,
      sum(amount) FILTER (WHERE method = 'CASH')::numeric AS cash,
      sum(amount) FILTER (WHERE method IN ('BANK', 'BANK_TRANSFER'))::numeric AS bank,
      sum(amount) FILTER (WHERE method IN ('POS', 'CARD'))::numeric AS pos,
      sum(amount) FILTER (
        WHERE method NOT IN ('CASH', 'BANK', 'BANK_TRANSFER', 'POS', 'CARD')
      )::numeric AS other,
      count(*)::bigint AS payments_count
    FROM reportable_payments
    GROUP BY collection_date
  )
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'date', collection_date::text,
        'total', public._r3(day_total),
        'cash', public._r3(coalesce(cash, 0)),
        'bank', public._r3(coalesce(bank, 0)),
        'pos', public._r3(coalesce(pos, 0)),
        'other', public._r3(coalesce(other, 0)),
        'count', payments_count
      )
      ORDER BY collection_date
    ),
    public._r3(coalesce(sum(day_total), 0))
  INTO v_rows, v_total
  FROM daily;

  RETURN jsonb_build_object(
    'rows', coalesce(v_rows, '[]'::jsonb),
    'total', coalesce(v_total, 0),
    'from', p_from,
    'to', p_to,
    'source', 'payments'
  );
END;
$function$;

ALTER FUNCTION public.rpt_daily_collection(date, date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpt_daily_collection(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpt_daily_collection(date, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.void_receipt_atomic(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_requested_id text := nullif(btrim(payload->>'receipt_id'), '');
  v_reason text := nullif(btrim(payload->>'reason'), '');
  v_request_id text := nullif(btrim(payload->>'request_id'), '');
  v_cached jsonb;
  v_payment public.payments%rowtype;
  v_receipt public.receipts%rowtype;
  v_receipt_was_void boolean := false;
  v_reversal_request_id text;
  v_reversal_batch_id uuid;
  v_original_count integer := 0;
  v_existing_reversal_count integer := 0;
  v_created_reversal_count integer := 0;
  v_original_debits numeric := 0;
  v_original_credits numeric := 0;
  v_result jsonb;
BEGIN
  IF v_actor_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = v_actor_id
      AND u.status::text = 'ACTIVE'
      AND u.role::text IN ('ADMIN', 'MANAGER')
  ) THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to void receipts.'
      USING ERRCODE = '42501';
  END IF;

  IF v_requested_id IS NULL OR v_reason IS NULL OR v_request_id IS NULL THEN
    RAISE EXCEPTION 'receipt_id, reason, and request_id are required.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('void_receipt_atomic:' || v_request_id, 0)
  );

  SELECT response_payload
  INTO v_cached
  FROM public.financial_operation_idempotency
  WHERE operation_name = 'void_receipt_atomic'
    AND request_id = v_request_id
  FOR UPDATE;

  IF v_cached IS NOT NULL THEN
    RETURN v_cached || jsonb_build_object('idempotent', true);
  END IF;

  SELECT p.*
  INTO v_payment
  FROM public.payments p
  WHERE p.id::text = v_requested_id
    AND p.deleted_at IS NULL
  FOR UPDATE;

  IF v_payment.id IS NOT NULL THEN
    SELECT r.*
    INTO v_receipt
    FROM public.receipts r
    WHERE r.id::text = coalesce(nullif(v_payment.receipt_id::text, ''), v_payment.id::text)
      AND r.deleted_at IS NULL
    FOR UPDATE;
  ELSE
    SELECT r.*
    INTO v_receipt
    FROM public.receipts r
    WHERE r.id::text = v_requested_id
      AND r.deleted_at IS NULL
    FOR UPDATE;

    IF v_receipt.id IS NOT NULL THEN
      SELECT p.*
      INTO v_payment
      FROM public.payments p
      WHERE p.receipt_id::text = v_receipt.id::text
        AND p.deleted_at IS NULL
      ORDER BY p.created_at DESC NULLS LAST, p.id
      LIMIT 1
      FOR UPDATE;
    END IF;
  END IF;

  IF v_payment.id IS NULL OR v_receipt.id IS NULL THEN
    RAISE EXCEPTION 'Linked payment and receipt were not found for identifier %.', v_requested_id
      USING ERRCODE = 'P0002';
  END IF;

  v_receipt_was_void := upper(coalesce(v_receipt.status, '')) = 'VOID';
  v_reversal_request_id := 'void:' || v_receipt.id::text;

  SELECT
    count(*)::integer,
    coalesce(sum(je.amount) FILTER (WHERE upper(je.type) = 'DEBIT'), 0),
    coalesce(sum(je.amount) FILTER (WHERE upper(je.type) = 'CREDIT'), 0)
  INTO v_original_count, v_original_debits, v_original_credits
  FROM public.journal_entries je
  WHERE je.source_id::text = v_receipt.id::text
    AND je.deleted_at IS NULL
    AND coalesce(je.request_id, '') <> v_reversal_request_id
    AND coalesce(je.entity_type, '') <> 'receipt_void';

  IF v_original_count > 0 AND abs(v_original_debits - v_original_credits) > 0.001 THEN
    RAISE EXCEPTION 'Original receipt journal is unbalanced; void aborted before mutation.'
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer
  INTO v_existing_reversal_count
  FROM public.journal_entries je
  WHERE je.request_id = v_reversal_request_id
    AND je.deleted_at IS NULL;

  IF NOT v_receipt_was_void THEN
    WITH allocated AS (
      SELECT ra.invoice_id, sum(ra.amount)::numeric AS amount
      FROM public.receipt_allocations ra
      WHERE ra.receipt_id::text = v_receipt.id::text
      GROUP BY ra.invoice_id
    )
    UPDATE public.invoices i
    SET
      paid_amount = greatest(0, coalesce(i.paid_amount, 0) - allocated.amount),
      status = CASE
        WHEN greatest(0, coalesce(i.paid_amount, 0) - allocated.amount) <= 0.001 THEN 'UNPAID'
        WHEN greatest(0, coalesce(i.paid_amount, 0) - allocated.amount)
          < coalesce(i.amount, 0) + coalesce(i.tax_amount, 0) - 0.001 THEN 'PARTIALLY_PAID'
        ELSE 'PAID'
      END,
      updated_at = now()
    FROM allocated
    WHERE i.id = allocated.invoice_id;
  END IF;

  UPDATE public.receipts
  SET status = 'VOID', voided_at = floor(extract(epoch from clock_timestamp()) * 1000)::bigint, updated_at = now()
  WHERE id::text = v_receipt.id::text;

  UPDATE public.payments
  SET status = 'VOID', updated_at = now()
  WHERE id = v_payment.id;

  IF v_original_count > 0 AND v_existing_reversal_count = 0 THEN
    v_reversal_batch_id := gen_random_uuid();

    INSERT INTO public.journal_entries (
      id, no, date, account_id, amount, type, source_id, entity_type,
      entity_id, created_at, request_id, status, batch_id
    )
    SELECT
      gen_random_uuid()::text,
      'VOID-' || left(replace(v_receipt.id::text, '-', ''), 12) || '-' || row_number() over (order by je.id),
      current_date::text,
      je.account_id,
      je.amount,
      CASE upper(je.type) WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END,
      v_receipt.id::text,
      'receipt_void',
      v_receipt.id::text,
      now(),
      v_reversal_request_id,
      'posted',
      v_reversal_batch_id
    FROM public.journal_entries je
    WHERE je.source_id::text = v_receipt.id::text
      AND je.deleted_at IS NULL
      AND coalesce(je.request_id, '') <> v_reversal_request_id
      AND coalesce(je.entity_type, '') <> 'receipt_void';

    GET DIAGNOSTICS v_created_reversal_count = ROW_COUNT;
    PERFORM public.close_journal_batch(v_reversal_batch_id);
  END IF;

  IF NOT v_receipt_was_void OR v_created_reversal_count > 0 THEN
    INSERT INTO public.audit_log (
      id, ts, user_id, action, entity, entity_id, note, "table", details,
      old_value, new_value, action_timestamp, created_at, updated_at
    ) VALUES (
      gen_random_uuid()::text,
      extract(epoch from now())::bigint,
      v_actor_id::text,
      'VOID_RECEIPT_ATOMIC',
      'receipt',
      v_receipt.id::text,
      'Receipt voided atomically with payment, invoice, report, and journal parity.',
      'receipts',
      jsonb_build_object(
        'reason', v_reason,
        'request_id', v_request_id,
        'requested_id', v_requested_id,
        'payment_id', v_payment.id,
        'receipt_id', v_receipt.id,
        'journal_reversal_batch_id', v_reversal_batch_id,
        'journal_reversal_entries', v_created_reversal_count
      )::text,
      jsonb_build_object('payment_status', v_payment.status, 'receipt_status', v_receipt.status),
      jsonb_build_object('payment_status', 'VOID', 'receipt_status', 'VOID'),
      now(),
      now(),
      now()
    );
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', v_receipt_was_void AND v_created_reversal_count = 0,
    'request_id', v_request_id,
    'requested_receipt_id', v_requested_id,
    'payment_id', v_payment.id,
    'receipt_id', v_receipt.id,
    'status', 'VOID',
    'reason', v_reason,
    'journal_reversal_batch_id', v_reversal_batch_id,
    'journal_reversal_entries', v_created_reversal_count
  );

  INSERT INTO public.financial_operation_idempotency (
    operation_name, request_id, response_payload
  ) VALUES (
    'void_receipt_atomic', v_request_id, v_result
  )
  ON CONFLICT (operation_name, request_id) DO NOTHING;

  RETURN v_result;
END;
$function$;

ALTER FUNCTION public.void_receipt_atomic(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.void_receipt_atomic(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_receipt_atomic(jsonb) TO authenticated, service_role;

-- The legacy overload accepts client-computed invoice/journal payloads. It remains
-- only for internal ownership continuity and is no longer an application endpoint.
REVOKE ALL ON FUNCTION public.void_receipt_atomic(text, bigint, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

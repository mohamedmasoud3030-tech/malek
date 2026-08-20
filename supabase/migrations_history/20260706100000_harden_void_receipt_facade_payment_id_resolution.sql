-- Migration: harden_void_receipt_facade_payment_id_resolution
--
-- The Receipts UI is payment-backed: its receipt identifier is public.payments.id.
-- The canonical void implementation operates on public.receipts.id. The prior
-- shared-id fix makes new record_invoice_payment_atomic rows use the same UUID for
-- both ids, but this facade also resolves payment-backed ids through
-- payments.receipt_id so any rows written with distinct ids can still be voided
-- when the linkage exists.

create or replace function public.void_receipt_atomic(payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_requested_receipt_id text := nullif(payload->>'receipt_id', '');
  v_resolved_receipt_id text;
  v_voided_at bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_result jsonb;
BEGIN
  IF v_requested_receipt_id IS NULL THEN
    RAISE EXCEPTION 'receipt_id is required';
  END IF;

  SELECT r.id::text
    INTO v_resolved_receipt_id
  FROM public.receipts r
  WHERE r.id::text = v_requested_receipt_id
  FOR UPDATE;

  IF v_resolved_receipt_id IS NULL THEN
    SELECT p.receipt_id::text
      INTO v_resolved_receipt_id
    FROM public.payments p
    WHERE p.id::text = v_requested_receipt_id
      AND p.receipt_id IS NOT NULL
      AND coalesce((to_jsonb(p)->>'deleted_at')::timestamptz, NULL) IS NULL
    FOR UPDATE;
  END IF;

  v_result := public.void_receipt_atomic(
    coalesce(v_resolved_receipt_id, v_requested_receipt_id),
    v_voided_at,
    '[]'::jsonb,
    '[]'::jsonb
  );

  RETURN coalesce(v_result, '{}'::jsonb)
    || jsonb_build_object(
      'voided_at', v_voided_at::text,
      'requested_receipt_id', v_requested_receipt_id,
      'receipt_id', coalesce(v_resolved_receipt_id, v_requested_receipt_id)
    );
END;
$function$;

grant execute on function public.void_receipt_atomic(jsonb) to authenticated, anon, service_role;

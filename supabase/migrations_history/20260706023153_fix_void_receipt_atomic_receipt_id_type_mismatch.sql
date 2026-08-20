-- receipts.id / receipt_allocations.receipt_id / invoices.id are all text in
-- this schema, but void_receipt_atomic(p_receipt_id uuid, ...) compared
-- text = uuid everywhere, which has no operator in Postgres and raises a
-- hard error on every call. Same class of bug as renew_contract_atomic.
-- Drop the broken uuid-arg overload and recreate it as text, matching the
-- actual column type, so we don't leave two ambiguous overloads behind.
-- Verified on production: 0 receipts exist, so no user has hit this yet.

drop function if exists public.void_receipt_atomic(uuid, bigint, jsonb, jsonb);

create function public.void_receipt_atomic(p_receipt_id text, p_voided_at bigint, p_invoice_updates jsonb DEFAULT '[]'::jsonb, p_reverse_entries jsonb DEFAULT '[]'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_receipt record;
BEGIN
  if auth.uid() is null or not exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('ADMIN', 'MANAGER')
  ) then
    raise exception 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول';
  end if;

  SELECT * INTO v_receipt FROM public.receipts WHERE id = p_receipt_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'سند القبض غير موجود: %', p_receipt_id;
  END IF;

  IF v_receipt.status = 'VOID' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'receipt_id', p_receipt_id);
  END IF;

  UPDATE public.receipts
  SET status = 'VOID', updated_at = now()
  WHERE id = p_receipt_id;

  UPDATE public.invoices i
  SET
    paid_amount = GREATEST(0, coalesce(i.paid_amount, 0) - ra.amount),
    status = CASE
      WHEN GREATEST(0, coalesce(i.paid_amount, 0) - ra.amount) <= 0 THEN 'UNPAID'
      WHEN GREATEST(0, coalesce(i.paid_amount, 0) - ra.amount) < (i.amount + coalesce(i.tax_amount, 0)) THEN 'PARTIALLY_PAID'
      ELSE i.status
    END
  FROM public.receipt_allocations ra
  WHERE ra.receipt_id = p_receipt_id AND i.id = ra.invoice_id;

  DELETE FROM public.receipt_allocations WHERE receipt_id = p_receipt_id;

  IF jsonb_array_length(p_reverse_entries) > 0 THEN
    INSERT INTO public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, created_at)
    SELECT
      coalesce(nullif(j->>'id', '')::uuid, gen_random_uuid()),
      j->>'no',
      j->>'date',
      j->>'account_id',
      (j->>'amount')::numeric,
      j->>'type',
      j->>'source_id',
      nullif(j->>'entity_type', ''),
      nullif(j->>'entity_id', ''),
      CASE
        WHEN j->>'created_at' IS NOT NULL AND j->>'created_at' != ''
          THEN to_timestamp((j->>'created_at')::bigint / 1000.0)
        ELSE now()
      END
    FROM jsonb_array_elements(p_reverse_entries) AS j;
  END IF;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'receipt_id', p_receipt_id);
END;
$function$;

create or replace function public.void_receipt_atomic(payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_receipt_id text := nullif(payload->>'receipt_id', '');
  v_voided_at bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_result jsonb;
BEGIN
  IF v_receipt_id IS NULL THEN
    RAISE EXCEPTION 'receipt_id is required';
  END IF;

  v_result := public.void_receipt_atomic(v_receipt_id, v_voided_at, '[]'::jsonb, '[]'::jsonb);

  RETURN coalesce(v_result, '{}'::jsonb) || jsonb_build_object('voided_at', v_voided_at::text);
END;
$function$;

grant execute on function public.void_receipt_atomic(text, bigint, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.void_receipt_atomic(jsonb) to authenticated, anon, service_role;

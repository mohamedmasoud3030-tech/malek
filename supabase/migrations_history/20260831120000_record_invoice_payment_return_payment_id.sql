-- Isolated lifecycle / browser collect contract: record_invoice_payment_atomic
-- must return payment_id (shared receipt identity) and persist reference_number.
-- The RC1 engine already creates the payments row via post_receipt_atomic but
-- omitted payment_id from the JSON result, so the browser parser and verify
-- path could not observe the collection.
--
-- Expand/contract: keep the proven RC1 engine body byte-identical under a
-- private name and publish a thin compatibility wrapper as the public RPC.

begin;

do $rename_engine$
begin
  if to_regprocedure('public.record_invoice_payment_atomic_engine(jsonb)') is null then
    if to_regprocedure('public.record_invoice_payment_atomic(jsonb)') is null then
      raise exception 'RECORD_INVOICE_PAYMENT_ENGINE_MISSING';
    end if;
    alter function public.record_invoice_payment_atomic(jsonb)
      rename to record_invoice_payment_atomic_engine;
  end if;
end
$rename_engine$;

revoke all on function public.record_invoice_payment_atomic_engine(jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.record_invoice_payment_atomic(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_result jsonb;
  v_receipt_id uuid;
  v_payment_id uuid;
  v_reference text := nullif(btrim(coalesce(payload->>'reference', '')), '');
  v_company_id uuid;
begin
  v_result := public.record_invoice_payment_atomic_engine(payload);
  v_receipt_id := nullif(v_result->>'receipt_id', '')::uuid;
  v_company_id := public.require_company_id();

  if v_receipt_id is not null then
    if v_reference is not null then
      update public.payments
         set reference_number = coalesce(nullif(btrim(reference_number), ''), v_reference),
             reference_no = coalesce(nullif(btrim(reference_no), ''), v_reference),
             updated_at = now()
       where company_id = v_company_id
         and deleted_at is null
         and (
           receipt_id = v_receipt_id
           or id = v_receipt_id
         );
    end if;

    select p.id
      into v_payment_id
    from public.payments p
    where p.company_id = v_company_id
      and p.deleted_at is null
      and (p.receipt_id = v_receipt_id or p.id = v_receipt_id)
    order by p.created_at desc nulls last, p.id
    limit 1;
  end if;

  if v_payment_id is null then
    raise exception 'PAYMENT_ROW_MISSING_AFTER_RECEIPT: receipt_id=%', v_receipt_id
      using errcode = 'P0002';
  end if;

  return v_result || jsonb_build_object('payment_id', v_payment_id);
end;
$function$;

alter function public.record_invoice_payment_atomic(jsonb) owner to postgres;
revoke all on function public.record_invoice_payment_atomic(jsonb)
  from public, anon;
grant execute on function public.record_invoice_payment_atomic(jsonb)
  to authenticated, service_role;

comment on function public.record_invoice_payment_atomic(jsonb) is
  'Public collect RPC. Delegates accounting to record_invoice_payment_atomic_engine and returns the persisted payment_id plus dual reference fields required by lifecycle verify.';

comment on function public.record_invoice_payment_atomic_engine(jsonb) is
  'Internal RC1 invoice collection engine. Not a browser RPC.';

commit;

-- Restore the public collect wrapper guards required by
-- s02_financial_direct_write_hardening.sql. The previous wrapper delegated
-- all auth/role/company checks to the engine; the contract inspects the
-- public function source and also expects 42501 for an empty payload under
-- the authenticated role with no JWT.

begin;

create or replace function public.record_invoice_payment_atomic(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_result jsonb;
  v_receipt_id uuid;
  v_payment_id uuid;
  v_reference text := nullif(btrim(coalesce(payload->>'reference', '')), '');
begin
  if v_actor is null then
    raise exception 'Authentication is required to record invoice payments'
      using errcode = '42501';
  end if;
  if not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'ADMIN or MANAGER role is required to record invoice payments'
      using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  v_result := public.record_invoice_payment_atomic_engine(payload);
  v_receipt_id := nullif(v_result->>'receipt_id', '')::uuid;

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

commit;

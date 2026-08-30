-- terminate_contract_atomic accepts the browser contract id as text for
-- compatibility with the canonical RPC contract, while the live canonical
-- contracts/invoices columns are UUID. Compare through ::text exactly like the
-- hardened soft-delete command so termination does not fail with uuid = text.
--
-- Business behavior is unchanged: authority, lifecycle eligibility, reason
-- requirement and future-unpaid invoice cancellation all remain identical.

begin;

create or replace function public.terminate_contract_atomic(
  p_contract_id text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company_id uuid;
  v_old public.contracts%rowtype;
  v_cancelled_invoice_ids text[];
begin
  if auth.uid() is null or not public.current_user_has_effective_app_permission('contracts.cancel') then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنهاء عقد' using errcode = '42501';
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'سياق الشركة مطلوب لإنهاء العقد' using errcode = '42501';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'سبب الإنهاء مطلوب';
  end if;

  select * into v_old
  from public.contracts
  where id::text = p_contract_id
    and company_id = v_company_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'العقد غير موجود' using errcode = '42501';
  end if;

  if v_old.status not in ('active', 'draft') then
    raise exception 'لا يمكن إنهاء عقد بحالته الحالية (%): يجب أن يكون نشطاً أو مسودة', v_old.status;
  end if;

  update public.contracts
  set status = 'terminated',
      cancellation_reason = p_reason,
      updated_at = now()
  where id::text = p_contract_id
    and company_id = v_company_id;

  with cancelled as (
    update public.invoices
    set status = 'CANCELLED',
        updated_at = now()
    where contract_id::text = p_contract_id
      and company_id = v_company_id
      and deleted_at is null
      and paid_amount = 0
      and status not in ('CANCELLED', 'PAID')
      and due_date::date > current_date
    returning id
  )
  select coalesce(array_agg(id::text), '{}')
    into v_cancelled_invoice_ids
  from cancelled;

  return jsonb_build_object(
    'status', 'terminated',
    'contract_id', p_contract_id,
    'cancelled_invoice_ids', to_jsonb(v_cancelled_invoice_ids)
  );
end;
$function$;

comment on function public.terminate_contract_atomic(text,text) is
  'Governed contract termination; browser text ids are compared to canonical UUID storage via explicit ::text compatibility casts.';

notify pgrst, 'reload schema';
commit;

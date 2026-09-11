begin;

create or replace function public.soft_delete_contract_atomic(p_contract_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.contracts%rowtype;
  v_company_id uuid;
  v_contract_id uuid;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لحذف عقد' using errcode = '42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  v_contract_id := nullif(btrim(coalesce(p_contract_id, '')), '')::uuid;

  select * into v_old
  from public.contracts
  where id = v_contract_id and deleted_at is null
    and company_id = v_company_id
  for update;

  if not found then
    raise exception 'العقد غير موجود';
  end if;

  if exists (
    select 1 from public.invoices
    where contract_id = v_contract_id
      and deleted_at is null
      and coalesce(paid_amount, 0) > 0
  ) then
    raise exception 'لا يمكن حذف عقد يحتوي على فواتير مدفوعة أو دفعات مسجلة؛ يرجى إنهاء العقد بدلاً من ذلك';
  end if;

  if exists (
    select 1 from public.receipts
    where contract_id = v_contract_id
      and deleted_at is null
  ) then
    raise exception 'لا يمكن حذف عقد يحتوي على إيصالات مالية؛ يرجى إنهاء العقد بدلاً من ذلك';
  end if;

  update public.invoices
  set status = 'CANCELLED',
      deleted_at = now(),
      updated_at = now()
  where contract_id = v_contract_id
    and company_id = v_company_id
    and deleted_at is null
    and coalesce(paid_amount, 0) = 0
    and status not in ('CANCELLED', 'PAID')
    and due_date::date > current_date;

  update public.contracts
  set deleted_at = now(),
      updated_at = now()
  where id = v_contract_id
    and company_id = v_company_id;

  return jsonb_build_object(
    'status', 'deleted',
    'contract_id', p_contract_id
  );
end;
$$;

alter function public.soft_delete_contract_atomic(p_contract_id text) owner to postgres;
comment on function public.soft_delete_contract_atomic(p_contract_id text) is
  'Soft-deletes a contract (admin/manager, company-scoped). Text id normalized to uuid internally; malformed ids fail cleanly.';
revoke all on function public.soft_delete_contract_atomic(p_contract_id text) from public;
grant all on function public.soft_delete_contract_atomic(p_contract_id text) to service_role;
grant all on function public.soft_delete_contract_atomic(p_contract_id text) to authenticated;

commit;
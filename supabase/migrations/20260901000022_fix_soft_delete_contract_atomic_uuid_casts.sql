-- 20260901000022_fix_soft_delete_contract_atomic_uuid_casts.sql
--
-- Canonicalization regression fix: soft_delete_contract_atomic was rewritten
-- during canonicalization with a TEXT parameter (matching the frontend, which
-- passes text UUIDs), but its WHERE clauses still compare uuid columns
-- directly against the text value:
--
--   operator does not exist: uuid = text
--
-- making the RPC uncallable. The public signature stays `text` (the generated
-- types and contractService.ts depend on it); the parameter is normalized to
-- uuid once at the top and every comparison uses the normalized value.
--
-- Behavior preserved exactly:
--   * ADMIN/MANAGER only (is_admin_or_manager)
--   * company scoping via JWT app_metadata company_id
--   * paid-invoice and receipt financial guards
--   * future unpaid invoice cancellation
--   * 'العقد غير موجود' for unknown ids
--   * empty input -> unmatched (not found), matching sibling RPCs
--   * malformed UUID -> clean 22P02 error (fails safely)

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

  -- Normalize the text id once. Empty/whitespace becomes NULL (unmatched,
  -- treated as not found); any other malformed value fails cleanly with
  -- invalid input syntax for type uuid (22P02).
  v_contract_id := nullif(btrim(coalesce(p_contract_id, '')), '')::uuid;

  select * into v_old
  from public.contracts
  where id = v_contract_id and deleted_at is null
    and company_id = v_company_id
  for update;

  if not found then
    raise exception 'العقد غير موجود';
  end if;

  -- Protect financial integrity: reject soft deletion if paid invoices exist
  if exists (
    select 1 from public.invoices
    where contract_id = v_contract_id
      and deleted_at is null
      and coalesce(paid_amount, 0) > 0
  ) then
    raise exception 'لا يمكن حذف عقد يحتوي على فواتير مدفوعة أو دفعات مسجلة؛ يرجى إنهاء العقد بدلاً من ذلك';
  end if;

  -- Protect financial integrity: reject soft deletion if receipts exist
  if exists (
    select 1 from public.receipts
    where contract_id = v_contract_id
      and deleted_at is null
  ) then
    raise exception 'لا يمكن حذف عقد يحتوي على إيصالات مالية؛ يرجى إنهاء العقد بدلاً من ذلك';
  end if;

  -- Cancel and soft-delete future unpaid invoices so they do not remain open
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

  -- Soft-delete the contract
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

-- Grants preserved by CREATE OR REPLACE with an unchanged signature, but restate
-- them explicitly so the migration is self-contained and reviewable.
revoke all on function public.soft_delete_contract_atomic(p_contract_id text) from public;
grant all on function public.soft_delete_contract_atomic(p_contract_id text) to service_role;
grant all on function public.soft_delete_contract_atomic(p_contract_id text) to authenticated;

commit;

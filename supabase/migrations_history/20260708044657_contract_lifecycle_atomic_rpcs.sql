-- ============================================================
-- FGR-004: Contract update/termination lifecycle may bypass atomic rules
--
-- Problem: contractService.ts's updateContract() and softDeleteContract()
-- perform direct `update public.contracts ...` calls. Unlike
-- create_contract_atomic / renew_contract_atomic, these paths do NOT
-- re-validate:
--   - unit belongs to the target property
--   - no overlapping active/draft contract on the same unit for the new
--     date range
--   - owner_agreement coverage for the (possibly changed) date range
-- and "terminating" a contract today just means the generic edit form
-- sets status='terminated' via a raw update — no RPC enforces that only
-- an active/draft contract can be terminated, and no cleanup happens for
-- future unpaid invoices left dangling under the terminated contract.
--
-- This migration adds two SECURITY DEFINER RPCs that mirror
-- create_contract_atomic's validation and follow renew_contract_atomic's
-- FOR UPDATE locking pattern:
--   1. update_contract_atomic  — re-validates property/unit/date-overlap/
--      agreement-coverage invariants whenever those fields are part of the
--      update; always allowed for fields that don't affect those
--      invariants (rent_amount, notes, attachment_url, payment_terms_id).
--   2. terminate_contract_atomic — validates current status is
--      'active' or 'draft', sets status='terminated' with a required
--      cancellation_reason, and cancels any future invoices on that
--      contract that are still unpaid (paid_amount = 0). Invoices with
--      any payment history are left untouched — this migration does not
--      change accounting/settlement basis, only stops new obligations
--      from continuing to accrue against a dead contract.
--
-- Frontend follow-up (included in this same PR, not just this migration):
-- contractService.ts calls these RPCs instead of raw `.update()`/soft-delete
-- on `contracts`, and the contract detail UI offers an explicit "terminate"
-- action (with a required reason) separate from the generic edit form's
-- status dropdown.
--
-- NOTE (fixed during review, verified against live production schema via
-- Supabase MCP before applying):
--   - invoices.due_date is `text` on production (drift from the original
--     `date` column in the base migration), so the future-invoice filter
--     below casts explicitly (due_date::date) instead of comparing
--     text > date, which would raise "operator does not exist: text > date".
--   - contracts.tenant_id, start_date, end_date, payment_terms_id are all
--     `text` on production (same drift pattern as contracts.id being text
--     instead of uuid — see docs/CURRENT_STATE.md). p_tenant_id/p_agreement_id/
--     p_unit_id/p_payment_terms_id stay typed as uuid in the RPC signature
--     (matching create_contract_atomic's existing convention — all live
--     values are uuid-shaped), and are cast to ::text at the point they're
--     written into or compared against those text columns.
-- ============================================================

create or replace function public.update_contract_atomic(
  p_contract_id       text,
  p_property_id       text,
  p_unit_id           uuid,
  p_tenant_id         uuid,
  p_agreement_id      uuid,
  p_start_date        date,
  p_end_date          date,
  p_rent_amount       numeric,
  p_payment_cycle     text,
  p_payment_terms_id  uuid,
  p_status            text,
  p_cancellation_reason text,
  p_notes             text,
  p_attachment_url    text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.contracts%rowtype;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لتعديل عقد' using errcode = '42501';
  end if;

  -- Lock the row so a concurrent renew/terminate/update can't race us.
  select * into v_old
  from public.contracts
  where id = p_contract_id and deleted_at is null
  for update;

  if not found then
    raise exception 'العقد غير موجود';
  end if;

  -- Terminated contracts are a closed state; use terminate_contract_atomic
  -- to get there, and don't allow editing back out of it here.
  if v_old.status = 'terminated' and p_status <> 'terminated' then
    raise exception 'لا يمكن تعديل عقد تم إنهاؤه بالفعل';
  end if;

  if not exists (
    select 1 from public.people
    where id = p_tenant_id and type = 'tenant' and deleted_at is null
  ) then
    raise exception 'المستأجر غير موجود أو نوعه غير صحيح';
  end if;

  if not exists (
    select 1 from public.properties where id = p_property_id and deleted_at is null
  ) then
    raise exception 'العقار غير موجود';
  end if;

  if p_unit_id is not null and not exists (
    select 1 from public.units
    where id = p_unit_id and property_id = p_property_id and deleted_at is null
  ) then
    raise exception 'الوحدة لا تنتمي إلى العقار المحدد';
  end if;

  -- Overlap check excludes this contract's own current row.
  if p_unit_id is not null and exists (
    select 1 from public.contracts
    where unit_id = p_unit_id
      and id <> p_contract_id
      and deleted_at is null
      and status in ('active', 'draft')
      and start_date < p_end_date::text
      and end_date > p_start_date::text
  ) then
    raise exception 'الوحدة محجوزة خلال هذه الفترة';
  end if;

  if p_agreement_id is null then
    raise exception 'لا توجد اتفاقية مالك نشطة تغطي فترة العقد — أنشئ اتفاقية مالك أولاً';
  end if;

  if not exists (
    select 1 from public.owner_agreements
    where id = p_agreement_id
      and property_id = p_property_id
      and starts_on <= p_start_date
      and (ends_on is null or ends_on >= p_end_date)
  ) then
    raise exception 'اتفاقية المالك لا تغطي فترة العقد بالكامل أو لا تنتمي لهذا العقار';
  end if;

  update public.contracts set
    property_id          = p_property_id,
    unit_id               = p_unit_id,
    tenant_id             = p_tenant_id::text,
    agreement_id          = p_agreement_id,
    start_date            = p_start_date::text,
    end_date              = p_end_date::text,
    rent_amount           = p_rent_amount,
    payment_cycle         = p_payment_cycle,
    payment_terms_id      = p_payment_terms_id::text,
    status                = p_status,
    cancellation_reason   = p_cancellation_reason,
    notes                 = p_notes,
    attachment_url        = p_attachment_url,
    updated_at            = now()
  where id = p_contract_id;

  return (select to_jsonb(c) from public.contracts c where c.id = p_contract_id);
end;
$$;

revoke all on function public.update_contract_atomic(text,text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) from public, anon;
grant execute on function public.update_contract_atomic(text,text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) to authenticated;

create or replace function public.terminate_contract_atomic(
  p_contract_id text,
  p_reason      text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.contracts%rowtype;
  v_cancelled_invoice_ids text[];
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنهاء عقد' using errcode = '42501';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'سبب الإنهاء مطلوب';
  end if;

  select * into v_old
  from public.contracts
  where id = p_contract_id and deleted_at is null
  for update;

  if not found then
    raise exception 'العقد غير موجود';
  end if;

  if v_old.status not in ('active', 'draft') then
    raise exception 'لا يمكن إنهاء عقد بحالته الحالية (%): يجب أن يكون نشطاً أو مسودة', v_old.status;
  end if;

  update public.contracts
  set status = 'terminated',
      cancellation_reason = p_reason,
      updated_at = now()
  where id = p_contract_id;

  -- Cancel future, still-unpaid invoices so they stop appearing as
  -- outstanding receivables against a dead contract. Invoices with any
  -- payment history (paid_amount > 0) are left as-is — this only stops
  -- new/unpaid obligations, it does not touch settled accounting history.
  with cancelled as (
    update public.invoices
    set status = 'CANCELLED',
        updated_at = now()
    where contract_id = p_contract_id
      and deleted_at is null
      and paid_amount = 0
      and status not in ('CANCELLED', 'PAID')
      and due_date::date > current_date
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_cancelled_invoice_ids from cancelled;

  return jsonb_build_object(
    'status', 'terminated',
    'contract_id', p_contract_id,
    'cancelled_invoice_ids', to_jsonb(v_cancelled_invoice_ids)
  );
end;
$$;

revoke all on function public.terminate_contract_atomic(text,text) from public, anon;
grant execute on function public.terminate_contract_atomic(text,text) to authenticated;

-- ============================================================================
-- PHASE 3 — Credit / Reversal / AR Allocation Integrity
-- ============================================================================
-- Mission: Malik Financial Hardening, Phase 3.
-- Audit: docs/audits/FINANCIAL_HARDENING_AUDIT_20260815.md (F05, F06, F07, F11,
-- F12, F29).
--
-- Adds a controlled, production-grade credit/reversal model for rent invoices:
--   * original posted invoices remain immutable historical truth;
--   * a credit is a new controlled financial event (reason, actor, timestamp,
--     credit type, idempotent request, canonical journal, approval-eligible);
--   * a credit reduces the invoice's derived outstanding balance and is
--     reconciled to the 1201 tenant-receivable control account;
--   * credits can themselves be reversed (compensating, canonical) but never
--     hard-deleted;
--   * derived invoice status (UNPAID / PARTIALLY_PAID / PAID / OVERDUE) and the
--     AR reconciliation subledger both account for credits.
--
-- Payment allocation truth is preserved: outstanding is derived from
-- posted invoice - valid payment allocations (paid_amount) - valid credits
-- (credited_amount), each maintained transactionally under row locks by the
-- server-side engine. See 7.4 in the mission.
-- ----------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 1. invoices.credited_amount (cached, transactionally maintained, OMR 3dp)
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column if not exists credited_amount numeric(18,3) not null default 0;
alter table public.invoices
  drop constraint if exists invoices_credited_amount_nonneg_check;
alter table public.invoices
  add constraint invoices_credited_amount_nonneg_check check (credited_amount >= 0);
alter table public.invoices
  drop constraint if exists invoices_credited_amount_omr3dp_check;
alter table public.invoices
  add constraint invoices_credited_amount_omr3dp_check check (credited_amount = round(credited_amount, 3));

-- ---------------------------------------------------------------------------
-- 2. invoice_credits ledger (append-only; credits and their reversals)
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_credits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount numeric(18,3) not null check (amount > 0),
  credit_type text not null check (credit_type in ('PARTIAL','FULL')),
  reason text not null,
  reason_code text,
  effective_date date not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  request_id text not null,
  status text not null default 'POSTED' check (status in ('POSTED','REVERSED')),
  journal_batch_id uuid references public.journal_batches(id) on delete restrict,
  reversal_of_id uuid references public.invoice_credits(id) on delete restrict,
  reversal_request_id text,
  reversal_journal_batch_id uuid references public.journal_batches(id) on delete restrict,
  reversal_reason text,
  reversed_by uuid,
  reversed_at timestamptz,
  constraint invoice_credits_request_uq unique (company_id, request_id),
  constraint invoice_credits_reversal_request_uq unique (company_id, reversal_request_id),
  constraint invoice_credits_omr3dp_check check (amount = round(amount, 3)),
  constraint invoice_credits_reversal_shape_chk check (
    status <> 'REVERSED'
    or (reversal_request_id is not null
        and reversal_journal_batch_id is not null
        and nullif(btrim(reversal_reason), '') is not null
        and reversed_by is not null
        and reversed_at is not null)
  )
);

create index if not exists invoice_credits_invoice_idx
  on public.invoice_credits (company_id, invoice_id, created_at desc);
create index if not exists invoice_credits_request_idx
  on public.invoice_credits (company_id, request_id);

alter table public.invoice_credits enable row level security;

drop policy if exists invoice_credits_company_select on public.invoice_credits;
create policy invoice_credits_company_select on public.invoice_credits
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (public.is_admin_or_manager() or public.is_accountant())
  );

revoke all on table public.invoice_credits from public, anon, authenticated;
grant select on table public.invoice_credits to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Derived invoice status accounting for credits
-- ---------------------------------------------------------------------------
create or replace function public.recalculate_invoice_status(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  update public.invoices i
  set status = case
      when i.status = 'VOID' then 'VOID'
      when coalesce(i.paid_amount, 0) + coalesce(i.credited_amount, 0) <= 0
           and i.due_date < current_date then 'OVERDUE'
      when coalesce(i.paid_amount, 0) + coalesce(i.credited_amount, 0) <= 0 then 'UNPAID'
      when coalesce(i.paid_amount, 0) + coalesce(i.credited_amount, 0)
           < (i.amount + coalesce(i.tax_amount, 0)) then 'PARTIALLY_PAID'
      else 'PAID'
    end,
    updated_at = now()
  where i.id = p_invoice_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. create_invoice_credit_atomic — controlled credit against a posted invoice
-- ---------------------------------------------------------------------------
create or replace function public.create_invoice_credit_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_invoice_id uuid;
  v_amount numeric;
  v_credit_type text;
  v_reason text;
  v_reason_code text;
  v_request_id text;
  v_effective_date date;
  v_invoice record;
  v_outstanding numeric;
  v_rent_portion numeric := 0;
  v_vat_portion numeric := 0;
  v_ar_account_id text;
  v_revenue_account_id text;
  v_vat_account_id text;
  v_credit_id uuid;
  v_batch_id uuid;
  v_lines jsonb;
  v_fingerprint text;
  v_result jsonb;
  v_existing jsonb;
  v_cached_fingerprint text;
  v_cached_target text;
begin
  if v_actor is null then
    raise exception 'Authentication is required to create invoice credits.' using errcode='42501';
  end if;
  if not coalesce(public.is_admin_or_manager(), false) and not coalesce(public.is_accountant(), false) then
    raise exception 'CREDIT_ROLE_REQUIRED: ADMIN, MANAGER or ACCOUNTANT role is required to create invoice credits.' using errcode='42501';
  end if;
  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_company_id is null then
    raise exception 'Company context is required (no company_id claim in JWT).' using errcode='42501';
  end if;
  v_invoice_id := nullif(p_payload->>'invoice_id', '')::uuid;
  v_amount := coalesce((p_payload->>'amount')::numeric, 0);
  v_credit_type := coalesce(nullif(p_payload->>'credit_type', ''), 'PARTIAL');
  v_reason := nullif(btrim(coalesce(p_payload->>'reason', '')), '');
  v_reason_code := nullif(p_payload->>'reason_code', '');
  v_request_id := nullif(p_payload->>'request_id', '');
  v_effective_date := coalesce(nullif(p_payload->>'effective_date', '')::date, current_date);
  if v_invoice_id is null or v_amount <= 0 or v_request_id is null or v_reason is null then
    raise exception 'CREDIT_REQUIRED: invoice_id, amount, reason and request_id are required.' using errcode='22023';
  end if;
  if v_credit_type not in ('PARTIAL','FULL') then
    raise exception 'CREDIT_TYPE_INVALID: credit_type must be PARTIAL or FULL.' using errcode='22023';
  end if;

  v_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'invoice_id', v_invoice_id::text,
    'amount', trim_scale(v_amount),
    'credit_type', v_credit_type,
    'reason', v_reason
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtextextended('invoice_credit:' || v_company_id::text || ':' || v_request_id, 0));

  select response_payload into v_existing
    from public.financial_operation_idempotency
   where operation_name = 'invoice_credit:' || v_company_id::text
     and request_id = v_request_id
   for update;
  if v_existing is not null then
    v_cached_fingerprint := v_existing->>'_fingerprint';
    v_cached_target := v_existing->>'_target';
    if v_cached_fingerprint is null or v_cached_target is null or not (v_existing ? 'response') then
      raise exception 'CREDIT_IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED' using errcode='22023';
    end if;
    if v_cached_fingerprint <> v_fingerprint or v_cached_target <> v_invoice_id::text then
      raise exception 'CREDIT_IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode='22023';
    end if;
    return v_existing->'response';
  end if;

  select * into v_invoice
    from public.invoices
   where id = v_invoice_id and company_id = v_company_id and deleted_at is null
   for update;
  if not found then
    raise exception 'CREDIT_INVOICE_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;
  if v_invoice.document_status <> 'POSTED' then
    raise exception 'CREDIT_INVOICE_NOT_POSTED: only posted invoices can be credited.' using errcode='22023';
  end if;

  -- Credit ceiling: credit cannot exceed eligible outstanding.
  v_outstanding := v_invoice.amount + coalesce(v_invoice.tax_amount, 0)
                 - coalesce(v_invoice.paid_amount, 0) - coalesce(v_invoice.credited_amount, 0);
  if v_amount > v_outstanding + 0.001 then
    raise exception 'CREDIT_EXCEEDS_OUTSTANDING: credit % exceeds eligible invoice outstanding %.', v_amount, v_outstanding using errcode='22023';
  end if;

  -- Resolve canonical accounts and split credit across rent + VAT.
  v_ar_account_id := public.require_company_account_id(v_company_id, '1201');
  v_revenue_account_id := public.require_company_account_id(v_company_id, '4000');
  if coalesce(v_invoice.tax_rate, 0) > 0 then
    v_vat_account_id := public.require_company_account_id(v_company_id, '2100');
    v_vat_portion := round(v_amount * coalesce(v_invoice.tax_rate, 0) / (100 + coalesce(v_invoice.tax_rate, 0)), 3);
    v_rent_portion := round(v_amount - v_vat_portion, 3);
  else
    v_rent_portion := v_amount;
    v_vat_portion := 0;
  end if;

  v_credit_id := gen_random_uuid();
  insert into public.invoice_credits (
    id, company_id, invoice_id, amount, credit_type, reason, reason_code,
    effective_date, created_by, request_id, status
  ) values (
    v_credit_id, v_company_id, v_invoice_id, v_amount, v_credit_type, v_reason, v_reason_code,
    v_effective_date, v_actor, v_request_id, 'POSTED'
  );

  -- Reduce receivable + recompute derived status.
  update public.invoices
     set credited_amount = public.gl_pm_round_omr(credited_amount + v_amount),
         updated_at = now()
   where id = v_invoice_id;
  perform public.recalculate_invoice_status(v_invoice_id);

  -- Canonical GL: CR 1201 (reduce AR), DR 4000 (reduce revenue), DR 2100 (reduce VAT).
  perform public.gl_ensure_initial_open_period(v_company_id, v_effective_date);
  v_lines := jsonb_build_array(
    jsonb_build_object('account_id', v_ar_account_id, 'debit', 0, 'credit', v_amount,
      'line_description', 'CREDIT-' || v_credit_id::text || '-CR-AR',
      'ref_source_id', v_invoice_id::text, 'ref_entity_type', 'invoice', 'ref_entity_id', v_invoice_id::text),
    jsonb_build_object('account_id', v_revenue_account_id, 'debit', v_rent_portion, 'credit', 0,
      'line_description', 'CREDIT-' || v_credit_id::text || '-DR-REV',
      'ref_source_id', v_invoice_id::text, 'ref_entity_type', 'invoice', 'ref_entity_id', v_invoice_id::text)
  );
  if v_vat_portion > 0 and v_vat_account_id is not null then
    v_lines := v_lines || jsonb_build_object('account_id', v_vat_account_id, 'debit', v_vat_portion, 'credit', 0,
      'line_description', 'CREDIT-' || v_credit_id::text || '-DR-VAT',
      'ref_source_id', v_invoice_id::text, 'ref_entity_type', 'invoice', 'ref_entity_id', v_invoice_id::text);
  end if;
  v_result := public.post_journal_event(jsonb_build_object(
    'company_id', v_company_id,
    'source_type', 'invoice_credit',
    'source_id', v_invoice_id::text,
    'event_id', v_request_id,
    'effective_date', v_effective_date,
    'description', 'Invoice credit ' || v_credit_id::text,
    'lines', v_lines
  ));
  v_batch_id := (v_result->>'batch_id')::uuid;
  update public.invoice_credits set journal_batch_id = v_batch_id where id = v_credit_id;

  v_result := jsonb_build_object(
    'success', true,
    'credit_id', v_credit_id::text,
    'invoice_id', v_invoice_id::text,
    'amount', trim_scale(v_amount)::text,
    'credit_type', v_credit_type,
    'request_id', v_request_id,
    'batch_id', v_batch_id::text,
    'outstanding_after', trim_scale(public.gl_pm_round_omr(v_outstanding - v_amount))::text
  );

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('invoice_credit:' || v_company_id::text, v_request_id,
          jsonb_build_object('_fingerprint', v_fingerprint, '_target', v_invoice_id::text, 'response', v_result));

  return v_result;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. reverse_invoice_credit_atomic — controlled compensating reversal
-- ---------------------------------------------------------------------------
create or replace function public.reverse_invoice_credit_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_credit_id uuid;
  v_reason text;
  v_request_id text;
  v_credit record;
  v_invoice record;
  v_reversal_result jsonb;
  v_result jsonb;
  v_existing jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication is required to reverse invoice credits.' using errcode='42501';
  end if;
  if not coalesce(public.is_admin_or_manager(), false) and not coalesce(public.is_accountant(), false) then
    raise exception 'CREDIT_REVERSAL_ROLE_REQUIRED: ADMIN, MANAGER or ACCOUNTANT role is required.' using errcode='42501';
  end if;
  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_company_id is null then
    raise exception 'Company context is required (no company_id claim in JWT).' using errcode='42501';
  end if;
  v_credit_id := nullif(p_payload->>'credit_id', '')::uuid;
  v_reason := nullif(btrim(coalesce(p_payload->>'reason', '')), '');
  v_request_id := nullif(p_payload->>'request_id', '');
  if v_credit_id is null or v_reason is null or v_request_id is null then
    raise exception 'CREDIT_REVERSAL_REQUIRED: credit_id, reason and request_id are required.' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('invoice_credit_reversal:' || v_company_id::text || ':' || v_request_id, 0));

  select response_payload into v_existing
    from public.financial_operation_idempotency
   where operation_name = 'invoice_credit_reversal:' || v_company_id::text
     and request_id = v_request_id
   for update;
  if v_existing is not null then
    if not (v_existing ? 'response') then
      raise exception 'CREDIT_REVERSAL_IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED' using errcode='22023';
    end if;
    return v_existing->'response';
  end if;

  select * into v_credit
    from public.invoice_credits
   where id = v_credit_id and company_id = v_company_id
   for update;
  if not found then
    raise exception 'CREDIT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;
  if v_credit.status <> 'POSTED' then
    raise exception 'CREDIT_ALREADY_REVERSED: only POSTED credits can be reversed.' using errcode='22023';
  end if;
  if v_credit.journal_batch_id is null then
    raise exception 'CREDIT_JOURNAL_MISSING: credit has no posted journal batch.' using errcode='22023';
  end if;

  select * into v_invoice
    from public.invoices where id = v_credit.invoice_id and company_id = v_company_id
   for update;
  if not found then
    raise exception 'CREDIT_INVOICE_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;
  if v_invoice.credited_amount < v_credit.amount then
    raise exception 'CREDIT_REVERSAL_BALANCE_INVALID: credited balance is less than the credit amount.' using errcode='22023';
  end if;

  -- Canonical compensating reversal of the original credit batch.
  v_reversal_result := public.reverse_journal_batch(v_credit.journal_batch_id);

  update public.invoices
     set credited_amount = public.gl_pm_round_omr(credited_amount - v_credit.amount),
         updated_at = now()
   where id = v_credit.invoice_id;
  perform public.recalculate_invoice_status(v_credit.invoice_id);

  update public.invoice_credits
     set status = 'REVERSED',
         reversal_request_id = v_request_id,
         reversal_journal_batch_id = (v_reversal_result->>'reversal_batch_id')::uuid,
         reversal_reason = v_reason,
         reversed_by = v_actor,
         reversed_at = now()
   where id = v_credit_id;

  v_result := jsonb_build_object(
    'success', true,
    'credit_id', v_credit_id::text,
    'reversal_request_id', v_request_id,
    'reversal_batch_id', v_reversal_result->>'reversal_batch_id'
  );

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('invoice_credit_reversal:' || v_company_id::text, v_request_id, jsonb_build_object('response', v_result));

  return v_result;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Reconciliation / overdue / balance surfaces account for credits
-- ---------------------------------------------------------------------------
create or replace function public.wp05_subledger_tenant_receivables(p_company_id uuid, p_as_of date default current_date)
returns table (balance numeric, cnt bigint)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_bal numeric;
  v_cnt bigint;
begin
  if p_company_id is null then
    raise exception 'WP05_SUBLEDGER_TENANT_REQUIRED: company_id required' using errcode='22023';
  end if;

  select
    public.wp05_round_omr(coalesce(sum(
      greatest((i.amount + coalesce(i.tax_amount,0) - coalesce(i.paid_amount,0) - coalesce(i.credited_amount,0)), 0)
    ),0)),
    count(*) filter (where greatest((i.amount + coalesce(i.tax_amount,0) - coalesce(i.paid_amount,0) - coalesce(i.credited_amount,0)),0) > 0.0005)::bigint
  into v_bal, v_cnt
  from public.invoices i
  where i.company_id = p_company_id
    and i.deleted_at is null
    and coalesce(upper(i.status::text),'') not in ('VOID','VOIDED','CANCELLED')
    and i.issue_date <= p_as_of
    and (i.amount + coalesce(i.tax_amount,0) - coalesce(i.paid_amount,0) - coalesce(i.credited_amount,0)) > 0.0005;

  return query select coalesce(v_bal,0)::numeric, coalesce(v_cnt,0)::bigint;
end;
$$;

-- Overdue report: outstanding = amount + tax - paid - credited.
create or replace function public.rpt_overdue_invoices(p_as_of date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows jsonb;
  v_total numeric;
  v_count bigint;
  v_company_id uuid := public.require_company_id();
begin
  select jsonb_agg(jsonb_build_object(
      'invoice_id', i.id, 'invoice_no', i.no, 'due_date', i.due_date,
      'days_overdue', (p_as_of - i.due_date)::int,
      'amount', public._r3(i.amount + COALESCE(i.tax_amount, 0)),
      'paid', public._r3(i.paid_amount),
      'credited', public._r3(COALESCE(i.credited_amount, 0)),
      'remaining', public._r3(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount - COALESCE(i.credited_amount, 0)),
      'tenant_name', t.full_name, 'tenant_phone', t.phone,
      'unit_name', u.unit_number, 'property_name', pr.title, 'contract_id', c.id)
      ORDER BY (p_as_of - i.due_date) DESC),
    public._r3(sum(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount - COALESCE(i.credited_amount, 0))), count(*)
  into v_rows, v_total, v_count
  FROM public.invoices i
  JOIN public.contracts c ON c.id::text = i.contract_id::text AND c.deleted_at IS NULL
  JOIN public.people t ON t.id::text = c.tenant_id::text AND t.type = 'tenant' AND t.deleted_at IS NULL
  JOIN public.units u ON u.id::text = c.unit_id::text AND u.deleted_at IS NULL
  JOIN public.properties pr ON pr.id::text = c.property_id::text AND pr.deleted_at IS NULL
  WHERE upper(COALESCE(i.status, '')) NOT IN ('PAID', 'VOID', 'CANCELLED')
    AND i.deleted_at IS NULL
    AND i.company_id = v_company_id
    AND i.due_date < p_as_of
    AND (i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount - COALESCE(i.credited_amount, 0)) > 0.001;

  return jsonb_build_object(
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'total_overdue', COALESCE(v_total, 0),
    'count', COALESCE(v_count, 0),
    'as_of', p_as_of
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Security posture for the new SECURITY DEFINER RPCs
-- ---------------------------------------------------------------------------
revoke all on function public.create_invoice_credit_atomic(jsonb) from public, anon;
grant execute on function public.create_invoice_credit_atomic(jsonb) to authenticated, service_role;
revoke all on function public.reverse_invoice_credit_atomic(jsonb) from public, anon;
grant execute on function public.reverse_invoice_credit_atomic(jsonb) to authenticated, service_role;

commit;

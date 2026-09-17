-- Align receipt VOID request/approval/execution with company-role authority.
--
-- CONTEXT
-- This migration was applied directly to production on 2026-09-13 as
-- `align_receipt_void_request_acl_with_company_role`
-- (supabase_migrations.schema_migrations.version = '20260913073735') but was
-- never committed to this repository. It is added here after the fact, using
-- the exact version Supabase generated in production, per the reconciliation
-- precedent already documented in this directory's README.md
-- ("2026-07-18 canonical ledger reconciliation" / the
-- 20260913030547_fix_authenticated_acl_delete_and_spc_grants precedent):
-- planning timestamps are replaced with their exact live versions rather than
-- invented, and an already-applied version already has a row in the
-- production ledger, so a future clean replay against this same database
-- will treat this file as already applied and skip it — it will not re-run
-- and cannot conflict or double-apply.
--
-- Statements below are `CREATE OR REPLACE FUNCTION`, reproducing the four
-- receipt-VOID lifecycle functions exactly as they exist live today
-- (confirmed via pg_get_functiondef on 2026-09-17), so this file is a
-- documentation-only capture of already-live behavior, not a new change.
--
-- SCOPE
-- The receipt VOID maker/checker lifecycle (request -> approve -> execute)
-- authorizes on `public.is_admin_or_manager()` (a company-role predicate)
-- rather than any global/platform role, and the sole-admin self-approval
-- exception is gated the same way (`public.wp01_is_sole_admin_allowed`).
-- This file captures that as it stands live:
--   * request_receipt_void_atomic(jsonb) — creates a PENDING void request,
--     company-scoped receipt/payment lookup, idempotent on request_id.
--   * approve_receipt_void_atomic(jsonb) — maker-checker approval, denies
--     self-approval unless the company is a documented sole-admin exception,
--     delegates execution to execute_receipt_void_internal.
--   * execute_receipt_void_internal(jsonb) — the atomic void: reverses
--     journal entries via the canonical batch-reversal engine (or legacy
--     compat path), reverts invoice paid_amount/status, marks payment and
--     receipt VOID, idempotent on request_id with a fingerprint check.
--   * capture_owner_funds_receipt_void_reversal() — trigger function that
--     mirrors an EXECUTED void into an owner-funds reversal event.
--
-- No RLS, policy, grant, or schema change is made by this file; all four
-- objects already exist live with SECURITY DEFINER and search_path locked to
-- 'public', 'pg_temp'.

begin;

create or replace function public.request_receipt_void_atomic(payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid := public.current_company_id();
  v_requested_id text := nullif(btrim(payload->>'receipt_id'), '');
  v_reason text := nullif(btrim(payload->>'reason'), '');
  v_request_id text := nullif(btrim(payload->>'request_id'), '');
  v_receipt public.receipts%rowtype;
  v_existing public.receipt_void_requests%rowtype;
  v_row public.receipt_void_requests%rowtype;
begin
  if v_actor is null or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'ADMIN or MANAGER role is required to request receipt VOID.'
      using errcode = '42501';
  end if;

  if v_company_id is null then
    raise exception 'Company context is required to request receipt VOID.'
      using errcode = '42501';
  end if;

  if v_requested_id is null or v_reason is null or v_request_id is null then
    raise exception 'receipt_id, reason, and request_id are required.'
      using errcode = '22023';
  end if;

  select r.*
    into v_receipt
  from public.receipts r
  where r.company_id = v_company_id
    and r.deleted_at is null
    and (
      r.id::text = v_requested_id
      or exists (
        select 1
        from public.payments p
        where p.company_id = v_company_id
          and p.deleted_at is null
          and p.id::text = v_requested_id
          and p.receipt_id::text = r.id::text
      )
    )
  order by case when r.id::text = v_requested_id then 0 else 1 end
  limit 1
  for update;

  if v_receipt.id is null then
    raise exception 'Receipt was not found in the active company.'
      using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('receipt_void_request:' || v_company_id::text || ':' || v_receipt.id::text, 0)
  );

  select q.*
    into v_existing
  from public.receipt_void_requests q
  where q.company_id = v_company_id
    and q.request_id = v_request_id
  for update;

  if v_existing.id is not null then
    if v_existing.receipt_id <> v_receipt.id::text
       or v_existing.reason <> v_reason
       or v_existing.requested_by <> v_actor then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST'
        using errcode = '22023';
    end if;

    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'void_request_id', v_existing.id,
      'request_id', v_existing.request_id,
      'receipt_id', v_existing.receipt_id,
      'status', v_existing.status,
      'reason', v_existing.reason,
      'requested_by', v_existing.requested_by,
      'requested_at', v_existing.requested_at
    );
  end if;

  if upper(coalesce(v_receipt.status::text, '')) <> 'POSTED' then
    raise exception 'Only POSTED receipts can enter the VOID approval lifecycle.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.company_id = v_company_id
      and p.deleted_at is null
      and p.receipt_id::text = v_receipt.id::text
      and upper(coalesce(p.status::text, '')) = 'POSTED'
  ) then
    raise exception 'A linked POSTED payment is required to request receipt VOID.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.receipt_void_requests q
    where q.company_id = v_company_id
      and q.receipt_id = v_receipt.id::text
      and q.status = 'PENDING'
  ) then
    raise exception 'RECEIPT_VOID_ALREADY_PENDING'
      using errcode = '23505';
  end if;

  insert into public.receipt_void_requests (
    company_id, receipt_id, reason, requested_by, request_id
  ) values (
    v_company_id, v_receipt.id::text, v_reason, v_actor, v_request_id
  )
  returning * into v_row;

  update public.receipts
     set maker_user_id = v_actor,
         updated_at = now()
   where id::text = v_receipt.id::text
     and company_id = v_company_id;

  insert into public.audit_log (
    id, ts, user_id, action, entity, entity_id, note, "table", details,
    old_value, new_value, action_timestamp, created_at, updated_at
  ) values (
    gen_random_uuid()::text,
    extract(epoch from now())::bigint,
    v_actor::text,
    'REQUEST_RECEIPT_VOID',
    'receipt_void_request',
    v_row.id::text,
    'Receipt VOID requested; financial state remains unchanged pending separate approval.',
    'receipt_void_requests',
    jsonb_build_object(
      'company_id', v_company_id,
      'receipt_id', v_row.receipt_id,
      'reason', v_row.reason,
      'request_id', v_row.request_id,
      'requested_by', v_row.requested_by
    )::text,
    null,
    jsonb_build_object('status', 'PENDING'),
    now(), now(), now()
  );

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'void_request_id', v_row.id,
    'request_id', v_row.request_id,
    'receipt_id', v_row.receipt_id,
    'status', v_row.status,
    'reason', v_row.reason,
    'requested_by', v_row.requested_by,
    'requested_at', v_row.requested_at
  );
end;
$function$;

create or replace function public.approve_receipt_void_atomic(payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid := public.current_company_id();
  v_void_request_id uuid := nullif(btrim(payload->>'void_request_id'), '')::uuid;
  v_execution_request_id text := nullif(btrim(payload->>'request_id'), '');
  v_request public.receipt_void_requests%rowtype;
  v_result jsonb;
  v_is_sole_admin_exception boolean := false;
begin
  if v_actor is null or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'ADMIN or MANAGER role is required to approve receipt VOID.'
      using errcode = '42501';
  end if;

  if v_company_id is null then
    raise exception 'Company context is required to approve receipt VOID.'
      using errcode = '42501';
  end if;

  if v_void_request_id is null or v_execution_request_id is null then
    raise exception 'void_request_id and request_id are required.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('receipt_void_approval:' || v_company_id::text || ':' || v_void_request_id::text, 0)
  );

  select q.*
    into v_request
  from public.receipt_void_requests q
  where q.id = v_void_request_id
    and q.company_id = v_company_id
  for update;

  if v_request.id is null then
    raise exception 'Receipt VOID request was not found in the active company.'
      using errcode = 'P0002';
  end if;

  if v_request.status = 'EXECUTED' then
    if v_request.execution_request_id <> v_execution_request_id
       or v_request.result_payload is null then
      raise exception 'RECEIPT_VOID_REQUEST_ALREADY_EXECUTED'
        using errcode = '22023';
    end if;
    return v_request.result_payload || jsonb_build_object('idempotent', true);
  end if;

  if v_request.status <> 'PENDING' then
    raise exception 'Only PENDING receipt VOID requests can be approved.'
      using errcode = '22023';
  end if;

  v_is_sole_admin_exception := (v_request.requested_by = v_actor);

  if v_is_sole_admin_exception
     and not public.wp01_is_sole_admin_allowed(v_company_id) then
    raise exception 'MAKER_CHECKER_SELF_APPROVAL_DENIED: receipt VOID requester cannot approve the same request.'
      using errcode = '42501';
  end if;

  v_result := public.execute_receipt_void_internal(jsonb_build_object(
    'receipt_id', v_request.receipt_id,
    'reason', v_request.reason,
    'request_id', 'void-approved:' || v_execution_request_id
  ));

  v_result := v_result || jsonb_build_object(
    'void_request_id', v_request.id,
    'void_request_status', 'EXECUTED',
    'requested_by', v_request.requested_by,
    'approved_by', v_actor,
    'approval_request_id', v_execution_request_id,
    'is_sole_admin_exception', v_is_sole_admin_exception
  );

  update public.receipt_void_requests
     set status = 'EXECUTED',
         reviewed_by = v_actor,
         reviewed_at = now(),
         execution_request_id = v_execution_request_id,
         reversal_batch_id = nullif(v_result->>'journal_reversal_batch_id', '')::uuid,
         result_payload = v_result,
         is_sole_admin_exception = v_is_sole_admin_exception,
         updated_at = now()
   where id = v_request.id;

  -- Preserve the canonical audit action/entity contract used by release
  -- evidence and operational audit queries. The sole-admin flag is additive.
  insert into public.audit_log (
    id, ts, user_id, action, entity, entity_id, note, "table", details,
    old_value, new_value, action_timestamp, created_at, updated_at
  ) values (
    gen_random_uuid()::text,
    extract(epoch from now())::bigint,
    v_actor::text,
    'APPROVE_RECEIPT_VOID',
    'receipt_void_request',
    v_request.id::text,
    'Receipt VOID separately approved and executed through the canonical reversal engine.',
    'receipt_void_requests',
    jsonb_build_object(
      'company_id', v_company_id,
      'receipt_id', v_request.receipt_id,
      'reason', v_request.reason,
      'requested_by', v_request.requested_by,
      'approved_by', v_actor,
      'approval_request_id', v_execution_request_id,
      'journal_reversal_batch_id', v_result->>'journal_reversal_batch_id',
      'is_sole_admin_exception', v_is_sole_admin_exception
    )::text,
    jsonb_build_object('status', 'PENDING'),
    jsonb_build_object(
      'status', 'EXECUTED',
      'requested_by', v_request.requested_by,
      'approved_by', v_actor,
      'is_sole_admin_exception', v_is_sole_admin_exception
    ),
    now(), now(), now()
  );

  return v_result || jsonb_build_object('idempotent', false);
end;
$function$;

create or replace function public.execute_receipt_void_internal(payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
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
  v_company_id uuid;
  v_request_fingerprint text;
  v_cached_fingerprint text;
  v_cached_target_id text;
BEGIN
  IF v_actor_id IS NULL OR NOT coalesce(public.is_admin_or_manager(), false) THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to void receipts.'
      USING ERRCODE = '42501';
  END IF;

  -- 3A-1B: bind the operation to the caller's company BEFORE any replay/lookup.
  v_company_id := public.current_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company context is required to void receipts.'
      USING ERRCODE = '42501';
  END IF;

  IF v_requested_id IS NULL OR v_reason IS NULL OR v_request_id IS NULL THEN
    RAISE EXCEPTION 'receipt_id, reason, and request_id are required.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('void_receipt_atomic:' || v_company_id::text || ':' || v_request_id, 0)
  );

  -- 3A-1B: resolution is company-scoped — cross-company identifiers behave
  -- exactly like "not found" (no existence leakage, no cross-company locks).
  SELECT p.*
  INTO v_payment
  FROM public.payments p
  WHERE p.id::text = v_requested_id
    AND p.deleted_at IS NULL
    AND p.company_id = v_company_id
  FOR UPDATE;

  IF v_payment.id IS NOT NULL THEN
    SELECT r.*
    INTO v_receipt
    FROM public.receipts r
    WHERE r.id::text = coalesce(nullif(v_payment.receipt_id::text, ''), v_payment.id::text)
      AND r.deleted_at IS NULL
      AND r.company_id = v_company_id
    FOR UPDATE;
  ELSE
    SELECT r.*
    INTO v_receipt
    FROM public.receipts r
    WHERE r.id::text = v_requested_id
      AND r.deleted_at IS NULL
      AND r.company_id = v_company_id
    FOR UPDATE;

    IF v_receipt.id IS NOT NULL THEN
      SELECT p.*
      INTO v_payment
      FROM public.payments p
      WHERE p.receipt_id::text = v_receipt.id::text
        AND p.deleted_at IS NULL
        AND p.company_id = v_company_id
      ORDER BY p.created_at DESC NULLS LAST, p.id
      LIMIT 1
      FOR UPDATE;
    END IF;
  END IF;

  IF v_payment.id IS NULL OR v_receipt.id IS NULL THEN
    RAISE EXCEPTION 'Linked payment and receipt were not found for identifier %.', v_requested_id
      USING ERRCODE = 'P0002';
  END IF;

  v_request_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'receipt_id', v_receipt.id::text,
    'reason', v_reason,
    'note', nullif(btrim(payload->>'note'), ''),
    'date', nullif(payload->>'date', '')::date,
    'voided_at', nullif(payload->>'voided_at', '')::timestamptz
  )::text, 'UTF8')), 'hex');

  SELECT response_payload
  INTO v_cached
  FROM public.financial_operation_idempotency
  WHERE operation_name = 'void_receipt_atomic:' || v_company_id::text
    AND request_id = v_request_id
  FOR UPDATE;

  IF v_cached IS NOT NULL THEN
    v_cached_fingerprint := v_cached->>'_request_fingerprint';
    v_cached_target_id := v_cached->>'_target_id';
    IF v_cached_fingerprint IS NULL
       OR v_cached_target_id IS NULL
       OR NOT (v_cached ? 'response') THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED'
        USING ERRCODE = '22023';
    END IF;
    IF v_cached_fingerprint <> v_request_fingerprint
       OR v_cached_target_id <> v_receipt.id::text THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST'
        USING ERRCODE = '22023';
    END IF;
    RETURN (v_cached->'response') || jsonb_build_object('idempotent', true);
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

  SELECT count(*)::integer
  INTO v_existing_reversal_count
  FROM public.journal_entries je
  WHERE je.source_id::text = v_receipt.id::text
    AND je.deleted_at IS NULL
    AND je.request_id = v_reversal_request_id
    AND je.entity_type = 'receipt_void';

  -- Adjust invoices associated with allocations
  IF NOT v_receipt_was_void THEN
    WITH allocated AS (
      SELECT invoice_id, sum(amount) AS total
      FROM public.receipt_allocations
      WHERE receipt_id::text = v_receipt.id::text
        AND deleted_at IS NULL
      GROUP BY invoice_id
    )
    UPDATE public.invoices i
    SET
      paid_amount = coalesce(i.paid_amount, 0) - allocated.total,
      status = CASE
        WHEN coalesce(i.paid_amount, 0) - allocated.total <= 0 THEN 'UNPAID'
        WHEN coalesce(i.paid_amount, 0) - allocated.total
          < coalesce(i.amount, 0) + coalesce(i.tax_amount, 0) - 0.001 THEN 'PARTIALLY_PAID'
        ELSE 'PAID'
      END,
      updated_at = now()
    FROM allocated
    WHERE i.id = allocated.invoice_id
      AND i.company_id = v_company_id;
  END IF;

  UPDATE public.receipts
  SET status = 'VOID', voided_at = floor(extract(epoch from clock_timestamp()) * 1000)::bigint, updated_at = now()
  WHERE id::text = v_receipt.id::text;

  UPDATE public.payments
  SET status = 'VOID', updated_at = now()
  WHERE id = v_payment.id;

  -- Stage S03: canonical receipt batches use the engine-managed reversal.
  IF v_original_count > 0 AND v_existing_reversal_count = 0 THEN
    -- A receipt posted through Stage S03 has exactly one canonical source batch.
    -- Prefer that batch and let reverse_journal_batch own reversal identity,
    -- line inversion, period routing and idempotency.
    SELECT b.id
      INTO v_reversal_batch_id
    FROM public.journal_batches b
    WHERE b.company_id = v_company_id
      AND b.source_type = 'receipt'
      AND b.source_id = v_receipt.id::text
      AND NOT b.is_legacy_compat
    ORDER BY b.created_at, b.id
    LIMIT 1;

    IF v_reversal_batch_id IS NOT NULL THEN
      v_result := public.reverse_journal_batch(v_reversal_batch_id);

      -- The engine returns the created/reused reversal id. Preserve the public
      -- void_receipt_atomic response fields while reporting created line count
      -- only for a newly-created reversal.
      v_reversal_batch_id := nullif(v_result->>'reversal_batch_id', '')::uuid;
      IF coalesce((v_result->>'idempotent')::boolean, false) THEN
        v_created_reversal_count := 0;
      ELSE
        SELECT count(*)::integer
          INTO v_created_reversal_count
        FROM public.journal_lines jl
        WHERE jl.batch_id = v_reversal_batch_id
          AND jl.deleted_at IS NULL;
      END IF;
    ELSE
      -- Historical compatibility receipt: retain the pre-S03 behavior so old
      -- financial history remains voidable without rewriting legacy batches.
      v_reversal_batch_id := gen_random_uuid();

      INSERT INTO public.journal_entries (
        id, no, date, account_id, amount, type, source_id, entity_type,
        entity_id, created_at, request_id, status, batch_id, company_id
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
        v_reversal_batch_id,
        je.company_id
      FROM public.journal_entries je
      WHERE je.source_id::text = v_receipt.id::text
        AND je.deleted_at IS NULL
        AND coalesce(je.request_id, '') <> v_reversal_request_id
        AND coalesce(je.entity_type, '') <> 'receipt_void';

      GET DIAGNOSTICS v_created_reversal_count = ROW_COUNT;
      PERFORM public.close_journal_batch(v_reversal_batch_id);
    END IF;
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
    'void_receipt_atomic:' || v_company_id::text,
    v_request_id,
    jsonb_build_object(
      '_request_fingerprint', v_request_fingerprint,
      '_target_id', v_receipt.id::text,
      'response', v_result
    )
  )
  ON CONFLICT (operation_name, request_id) DO NOTHING;

  RETURN v_result;
END;
$function$;

create or replace function public.capture_owner_funds_receipt_void_reversal()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_event public.owner_funds_events%rowtype;
begin
  if new.status = 'EXECUTED' and old.status is distinct from 'EXECUTED' then
    for v_event in
      select *
        from public.owner_funds_events e
       where e.company_id = new.company_id
         and e.source_id = new.receipt_id::text
         and e.source_type in ('OWNER_COLLECTION', 'MANAGEMENT_FEE')
    loop
      insert into public.owner_funds_events (
        company_id, owner_id, contract_id, invoice_id, source_type, source_id,
        event_id, amount_delta, effective_date, journal_batch_id
      ) values (
        new.company_id, v_event.owner_id, v_event.contract_id, v_event.invoice_id,
        'RECEIPT_VOID_REVERSAL', new.id::text, v_event.id::text,
        -v_event.amount_delta, current_date, new.reversal_batch_id
      ) on conflict (company_id, source_type, source_id, event_id) do nothing;
    end loop;
  end if;
  return new;
end;
$function$;

commit;

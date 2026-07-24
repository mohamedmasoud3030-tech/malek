-- Phase 3A-1B — Canonical Account Resolution for Invoice, Payment, Receipt & VOID
-- ==================================================================================
-- Removes global account lookups (`WHERE no = '...' LIMIT 1`) and cross-company
-- reach from the active financial definitions of the invoice/payment/receipt/VOID
-- lifecycle. Account resolution now goes through the Phase 3A-1A helpers
-- (require_company_account_id / ensure_company_account) — those helpers are NOT
-- redefined here and their behavior is unchanged.
--
-- Doctrine enforced by this migration:
--   * every account lookup is company-scoped (via require_company_account_id);
--   * account numbers are never used as account IDs;
--   * idempotency operation keys are namespaced `<operation_name>:<company_uuid>`
--     (financial_operation_idempotency stays globally keyed — PK unchanged);
--   * receipts.request_id keeps its RAW value in storage (release-blocker gate
--     contract); the global UNIQUE on receipts.request_id fails loudly (23505) if
--     request_ids collide across companies — relaxed only in Phase 3A-2 together
--     with accounts.no composite uniqueness;
--   * VOID reuses the ORIGINAL journal account_ids (never re-looked-up);
--   * no grants are re-issued: CREATE OR REPLACE preserves existing ACLs;
--   * the legacy overload void_receipt_atomic(uuid, timestamptz, jsonb, jsonb) is
--     deliberately left byte-identical — there is no proof of non-usage, and it is
--     not callable by anon/authenticated/service_role.
-- Deferred (documented in docs/audits/PHASE3A1B_INVOICE_PAYMENT_RECEIPT_VOID.md):
--   Owner settlements (3A-1C) · composite UNIQUE(company_id, no) (3A-2) · PDC.

begin;

-- ── 1. find_payment_account_id — company-scoped resolution via 3A-1A helper ───────
-- Same signature, same role→number mapping. Previously resolved the account with a
-- GLOBAL `WHERE a.no = v_target_no LIMIT 1` (could return another company's account
-- or NULL silently). Now derives the caller's company from the JWT server-side and
-- delegates to require_company_account_id (loud P0001 when unconfigured, 23505 on
-- ambiguity). Internal helper — stays unexposed (no ACL changes).
CREATE OR REPLACE FUNCTION public.find_payment_account_id(account_role text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_target_no text;
  v_company_id uuid;
begin
  case account_role
    when 'cash' then v_target_no := '1111';
    when 'receivable' then v_target_no := '1201';
    else return null;
  end case;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'Company context is required to resolve payment accounts.' using errcode = '42501';
  end if;

  return public.require_company_account_id(v_company_id, v_target_no);
end;
$function$;

-- ── 2. generate_invoices_from_active_contracts — company-canonical accounts/scope ─
-- Signature, proration/period logic, invoice numbering inputs, due dates, statuses,
-- amount math and OMR rounding are preserved exactly. Changes:
--   * explicit company-context guard (42501) after JWT derivation;
--   * AR 1201 / Revenue 4000 resolved per-company via require_company_account_id
--     (the previous NULL-guard remains semantically: the helper raises first);
--   * VAT settings read is scoped to the caller's company;
--   * VAT 2100 is required loud-and-clear ONLY when VAT is actually charged
--     (previously a missing 2100 silently produced an unbalanced journal);
--   * the active-contracts loop is scoped to the caller's company — previously it
--     iterated over ALL companies' contracts and stamped them with the caller's
--     company_id.
CREATE OR REPLACE FUNCTION public.generate_invoices_from_active_contracts()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_company_id uuid;
  v_contract record;
  v_invoice_id uuid;
  v_batch_id uuid;
  v_tax_rate numeric;
  v_tax_amount numeric;
  v_total_amount numeric;
  v_ar_account_id text;
  v_revenue_account_id text;
  v_vat_account_id text;
  v_count integer := 0;
  v_period_start date;
  v_period_end date;
  v_invoice_exists boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to generate invoices' USING ERRCODE = '42501';
  END IF;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company context is required (no company_id claim in JWT).' USING ERRCODE = '42501';
  END IF;

  -- 3A-1B: company-scoped canonical accounts (loud when unconfigured/ambiguous).
  v_ar_account_id := public.require_company_account_id(v_company_id, '1201');
  v_revenue_account_id := public.require_company_account_id(v_company_id, '4000');

  SELECT CASE WHEN vat_enabled THEN COALESCE(vat_rate, 0) ELSE 0 END
    INTO v_tax_rate
    FROM public.company_settings
    WHERE company_id = v_company_id
    LIMIT 1;

  IF v_tax_rate IS NULL THEN
    v_tax_rate := 0;
  END IF;

  -- VAT payable (2100) is only required when VAT is actually charged.
  IF v_tax_rate > 0 THEN
    v_vat_account_id := public.require_company_account_id(v_company_id, '2100');
  END IF;

  FOR v_contract IN
    SELECT c.id, c.rent_amount, c.payment_cycle, c.start_date
    FROM public.contracts c
    WHERE c.deleted_at IS NULL
      AND lower(c.status) = 'active'
      AND c.company_id = v_company_id
    ORDER BY c.id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('invoice_generation:' || v_contract.id::text));

    CASE v_contract.payment_cycle
      WHEN 'monthly' THEN
        v_period_start := date_trunc('month', current_date)::date;
        v_period_end := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
      WHEN 'quarterly' THEN
        v_period_start := date_trunc('quarter', current_date)::date;
        v_period_end := (date_trunc('quarter', current_date) + interval '3 months' - interval '1 day')::date;
      WHEN 'semi_annual' THEN
        IF EXTRACT(MONTH FROM current_date) <= 6 THEN
          v_period_start := make_date(EXTRACT(YEAR FROM current_date)::int, 1, 1);
          v_period_end := make_date(EXTRACT(YEAR FROM current_date)::int, 6, 30);
        ELSE
          v_period_start := make_date(EXTRACT(YEAR FROM current_date)::int, 7, 1);
          v_period_end := make_date(EXTRACT(YEAR FROM current_date)::int, 12, 31);
        END IF;
      WHEN 'annual' THEN
        v_period_start := date_trunc('year', current_date)::date;
        v_period_end := (date_trunc('year', current_date) + interval '1 year' - interval '1 day')::date;
      ELSE
        v_period_start := date_trunc('month', current_date)::date;
        v_period_end := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
    END CASE;

    SELECT EXISTS(
      SELECT 1 FROM public.invoices i
      WHERE i.contract_id = v_contract.id
        AND i.issue_date >= v_period_start
        AND i.issue_date <= v_period_end
        AND i.deleted_at IS NULL
    ) INTO v_invoice_exists;

    IF v_invoice_exists THEN
      CONTINUE;
    END IF;

    v_tax_amount := round(v_contract.rent_amount * v_tax_rate / 100, 2);
    v_total_amount := v_contract.rent_amount + v_tax_amount;

    v_batch_id := gen_random_uuid();

    INSERT INTO public.invoices (
      contract_id, issue_date, due_date, amount, tax_amount, tax_rate, status
    , company_id) VALUES (
      v_contract.id,
      current_date,
      current_date + interval '30 days',
      v_contract.rent_amount,
      v_tax_amount,
      v_tax_rate,
      'UNPAID'
    , v_company_id)
    RETURNING id INTO v_invoice_id;

    INSERT INTO public.journal_entries (
      id, no, date, account_id, amount, type, source_id, entity_type, entity_id, batch_id, created_at
    , company_id) VALUES (
      gen_random_uuid(),
      'INV-' || v_invoice_id::text || '-DR',
      current_date,
      v_ar_account_id,
      v_total_amount,
      'DEBIT',
      v_invoice_id,
      'invoice',
      v_invoice_id::text,
      v_batch_id,
      now()
    , v_company_id);

    INSERT INTO public.journal_entries (
      id, no, date, account_id, amount, type, source_id, entity_type, entity_id, batch_id, created_at
    , company_id) VALUES (
      gen_random_uuid(),
      'INV-' || v_invoice_id::text || '-CR-REV',
      current_date,
      v_revenue_account_id,
      v_contract.rent_amount,
      'CREDIT',
      v_invoice_id,
      'invoice',
      v_invoice_id::text,
      v_batch_id,
      now()
    , v_company_id);

    IF v_tax_amount > 0 AND v_vat_account_id IS NOT NULL THEN
      INSERT INTO public.journal_entries (
        id, no, date, account_id, amount, type, source_id, entity_type, entity_id, batch_id, created_at
      , company_id) VALUES (
        gen_random_uuid(),
        'INV-' || v_invoice_id::text || '-CR-VAT',
        current_date,
        v_vat_account_id,
        v_tax_amount,
        'CREDIT',
        v_invoice_id,
        'invoice',
        v_invoice_id::text,
        v_batch_id,
        now()
      , v_company_id);
    END IF;

    v_count := v_count + 1;
  END LOOP;

  IF v_count > 0 THEN
    INSERT INTO public.audit_log (
      id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
    ) VALUES (
      gen_random_uuid()::text,
      extract(epoch from now())::bigint,
      auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'GENERATE',
      'invoices',
      'batch',
      format('Generated %s invoices from active contracts', v_count),
      'invoices',
      jsonb_build_object('count', v_count, 'tax_rate', v_tax_rate)::text,
      now()
    );
  END IF;

  RETURN v_count;
END;
$function$;

-- ── 3. record_invoice_payment_atomic — namespaced idempotency + canonical accounts ─
-- Payload contract, return shape, locking, delegation to post_receipt_atomic and
-- the overpay guard are unchanged. Changes:
--   * advisory lock + idempotency operation key are namespaced with the company
--     uuid: `record_invoice_payment_atomic:<company_uuid>` — the same request_id
--     in another company can never replay this company's response;
--   * cash (1111) / receivable (1201) resolve through the now-company-scoped
--     find_payment_account_id (kept in the chain by design).
CREATE OR REPLACE FUNCTION public.record_invoice_payment_atomic(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  actor_id uuid;
  v_invoice_id_raw text;
  v_invoice_id uuid;
  v_amount numeric;
  v_method text;
  v_date date;
  v_reference text;
  v_request_id text;
  v_invoice jsonb;
  v_contract jsonb;
  v_total_due numeric;
  v_paid_amount numeric;
  v_outstanding numeric;
  v_receipt_id uuid := gen_random_uuid();
  v_allocation_id uuid := gen_random_uuid();
  v_debit_account_id text;
  v_credit_account_id text;
  v_internal_payload jsonb;
  v_internal_result jsonb;
  v_existing_result jsonb;
  v_result jsonb;
  v_company_id uuid;
BEGIN
  actor_id := auth.uid();
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to record invoice payments';
  END IF;

  IF NOT coalesce(public.is_admin_or_manager(), false) THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to record invoice payments'
      USING ERRCODE = '42501';
  END IF;

  -- P0 (F-WR): bind the operation to the caller's company.
  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company context is required (no company_id claim in JWT).' USING ERRCODE = '42501';
  END IF;

  v_request_id := nullif(payload->>'request_id', '');
  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'request_id is required for idempotent payment recording';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('record_invoice_payment_atomic:' || v_company_id::text || ':' || v_request_id, 0)
  );

  SELECT response_payload
    INTO v_existing_result
  FROM public.financial_operation_idempotency
  WHERE operation_name = 'record_invoice_payment_atomic:' || v_company_id::text
    AND request_id = v_request_id
  FOR UPDATE;

  IF v_existing_result IS NOT NULL THEN
    RETURN v_existing_result;
  END IF;

  v_invoice_id_raw := nullif(payload->>'invoice_id', '');
  IF v_invoice_id_raw IS NULL THEN
    RAISE EXCEPTION 'invoice_id is required';
  END IF;

  IF v_invoice_id_raw !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'invoice_id is not a valid identifier: %', v_invoice_id_raw;
  END IF;

  v_invoice_id := v_invoice_id_raw::uuid;
  v_amount := coalesce((payload->>'amount')::numeric, 0);
  v_method := nullif(payload->>'method', '');
  v_date := coalesce(nullif(payload->>'date', '')::date, current_date);
  v_reference := nullif(payload->>'reference', '');

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  SELECT to_jsonb(invoice_record)
    INTO v_invoice
  FROM public.invoices AS invoice_record
  WHERE invoice_record.id::text = v_invoice_id::text
    AND coalesce((to_jsonb(invoice_record)->>'deleted_at')::timestamptz, NULL) IS NULL
    AND coalesce(to_jsonb(invoice_record)->>'company_id', '') = v_company_id::text
  FOR UPDATE;

  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  SELECT to_jsonb(contract_record)
    INTO v_contract
  FROM public.contracts AS contract_record
  WHERE contract_record.id::text = (v_invoice->>'contract_id')
    AND coalesce((to_jsonb(contract_record)->>'deleted_at')::timestamptz, NULL) IS NULL
  FOR UPDATE;

  IF v_contract IS NULL THEN
    RAISE EXCEPTION 'Contract for invoice not found';
  END IF;

  v_total_due := coalesce((v_invoice->>'amount')::numeric, 0)
    + coalesce((v_invoice->>'tax_amount')::numeric, 0);
  v_paid_amount := coalesce((v_invoice->>'paid_amount')::numeric, 0);
  v_outstanding := v_total_due - v_paid_amount;

  IF v_amount > v_outstanding + 0.001 THEN
    RAISE EXCEPTION 'Payment amount exceeds outstanding invoice balance';
  END IF;

  v_debit_account_id := public.find_payment_account_id('cash');
  v_credit_account_id := public.find_payment_account_id('receivable');

  IF v_debit_account_id IS NULL OR v_credit_account_id IS NULL THEN
    RAISE EXCEPTION 'Payment accounting accounts are not configured';
  END IF;

  -- Delegate fully to post_receipt_atomic — it now creates payments row automatically
  v_internal_payload := jsonb_build_object(
    'request_id', v_request_id,
    'receipt', jsonb_build_object(
      'id', v_receipt_id,
      'contract_id', v_invoice->>'contract_id',
      'date_time', v_date::text,
      'channel', v_method,
      'amount', v_amount,
      'ref', coalesce(v_reference, v_request_id),
      'notes', 'Invoice payment ' || v_invoice_id::text,
      'status', 'POSTED',
      'created_at', timezone('utc', now()),
      'request_id', v_request_id
    ),
    'allocations', jsonb_build_array(jsonb_build_object(
      'id', v_allocation_id,
      'invoice_id', v_invoice_id,
      'amount', v_amount,
      'created_at', timezone('utc', now())
    )),
    'journal_entries', jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'PAY-' || left(replace(v_request_id, '-', ''), 12) || '-D',
        'date', v_date::text,
        'account_id', v_debit_account_id,
        'amount', v_amount,
        'type', 'DEBIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice->>'contract_id',
        'created_at', timezone('utc', now())
      ),
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'PAY-' || left(replace(v_request_id, '-', ''), 12) || '-C',
        'date', v_date::text,
        'account_id', v_credit_account_id,
        'amount', v_amount,
        'type', 'CREDIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice->>'contract_id',
        'created_at', timezone('utc', now())
      )
    )
  );

  v_internal_result := public.post_receipt_atomic(v_internal_payload);

  v_result := v_internal_result || jsonb_build_object(
    'status', 'recorded',
    'request_id', v_request_id,
    'invoice_id', v_invoice_id,
    'receipt_id', coalesce(
      nullif(v_internal_result->>'receipt_id', '')::uuid,
      v_receipt_id
    )
  );

  INSERT INTO public.financial_operation_idempotency(
    operation_name,
    request_id,
    response_payload
  ) VALUES (
    'record_invoice_payment_atomic:' || v_company_id::text,
    v_request_id,
    v_result
  )
  ON CONFLICT (operation_name, request_id) DO NOTHING;

  RETURN v_result;
END;
$function$;

-- ── 4. post_receipt_atomic — company-scoped replay + journal account ownership ─────
-- Payload contract, shared payment/receipt identity (payments.id =
-- payments.receipt_id = receipts.id), allocation math, overpay guard, status
-- transitions and the RAW request_id storage are unchanged. Changes:
--   * the idempotent replay lookup is scoped to the caller's company — a matching
--     request_id from another company never replays this company's receipt (any
--     remaining cross-company request_id collision then fails loudly on the global
--     UNIQUE (receipts.request_id) with 23505 — see header note / 3A-2);
--   * every client-supplied journal_entries[].account_id must identify an account
--     OWNED by the caller's company (42501 otherwise) — previously the account_id
--     was inserted verbatim.
CREATE OR REPLACE FUNCTION public.post_receipt_atomic(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_receipt jsonb;
  v_allocations jsonb;
  v_journal_entries jsonb;
  v_request_id text;
  v_existing_id public.receipts.id%TYPE;
  v_invoice_id_text text;
  v_invoice record;
  v_allocation_total numeric;

  v_receipt_id public.receipts.id%TYPE;
  v_receipt_contract_id public.receipts.contract_id%TYPE;
  v_receipt_date_time public.receipts.date_time%TYPE;
  v_receipt_tenant_id public.receipts.tenant_id%TYPE;
  v_receipt_check_date public.receipts.check_date%TYPE;
  v_receipt_amount numeric;
  v_receipt_channel text;
  v_receipt_ref text;
  v_receipt_notes text;
  v_receipt_status text;

  v_allocation jsonb;
  v_allocation_id public.receipt_allocations.id%TYPE;
  v_allocation_receipt_id public.receipt_allocations.receipt_id%TYPE;
  v_allocation_invoice_id public.receipt_allocations.invoice_id%TYPE;
  v_allocation_tenant_id public.receipt_allocations.tenant_id%TYPE;

  v_journal jsonb;
  v_journal_id public.journal_entries.id%TYPE;
  v_journal_date public.journal_entries.date%TYPE;
  v_journal_source_id public.journal_entries.source_id%TYPE;

  v_company_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS app_user
    WHERE app_user.id = auth.uid()
      AND app_user.role::text IN ('ADMIN', 'MANAGER')
      AND app_user.status::text = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول'
      USING ERRCODE = '42501';
  END IF;

  v_company_id := public.current_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: لم يتم العثور على معرّف الشركة للمستخدم الحالي'
      USING ERRCODE = '42501';
  END IF;

  v_receipt := coalesce(payload->'receipt', '{}'::jsonb);
  v_allocations := coalesce(payload->'allocations', '[]'::jsonb);
  v_journal_entries := coalesce(payload->'journal_entries', '[]'::jsonb);
  v_request_id := nullif(coalesce(payload->>'request_id', v_receipt->>'request_id'), '');

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'معرّف الطلب مطلوب لضمان عدم التكرار.';
  END IF;

  -- 3A-1B: replay lookup is company-scoped — no cross-company response leakage.
  SELECT receipt_record.id
    INTO v_existing_id
  FROM public.receipts AS receipt_record
  WHERE receipt_record.request_id = v_request_id
    AND receipt_record.company_id = v_company_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'request_id', v_request_id,
      'receipt_id', v_existing_id
    );
  END IF;

  -- Validate allocations don't exceed invoice balances
  FOR v_invoice_id_text IN
    SELECT DISTINCT allocation_record.value->>'invoice_id'
    FROM jsonb_array_elements(v_allocations) AS allocation_record(value)
    ORDER BY 1
  LOOP
    SELECT
      invoice_record.id,
      invoice_record.amount,
      invoice_record.tax_amount,
      invoice_record.paid_amount,
      invoice_record.status
    INTO v_invoice
    FROM public.invoices AS invoice_record
    WHERE invoice_record.id::text = v_invoice_id_text
      AND coalesce((to_jsonb(invoice_record)->>'company_id')::text, '') = v_company_id::text
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'فاتورة غير موجودة: %', v_invoice_id_text;
    END IF;

    SELECT sum((allocation_record->>'amount')::numeric)
      INTO v_allocation_total
    FROM jsonb_array_elements(v_allocations) AS allocation_record
    WHERE allocation_record->>'invoice_id' = v_invoice_id_text;

    IF coalesce(v_invoice.paid_amount, 0) + v_allocation_total
         > coalesce(v_invoice.amount, 0) + coalesce(v_invoice.tax_amount, 0) + 0.001 THEN
      RAISE EXCEPTION 'قيمة السداد تتجاوز المتبقي على الفاتورة: %', v_invoice_id_text;
    END IF;
  END LOOP;

  -- Extract receipt fields into variables
  v_receipt_id := coalesce(v_receipt->>'id', gen_random_uuid()::text);
  v_receipt_contract_id := nullif(v_receipt->>'contract_id', '');
  -- P0 (F-WR): the receipt contract must belong to the caller's company.
  IF v_receipt_contract_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.contracts contract_record
    WHERE contract_record.id::text = v_receipt_contract_id::text
      AND contract_record.company_id = v_company_id
      AND contract_record.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'غير مصرح: العقد لا ينتمي إلى شركتك.' USING ERRCODE = '42501';
  END IF;
  v_receipt_tenant_id := nullif(v_receipt->>'tenant_id', '');
  v_receipt_check_date := nullif(v_receipt->>'check_date', '');
  v_receipt_amount := (v_receipt->>'amount')::numeric;
  v_receipt_channel := v_receipt->>'channel';
  v_receipt_ref := coalesce(v_receipt->>'ref', '');
  v_receipt_notes := coalesce(v_receipt->>'notes', '');
  v_receipt_status := coalesce(v_receipt->>'status', 'POSTED');

  IF nullif(v_receipt->>'date_time', '') IS NULL THEN
    v_receipt_date_time := now();
  ELSE
    v_receipt_date_time := v_receipt->>'date_time';
  END IF;

  -- Insert receipt
  INSERT INTO public.receipts(
    id,
    no,
    contract_id,
    date_time,
    channel,
    amount,
    ref,
    notes,
    status,
    check_number,
    check_bank,
    check_date,
    check_status,
    created_at,
    request_id,
    tenant_id,
    company_id
  ) VALUES (
    v_receipt_id,
    v_receipt->>'no',
    v_receipt_contract_id,
    v_receipt_date_time,
    v_receipt_channel,
    v_receipt_amount,
    v_receipt_ref,
    v_receipt_notes,
    v_receipt_status,
    nullif(v_receipt->>'check_number', ''),
    nullif(v_receipt->>'check_bank', ''),
    v_receipt_check_date,
    nullif(v_receipt->>'check_status', ''),
    now(),
    v_request_id,
    v_receipt_tenant_id,
    v_company_id
  );

  -- Insert corresponding payments row (shadow record)
  INSERT INTO public.payments(
    receipt_id,
    contract_id,
    amount,
    payment_date,
    payment_method,
    reference_no,
    date_time,
    channel,
    status,
    notes,
    created_by,
    created_at,
    company_id
  ) VALUES (
    v_receipt_id,
    v_receipt_contract_id,
    v_receipt_amount,
    (v_receipt_date_time::date),
    v_receipt_channel,
    nullif(v_receipt_ref, ''),
    v_receipt_date_time,
    v_receipt_channel,
    v_receipt_status,
    nullif(v_receipt_notes, ''),
    auth.uid(),
    now(),
    v_company_id
  );

  -- Insert receipt allocations
  FOR v_allocation IN
    SELECT allocation_record.value
    FROM jsonb_array_elements(v_allocations) AS allocation_record(value)
  LOOP
    v_allocation_id := coalesce(v_allocation->>'id', gen_random_uuid()::text);
    v_allocation_receipt_id := v_receipt_id;
    v_allocation_invoice_id := v_allocation->>'invoice_id';
    v_allocation_tenant_id := nullif(v_allocation->>'tenant_id', '');

    INSERT INTO public.receipt_allocations(
      id,
      receipt_id,
      invoice_id,
      amount,
      created_at,
      tenant_id,
      company_id
    ) VALUES (
      v_allocation_id,
      v_allocation_receipt_id,
      v_allocation_invoice_id,
      (v_allocation->>'amount')::numeric,
      now(),
      v_allocation_tenant_id,
      v_company_id
    );
  END LOOP;

  -- Update invoice paid_amount and status
  WITH allocation_totals AS (
    SELECT
      allocation_record->>'invoice_id' AS invoice_id,
      sum((allocation_record->>'amount')::numeric) AS total
    FROM jsonb_array_elements(v_allocations) AS allocation_record
    GROUP BY 1
  )
  UPDATE public.invoices AS invoice_record
  SET
    paid_amount = coalesce(invoice_record.paid_amount, 0) + allocation_totals.total,
    status = CASE
      WHEN coalesce(invoice_record.paid_amount, 0) + allocation_totals.total
        >= coalesce(invoice_record.amount, 0) + coalesce(invoice_record.tax_amount, 0) - 0.001
        THEN 'PAID'
      WHEN coalesce(invoice_record.paid_amount, 0) + allocation_totals.total > 0
        THEN 'PARTIALLY_PAID'
      ELSE invoice_record.status
    END
  FROM allocation_totals
  WHERE invoice_record.id::text = allocation_totals.invoice_id;

  -- Insert journal entries (3A-1B: account must belong to the caller's company)
  FOR v_journal IN
    SELECT journal_record.value
    FROM jsonb_array_elements(v_journal_entries) AS journal_record(value)
  LOOP
    v_journal_id := coalesce(v_journal->>'id', gen_random_uuid()::text);
    v_journal_date := v_journal->>'date';
    v_journal_source_id := nullif(v_journal->>'source_id', '');

    IF nullif(v_journal->>'account_id', '') IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.accounts AS account_record
      WHERE account_record.id = v_journal->>'account_id'
        AND account_record.company_id = v_company_id
    ) THEN
      RAISE EXCEPTION 'غير مصرح: حساب القيد لا ينتمي إلى شركتك: %', v_journal->>'account_id'
        USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.journal_entries(
      id,
      no,
      date,
      account_id,
      amount,
      type,
      source_id,
      entity_type,
      entity_id,
      created_at,
      company_id
    ) VALUES (
      v_journal_id,
      v_journal->>'no',
      v_journal_date,
      v_journal->>'account_id',
      (v_journal->>'amount')::numeric,
      v_journal->>'type',
      v_journal_source_id,
      nullif(v_journal->>'entity_type', ''),
      nullif(v_journal->>'entity_id', ''),
      now(),
      v_company_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'request_id', v_request_id,
    'receipt_id', v_receipt_id
  );
END;
$function$;

-- ── 5. void_receipt_atomic(payload jsonb) — company isolation + namespaced keys ────
-- Payload contract, return shape, shared identity resolution, single-reversal
-- semantics, reuse of ORIGINAL journal account_ids, soft-VOID doctrine (nothing is
-- deleted) and audit behavior are unchanged. Changes:
--   * the caller's company is derived from the JWT BEFORE the idempotency replay,
--     and the advisory lock + operation key are namespaced
--     `void_receipt_atomic:<company_uuid>`;
--   * payment/receipt resolution is scoped to the caller's company — a
--     cross-company identifier fails exactly like "not found" (P0002) BEFORE any
--     invoice/journal/audit/idempotency write;
--   * the invoice balance reversal is additionally filtered to the caller's
--     company (defense in depth — allocation rows are already company-owned).
CREATE OR REPLACE FUNCTION public.void_receipt_atomic(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
BEGIN
  IF v_actor_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = v_actor_id
      AND u.status::text = 'ACTIVE'
      AND u.role::text IN ('ADMIN', 'MANAGER')
  ) THEN
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

  SELECT response_payload
  INTO v_cached
  FROM public.financial_operation_idempotency
  WHERE operation_name = 'void_receipt_atomic:' || v_company_id::text
    AND request_id = v_request_id
  FOR UPDATE;

  IF v_cached IS NOT NULL THEN
    RETURN v_cached || jsonb_build_object('idempotent', true);
  END IF;

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

  IF v_original_count > 0 AND v_existing_reversal_count = 0 THEN
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
    'void_receipt_atomic:' || v_company_id::text, v_request_id, v_result
  )
  ON CONFLICT (operation_name, request_id) DO NOTHING;

  RETURN v_result;
END;
$function$;

commit;

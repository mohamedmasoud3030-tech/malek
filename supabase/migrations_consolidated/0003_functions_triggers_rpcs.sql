-- Consolidated production baseline: functions, triggers, and operational RPCs

begin;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.set_owner_agreements_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

create or replace function public.validate_property_owner_active_totals()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_other_active_percentage_total numeric;
begin
  if new.ends_on is not null then
    return new;
  end if;

  select coalesce(sum(ownership_percentage), 0)
    into v_other_active_percentage_total
  from public.property_owners
  where property_id = new.property_id
    and ends_on is null
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_other_active_percentage_total + new.ownership_percentage > 100 then
    raise exception 'Active ownership percentages for a property cannot exceed 100.';
  end if;

  return new;
end;
$$;

create or replace function public.recalculate_invoice_status(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.invoices i
  set status = case
      when i.status = 'VOID' then 'VOID'
      when coalesce(i.paid_amount, 0) <= 0 and i.due_date < current_date then 'OVERDUE'
      when coalesce(i.paid_amount, 0) <= 0 then 'UNPAID'
      when coalesce(i.paid_amount, 0) < (i.amount + coalesce(i.tax_amount, 0)) then 'PARTIALLY_PAID'
      else 'PAID'
    end,
    updated_at = now()
  where i.id = p_invoice_id;
end;
$$;

create or replace function public.find_payment_account_id(account_role text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_no text;
  v_account_id text;
begin
  case account_role
    when 'cash' then v_target_no := '1111';
    when 'receivable' then v_target_no := '1201';
    else return null;
  end case;

  select a.id into v_account_id
  from public.accounts a
  where a.no = v_target_no
  limit 1;

  return v_account_id;
end;
$$;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  claims    jsonb;
  user_role text;
BEGIN
  SELECT role::text
    INTO user_role
    FROM public.users
   WHERE id = (event->>'user_id')::uuid
     AND status = 'ACTIVE';

  claims := event -> 'claims';

  IF jsonb_typeof(claims -> 'app_metadata') IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  END IF;

  claims := jsonb_set(
    claims,
    '{app_metadata, user_role}',
    to_jsonb(COALESCE(user_role, 'USER'))
  );

  RETURN jsonb_set(event, '{claims}', claims);
END;
$function$;

CREATE OR REPLACE FUNCTION public.post_receipt_atomic(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_receipt jsonb; v_allocations jsonb; v_journal_entries jsonb;
  v_request_id text; v_receipt_id text; v_existing_id text; v_invoice_id text;
  v_invoice record;
  v_allocation_total numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN','MANAGER') AND u.status = 'ACTIVE') THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول' USING ERRCODE = '42501';
  END IF;
  v_receipt := COALESCE(payload->'receipt', '{}'::jsonb);
  v_allocations := COALESCE(payload->'allocations', '[]'::jsonb);
  v_journal_entries := COALESCE(payload->'journal_entries', '[]'::jsonb);
  v_request_id := nullif(COALESCE(payload->>'request_id', v_receipt->>'request_id'), '');
  IF v_request_id IS NULL THEN RAISE EXCEPTION 'معرّف الطلب مطلوب لضمان عدم التكرار.'; END IF;
  SELECT r.id INTO v_existing_id FROM receipts r WHERE r.request_id = v_request_id LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success',true,'idempotent',true,'request_id',v_request_id,'receipt_id',v_existing_id);
  END IF;

  -- Lock every invoice referenced by an allocation, in a deterministic order
  -- (sorted by id) so concurrent callers touching overlapping invoice sets
  -- always acquire locks in the same order and cannot deadlock each other.
  FOR v_invoice_id IN
    SELECT DISTINCT value->>'invoice_id' FROM jsonb_array_elements(v_allocations) ORDER BY 1
  LOOP
    SELECT i.id, i.amount, i.tax_amount, i.paid_amount, i.status
      INTO v_invoice
      FROM invoices i
      WHERE i.id = v_invoice_id
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'فاتورة غير موجودة: %', v_invoice_id;
    END IF;

    SELECT SUM((a->>'amount')::numeric)
      INTO v_allocation_total
      FROM jsonb_array_elements(v_allocations) AS a
      WHERE a->>'invoice_id' = v_invoice_id;

    IF COALESCE(v_invoice.paid_amount, 0) + v_allocation_total
         > COALESCE(v_invoice.amount, 0) + COALESCE(v_invoice.tax_amount, 0) + 0.001 THEN
      RAISE EXCEPTION 'قيمة السداد تتجاوز المتبقي على الفاتورة: %', v_invoice_id;
    END IF;
  END LOOP;

  v_receipt_id := COALESCE(v_receipt->>'id', gen_random_uuid()::text);
  INSERT INTO receipts(id,no,contract_id,date_time,channel,amount,ref,notes,status,check_number,check_bank,check_date,check_status,created_at,request_id,tenant_id)
  VALUES(v_receipt_id,v_receipt->>'no',v_receipt->>'contract_id',v_receipt->>'date_time',v_receipt->>'channel',(v_receipt->>'amount')::numeric,COALESCE(v_receipt->>'ref',''),COALESCE(v_receipt->>'notes',''),COALESCE(v_receipt->>'status','POSTED'),nullif(v_receipt->>'check_number',''),nullif(v_receipt->>'check_bank',''),nullif(v_receipt->>'check_date',''),nullif(v_receipt->>'check_status',''),now(),v_request_id,nullif(v_receipt->>'tenant_id',''));
  INSERT INTO receipt_allocations(id,receipt_id,invoice_id,amount,created_at,tenant_id)
  SELECT COALESCE(a->>'id',gen_random_uuid()::text),v_receipt_id,a->>'invoice_id',(a->>'amount')::numeric,now(),nullif(a->>'tenant_id','') FROM jsonb_array_elements(v_allocations) AS a;
  WITH at AS (SELECT a->>'invoice_id' AS invoice_id, SUM((a->>'amount')::numeric) AS total FROM jsonb_array_elements(v_allocations) AS a GROUP BY 1)
  UPDATE invoices i SET paid_amount=COALESCE(i.paid_amount,0)+at.total, status=CASE WHEN(COALESCE(i.paid_amount,0)+at.total)>=(COALESCE(i.amount,0)+COALESCE(i.tax_amount,0))-0.001 THEN 'PAID' WHEN(COALESCE(i.paid_amount,0)+at.total)>0 THEN 'PARTIALLY_PAID' ELSE i.status END FROM at WHERE i.id=at.invoice_id;
  INSERT INTO journal_entries(id,no,date,account_id,amount,type,source_id,entity_type,entity_id,created_at)
  SELECT COALESCE(j->>'id',gen_random_uuid()::text),j->>'no',j->>'date',j->>'account_id',(j->>'amount')::numeric,j->>'type',j->>'source_id',nullif(j->>'entity_type',''),nullif(j->>'entity_id',''),now() FROM jsonb_array_elements(v_journal_entries) AS j;
  RETURN jsonb_build_object('success',true,'idempotent',false,'request_id',v_request_id,'receipt_id',v_receipt_id);
END;
$function$;

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
  v_payment_id uuid := gen_random_uuid();
  v_receipt_id uuid := v_payment_id;
  v_allocation_id uuid := gen_random_uuid();
  v_debit_account_id text;
  v_credit_account_id text;
  v_internal_payload jsonb;
  v_internal_result jsonb;
  v_existing_result jsonb;
  v_payment_columns text[];
  v_payment_insert_columns text;
  v_payment_insert_values text;
  v_result jsonb;
BEGIN
  actor_id := auth.uid();
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to record invoice payments';
  END IF;

  IF NOT coalesce(public.is_admin_or_manager(), false) THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to record invoice payments'
      USING errcode = '42501';
  END IF;

  v_request_id := nullif(payload->>'request_id', '');
  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'request_id is required for idempotent payment recording';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'record_invoice_payment_atomic:' || v_request_id,
      0
    )
  );

  SELECT response_payload
    INTO v_existing_result
  FROM public.financial_operation_idempotency
  WHERE operation_name = 'record_invoice_payment_atomic'
    AND request_id = v_request_id
  FOR UPDATE;

  IF v_existing_result IS NOT NULL THEN
    RETURN v_existing_result;
  END IF;

  -- Validate invoice_id format before casting to avoid cryptic Postgres cast errors
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

  SELECT to_jsonb(i)
    INTO v_invoice
  FROM public.invoices i
  WHERE i.id = v_invoice_id::text
    AND coalesce((to_jsonb(i)->>'deleted_at')::timestamptz, NULL) IS NULL
  FOR UPDATE;

  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  SELECT to_jsonb(c)
    INTO v_contract
  FROM public.contracts c
  WHERE c.id = (v_invoice->>'contract_id')
    AND coalesce((to_jsonb(c)->>'deleted_at')::timestamptz, NULL) IS NULL
  FOR UPDATE;

  IF v_contract IS NULL THEN
    RAISE EXCEPTION 'Contract for invoice not found';
  END IF;

  v_total_due := coalesce((v_invoice->>'amount')::numeric, 0) + coalesce((v_invoice->>'tax_amount')::numeric, 0);
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
  v_payment_id := coalesce(nullif(v_internal_result->>'payment_id', '')::uuid, v_payment_id);

  IF v_internal_result ? 'payment_id' THEN
    v_payment_id := (v_internal_result->>'payment_id')::uuid;
  ELSE
    SELECT array_agg(column_name ORDER BY ordinal_position)
      INTO v_payment_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payments'
      AND column_name IN ('id', 'invoice_id', 'contract_id', 'amount', 'payment_method', 'payment_date', 'reference_number', 'payment_reference', 'status', 'receipt_id');

    v_payment_insert_columns := array_to_string(v_payment_columns, ', ');
    v_payment_insert_values := array_to_string(array(
      SELECT CASE column_name
        WHEN 'id' THEN quote_literal(v_payment_id)
        WHEN 'invoice_id' THEN quote_literal(v_invoice_id)
        WHEN 'contract_id' THEN quote_literal(v_invoice->>'contract_id')
        WHEN 'amount' THEN quote_literal(round(v_amount, 2))
        WHEN 'payment_method' THEN quote_literal(v_method)
        WHEN 'payment_date' THEN quote_literal(v_date)
        WHEN 'reference_number' THEN quote_nullable(v_reference)
        WHEN 'payment_reference' THEN quote_nullable(v_reference)
        WHEN 'status' THEN quote_literal('POSTED')
        WHEN 'receipt_id' THEN quote_literal(v_receipt_id)
      END
      FROM unnest(v_payment_columns) AS column_name
    ), ', ');

    EXECUTE format('INSERT INTO public.payments (%s) VALUES (%s)', v_payment_insert_columns, v_payment_insert_values);
  END IF;

  v_result := coalesce(v_internal_result, '{}'::jsonb)
    || jsonb_build_object(
      'status', 'recorded',
      'request_id', v_request_id,
      'invoice_id', v_invoice_id,
      'payment_id', v_payment_id,
      'receipt_id', coalesce(nullif(v_internal_result->>'receipt_id', '')::uuid, v_receipt_id)
    );

  INSERT INTO public.financial_operation_idempotency(operation_name, request_id, response_payload)
  VALUES ('record_invoice_payment_atomic', v_request_id, v_result)
  ON CONFLICT (operation_name, request_id) DO NOTHING;

  RETURN v_result;
END;
$function$;

create or replace function public.void_receipt_atomic(p_receipt_id text, p_voided_at bigint, p_invoice_updates jsonb DEFAULT '[]'::jsonb, p_reverse_entries jsonb DEFAULT '[]'::jsonb)
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

  SELECT * INTO v_receipt FROM public.receipts WHERE id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'سند القبض غير موجود: %', p_receipt_id;
  END IF;

  IF v_receipt.status = 'VOID' THEN
    UPDATE public.payments
    SET status = 'VOID', updated_at = now()
    WHERE (id::text = p_receipt_id OR receipt_id::text = p_receipt_id)
      AND coalesce(status, '') <> 'VOID';

    RETURN jsonb_build_object('success', true, 'idempotent', true, 'receipt_id', p_receipt_id);
  END IF;

  UPDATE public.receipts
  SET status = 'VOID', updated_at = now()
  WHERE id = p_receipt_id;

  UPDATE public.payments
  SET status = 'VOID', updated_at = now()
  WHERE id::text = p_receipt_id OR receipt_id::text = p_receipt_id;

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
  v_requested_receipt_id text := nullif(payload->>'receipt_id', '');
  v_resolved_receipt_id text;
  v_voided_at bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_result jsonb;
BEGIN
  IF v_requested_receipt_id IS NULL THEN
    RAISE EXCEPTION 'receipt_id is required';
  END IF;

  SELECT r.id::text
    INTO v_resolved_receipt_id
  FROM public.receipts r
  WHERE r.id::text = v_requested_receipt_id
  FOR UPDATE;

  IF v_resolved_receipt_id IS NULL THEN
    SELECT p.receipt_id::text
      INTO v_resolved_receipt_id
    FROM public.payments p
    WHERE p.id::text = v_requested_receipt_id
      AND p.receipt_id IS NOT NULL
      AND coalesce((to_jsonb(p)->>'deleted_at')::timestamptz, NULL) IS NULL
    FOR UPDATE;
  END IF;

  v_result := public.void_receipt_atomic(
    coalesce(v_resolved_receipt_id, v_requested_receipt_id),
    v_voided_at,
    '[]'::jsonb,
    '[]'::jsonb
  );

  RETURN coalesce(v_result, '{}'::jsonb)
    || jsonb_build_object(
      'voided_at', v_voided_at::text,
      'requested_receipt_id', v_requested_receipt_id,
      'receipt_id', coalesce(v_resolved_receipt_id, v_requested_receipt_id)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_property_with_agreement(
  p_title              text,
  p_type               text,
  p_address            text,
  p_owner_id           uuid,
  p_agreement_type     text,
  p_commission_type    text,
  p_commission_value   numeric,
  p_agreement_starts_on date,
  p_agreement_ends_on  date    DEFAULT NULL,
  p_owner_name         text    DEFAULT NULL,
  p_purchase_value     numeric DEFAULT NULL,
  p_current_value      numeric DEFAULT NULL,
  p_status             text    DEFAULT 'active',
  p_notes              text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_property_id  text;
  v_agreement_id uuid;
BEGIN
  IF NOT is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنشاء عقار';
  END IF;
  IF p_commission_type = 'RATE' AND (p_commission_value < 0 OR p_commission_value > 100) THEN
    RAISE EXCEPTION 'نسبة العمولة يجب أن تكون بين 0 و100 عند نوع RATE (القيمة المدخلة: %)', p_commission_value;
  END IF;
  INSERT INTO public.properties (title, type, address, owner_id, owner_name, purchase_value, current_value, status, notes)
  VALUES (p_title, p_type, p_address, p_owner_id, p_owner_name, p_purchase_value, p_current_value, p_status, p_notes)
  RETURNING id INTO v_property_id;
  INSERT INTO public.owner_agreements (owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on)
  VALUES (p_owner_id, v_property_id, p_agreement_type, p_commission_type, p_commission_value, p_agreement_starts_on, p_agreement_ends_on)
  RETURNING id INTO v_agreement_id;
  INSERT INTO public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on)
  VALUES (v_property_id, p_owner_id, 100, true, p_agreement_starts_on, p_agreement_ends_on)
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('property_id', v_property_id, 'agreement_id', v_agreement_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_contract_atomic(
  p_property_id text,
  p_unit_id uuid,
  p_tenant_id uuid,
  p_agreement_id uuid,
  p_start_date date,
  p_end_date date,
  p_rent_amount numeric,
  p_payment_cycle text,
  p_payment_terms_id uuid,
  p_status text,
  p_cancellation_reason text,
  p_notes text,
  p_attachment_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنشاء عقد' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.people
    WHERE id = p_tenant_id::text AND type = 'tenant' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'المستأجر غير موجود أو نوعه غير صحيح';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.properties WHERE id = p_property_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'العقار غير موجود';
  END IF;

  IF p_unit_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.units
    WHERE id = p_unit_id AND property_id = p_property_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'الوحدة لا تنتمي إلى العقار المحدد';
  END IF;

  IF p_unit_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.contracts
    WHERE unit_id = p_unit_id
      AND deleted_at IS NULL
      AND status IN ('active', 'draft')
      AND start_date::date < p_end_date
      AND end_date::date > p_start_date
  ) THEN
    RAISE EXCEPTION 'الوحدة محجوزة خلال هذه الفترة';
  END IF;

  IF p_agreement_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد اتفاقية مالك نشطة تغطي فترة العقد — أنشئ اتفاقية مالك أولاً';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.owner_agreements
    WHERE id = p_agreement_id
      AND property_id = p_property_id
      AND starts_on <= p_start_date
      AND (ends_on IS NULL OR ends_on >= p_end_date)
  ) THEN
    RAISE EXCEPTION 'اتفاقية المالك لا تغطي فترة العقد بالكامل أو لا تنتمي لهذا العقار';
  END IF;

  INSERT INTO public.contracts (
    property_id, unit_id, tenant_id, agreement_id,
    start_date, end_date, rent_amount, payment_cycle,
    payment_terms_id, status, cancellation_reason, notes, attachment_url
  ) VALUES (
    p_property_id, p_unit_id, p_tenant_id, p_agreement_id,
    p_start_date, p_end_date, p_rent_amount, p_payment_cycle,
    p_payment_terms_id, p_status, p_cancellation_reason, p_notes, p_attachment_url
  )
  RETURNING id INTO v_id;

  RETURN (SELECT to_jsonb(c) FROM public.contracts c WHERE c.id = v_id::text);
END;
$function$;

CREATE OR REPLACE FUNCTION public.renew_contract_atomic(old_contract_id text, new_contract_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_new_id text;
  v_old public.contracts%rowtype;
  v_active_count integer;
  v_new_start text;
  v_new_end text;
  v_new_amount numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول';
  END IF;

  v_new_start := new_contract_data ->> 'new_start';
  v_new_end := new_contract_data ->> 'new_end';
  v_new_amount := (new_contract_data ->> 'new_amount')::numeric;

  IF v_new_start IS NULL OR v_new_end IS NULL OR v_new_amount IS NULL THEN
    RAISE EXCEPTION 'new_start / new_end / new_amount مطلوبة';
  END IF;

  SELECT * INTO v_old
  FROM public.contracts
  WHERE id::text = old_contract_id::text AND status IN ('active', 'expired', 'ACTIVE') AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original contract is not active or expired';
  END IF;

  SELECT count(*) INTO v_active_count
  FROM public.contracts
  WHERE unit_id = v_old.unit_id AND status IN ('active', 'draft', 'ACTIVE') AND deleted_at IS NULL AND id::text <> old_contract_id::text;

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'Unit already has another active contract';
  END IF;

  UPDATE public.contracts
  SET status = 'expired',
      updated_at = now()
  WHERE id::text = old_contract_id::text;

  INSERT INTO public.contracts (
    no, unit_id, tenant_id, rent_amount, due_day,
    start_date, end_date, deposit, status,
    sponsor_name, sponsor_id, sponsor_phone,
    property_id, organization_id, payment_cycle, commission_rate,
    payment_terms_id, agreement_id, monthly_rent,
    renewed_from_id,
    created_at, updated_at, deleted_at
  )
  VALUES (
    v_old.no, v_old.unit_id, v_old.tenant_id, v_new_amount, v_old.due_day,
    v_new_start, v_new_end, coalesce(v_old.deposit, 0), 'active',
    v_old.sponsor_name, v_old.sponsor_id, v_old.sponsor_phone,
    v_old.property_id, v_old.organization_id, v_old.payment_cycle, v_old.commission_rate,
    v_old.payment_terms_id, v_old.agreement_id, v_new_amount,
    v_old.id,
    now(), now(), null
  )
  RETURNING id::text INTO v_new_id;

  RETURN jsonb_build_object(
    'status', 'renewed',
    'old_contract_id', old_contract_id,
    'new_contract_id', v_new_id
  );
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.soft_delete_contract_atomic(p_contract_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_old public.contracts%rowtype;
  v_cancelled_invoice_ids text[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لحذف عقد' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_old
  FROM public.contracts
  WHERE id::text = p_contract_id::text AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'العقد غير موجود';
  END IF;

  UPDATE public.contracts
  SET deleted_at = now(),
      updated_at = now()
  WHERE id::text = p_contract_id::text;

  WITH cancelled AS (
    UPDATE public.invoices
    SET status = 'CANCELLED',
        updated_at = now()
    WHERE contract_id::text = p_contract_id::text
      AND deleted_at IS NULL
      AND paid_amount = 0
      AND status NOT IN ('CANCELLED', 'PAID')
      AND due_date::date > current_date
    RETURNING id::text
  )
  SELECT coalesce(array_agg(id), '{}') INTO v_cancelled_invoice_ids FROM cancelled;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'soft_deleted',
    'contract_id', p_contract_id::text,
    'cancelled_invoice_ids', to_jsonb(v_cancelled_invoice_ids)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.soft_delete_contract_atomic(
  p_contract_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old public.contracts%rowtype;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لحذف عقد' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_old
  FROM public.contracts
  WHERE id = p_contract_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'العقد غير موجود';
  END IF;

  -- Protect financial integrity: reject soft deletion if paid invoices exist
  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE contract_id = p_contract_id
      AND deleted_at IS NULL
      AND COALESCE(paid_amount, 0) > 0
  ) THEN
    RAISE EXCEPTION 'لا يمكن حذف عقد يحتوي على فواتير مدفوعة أو دفعات مسجلة؛ يرجى إنهاء العقد بدلاً من ذلك';
  END IF;

  -- Protect financial integrity: reject soft deletion if receipts exist
  IF EXISTS (
    SELECT 1 FROM public.receipts
    WHERE contract_id = p_contract_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'لا يمكن حذف عقد يحتوي على إيصالات مالية؛ يرجى إنهاء العقد بدلاً من ذلك';
  END IF;

  -- Cancel and soft-delete future unpaid invoices so they do not remain open
  UPDATE public.invoices
  SET status = 'CANCELLED',
      deleted_at = now(),
      updated_at = now()
  WHERE contract_id = p_contract_id
    AND deleted_at IS NULL
    AND COALESCE(paid_amount, 0) = 0
    AND status NOT IN ('CANCELLED', 'PAID')
    AND due_date::date > current_date;

  -- Soft-delete the contract
  UPDATE public.contracts
  SET deleted_at = now(),
      updated_at = now()
  WHERE id = p_contract_id;

  RETURN jsonb_build_object(
    'status', 'deleted',
    'contract_id', p_contract_id
  );
END;
$$;

create or replace function public.generate_invoices_from_active_contracts()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to generate invoices' using errcode = '42501';
  end if;

  insert into public.invoices (contract_id, issue_date, due_date, amount, status)
  select c.id, current_date, current_date, c.rent_amount, 'UNPAID'
  from public.contracts c
  where c.deleted_at is null
    and lower(c.status) = 'active'
    and not exists (
      select 1
      from public.invoices i
      where i.contract_id = c.id
        and i.issue_date = current_date
        and i.deleted_at is null
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.update_unit_status_from_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit_id uuid := coalesce(new.unit_id, old.unit_id);
begin
  if v_unit_id is null then
    return coalesce(new, old);
  end if;

  update public.units u
  set status = case
      when exists (
        select 1 from public.maintenance_records m
        where m.unit_id = v_unit_id
          and m.deleted_at is null
          and coalesce(m.status, '') in ('open', 'in_progress', 'urgent')
      ) then 'maintenance'
      when exists (
        select 1 from public.contracts c
        where c.unit_id = v_unit_id
          and c.deleted_at is null
          and lower(c.status) = 'active'
          and current_date between c.start_date and c.end_date
      ) then 'occupied'
      else 'available'
    end,
    updated_at = now()
  where u.id = v_unit_id;

  return coalesce(new, old);
end;
$$;

CREATE OR REPLACE FUNCTION public.resolve_maintenance_with_expense(
  p_request_id text,
  p_cost numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_record public.maintenance_records;
  v_expense_id text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'MANAGER')
  ) THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول' USING ERRCODE = '42501';
  END IF;

  IF p_cost IS NULL OR p_cost < 0 THEN
    RAISE EXCEPTION 'التكلفة يجب أن تكون رقماً موجباً';
  END IF;

  SELECT * INTO v_record
  FROM public.maintenance_records
  WHERE id = p_request_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب الصيانة غير موجود';
  END IF;

  IF v_record.status IN ('resolved', 'closed') THEN
    RAISE EXCEPTION 'تم إغلاق هذا الطلب مسبقاً';
  END IF;

  IF p_cost > 0 THEN
    INSERT INTO public.expenses (
      property_id, category, amount, expense_date, description, notes, ref, status
    ) VALUES (
      v_record.property_id, 'صيانة', p_cost, CURRENT_DATE,
      coalesce(v_record.title, 'مصروف صيانة'),
      p_notes, v_record.id, 'posted'
    )
    RETURNING id INTO v_expense_id;
  END IF;

  UPDATE public.maintenance_records
  SET status = 'resolved',
      cost = p_cost,
      resolved_at = now(),
      notes = coalesce(p_notes, notes)
  WHERE id = p_request_id
  RETURNING * INTO v_record;

  RETURN jsonb_build_object(
    'maintenance', to_jsonb(v_record),
    'expense_id', v_expense_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_all_balances()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'MANAGER')
  ) THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول' USING ERRCODE = '42501';
  END IF;

  -- contract_balances
  DELETE FROM contract_balances WHERE true;
  INSERT INTO contract_balances (contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at)
  SELECT
    c.id,
    c.tenant_id,
    c.unit_id,
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0),
    COALESCE(SUM(i.paid_amount), 0),
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount), 0),
    now()
  FROM contracts c
  LEFT JOIN invoices i ON i.contract_id = c.id AND i.deleted_at IS NULL
  GROUP BY c.id, c.tenant_id, c.unit_id;

  -- tenant_balances
  DELETE FROM tenant_balances WHERE true;
  INSERT INTO tenant_balances (tenant_id, balance_due, updated_at)
  SELECT
    c.tenant_id,
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount), 0),
    now()
  FROM contracts c
  LEFT JOIN invoices i ON i.contract_id = c.id AND i.deleted_at IS NULL
  GROUP BY c.tenant_id;

  -- owner_balances
  DELETE FROM owner_balances WHERE true;
  INSERT INTO owner_balances (owner_id, total_income, total_expenses, commission, net_balance, updated_at)
  SELECT
    p.owner_id::text,
    COALESCE(SUM(CASE WHEN i.deleted_at IS NULL THEN i.paid_amount ELSE 0 END), 0),
    COALESCE((SELECT SUM(e.amount) FROM expenses e
              JOIN units u2 ON u2.id::text = e.property_id::text
              JOIN properties p2 ON p2.id = u2.property_id
              WHERE p2.owner_id = p.owner_id AND e.deleted_at IS NULL), 0),
    0,
    0,
    now()
  FROM properties p
  JOIN units u ON u.property_id = p.id
  JOIN contracts c ON c.unit_id = u.id
  LEFT JOIN invoices i ON i.contract_id = c.id
  GROUP BY p.owner_id;

END;
$function$;

CREATE OR REPLACE FUNCTION public.create_expense_with_journal_atomic(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_property_id uuid := nullif(p_payload->>'property_id', '')::uuid;
  v_category text := nullif(p_payload->>'category', '');
  v_amount numeric := nullif(p_payload->>'amount', '')::numeric;
  v_expense_date date := nullif(p_payload->>'expense_date', '')::date;
  v_description text := nullif(p_payload->>'description', '');
  v_cost_center_id uuid := nullif(p_payload->>'cost_center_id', '')::uuid;
  v_contract_id uuid := nullif(p_payload->>'contract_id', '')::uuid;
  v_charged_to text := nullif(p_payload->>'charged_to', '');
  v_attachment_url text := nullif(p_payload->>'attachment_url', '');
  v_expense_id uuid;
  v_expense_no text;
  v_expense_account_id text;
  v_cash_account_id text;
  v_result jsonb;
  v_cached jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_app_user(), false) THEN
    RAISE EXCEPTION 'Authenticated app user is required.' USING ERRCODE = '42501';
  END IF;

  IF v_request_id IS NULL OR v_request_id = '' THEN
    v_request_id := gen_random_uuid()::text;
  END IF;

  -- Idempotency: return the prior result when the same request_id was processed.
  SELECT response_payload INTO v_cached
  FROM public.financial_operation_idempotency
  WHERE operation_name = 'create_expense_with_journal_atomic' AND request_id = v_request_id;
  IF v_cached IS NOT NULL THEN
    RETURN v_cached || jsonb_build_object('idempotent', true);
  END IF;

  IF v_property_id IS NULL THEN
    RAISE EXCEPTION 'property_id is required.';
  END IF;
  IF v_category IS NULL OR length(trim(v_category)) = 0 THEN
    RAISE EXCEPTION 'category is required.';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be greater than zero.';
  END IF;
  IF v_expense_date IS NULL THEN
    RAISE EXCEPTION 'expense_date is required.';
  END IF;

  v_expense_account_id := (SELECT id FROM public.accounts WHERE no = '6100' LIMIT 1);
  v_cash_account_id := (SELECT id FROM public.accounts WHERE no = '1111' LIMIT 1);
  IF v_expense_account_id IS NULL OR v_cash_account_id IS NULL THEN
    RAISE EXCEPTION 'Expense accounting accounts are not configured';
  END IF;

  v_expense_id := gen_random_uuid();
  v_expense_no := 'EXP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_request_id, '-', ''), 1, 6);

  INSERT INTO public.expenses (
    id, property_id, category, amount, expense_date, description,
    cost_center_id, contract_id, charged_to, attachment_url, status, date_time, no
  ) VALUES (
    v_expense_id, v_property_id, v_category, v_amount, v_expense_date, v_description,
    v_cost_center_id, v_contract_id, v_charged_to, v_attachment_url, 'POSTED', now(), v_expense_no
  );

  -- Journal entry: Debit the expense account, Credit cash.
  INSERT INTO public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, created_at)
  VALUES
    (gen_random_uuid(), v_expense_no || '-D', v_expense_date, v_expense_account_id, v_amount, 'DEBIT', v_expense_id, 'expense', v_expense_id::text, now()),
    (gen_random_uuid(), v_expense_no || '-C', v_expense_date, v_cash_account_id, v_amount, 'CREDIT', v_expense_id, 'expense', v_expense_id::text, now());

  -- Audit trail for the financial mutation.
  INSERT INTO public.audit_log (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  VALUES (
    gen_random_uuid(),
    extract(epoch from now())::bigint,
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'CREATE', 'expenses', v_expense_id::text, 'Expense recorded with journal entry',
    'expenses', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'expense_id', v_expense_id,
    'expense_no', v_expense_no,
    'request_id', v_request_id
  );

  INSERT INTO public.financial_operation_idempotency (operation_name, request_id, response_payload)
  VALUES ('create_expense_with_journal_atomic', v_request_id, v_result)
  ON CONFLICT (operation_name, request_id) DO NOTHING;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_owner_balance_on_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_property_id text;
  v_contract_id text;
begin
  if tg_table_name = 'expenses' then
    v_property_id := coalesce(NEW.property_id, OLD.property_id);
    v_contract_id := coalesce(NEW.contract_id, OLD.contract_id);
  else
    v_property_id := null;
    v_contract_id := coalesce(NEW.contract_id, OLD.contract_id);
  end if;

  insert into owner_balances (owner_id, total_income, total_expenses, commission, net_balance, updated_at)
  select o.id,
    coalesce(sum(case when r.status = 'POSTED' then r.amount else 0 end), 0),
    coalesce(sum(case when e.status = 'POSTED' and e.charged_to in ('OWNER', 'OFFICE') then e.amount else 0 end), 0),
    coalesce(sum(case when r.status = 'POSTED' then r.amount * coalesce(o.commission_value / 100, 0.05) else 0 end), 0),
    0,
    now()
  from owners o
  left join properties p on p.owner_id = o.id
  left join units u on u.property_id = p.id
  -- Removed "and c.status = 'ACTIVE'" filter: lifetime totals must include
  -- receipts/expenses from ENDED (renewed/terminated) contracts.
  left join contracts c on c.unit_id = u.id and c.deleted_at is null
  left join receipts r on r.contract_id = c.id
  left join expenses e on (e.contract_id = c.id or e.property_id = p.id)
  where o.id = coalesce(
    (select owner_id from properties where id = v_property_id),
    (select p2.owner_id from contracts c2 join properties p2 on p2.id = c2.property_id where c2.id = v_contract_id)
  )
  group by o.id, o.commission_value
  on conflict (owner_id) do update set
    total_income = excluded.total_income,
    total_expenses = excluded.total_expenses,
    commission = excluded.commission,
    net_balance = excluded.total_income - excluded.total_expenses - excluded.commission,
    updated_at = now();
  return coalesce(NEW, OLD);
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_tenant_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_tenant_id text;
begin
  if tg_table_name = 'invoices' then
    if tg_op = 'DELETE' then
      select tenant_id
      into v_tenant_id
      from public.contracts
      where id = old.contract_id;
    else
      select tenant_id
      into v_tenant_id
      from public.contracts
      where id = new.contract_id;
    end if;
  else
    -- receipt_allocations: has its own tenant_id column, no contract_id.
    if tg_op = 'DELETE' then
      v_tenant_id := old.tenant_id;
    else
      v_tenant_id := new.tenant_id;
    end if;
  end if;

  if v_tenant_id is null then
    return coalesce(new, old);
  end if;

  insert into public.tenant_balances (
    tenant_id,
    balance_due,
    updated_at
  )
  select
    c.tenant_id,
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0) - i.paid_amount), 0),
    now()
  from public.contracts c
  left join public.invoices i
    on i.contract_id = c.id
   and i.deleted_at is null
  where c.tenant_id = v_tenant_id
  group by c.tenant_id
  on conflict (tenant_id) do update set
    balance_due = excluded.balance_due,
    updated_at = now();

  return coalesce(new, old);
end;
$function$;

CREATE OR REPLACE FUNCTION public.audit_journal_entry_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'posted' THEN
    INSERT INTO public.audit_log (
      user_id, action, entity, entity_id, note, "table",
      old_value, new_value, action_timestamp, created_at, updated_at
    ) VALUES (
      auth.uid(),
      'INSERT_POSTED_JOURNAL_ENTRY',
      'journal_entry',
      NEW.id::text,
      'Posted journal entry created. Corrections must use reversing entries.',
      'journal_entries',
      NULL,
      to_jsonb(NEW),
      now(),
      now(),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_posted_journal_entry_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'posted' THEN
    RAISE EXCEPTION 'Posted journal entries are immutable. Use reverse entry.'
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_bank_reconciliation_match_atomic(payload jsonb)
RETURNS public.bank_reconciliation_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_statement_line_id uuid := nullif(payload->>'statement_line_id', '')::uuid;
  v_matched_entity_type text := nullif(payload->>'matched_entity_type', '');
  v_matched_entity_id text := nullif(payload->>'matched_entity_id', '');
  v_matched_amount numeric := nullif(payload->>'matched_amount', '')::numeric;
  v_notes text := nullif(payload->>'notes', '');
  v_line public.bank_statement_lines%ROWTYPE;
  v_match public.bank_reconciliation_matches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_app_user(), false) THEN
    RAISE EXCEPTION 'Authenticated app user is required.' USING ERRCODE = '42501';
  END IF;

  IF v_statement_line_id IS NULL THEN
    RAISE EXCEPTION 'statement_line_id is required.' USING ERRCODE = '22023';
  END IF;
  IF v_matched_entity_type NOT IN ('payment', 'receipt', 'expense', 'manual_adjustment') THEN
    RAISE EXCEPTION 'Invalid matched_entity_type.' USING ERRCODE = '22023';
  END IF;
  IF v_matched_entity_id IS NULL THEN
    RAISE EXCEPTION 'matched_entity_id is required.' USING ERRCODE = '22023';
  END IF;
  IF v_matched_amount IS NULL OR v_matched_amount = 0 THEN
    RAISE EXCEPTION 'matched_amount must be non-zero.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_line
  FROM public.bank_statement_lines
  WHERE id = v_statement_line_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank statement line was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_line.status <> 'unmatched' THEN
    RAISE EXCEPTION 'Bank statement line is already processed.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.bank_reconciliation_matches (
    statement_line_id,
    matched_entity_type,
    matched_entity_id,
    matched_amount,
    notes,
    matched_by
  ) VALUES (
    v_statement_line_id,
    v_matched_entity_type,
    v_matched_entity_id,
    v_matched_amount,
    v_notes,
    auth.uid()
  )
  RETURNING * INTO v_match;

  UPDATE public.bank_statement_lines
  SET status = 'matched', updated_at = now()
  WHERE id = v_statement_line_id;

  INSERT INTO public.audit_log (
    user_id, action, entity, entity_id, note, "table",
    old_value, new_value, action_timestamp, created_at, updated_at
  ) VALUES (
    auth.uid(),
    'PROCESS_BANK_RECONCILIATION_MATCH_ATOMIC',
    'bank_reconciliation_match',
    v_match.id::text,
    'Bank statement line matched atomically through RPC.',
    'bank_reconciliation_matches',
    to_jsonb(v_line),
    jsonb_build_object('match', to_jsonb(v_match), 'statement_line_status', 'matched'),
    now(),
    now(),
    now()
  );

  RETURN v_match;
END;
$$;

revoke all on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke all on function public.find_payment_account_id(text) from public, anon, authenticated;
revoke all on function public.post_receipt_atomic(jsonb) from public, anon, authenticated;
revoke all on function public.record_invoice_payment_atomic(jsonb) from public, anon;
grant execute on function public.record_invoice_payment_atomic(jsonb) to authenticated, service_role;
revoke all on function public.renew_contract_atomic(text, jsonb) from public, anon;
grant execute on function public.renew_contract_atomic(text, jsonb) to authenticated, service_role;
revoke all on function public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) from public, anon;
grant execute on function public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) to authenticated, service_role;
revoke all on function public.update_contract_atomic(text,text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) from public, anon;
grant execute on function public.update_contract_atomic(text,text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) to authenticated, service_role;
revoke all on function public.terminate_contract_atomic(text,text) from public, anon;
grant execute on function public.terminate_contract_atomic(text,text) to authenticated, service_role;
revoke all on function public.generate_invoices_from_active_contracts() from public, anon;
grant execute on function public.generate_invoices_from_active_contracts() to authenticated, service_role;
revoke all on function public.void_receipt_atomic(jsonb) from public, anon;
grant execute on function public.void_receipt_atomic(jsonb) to authenticated, service_role;
grant execute on function public.void_receipt_atomic(text, bigint, jsonb, jsonb) to authenticated, service_role;
revoke all on function public.recalculate_all_balances() from public, anon, authenticated;
grant execute on function public.recalculate_all_balances() to service_role;
revoke all on function public.create_expense_with_journal_atomic(jsonb) from public, anon;
grant execute on function public.create_expense_with_journal_atomic(jsonb) to authenticated, service_role;
revoke all on function public.process_bank_reconciliation_match_atomic(jsonb) from public, anon;
grant execute on function public.process_bank_reconciliation_match_atomic(jsonb) to authenticated, service_role;
revoke all on function public.audit_journal_entry_insert() from public, anon, authenticated;
grant execute on function public.audit_journal_entry_insert() to service_role;
revoke all on function public.prevent_posted_journal_entry_mutation() from public, anon, authenticated;
grant execute on function public.prevent_posted_journal_entry_mutation() to service_role;
revoke all on function public.create_property_with_agreement from public;
grant execute on function public.create_property_with_agreement to authenticated;
grant execute on function public.resolve_maintenance_with_expense(text, numeric, text) to authenticated;
revoke all on function public.soft_delete_contract_atomic(uuid) from public, anon;
grant execute on function public.soft_delete_contract_atomic(uuid) to authenticated, service_role;
revoke all on function public.soft_delete_contract_atomic(text) from public, anon;
grant execute on function public.soft_delete_contract_atomic(text) to authenticated, service_role;
alter function public.record_invoice_payment_atomic(jsonb) owner to postgres;
alter function public.void_receipt_atomic(jsonb) owner to postgres;
alter function public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) owner to postgres;
alter function public.renew_contract_atomic(text,jsonb) owner to postgres;
alter function public.update_contract_atomic(text,text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) owner to postgres;
alter function public.terminate_contract_atomic(text,text) owner to postgres;
alter function public.generate_invoices_from_active_contracts() owner to postgres;
alter function public.recalculate_all_balances() owner to postgres;
alter function public.soft_delete_contract_atomic(uuid) owner to postgres;
alter function public.soft_delete_contract_atomic(text) owner to postgres;
alter function public.audit_journal_entry_insert() owner to postgres;
alter function public.prevent_posted_journal_entry_mutation() owner to postgres;
alter function public.process_bank_reconciliation_match_atomic(jsonb) owner to postgres;

CREATE TRIGGER audit_journal_entry_insert
  AFTER INSERT ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_journal_entry_insert();

CREATE TRIGGER prevent_journal_entries_mutation_after_posting
  BEFORE UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_posted_journal_entry_mutation();

create trigger set_company_settings_updated_at before update on public.company_settings for each row execute function public.touch_updated_at();

create trigger set_contracts_updated_at before update on public.contracts for each row execute function public.touch_updated_at();

create trigger set_expenses_updated_at before update on public.expenses for each row execute function public.touch_updated_at();

create trigger set_invoices_updated_at before update on public.invoices for each row execute function public.touch_updated_at();

create trigger set_maintenance_records_updated_at before update on public.maintenance_records for each row execute function public.touch_updated_at();

create trigger set_owners_updated_at before update on public.owners for each row execute function public.touch_updated_at();

create trigger set_payments_updated_at before update on public.payments for each row execute function public.touch_updated_at();

create trigger set_people_updated_at before update on public.people for each row execute function public.touch_updated_at();

create trigger set_properties_updated_at before update on public.properties for each row execute function public.touch_updated_at();

create trigger set_property_owners_updated_at before update on public.property_owners for each row execute function public.touch_updated_at();

create trigger set_receipt_allocations_updated_at before update on public.receipt_allocations for each row execute function public.touch_updated_at();

create trigger set_receipts_updated_at before update on public.receipts for each row execute function public.touch_updated_at();

create trigger set_units_updated_at before update on public.units for each row execute function public.touch_updated_at();

create trigger set_users_updated_at before update on public.users for each row execute function public.touch_updated_at();

create trigger tenants_updated_at
  before update on public.tenants
  for each row execute function public.update_updated_at();

CREATE TRIGGER trg_owner_agreements_updated_at
  BEFORE UPDATE ON public.owner_agreements
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_agreements_updated_at();

CREATE TRIGGER update_cost_centers_updated_at
    BEFORE UPDATE ON public.cost_centers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_payment_terms_updated_at
    BEFORE UPDATE ON public.payment_terms_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

create trigger update_unit_status_after_contract_change
after insert or update or delete on public.contracts
for each row execute function public.update_unit_status_from_activity();

create trigger update_unit_status_after_maintenance_change
after insert or update or delete on public.maintenance_records
for each row execute function public.update_unit_status_from_activity();

create trigger validate_property_owner_active_totals
before insert or update of property_id, ownership_percentage, ends_on on public.property_owners
for each row execute function public.validate_property_owner_active_totals();

commit;

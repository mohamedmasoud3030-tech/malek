-- ============================================================================
-- Rentrix - Hardening remaining RPCs and Trigger functions for multi-tenant isolation
-- Date: 2026-07-23
-- ============================================================================

begin;

-- ── 1. post_receipt_atomic ──────────────────────────────────────────────────
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

  SELECT receipt_record.id
    INTO v_existing_id
  FROM public.receipts AS receipt_record
  WHERE receipt_record.request_id = v_request_id
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

  -- Insert journal entries
  FOR v_journal IN
    SELECT journal_record.value
    FROM jsonb_array_elements(v_journal_entries) AS journal_record(value)
  LOOP
    v_journal_id := coalesce(v_journal->>'id', gen_random_uuid()::text);
    v_journal_date := v_journal->>'date';
    v_journal_source_id := nullif(v_journal->>'source_id', '');

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


-- ── 2. void_receipt_atomic ──────────────────────────────────────────────────
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

  IF v_requested_id IS NULL OR v_reason IS NULL OR v_request_id IS NULL THEN
    RAISE EXCEPTION 'receipt_id, reason, and request_id are required.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('void_receipt_atomic:' || v_request_id, 0)
  );

  SELECT response_payload
  INTO v_cached
  FROM public.financial_operation_idempotency
  WHERE operation_name = 'void_receipt_atomic'
    AND request_id = v_request_id
  FOR UPDATE;

  IF v_cached IS NOT NULL THEN
    RETURN v_cached || jsonb_build_object('idempotent', true);
  END IF;

  SELECT p.*
  INTO v_payment
  FROM public.payments p
  WHERE p.id::text = v_requested_id
    AND p.deleted_at IS NULL
  FOR UPDATE;

  IF v_payment.id IS NOT NULL THEN
    SELECT r.*
    INTO v_receipt
    FROM public.receipts r
    WHERE r.id::text = coalesce(nullif(v_payment.receipt_id::text, ''), v_payment.id::text)
      AND r.deleted_at IS NULL
    FOR UPDATE;
  ELSE
    SELECT r.*
    INTO v_receipt
    FROM public.receipts r
    WHERE r.id::text = v_requested_id
      AND r.deleted_at IS NULL
    FOR UPDATE;

    IF v_receipt.id IS NOT NULL THEN
      SELECT p.*
      INTO v_payment
      FROM public.payments p
      WHERE p.receipt_id::text = v_receipt.id::text
        AND p.deleted_at IS NULL
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
    WHERE i.id = allocated.invoice_id;
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
    'void_receipt_atomic', v_request_id, v_result
  )
  ON CONFLICT (operation_name, request_id) DO NOTHING;

  RETURN v_result;
END;
$function$;


-- ── 3. update_owner_balance_on_expense ──────────────────────────────────────
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

  insert into owner_balances (owner_id, total_income, total_expenses, commission, net_balance, updated_at, company_id)
  select o.id,
    coalesce(sum(case when r.status = 'POSTED' then r.amount else 0 end), 0),
    coalesce(sum(case when e.status = 'POSTED' and e.charged_to in ('OWNER', 'OFFICE') then e.amount else 0 end), 0),
    coalesce(sum(case when r.status = 'POSTED' then r.amount * coalesce(o.commission_value / 100, 0.05) else 0 end), 0),
    0,
    now(),
    o.company_id
  from owners o
  left join properties p on p.owner_id = o.id
  left join units u on u.property_id = p.id
  left join contracts c on c.unit_id = u.id and c.deleted_at is null
  left join receipts r on r.contract_id = c.id
  left join expenses e on (e.contract_id = c.id or e.property_id = p.id)
  where o.id = coalesce(
    (select owner_id from properties where id = v_property_id),
    (select p2.owner_id from contracts c2 join properties p2 on p2.id = c2.property_id where c2.id = v_contract_id)
  )
  group by o.id, o.commission_value, o.company_id
  on conflict (owner_id) do update set
    total_income = excluded.total_income,
    total_expenses = excluded.total_expenses,
    commission = excluded.commission,
    net_balance = excluded.total_income - excluded.total_expenses - excluded.commission,
    updated_at = now();
  return coalesce(NEW, OLD);
end;
$function$;


-- ── 4. execute_automation_rule_internal ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.execute_automation_rule_internal(p_rule_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_rule record;
  v_run_id uuid;
  v_items_processed int :=0;
  v_items_failed int :=0;
  v_result jsonb;
  v_contract record;
  v_invoice record;
  v_maint record;
  v_notif_count int :=0;
  v_error_msg text;
begin
  select * into v_rule from public.automation_rules where id=p_rule_id and deleted_at is null and is_enabled=true for update;
  if not found then return jsonb_build_object('success',false,'skipped',true,'reason','rule not found or disabled'); end if;

  perform pg_advisory_xact_lock(hashtextextended('automation_rule_internal:'||p_rule_id,0));

  if exists (
    select 1 from public.automation_runs
    where rule_id=p_rule_id and status='running' and started_at > extract(epoch from (now() - interval '5 minutes'))*1000
  ) then
    return jsonb_build_object('success',false,'skipped',true,'reason','duplicate prevention');
  end if;

  insert into public.automation_runs (job_name, rule_id, status, started_at, company_id)
  values (v_rule.name, v_rule.id, 'running', extract(epoch from now())*1000, v_rule.company_id)
  returning id into v_run_id;

  BEGIN
    if v_rule.rule_type = 'contract_expiry' then
      for v_contract in select id, end_date from public.contracts where deleted_at is null and status='active' and end_date between current_date and current_date + interval '30 days' limit 100 loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id, company_id)
        values (v_rule.id, v_run_id, 'contract_expiry','عقد قريب من الانتهاء','العقد '||v_contract.id||' ينتهي في '||v_contract.end_date,'contract',v_contract.id::text, v_rule.company_id);
        v_items_processed := v_items_processed+1; v_notif_count:=v_notif_count+1;
      end loop;
    elsif v_rule.rule_type = 'overdue_invoice' then
      for v_invoice in select id, due_date, amount, paid_amount from public.invoices where deleted_at is null and status not in ('paid','cancelled','void') and due_date < current_date and (amount - coalesce(paid_amount,0))>0 limit 100 loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id, company_id)
        values (v_rule.id, v_run_id, 'overdue_invoice','فاتورة متأخرة','الفاتورة '||v_invoice.id||' متأخرة','invoice',v_invoice.id::text, v_rule.company_id);
        v_items_processed:=v_items_processed+1; v_notif_count:=v_notif_count+1;
      end loop;
    elsif v_rule.rule_type = 'maintenance_overdue' then
      for v_maint in select id, title from public.maintenance_records where deleted_at is null and status in ('open','in_progress') and created_at < now() - interval '7 days' limit 100 loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id, company_id)
        values (v_rule.id, v_run_id, 'maintenance_overdue','صيانة متأخرة','طلب '||coalesce(v_maint.title, v_maint.id::text)||' متأخر','maintenance',v_maint.id::text, v_rule.company_id);
        v_items_processed:=v_items_processed+1; v_notif_count:=v_notif_count+1;
      end loop;
    end if;

    update public.automation_runs set completed_at=extract(epoch from now())*1000, status='success', items_processed=v_items_processed, actions_taken=jsonb_build_array(jsonb_build_object('notifications_created',v_notif_count)) where id=v_run_id;
    update public.automation_rules set last_run_at=now(), last_run_status='SUCCESS', last_run_result='Scheduled: '||v_items_processed||' items, '||v_notif_count||' notifs', updated_at=now() where id=v_rule.id;
    return jsonb_build_object('success',true,'run_id',v_run_id,'processed',v_items_processed,'notifications',v_notif_count);
  EXCEPTION WHEN OTHERS THEN
    v_error_msg:=SQLERRM;
    BEGIN
      update public.automation_runs set completed_at=extract(epoch from now())*1000, status='failed', error_message=v_error_msg where id=v_run_id;
      update public.automation_rules set last_run_at=now(), last_run_status='FAILED', last_run_result=v_error_msg where id=v_rule.id;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Failed to update failed status: %', SQLERRM;
    END;
    RETURN jsonb_build_object('success',false,'run_id',v_run_id,'error',v_error_msg);
  END;
end;
$$;


-- ── 5. recalculate_all_balances ─────────────────────────────────────────────
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
  INSERT INTO contract_balances (contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at, company_id)
  SELECT
    c.id,
    c.tenant_id,
    c.unit_id::text,
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0),
    COALESCE(SUM(i.paid_amount), 0),
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount), 0),
    now(),
    c.company_id
  FROM contracts c
  LEFT JOIN invoices i ON i.contract_id = c.id AND i.deleted_at IS NULL
  GROUP BY c.id, c.tenant_id, c.unit_id, c.company_id;

  -- tenant_balances
  DELETE FROM tenant_balances WHERE true;
  INSERT INTO tenant_balances (tenant_id, balance_due, updated_at, company_id)
  SELECT
    c.tenant_id,
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount), 0),
    now(),
    c.company_id
  FROM contracts c
  LEFT JOIN invoices i ON i.contract_id = c.id AND i.deleted_at IS NULL
  GROUP BY c.tenant_id, c.company_id;

  -- owner_balances
  DELETE FROM owner_balances WHERE true;
  INSERT INTO owner_balances (owner_id, total_income, total_expenses, commission, net_balance, updated_at, company_id)
  SELECT
    p.owner_id::text,
    COALESCE(SUM(CASE WHEN i.deleted_at IS NULL THEN i.paid_amount ELSE 0 END), 0),
    COALESCE((SELECT SUM(e.amount) FROM expenses e
              JOIN units u2 ON u2.id::text = e.property_id::text
              JOIN properties p2 ON p2.id = u2.property_id
              WHERE p2.owner_id = p.owner_id AND e.deleted_at IS NULL), 0),
    0,
    0,
    now(),
    p.company_id
  FROM properties p
  JOIN units u ON u.property_id = p.id
  JOIN contracts c ON c.unit_id = u.id
  LEFT JOIN invoices i ON i.contract_id = c.id
  GROUP BY p.owner_id, p.company_id;

END;
$function$;


-- ── 6. resolve_maintenance_with_expense ─────────────────────────────────────
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
      property_id, category, amount, expense_date, description, notes, ref, status, company_id
    ) VALUES (
      v_record.property_id, 'صيانة', p_cost, CURRENT_DATE,
      coalesce(v_record.title, 'مصروف صيانة'),
      p_notes, v_record.id, 'posted', v_record.company_id
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


-- ── 7. Re-assert and Harden Grants for all 31 isolated functions ────────────

-- Hardening execution grants for multi-tenant isolation
revoke execute on function public.approve_owner_settlement_atomic(p_payload jsonb) from public, anon, authenticated;
grant execute on function public.approve_owner_settlement_atomic(p_payload jsonb) to authenticated;
revoke execute on function public.cancel_owner_settlement_atomic(p_payload jsonb) from public, anon, authenticated;
grant execute on function public.cancel_owner_settlement_atomic(p_payload jsonb) to authenticated;
revoke execute on function public.create_contract_atomic(p_property_id text, p_unit_id uuid, p_tenant_id uuid, p_agreement_id uuid, p_start_date date, p_end_date date, p_rent_amount numeric, p_payment_cycle text, p_payment_terms_id uuid, p_status text, p_cancellation_reason text, p_notes text, p_attachment_url text) from public, anon, authenticated;
grant execute on function public.create_contract_atomic(p_property_id text, p_unit_id uuid, p_tenant_id uuid, p_agreement_id uuid, p_start_date date, p_end_date date, p_rent_amount numeric, p_payment_cycle text, p_payment_terms_id uuid, p_status text, p_cancellation_reason text, p_notes text, p_attachment_url text) to authenticated;
revoke execute on function public.create_deposit_atomic(p_payload jsonb) from public, anon, authenticated;
grant execute on function public.create_deposit_atomic(p_payload jsonb) to authenticated;
revoke execute on function public.create_expense_with_journal_atomic(p_payload jsonb) from public, anon, authenticated;
grant execute on function public.create_expense_with_journal_atomic(p_payload jsonb) to authenticated;
revoke execute on function public.create_owner_agreement_atomic(payload jsonb) from public, anon, authenticated;
grant execute on function public.create_owner_agreement_atomic(payload jsonb) to authenticated;
revoke execute on function public.create_owner_settlement_draft_atomic(p_payload jsonb) from public, anon, authenticated;
grant execute on function public.create_owner_settlement_draft_atomic(p_payload jsonb) to authenticated;
revoke execute on function public.create_property_with_agreement(p_title text, p_type text, p_address text, p_owner_id uuid, p_agreement_type text, p_commission_type text, p_commission_value numeric, p_agreement_starts_on date, p_agreement_ends_on date DEFAULT NULL::date, p_owner_name text DEFAULT NULL::text, p_purchase_value numeric DEFAULT NULL::numeric, p_current_value numeric DEFAULT NULL::numeric, p_status text DEFAULT 'active'::text, p_notes text DEFAULT NULL::text) from public, anon, authenticated;
grant execute on function public.create_property_with_agreement(p_title text, p_type text, p_address text, p_owner_id uuid, p_agreement_type text, p_commission_type text, p_commission_value numeric, p_agreement_starts_on date, p_agreement_ends_on date DEFAULT NULL::date, p_owner_name text DEFAULT NULL::text, p_purchase_value numeric DEFAULT NULL::numeric, p_current_value numeric DEFAULT NULL::numeric, p_status text DEFAULT 'active'::text, p_notes text DEFAULT NULL::text) to authenticated;
revoke execute on function public.deduct_deposit_atomic(p_payload jsonb) from public, anon, authenticated;
grant execute on function public.deduct_deposit_atomic(p_payload jsonb) to authenticated;
revoke execute on function public.execute_automation_rule(p_rule_id text) from public, anon, authenticated;
grant execute on function public.execute_automation_rule(p_rule_id text) to authenticated;
revoke execute on function public.generate_invoices_from_active_contracts() from public, anon, authenticated;
grant execute on function public.generate_invoices_from_active_contracts() to authenticated;
revoke execute on function public.pay_owner_settlement_atomic(p_payload jsonb) from public, anon, authenticated;
grant execute on function public.pay_owner_settlement_atomic(p_payload jsonb) to authenticated;
revoke execute on function public.post_receipt_atomic(payload jsonb) from public, anon, authenticated;
grant execute on function public.post_receipt_atomic(payload jsonb) to authenticated;
revoke execute on function public.process_bank_reconciliation_match_atomic(payload jsonb) from public, anon, authenticated;
grant execute on function public.process_bank_reconciliation_match_atomic(payload jsonb) to authenticated;
revoke execute on function public.record_invoice_payment_atomic(payload jsonb) from public, anon, authenticated;
grant execute on function public.record_invoice_payment_atomic(payload jsonb) to authenticated;
revoke execute on function public.refund_deposit_atomic(p_payload jsonb) from public, anon, authenticated;
grant execute on function public.refund_deposit_atomic(p_payload jsonb) to authenticated;
revoke execute on function public.renew_contract_atomic(old_contract_id text, new_contract_data jsonb) from public, anon, authenticated;
grant execute on function public.renew_contract_atomic(old_contract_id text, new_contract_data jsonb) to authenticated;
revoke execute on function public.soft_delete_contract_atomic(p_contract_id text) from public, anon, authenticated;
grant execute on function public.soft_delete_contract_atomic(p_contract_id text) to authenticated;
revoke execute on function public.terminate_contract_atomic(p_contract_id text, p_reason text) from public, anon, authenticated;
grant execute on function public.terminate_contract_atomic(p_contract_id text, p_reason text) to authenticated;
revoke execute on function public.update_contract_atomic(p_contract_id text, p_property_id text, p_unit_id uuid, p_tenant_id uuid, p_agreement_id uuid, p_start_date date, p_end_date date, p_rent_amount numeric, p_payment_cycle text, p_payment_terms_id uuid, p_status text, p_cancellation_reason text, p_notes text, p_attachment_url text) from public, anon, authenticated;
grant execute on function public.update_contract_atomic(p_contract_id text, p_property_id text, p_unit_id uuid, p_tenant_id uuid, p_agreement_id uuid, p_start_date date, p_end_date date, p_rent_amount numeric, p_payment_cycle text, p_payment_terms_id uuid, p_status text, p_cancellation_reason text, p_notes text, p_attachment_url text) to authenticated;
revoke execute on function public.update_expense_with_journal_atomic(p_payload jsonb) from public, anon, authenticated;
grant execute on function public.update_expense_with_journal_atomic(p_payload jsonb) to authenticated;
revoke execute on function public.update_owner_agreement_atomic(p_agreement_id uuid, payload jsonb) from public, anon, authenticated;
grant execute on function public.update_owner_agreement_atomic(p_agreement_id uuid, payload jsonb) to authenticated;
revoke execute on function public.void_receipt_atomic(payload jsonb) from public, anon, authenticated;
grant execute on function public.void_receipt_atomic(payload jsonb) to authenticated;
revoke execute on function public.update_contract_balance_from_allocation() from public, anon, authenticated;
revoke execute on function public.update_contract_balance_from_invoice() from public, anon, authenticated;
revoke execute on function public.update_contract_balance_on_receipt_allocation() from public, anon, authenticated;
revoke execute on function public.update_invoice_status() from public, anon, authenticated;
revoke execute on function public.update_owner_balance_from_operation() from public, anon, authenticated;
revoke execute on function public.update_owner_balance_on_expense() from public, anon, authenticated;
revoke execute on function public.update_tenant_balance() from public, anon, authenticated;
revoke execute on function public.update_unit_status() from public, anon, authenticated;

-- Redefined RPCs from this file
revoke execute on function public.post_receipt_atomic(jsonb) from public, anon, authenticated;
grant execute on function public.post_receipt_atomic(jsonb) to authenticated;

revoke execute on function public.void_receipt_atomic(jsonb) from public, anon, authenticated;
grant execute on function public.void_receipt_atomic(jsonb) to authenticated;

revoke execute on function public.recalculate_all_balances() from public, anon, authenticated;
grant execute on function public.recalculate_all_balances() to authenticated;

revoke execute on function public.resolve_maintenance_with_expense(text, numeric, text) from public, anon, authenticated;
grant execute on function public.resolve_maintenance_with_expense(text, numeric, text) to authenticated;

revoke execute on function public.execute_automation_rule_internal(text) from public, anon, authenticated;
grant execute on function public.execute_automation_rule_internal(text) to service_role;

commit;

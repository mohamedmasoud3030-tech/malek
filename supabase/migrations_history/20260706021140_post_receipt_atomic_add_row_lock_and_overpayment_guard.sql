-- Migration: post_receipt_atomic_add_row_lock_and_overpayment_guard
--
-- Applied live on 2026-07-06 (version 20260706021140) but never captured as a file in this
-- repo until now. This file is a snapshot of the function as it stands live on
-- nnggcnpcuomwfuupupwg, taken via pg_get_functiondef — not a replay of whatever body was
-- originally drafted for this migration name.
--
-- What it does: locks every invoice referenced by an allocation (FOR UPDATE, in a
-- deterministic id-sorted order to prevent deadlocks between concurrent callers touching
-- overlapping invoice sets) and raises before any invoice's paid_amount + new allocations
-- would exceed amount + tax_amount, closing an overpayment/race-condition gap in receipt
-- posting.
--
-- Idempotent (CREATE OR REPLACE). Safe to run again; does not need re-applying since it is
-- already live, but kept in the repo so the file list matches the live migration ledger.

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

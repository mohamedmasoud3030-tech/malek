-- =============================================================================
-- Migration: purge_production_qa_seed_data
-- Date: 2026-07-15
-- Risk: MEDIUM (targeted production data deletion)
--
-- Purpose:
--   Remove deterministic QA readiness seed data that was accidentally left in
--   production. This migration deletes only rows that match the known QA IDs,
--   QA references, and QA marker text discovered during live verification.
--
-- Safety:
--   - No TRUNCATE.
--   - Idempotent deletes: safe to re-run when rows are already absent.
--   - Pre-flight guards raise if a known QA key exists but does not carry the
--     expected QA markers/relationships.
--   - Child rows are deleted before parent rows to respect FK constraints.
--   - Does not delete any row outside the deterministic QA graph.
--
-- Rollback note:
--   Data deletion is not self-rollbackable after commit. Restore would require
--   point-in-time recovery or manual re-insertion from the verified pre-delete
--   snapshot. The migration is therefore intentionally narrow and guarded.
-- =============================================================================

DO $$
DECLARE
  v_qa_owner_id    text := '00000000-0000-4000-9000-000000000001';
  v_qa_unit_id     text := '00000000-0000-4000-9001-000000000001';
  v_qa_agreement_id uuid := '00000000-0000-4000-9002-000000000001'::uuid;
  v_qa_tenant_id   text := '00000000-0000-4000-9003-000000000001';
  v_qa_invoice_id  text := '00000000-0000-4000-9004-000000000001';
  v_qa_property_id text := 'TEST-QA-PROP-001';
  v_qa_reference   text := 'TEST-QA-REF-1';
  v_qa_contract_id text;
  v_bad_count      integer;
BEGIN
  -- Resolve the QA contract only when it is linked to the deterministic QA graph.
  SELECT c.id
    INTO v_qa_contract_id
    FROM public.contracts c
   WHERE c.property_id::text = v_qa_property_id
     AND c.unit_id::text = v_qa_unit_id
     AND c.tenant_id::text = v_qa_tenant_id
     AND c.agreement_id = v_qa_agreement_id
     AND coalesce(c.notes, '') LIKE '%اختبار جاهزية%'
   LIMIT 1;

  -- If any row points at the QA contract but the contract cannot be resolved via
  -- the full QA graph, stop instead of guessing.
  IF v_qa_contract_id IS NULL AND EXISTS (
    SELECT 1 FROM public.invoices WHERE id::text = v_qa_invoice_id
    UNION ALL
    SELECT 1 FROM public.payments WHERE reference_no = v_qa_reference OR reference_number = v_qa_reference
    UNION ALL
    SELECT 1 FROM public.receipts WHERE ref = v_qa_reference
    UNION ALL
    SELECT 1 FROM public.contracts
     WHERE property_id::text = v_qa_property_id OR unit_id::text = v_qa_unit_id OR tenant_id::text = v_qa_tenant_id OR agreement_id = v_qa_agreement_id
  ) THEN
    RAISE EXCEPTION 'QA cleanup guard failed: QA-linked rows exist but QA contract graph was not uniquely resolved';
  END IF;

  -- Guard deterministic keys: if present, they must carry QA markers and/or the
  -- expected deterministic relationships.
  SELECT count(*) INTO v_bad_count
  FROM public.owners o
  WHERE o.id::text = v_qa_owner_id
    AND NOT (
      coalesce(to_jsonb(o)->>'name', to_jsonb(o)->>'display_name', '') ILIKE '%TEST-QA%'
      OR coalesce(o.notes, '') LIKE '%اختبار جاهزية%'
    );
  IF v_bad_count > 0 THEN RAISE EXCEPTION 'QA cleanup guard failed: owner % does not look like QA data', v_qa_owner_id; END IF;

  SELECT count(*) INTO v_bad_count
  FROM public.properties p
  WHERE p.id::text = v_qa_property_id
    AND NOT (
      coalesce(to_jsonb(p)->>'owner_id', '') = v_qa_owner_id
      AND (
        coalesce(to_jsonb(p)->>'name', to_jsonb(p)->>'title', '') ILIKE '%TEST-QA%'
        OR coalesce(p.notes, '') LIKE '%اختبار جاهزية%'
      )
    );
  IF v_bad_count > 0 THEN RAISE EXCEPTION 'QA cleanup guard failed: property % does not look like QA data', v_qa_property_id; END IF;

  SELECT count(*) INTO v_bad_count
  FROM public.units u
  WHERE u.id::text = v_qa_unit_id
    AND NOT (
      u.property_id::text = v_qa_property_id
      AND (
        coalesce(to_jsonb(u)->>'name', to_jsonb(u)->>'unit_number', '') ILIKE '%TEST-QA%'
        OR coalesce(u.notes, '') LIKE '%اختبار جاهزية%'
      )
    );
  IF v_bad_count > 0 THEN RAISE EXCEPTION 'QA cleanup guard failed: unit % does not look like QA data', v_qa_unit_id; END IF;

  SELECT count(*) INTO v_bad_count
  FROM public.people
  WHERE id::text = v_qa_tenant_id
    AND NOT (type = 'tenant' AND (coalesce(full_name, '') ILIKE '%TEST-QA%' OR coalesce(notes, '') LIKE '%اختبار جاهزية%'));
  IF v_bad_count > 0 THEN RAISE EXCEPTION 'QA cleanup guard failed: people tenant % does not look like QA data', v_qa_tenant_id; END IF;

  SELECT count(*) INTO v_bad_count
  FROM public.tenants t
  WHERE t.id::text = v_qa_tenant_id
    AND NOT (
      coalesce(to_jsonb(t)->>'name', to_jsonb(t)->>'full_name', '') ILIKE '%TEST-QA%'
      OR coalesce(t.notes, '') LIKE '%اختبار جاهزية%'
    );
  IF v_bad_count > 0 THEN RAISE EXCEPTION 'QA cleanup guard failed: legacy tenant % does not look like QA data', v_qa_tenant_id; END IF;

  SELECT count(*) INTO v_bad_count
  FROM public.owner_agreements
  WHERE id = v_qa_agreement_id
    AND NOT (owner_id::text = v_qa_owner_id AND property_id::text = v_qa_property_id AND coalesce(notes, '') LIKE '%اختبار جاهزية%');
  IF v_bad_count > 0 THEN RAISE EXCEPTION 'QA cleanup guard failed: owner agreement % does not look like QA data', v_qa_agreement_id; END IF;

  SELECT count(*) INTO v_bad_count
  FROM public.invoices i
  WHERE i.id::text = v_qa_invoice_id
    AND NOT (
      i.contract_id::text = v_qa_contract_id
      AND coalesce(to_jsonb(i)->>'no', '') = 'TEST-INV-1'
      AND coalesce(i.status, '') = 'UNPAID'
      AND coalesce(i.paid_amount, 0) = 0
      AND coalesce(i.notes, '') LIKE '%اختبار جاهزية%'
    );
  IF v_bad_count > 0 THEN RAISE EXCEPTION 'QA cleanup guard failed: invoice % does not look like QA data', v_qa_invoice_id; END IF;

  SELECT count(*) INTO v_bad_count
  FROM public.payments
  WHERE (reference_no = v_qa_reference OR reference_number = v_qa_reference OR invoice_id::text = v_qa_invoice_id)
    AND NOT (
      invoice_id::text = v_qa_invoice_id
      AND coalesce(reference_no, '') = v_qa_reference
      AND coalesce(reference_number, '') = v_qa_reference
    );
  IF v_bad_count > 0 THEN RAISE EXCEPTION 'QA cleanup guard failed: payment reference % does not look like QA data', v_qa_reference; END IF;

  SELECT count(*) INTO v_bad_count
  FROM public.receipts
  WHERE (ref = v_qa_reference OR request_id = 'test-qa-payment-001' OR coalesce(notes, '') LIKE '%' || v_qa_invoice_id || '%')
    AND NOT (
      contract_id::text = v_qa_contract_id
      AND coalesce(ref, '') = v_qa_reference
      AND coalesce(status, '') = 'VOID'
    );
  IF v_bad_count > 0 THEN RAISE EXCEPTION 'QA cleanup guard failed: receipt reference % does not look like QA data', v_qa_reference; END IF;

  -- Guard against unexpected non-QA children that would make parent deletion unsafe.
  SELECT count(*) INTO v_bad_count FROM public.receipt_allocations WHERE invoice_id::text = v_qa_invoice_id;
  IF v_bad_count > 0 THEN RAISE EXCEPTION 'QA cleanup guard failed: invoice % has receipt allocations', v_qa_invoice_id; END IF;

  SELECT count(*) INTO v_bad_count FROM public.deposit_txs WHERE contract_id::text = v_qa_contract_id;
  IF v_bad_count > 0 THEN RAISE EXCEPTION 'QA cleanup guard failed: QA contract has deposit transactions'; END IF;

  SELECT count(*) INTO v_bad_count FROM public.contract_documents WHERE contract_id::text = v_qa_contract_id;
  IF v_bad_count > 0 THEN RAISE EXCEPTION 'QA cleanup guard failed: QA contract has documents'; END IF;

  SELECT count(*) INTO v_bad_count FROM public.maintenance_records WHERE unit_id::text = v_qa_unit_id;
  IF v_bad_count > 0 THEN RAISE EXCEPTION 'QA cleanup guard failed: QA unit has maintenance records'; END IF;

  SELECT count(*) INTO v_bad_count FROM public.cost_centers WHERE property_id::text = v_qa_property_id;
  IF v_bad_count > 0 THEN RAISE EXCEPTION 'QA cleanup guard failed: QA property has cost centers'; END IF;

  -- Delete QA-only children first.
  DELETE FROM public.financial_operation_idempotency
   WHERE request_id = 'test-qa-payment-001'
      OR response_payload::text LIKE '%' || v_qa_invoice_id || '%'
      OR response_payload::text LIKE '%' || v_qa_reference || '%';

  DELETE FROM public.payments
   WHERE invoice_id::text = v_qa_invoice_id
      OR reference_no = v_qa_reference
      OR reference_number = v_qa_reference;

  DELETE FROM public.receipts
   WHERE ref = v_qa_reference
      OR request_id = 'test-qa-payment-001'
      OR (contract_id::text = v_qa_contract_id AND coalesce(notes, '') LIKE '%' || v_qa_invoice_id || '%');

  DELETE FROM public.invoices i
   WHERE i.id::text = v_qa_invoice_id
      OR (
        i.contract_id::text = v_qa_contract_id
        AND coalesce(to_jsonb(i)->>'no', '') = 'TEST-INV-1'
        AND coalesce(i.notes, '') LIKE '%اختبار جاهزية%'
      );

  DELETE FROM public.contract_balances
   WHERE contract_id::text = v_qa_contract_id
      OR unit_id::text = v_qa_unit_id
      OR tenant_id::text = v_qa_tenant_id;

  DELETE FROM public.tenant_balances
   WHERE tenant_id::text = v_qa_tenant_id;

  DELETE FROM public.owner_balances
   WHERE owner_id::text = v_qa_owner_id;

  -- Delete QA parent/domain rows after financial summaries are gone.
  DELETE FROM public.contracts
   WHERE id::text = v_qa_contract_id
     AND property_id::text = v_qa_property_id
     AND unit_id::text = v_qa_unit_id
     AND tenant_id::text = v_qa_tenant_id
     AND agreement_id = v_qa_agreement_id
     AND coalesce(notes, '') LIKE '%اختبار جاهزية%';

  DELETE FROM public.tenants t
   WHERE t.id::text = v_qa_tenant_id
     AND (
       coalesce(to_jsonb(t)->>'name', to_jsonb(t)->>'full_name', '') ILIKE '%TEST-QA%'
       OR coalesce(t.notes, '') LIKE '%اختبار جاهزية%'
     );

  DELETE FROM public.people
   WHERE id::text = v_qa_tenant_id
     AND type = 'tenant'
     AND (coalesce(full_name, '') ILIKE '%TEST-QA%' OR coalesce(notes, '') LIKE '%اختبار جاهزية%');

  DELETE FROM public.owner_agreements
   WHERE id = v_qa_agreement_id
     AND owner_id::text = v_qa_owner_id
     AND property_id::text = v_qa_property_id
     AND coalesce(notes, '') LIKE '%اختبار جاهزية%';

  DELETE FROM public.units u
   WHERE u.id::text = v_qa_unit_id
     AND u.property_id::text = v_qa_property_id
     AND (
       coalesce(to_jsonb(u)->>'name', to_jsonb(u)->>'unit_number', '') ILIKE '%TEST-QA%'
       OR coalesce(u.notes, '') LIKE '%اختبار جاهزية%'
     );

  DELETE FROM public.property_owners
   WHERE property_id::text = v_qa_property_id
      OR owner_id::text = v_qa_owner_id;

  DELETE FROM public.properties p
   WHERE p.id::text = v_qa_property_id
     AND coalesce(to_jsonb(p)->>'owner_id', '') = v_qa_owner_id
     AND (
       coalesce(to_jsonb(p)->>'name', to_jsonb(p)->>'title', '') ILIKE '%TEST-QA%'
       OR coalesce(p.notes, '') LIKE '%اختبار جاهزية%'
     );

  DELETE FROM public.owners o
   WHERE o.id::text = v_qa_owner_id
     AND (
       coalesce(to_jsonb(o)->>'name', to_jsonb(o)->>'display_name', '') ILIKE '%TEST-QA%'
       OR coalesce(o.notes, '') LIKE '%اختبار جاهزية%'
     );
END $$;

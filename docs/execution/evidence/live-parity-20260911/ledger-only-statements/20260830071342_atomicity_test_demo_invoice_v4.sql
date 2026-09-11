
DO $$
DECLARE
  v_company_id   uuid    := 'ae96d298-36dd-4e23-b603-4c5738b03c3a';
  v_contract_id  uuid    := 'd980f9cd-5e9a-43b6-81fc-6c11ca93664b';
  v_inv_id       uuid    := 'aabbcc01-0000-4000-8000-000000000001';
  v_snapshot_id  uuid    := 'aabbcc01-0000-4000-8000-000000000002';
  v_batch_id     uuid    := 'aabbcc01-0000-4000-8000-000000000003';
  v_period_id    uuid    := 'd91969fe-768c-4997-baa1-96ad8aabdd04';
  v_ar_acct_id   text    := 'coa:ae96d298-36dd-4e23-b603-4c5738b03c3a:1201';
  v_ofp_acct_id  text    := 'coa:ae96d298-36dd-4e23-b603-4c5738b03c3a:2000';
  v_manager_id   uuid    := '3a450df2-7b28-4052-9e85-38e4298cc52a';
BEGIN
  -- 1. Posted invoice journal batch first (needed for snapshot's journal_batch_id)
  INSERT INTO public.journal_batches (
    id, company_id, status, source_type, source_id, event_id,
    is_legacy_compat, effective_date, accounting_period_id,
    period_resolution_reason, posted_at, posted_by,
    description, created_at, created_by, updated_at
  ) VALUES (
    v_batch_id, v_company_id, 'POSTED', 'invoice', v_inv_id::text, v_inv_id::text,
    false, '2026-09-01', v_period_id,
    'open_period_contains_date', now(), v_manager_id,
    'OWNER_AGENCY OFFICE_IS_CREDITOR rent invoice DEMO-2026-09',
    now(), v_manager_id, now()
  );

  -- Journal lines (Dr 1201 / Cr 2000)
  INSERT INTO public.journal_lines (
    id, batch_id, company_id, account_id, debit, credit, line_description,
    ref_source_id, ref_entity_type, ref_entity_id, created_at
  ) VALUES
    (
      gen_random_uuid()::text, v_batch_id, v_company_id,
      v_ar_acct_id, 450.000, 0.000,
      'INV-DEMO-2026-09-DR-AR',
      v_inv_id::text, 'invoice', v_inv_id::text, now()
    ),
    (
      gen_random_uuid()::text, v_batch_id, v_company_id,
      v_ofp_acct_id, 0.000, 450.000,
      'INV-DEMO-2026-09-CR-OWNER-FUNDS',
      v_inv_id::text, 'invoice', v_inv_id::text, now()
    );

  -- 2. Tax snapshot (references the batch)
  INSERT INTO public.taxable_line_tax_snapshots (
    id, company_id, source_type, source_id,
    journal_batch_id, account_no,
    tax_code, tax_rate, net_amount, tax_amount, effective_date,
    created_at
  ) VALUES (
    v_snapshot_id, v_company_id, 'invoice', v_inv_id::text,
    v_batch_id, '2100',
    'NON_TAXABLE', 0.000, 450.000, 0.000, '2026-09-01',
    now()
  );

  -- 3. Invoice with full RC1 lineage
  INSERT INTO public.invoices (
    id, company_id, contract_id, amount, tax_amount,
    issue_date, due_date, status, document_status,
    invoice_operating_model, invoice_collection_role,
    invoice_accounting_classification,
    invoice_agreement_version_id,
    tax_treatment, tax_basis, tax_code, tax_rate,
    tax_profile_id, tax_snapshot_id,
    invoice_posting_batch_id,
    charge_type, created_at, updated_at
  ) VALUES (
    v_inv_id,
    v_company_id,
    v_contract_id,
    450.000, 0.000,
    '2026-09-01', '2026-09-30',
    'UNPAID', 'POSTED',
    'OWNER_AGENCY', 'OFFICE_IS_CREDITOR',
    'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS',
    'd2000000-0000-4000-8000-000000000081',
    'NON_TAXABLE', 'NON_TAXABLE', 'NON_TAXABLE', 0.000,
    'd2000000-0000-4000-8000-0000000000a1',
    v_snapshot_id,
    v_batch_id,
    'RENT',
    now(), now()
  );

  RAISE NOTICE 'TEST invoice ready: invoice=%, batch=%, snapshot=%', v_inv_id, v_batch_id, v_snapshot_id;
END $$;

-- =============================================================================
-- Stage S04 — Property Management GL Lifecycle, Commission, Expenses, Deposits,
-- Reconciliation & Diagnostics Contract (pgTAP)
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;
select plan(32);

-- Temp table for collecting test results
create temp table _s04_test_results (seq serial, line text);

-- ── 1. Static Function Existence & Posture ───────────────────────────────────

do $$
declare
  v_rpcs text[] := array[
    'gl_pm_require_account',
    'gl_pm_round_omr',
    'gl_pm_post_collection_owner_is_creditor',
    'gl_pm_post_invoice_office_is_creditor',
    'gl_pm_post_collection_office_is_creditor',
    'gl_pm_accrue_fixed_monthly_fee',
    'gl_pm_post_owner_payment',
    'gl_pm_post_owner_expense',
    'gl_pm_post_deposit_receipt',
    'gl_pm_post_deposit_refund',
    'gl_pm_post_deposit_application',
    'gl_pm_post_broker_commission_approval',
    'gl_pm_post_broker_commission_payment',
    'gl_pm_list_batches',
    'gl_reconcile_subledgers',
    'gl_diagnose_historical_financial_integrity'
  ];
  v_rpc text;
begin
  foreach v_rpc in array v_rpcs loop
    insert into _s04_test_results(line)
    select is(
      exists (select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'public' and p.proname = v_rpc),
      true,
      v_rpc || ' exists'
    );
  end loop;
end $$;

-- ── 2. Seed Test Fixtures ────────────────────────────────────────────────────

insert into public.companies (id, name, slug)
values
  ('c4010000-0000-4000-8000-000000000001', 'S04 Test Co A', 's04-test-a'),
  ('c4010000-0000-4000-8000-000000000002', 'S04 Test Co B', 's04-test-b')
on conflict (id) do nothing;

insert into auth.users (id, email, raw_app_meta_data)
values
  ('a4010000-0000-4000-8000-000000000001', 'admin.a@s04.test', '{"company_id":"c4010000-0000-4000-8000-000000000001"}'::jsonb),
  ('a4010000-0000-4000-8000-000000000002', 'admin.b@s04.test', '{"company_id":"c4010000-0000-4000-8000-000000000002"}'::jsonb)
on conflict (id) do nothing;

insert into public.users (id, email, name, role, status, is_active)
values
  ('a4010000-0000-4000-8000-000000000001', 'admin.a@s04.test', 'Admin A', 'ADMIN', 'ACTIVE', true),
  ('a4010000-0000-4000-8000-000000000002', 'admin.b@s04.test', 'Admin B', 'ADMIN', 'ACTIVE', true)
on conflict (id) do nothing;

insert into public.company_members (company_id, user_id, role)
values
  ('c4010000-0000-4000-8000-000000000001', 'a4010000-0000-4000-8000-000000000001', 'ADMIN'),
  ('c4010000-0000-4000-8000-000000000002', 'a4010000-0000-4000-8000-000000000002', 'ADMIN')
on conflict do nothing;

-- Provision Chart of Accounts for both companies
select public.provision_company_chart_of_accounts('c4010000-0000-4000-8000-000000000001'::uuid);
select public.provision_company_chart_of_accounts('c4010000-0000-4000-8000-000000000002'::uuid);

-- Ensure Open Accounting Period
insert into public.accounting_periods (company_id, name, start_date, end_date, status)
values
  ('c4010000-0000-4000-8000-000000000001', '2026-08', '2026-08-01', '2026-08-31', 'OPEN'),
  ('c4010000-0000-4000-8000-000000000002', '2026-08', '2026-08-01', '2026-08-31', 'OPEN')
on conflict (company_id, name) do nothing;

-- ── 3. Behavioral Lifecycle & Invariant Tests ─────────────────────────────────

do $$
declare
  v_co_a uuid := 'c4010000-0000-4000-8000-000000000001';
  v_co_b uuid := 'c4010000-0000-4000-8000-000000000002';
  v_pmt_id uuid := gen_random_uuid();
  v_inv_id uuid := gen_random_uuid();
  v_agmt_id uuid := gen_random_uuid();
  v_stl_id text := 'stl-test-001';
  v_res jsonb;
  v_bal_ofp numeric;
  v_bal_mfr numeric;
  v_bal_cash numeric;
  v_bal_due numeric;
  v_bal_dep numeric;
  v_bal_comm numeric;
begin
  -- Test 17: OMR 3-decimal rounding helper
  insert into _s04_test_results(line)
  select is(public.gl_pm_round_omr(100.12345), 100.123::numeric, 'gl_pm_round_omr rounds to 3dp');

  -- Test 18: Account requirement fails cleanly on unknown account
  begin
    perform public.gl_pm_require_account(v_co_a, '9999');
    insert into _s04_test_results(line) select fail('gl_pm_require_account should have thrown P0002');
  exception when sqlstate 'P0002' then
    insert into _s04_test_results(line) select pass('gl_pm_require_account throws P0002 on unprovisioned account');
  end;

  -- Test 19: 1000 OMR / 10% Collection (OWNER_IS_CREDITOR)
  v_res := public.gl_pm_post_collection_owner_is_creditor(jsonb_build_object(
    'company_id', v_co_a,
    'payment_id', v_pmt_id,
    'collected_amount', 1000.000,
    'commission_net', 100.000,
    'vat_amount', 0,
    'effective_date', '2026-08-09'
  ));
  insert into _s04_test_results(line)
  select is((v_res->>'model')::text, 'OWNER_IS_CREDITOR', 'Collection OWNER_IS_CREDITOR posts successfully');

  -- Check OFP balance: Credit 1000, Debit 100 -> net Credit 900
  select coalesce(sum(l.credit - l.debit), 0) into v_bal_ofp
    from public.journal_lines l
    join public.accounts a on a.id = l.account_id
   where l.company_id = v_co_a and a.no = '2000';
  insert into _s04_test_results(line)
  select is(v_bal_ofp, 900.000::numeric, 'OFP net balance after 1000 collection and 100 fee is 900.000');

  -- Check Management Fee Revenue balance: Credit 100
  select coalesce(sum(l.credit - l.debit), 0) into v_bal_mfr
    from public.journal_lines l
    join public.accounts a on a.id = l.account_id
   where l.company_id = v_co_a and a.no = '4100';
  insert into _s04_test_results(line)
  select is(v_bal_mfr, 100.000::numeric, 'Management Fee Revenue is 100.000');

  -- Test 20: Idempotent replay returns same result without duplicate batch
  v_res := public.gl_pm_post_collection_owner_is_creditor(jsonb_build_object(
    'company_id', v_co_a,
    'payment_id', v_pmt_id,
    'collected_amount', 1000.000,
    'commission_net', 100.000,
    'vat_amount', 0,
    'effective_date', '2026-08-09'
  ));
  select coalesce(sum(l.credit - l.debit), 0) into v_bal_ofp
    from public.journal_lines l
    join public.accounts a on a.id = l.account_id
   where l.company_id = v_co_a and a.no = '2000';
  insert into _s04_test_results(line)
  select is(v_bal_ofp, 900.000::numeric, 'Idempotent replay does not duplicate OFP entries');

  -- Test 21: Owner Payment Payout of 900
  -- Insert owner settlement in APPROVED status first
  insert into public.owners (id, full_name, name, company_id)
  values ('0a040000-0000-4000-8000-000000000001', 'Owner S04', 'Owner S04', v_co_a)
  on conflict (id) do nothing;

  insert into public.owner_settlements (id, company_id, owner_id, status, period_start, period_end, gross_collected, office_fee, net_payable, approved_at, approved_by)
  values (v_stl_id, v_co_a, '0a040000-0000-4000-8000-000000000001', 'APPROVED', '2026-08-01', '2026-08-31', 1000.000, 100.000, 900.000, now(), 'a4010000-0000-4000-8000-000000000001')
  on conflict (id) do update set status = 'APPROVED', approved_at = now(), approved_by = 'a4010000-0000-4000-8000-000000000001';

  v_res := public.gl_pm_post_owner_payment(jsonb_build_object(
    'company_id', v_co_a,
    'settlement_id', v_stl_id,
    'net_payout', 900.000,
    'effective_date', '2026-08-09'
  ));
  insert into _s04_test_results(line)
  select is((v_res->>'step')::text, 'owner_payment', 'Owner payment posts successfully');

  -- Final OFP balance must now be 0.000
  select coalesce(sum(l.credit - l.debit), 0) into v_bal_ofp
    from public.journal_lines l
    join public.accounts a on a.id = l.account_id
   where l.company_id = v_co_a and a.no = '2000';
  insert into _s04_test_results(line)
  select is(v_bal_ofp, 0.000::numeric, 'Acceptance scenario final OFP balance is 0.000');

  -- Final Cash balance must be 100.000 (1000 collected - 900 paid)
  select coalesce(sum(l.debit - l.credit), 0) into v_bal_cash
    from public.journal_lines l
    join public.accounts a on a.id = l.account_id
   where l.company_id = v_co_a and a.no = '1120';
  insert into _s04_test_results(line)
  select is(v_bal_cash, 100.000::numeric, 'Acceptance scenario final Cash balance is 100.000');

  -- Test 22: OFFICE_IS_CREDITOR invoice and collection
  v_res := public.gl_pm_post_invoice_office_is_creditor(jsonb_build_object(
    'company_id', v_co_a,
    'invoice_id', v_inv_id,
    'invoice_amount', 500.000,
    'effective_date', '2026-08-09'
  ));
  insert into _s04_test_results(line)
  select is((v_res->>'model')::text, 'OFFICE_IS_CREDITOR', 'OFFICE_IS_CREDITOR invoice posted');

  -- Test 23: FIXED_MONTHLY daily accrual (Due from Owner 1300 → MFR 4100)
  v_res := public.gl_pm_accrue_fixed_monthly_fee(jsonb_build_object(
    'company_id', v_co_a,
    'agreement_id', v_agmt_id,
    'accrual_period', '2026-08-01/2026-08-31',
    'accrual_net', 50.000,
    'vat_amount', 2.500,
    'effective_date', '2026-08-09'
  ));
  select coalesce(sum(l.debit - l.credit), 0) into v_bal_due
    from public.journal_lines l
    join public.accounts a on a.id = l.account_id
   where l.company_id = v_co_a and a.no = '1300';
  insert into _s04_test_results(line)
  select is(v_bal_due, 52.500::numeric, 'Due from Owners has 52.500 (50 net + 2.5 VAT)');

  -- Test 24: Deposit Receipt and Refund
  declare
    v_dep_id text := '00000000-0000-4000-8000-000000005001';
    v_prop_id text := '00000000-0000-4000-8000-000000005010';
    v_unit_id text := '00000000-0000-4000-8000-000000005011';
    v_ten_id uuid := '00000000-0000-4000-8000-000000005012';
    v_agmt_id text := '00000000-0000-4000-8000-000000005013';
    v_cont_id text := '00000000-0000-4000-8000-000000005014';
  begin
    insert into public.properties (id, title, name, type, address, company_id)
    values (v_prop_id::uuid, 'Deposit Prop', 'Deposit Prop', 'residential', 'Muscat', v_co_a)
    on conflict (id) do nothing;

    insert into public.people (id, full_name, type, company_id)
    values (v_ten_id, 'Tenant Dep', 'tenant', v_co_a)
    on conflict (id) do nothing;

    insert into public.property_owners
      (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values (v_prop_id::uuid, '0a040000-0000-4000-8000-000000000001'::uuid, 100, true, date '2026-01-01', v_co_a)
    on conflict do nothing;

    insert into public.owner_agreements
      (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values (v_agmt_id::uuid, '0a040000-0000-4000-8000-000000000001'::uuid, v_prop_id::uuid, 'property_management', 'RATE', 10, date '2026-01-01', v_co_a)
    on conflict (id) do nothing;

    insert into public.units (id, property_id, name, unit_number, company_id)
    values (v_unit_id::uuid, v_prop_id::uuid, 'Unit Dep', '101', v_co_a)
    on conflict (id) do nothing;

    insert into public.contracts (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
    values (v_cont_id::uuid, v_prop_id::uuid, v_unit_id::uuid, v_ten_id, v_agmt_id::uuid, '2026-01-01', '2026-12-31', 500, 'active', v_co_a)
    on conflict (id) do nothing;

    insert into public.tenant_deposits (id, contract_id, tenant_id, property_id, unit_id, deposit_amount, remaining_amount, status, received_date, company_id)
    values (v_dep_id::uuid, v_cont_id::uuid, v_ten_id, v_prop_id::uuid, v_unit_id::uuid, 200, 200, 'held', '2026-08-09', v_co_a)
    on conflict (id) do update set remaining_amount = 200, refunded_amount = 0, status = 'held';

    perform public.gl_pm_post_deposit_receipt(jsonb_build_object(
      'company_id', v_co_a,
      'deposit_id', v_dep_id,
      'amount', 200.000,
      'effective_date', '2026-08-09'
    ));
    select coalesce(sum(l.credit - l.debit), 0) into v_bal_dep
      from public.journal_lines l
      join public.accounts a on a.id = l.account_id
     where l.company_id = v_co_a and a.no = '2200';
    insert into _s04_test_results(line)
    select is(v_bal_dep, 200.000::numeric, 'Tenant Deposits Payable is 200.000');

    perform public.gl_pm_post_deposit_refund(jsonb_build_object(
      'company_id', v_co_a,
      'deposit_id', v_dep_id,
      'amount', 200.000,
      'effective_date', '2026-08-09'
    ));
    select coalesce(sum(l.credit - l.debit), 0) into v_bal_dep
      from public.journal_lines l
      join public.accounts a on a.id = l.account_id
     where l.company_id = v_co_a and a.no = '2200';
    insert into _s04_test_results(line)
    select is(v_bal_dep, 0.000::numeric, 'Tenant Deposits Payable after refund is 0.000');
  end;

  -- Test 25: Broker Commission Approval and Payment
  declare
    v_comm_id uuid := gen_random_uuid();
  begin
    perform public.gl_pm_post_broker_commission_approval(jsonb_build_object(
      'company_id', v_co_a,
      'commission_id', v_comm_id,
      'amount', 150.000,
      'effective_date', '2026-08-09'
    ));
    select coalesce(sum(l.credit - l.debit), 0) into v_bal_comm
      from public.journal_lines l
      join public.accounts a on a.id = l.account_id
     where l.company_id = v_co_a and a.no = '2300';
    insert into _s04_test_results(line)
    select is(v_bal_comm, 150.000::numeric, 'Broker Commissions Payable is 150.000');

    perform public.gl_pm_post_broker_commission_payment(jsonb_build_object(
      'company_id', v_co_a,
      'commission_id', v_comm_id,
      'amount', 150.000,
      'effective_date', '2026-08-09'
    ));
    select coalesce(sum(l.credit - l.debit), 0) into v_bal_comm
      from public.journal_lines l
      join public.accounts a on a.id = l.account_id
     where l.company_id = v_co_a and a.no = '2300';
    insert into _s04_test_results(line)
    select is(v_bal_comm, 0.000::numeric, 'Broker Commissions Payable after payout is 0.000');
  end;

  -- Test 26: Two-Company Isolation: Company B has zero batches from Company A
  select count(*)::int into v_bal_ofp
    from public.journal_batches b
   where b.company_id = v_co_b;
  insert into _s04_test_results(line)
  select is(v_bal_ofp, 0::numeric, 'Company B has 0 batches (strict company isolation)');
end $$;

-- ── Emit Collected Assertions ────────────────────────────────────────────────

select line from _s04_test_results order by seq;
select * from finish();

rollback;

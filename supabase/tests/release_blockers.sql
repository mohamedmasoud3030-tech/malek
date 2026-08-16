begin;

-- Set ephemeral defaults for company_id during testing
do $$
declare
  r record;
begin
  for r in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'company_id'
  loop
    execute format(
      'alter table public.%I alter column company_id set default ''00000000-0000-4000-8000-000000000001''::uuid',
      r.table_name
    );
  end loop;
end;
$$;

create extension if not exists pgtap with schema extensions;

select plan(32);

select has_table('public', 'contracts', 'contracts table exists after a clean migration replay');
select has_table('public', 'invoices', 'invoices table exists after a clean migration replay');
select has_table('public', 'payments', 'payments table exists after a clean migration replay');
select has_table('public', 'receipts', 'receipts table exists after a clean migration replay');

select ok(
  -- R4 Contract → Billing Authority: the browser contract now carries the
  -- explicit billing policy (p_billing_day, p_grace_days with defaults).
  to_regprocedure('public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text,integer,integer)') is not null,
  'create_contract_atomic is present with the browser contract signature (R4: explicit billing policy)'
);
select ok(
  to_regprocedure('public.record_invoice_payment_atomic(jsonb)') is not null,
  'record_invoice_payment_atomic is present'
);
select ok(
  not exists (
    select 1
    from (values
      ('contracts'), ('invoices'), ('payments'), ('receipts'),
      ('receipt_allocations'), ('financial_operation_idempotency'),
      -- Stage 3: journal_entries is now a compatibility VIEW over the canonical
      -- ledger tables; RLS is asserted on the canonical tables instead.
      ('journal_batches'), ('journal_lines'), ('accounting_periods')
    ) as required(table_name)
    left join pg_class c on c.relname = required.table_name
    left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where c.oid is null or not c.relrowsecurity
  ),
  'RLS is enabled on every launch-critical financial and contract table'
);
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_contract_atomic', 'record_invoice_payment_atomic', 'void_receipt_atomic')
      and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') !~ 'search_path=(public, pg_temp|"public", "pg_temp"|public,pg_temp)'
  ),
  'critical SECURITY DEFINER RPCs pin a safe search_path'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'release-admin@rentrix.test', 'not-used',
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'release-user@rentrix.test', 'not-used',
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
  )
on conflict (id) do nothing;

insert into public.users (id, email, name, role, status, is_active)
values
  ('00000000-0000-0000-0000-000000000101', 'release-admin@rentrix.test', 'Release Admin', 'ADMIN', 'ACTIVE', true),
  ('00000000-0000-0000-0000-000000000102', 'release-user@rentrix.test', 'Release User', 'USER', 'ACTIVE', true)
on conflict (id) do update set role = excluded.role, status = excluded.status, is_active = excluded.is_active;

insert into public.company_members (company_id, user_id, role)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000101', 'OWNER'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000102', 'MEMBER')
on conflict (company_id, user_id) do update set role = excluded.role;

-- The RATE payment path posts through the canonical per-company chart. Keep
-- this release fixture complete instead of relying on legacy bootstrap rows.
do $$
begin
  perform public.provision_company_chart_of_accounts(
    '00000000-0000-4000-8000-000000000001'
  );
end;
$$;

insert into public.owners (id, full_name, company_id)
values ('00000000-0000-0000-0000-000000000201', 'Release Owner', '00000000-0000-4000-8000-000000000001');

insert into public.properties (id, title, type, address, status, company_id)
values
  ('00000000-0000-0000-0000-000000000301', 'Release Rate Property', 'residential', 'Release Gate', 'active', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-0000-0000-000000000302', 'Release Fixed Property', 'residential', 'Release Gate', 'active', '00000000-0000-4000-8000-000000000001');

insert into public.units (id, property_id, unit_number, status, rent_amount, company_id)
values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000301', 'RG-1', 'available', 100, '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000302', 'FG-1', 'available', 100, '00000000-0000-4000-8000-000000000001');

insert into public.people (id, full_name, type, company_id)
values ('00000000-0000-0000-0000-000000000501', 'Release Tenant', 'tenant', '00000000-0000-4000-8000-000000000001');

select is(
  (select name from public.owners where id = '00000000-0000-0000-0000-000000000201'),
  'Release Owner',
  'owner compatibility name is populated from full_name'
);
select is(
  (select name from public.properties where id = '00000000-0000-0000-0000-000000000301'),
  'Release Rate Property',
  'property compatibility name is populated from title'
);

insert into public.property_owners (
  property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on, company_id
) values
  (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    100, true, date '2026-01-01', date '2027-12-31', '00000000-0000-4000-8000-000000000001'
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000201',
    100, true, date '2026-01-01', date '2027-12-31', '00000000-0000-4000-8000-000000000001'
  );

insert into public.owner_agreements (
  id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, company_id
) values
  (
    '00000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000301',
    'property_management', 'RATE', 5, date '2026-01-01', date '2027-12-31', '00000000-0000-4000-8000-000000000001'
  ),
  (
    '00000000-0000-0000-0000-000000000602',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000302',
    'property_management', 'FIXED_MONTHLY', 50, date '2026-01-01', date '2027-12-31', '00000000-0000-4000-8000-000000000001'
  );

-- RC1 payment fixtures use explicit versioned owner-agency terms. They do not
-- depend on legacy agreement inference.
insert into public.owner_agreement_versions (
  id, owner_agreement_id, company_id, version_no, operating_model,
  collection_role, commission_type, commission_value,
  commission_recognition_basis, effective_from, effective_to, created_by
) values
  (
    '00000000-0000-0000-0000-000000000611',
    '00000000-0000-0000-0000-000000000601',
    '00000000-0000-4000-8000-000000000001', 1, 'OWNER_AGENCY',
    'OWNER_IS_CREDITOR', 'RATE', 5, 'ON_COLLECTION',
    date '2026-01-01', date '2027-12-31', '00000000-0000-0000-0000-000000000101'
  ),
  (
    '00000000-0000-0000-0000-000000000612',
    '00000000-0000-0000-0000-000000000602',
    '00000000-0000-4000-8000-000000000001', 1, 'OWNER_AGENCY',
    'OWNER_IS_CREDITOR', 'FIXED_MONTHLY', 50, 'DAILY_ACCRUAL',
    date '2026-01-01', date '2027-12-31', '00000000-0000-0000-0000-000000000101'
  );

update public.owner_agreements
set current_version_id = case id
  when '00000000-0000-0000-0000-000000000601' then '00000000-0000-0000-0000-000000000611'::uuid
  when '00000000-0000-0000-0000-000000000602' then '00000000-0000-0000-0000-000000000612'::uuid
end
where id in (
  '00000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000602'
);

-- Explicit non-taxable rent and RATE-fee policies keep the fixture independent
-- from any assumed statutory rate while satisfying the fail-closed RC1 model.
insert into public.company_tax_profiles (
  id, company_id, version_no, tax_code, tax_rate, effective_from, effective_to,
  status, description, created_by, approved_by, approved_at
) values (
  '00000000-0000-0000-0000-000000000801',
  '00000000-0000-4000-8000-000000000001', 1, 'NON_TAXABLE', 0,
  date '2026-01-01', date '2027-12-31', 'ACTIVE', 'Release gate explicit non-taxable rent',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000102', now()
);

insert into public.company_fee_tax_treatments (
  id, company_id, fee_kind, version_no, tax_code, tax_rate,
  effective_from, effective_to, status, created_by, approved_by, approved_at
) values (
  '00000000-0000-0000-0000-000000000811',
  '00000000-0000-4000-8000-000000000001', 'RATE_MANAGEMENT_FEE', 1,
  'NON_TAXABLE', 0, date '2026-01-01', date '2027-12-31', 'ACTIVE',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000102', now()
);

set local role anon;
select is(
  (select count(*)::integer from public.contracts),
  0,
  'anonymous users cannot read operational contracts'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated","app_metadata":{"user_role":"USER","company_id":"00000000-0000-4000-8000-000000000001"}}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    select public.create_contract_atomic(
      '00000000-0000-0000-0000-000000000301',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000601',
      date '2026-08-01', date '2027-07-31', 100, 'monthly', null,
      'draft', null, 'release-blocker-user-denied', null
    )
  $$,
  null,
  null,
  'USER cannot create contracts through the privileged RPC'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-000000000001"}}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select public.create_contract_atomic(
      '00000000-0000-0000-0000-000000000301',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000601',
      date '2026-08-01', date '2027-07-31', 100, 'monthly', null,
      'draft', null, 'release-blocker-contract', null
    )
  $$,
  'ADMIN can create a valid contract'
);
select is(
  (select count(*)::integer from public.contracts where notes = 'release-blocker-contract'),
  1,
  'valid contract is persisted exactly once'
);
select throws_ok(
  $$
    select public.create_contract_atomic(
      '00000000-0000-0000-0000-000000000301',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000601',
      date '2026-09-01', date '2027-01-31', 100, 'monthly', null,
      'draft', null, 'release-blocker-overlap', null
    )
  $$,
  null,
  null,
  'overlapping contracts on the same unit are rejected'
);

select lives_ok(
  $$
    select public.create_contract_atomic(
      '00000000-0000-0000-0000-000000000302',
      '00000000-0000-0000-0000-000000000402',
      '00000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000602',
      date '2026-08-01', date '2027-07-31', 100, 'monthly', null,
      'draft', null, 'release-blocker-fixed-contract', null
    )
  $$,
  'the same owner can use a different fee agreement on another property'
);
select is(
  (select count(*)::integer from public.contracts where notes = 'release-blocker-fixed-contract'),
  1,
  'the fixed-fee contract is linked and persisted independently'
);

-- Freeze the exact owner-agency version/role on these synthetic DRAFT contracts
-- before creating posted RC1 invoice fixtures. Production activation owns this
-- transition; the release test seeds it directly as the privileged fixture role.
reset role;
update public.contracts c
set agreement_version_id = oa.current_version_id,
    operating_model_snapshot = 'OWNER_AGENCY',
    collection_role_snapshot = 'OWNER_IS_CREDITOR'
from public.owner_agreements oa
where oa.id = c.agreement_id
  and c.notes in ('release-blocker-contract', 'release-blocker-fixed-contract');

-- Invoice creation is server-only. Seed the same immutable sequence used by the
-- generator: DRAFT with RC1 lineage -> tax snapshot -> POSTED.
insert into public.invoices (
  id, contract_id, issue_date, due_date, amount, paid_amount, tax_amount, tax_rate,
  status, company_id, document_status, charge_type, billing_period_start,
  billing_period_end, invoice_agreement_version_id, invoice_operating_model,
  invoice_collection_role, invoice_accounting_classification, tax_treatment,
  tax_profile_id, tax_code, tax_basis
)
select
  '00000000-0000-0000-0000-000000000701', c.id::uuid,
  date '2026-08-01', date '2026-08-05', 100, 0, 0, 0,
  'UNPAID', c.company_id, 'DRAFT', 'RENT', date '2026-08-01', date '2026-08-31',
  c.agreement_version_id, c.operating_model_snapshot, c.collection_role_snapshot,
  'OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL', 'NON_TAXABLE',
  '00000000-0000-0000-0000-000000000801', 'NON_TAXABLE', 'NON_TAXABLE'
from public.contracts c
where c.notes = 'release-blocker-contract';

insert into public.taxable_line_tax_snapshots (
  id, company_id, source_type, source_id, journal_batch_id, account_no,
  tax_code, tax_rate, net_amount, tax_amount, effective_date
) values (
  '00000000-0000-0000-0000-000000000901',
  '00000000-0000-4000-8000-000000000001', 'invoice',
  '00000000-0000-0000-0000-000000000701', null, '2100',
  'NON_TAXABLE', 0, 100, 0, date '2026-08-01'
);

update public.invoices
set tax_snapshot_id = '00000000-0000-0000-0000-000000000901',
    document_status = 'POSTED'
where id = '00000000-0000-0000-0000-000000000701';
set local role authenticated;

select lives_ok(
  $$
    select public.record_invoice_payment_atomic(jsonb_build_object(
      'invoice_id', '00000000-0000-0000-0000-000000000701',
      'amount', 25,
      'method', 'cash',
      'date', '2026-08-05',
      'reference', 'RB-REF-1',
      'request_id', 'release-blocker-payment-1'
    ))
  $$,
  'first atomic payment succeeds'
);
select lives_ok(
  $$
    select public.record_invoice_payment_atomic(jsonb_build_object(
      'invoice_id', '00000000-0000-0000-0000-000000000701',
      'amount', 25,
      'method', 'cash',
      'date', '2026-08-05',
      'reference', 'RB-REF-1',
      'request_id', 'release-blocker-payment-1'
    ))
  $$,
  'repeating the same request is idempotent'
);
select is(
  (select count(*)::integer from public.payments where reference_number = 'RB-REF-1'),
  1,
  'idempotent retry creates one payment only'
);
select is(
  (select count(*)::integer from public.receipts where request_id = 'release-blocker-payment-1'),
  1,
  'idempotent retry creates one receipt only'
);
select is(
  (select paid_amount::numeric from public.invoices where id = '00000000-0000-0000-0000-000000000701'),
  25::numeric,
  'invoice paid amount is correct after the successful payment'
);

select throws_ok(
  $$
    select public.record_invoice_payment_atomic(jsonb_build_object(
      'invoice_id', '00000000-0000-0000-0000-000000000701',
      'amount', 1000,
      'method', 'cash',
      'date', '2026-08-05',
      'reference', 'RB-OVERPAY',
      'request_id', 'release-blocker-overpay'
    ))
  $$,
  null,
  null,
  'overpayment is rejected atomically'
);
select is(
  (select count(*)::integer from public.receipt_allocations where invoice_id = '00000000-0000-0000-0000-000000000701'),
  1,
  'failed overpayment leaves no partial payment row'
);
select is(
  (select count(*)::integer from public.receipts where contract_id = (select contract_id from public.invoices where id = '00000000-0000-0000-0000-000000000701')),
  1,
  'failed overpayment leaves no partial receipt row'
);
select is(
  (select paid_amount::numeric from public.invoices where id = '00000000-0000-0000-0000-000000000701'),
  25::numeric,
  'failed overpayment does not mutate the invoice balance'
);
select throws_ok(
  $$
    select public.record_invoice_payment_atomic(jsonb_build_object(
      'invoice_id', '00000000-0000-0000-0000-000000000701',
      'amount', -1,
      'method', 'cash',
      'date', '2026-08-05',
      'reference', 'RB-NEGATIVE',
      'request_id', 'release-blocker-negative'
    ))
  $$,
  null,
  null,
  'negative payments are rejected'
);

reset role;
insert into public.invoices (
  id, contract_id, issue_date, due_date, amount, paid_amount, tax_amount, tax_rate,
  status, company_id, document_status, charge_type, billing_period_start,
  billing_period_end, invoice_agreement_version_id, invoice_operating_model,
  invoice_collection_role, invoice_accounting_classification, tax_treatment,
  tax_profile_id, tax_code, tax_basis
)
select
  '00000000-0000-0000-0000-000000000702', c.id::uuid,
  date '2026-08-01', date '2026-08-05', 100, 0, 0, 0,
  'UNPAID', c.company_id, 'DRAFT', 'RENT', date '2026-08-01', date '2026-08-31',
  c.agreement_version_id, c.operating_model_snapshot, c.collection_role_snapshot,
  'OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL', 'NON_TAXABLE',
  '00000000-0000-0000-0000-000000000801', 'NON_TAXABLE', 'NON_TAXABLE'
from public.contracts c
where c.notes = 'release-blocker-fixed-contract';

insert into public.taxable_line_tax_snapshots (
  id, company_id, source_type, source_id, journal_batch_id, account_no,
  tax_code, tax_rate, net_amount, tax_amount, effective_date
) values (
  '00000000-0000-0000-0000-000000000902',
  '00000000-0000-4000-8000-000000000001', 'invoice',
  '00000000-0000-0000-0000-000000000702', null, '2100',
  'NON_TAXABLE', 0, 100, 0, date '2026-08-01'
);

update public.invoices
set tax_snapshot_id = '00000000-0000-0000-0000-000000000902',
    document_status = 'POSTED'
where id = '00000000-0000-0000-0000-000000000702';
set local role authenticated;

select lives_ok(
  $$
    select public.record_invoice_payment_atomic(jsonb_build_object(
      'invoice_id', '00000000-0000-0000-0000-000000000702',
      'amount', 40,
      'method', 'cash',
      'date', '2026-08-05',
      'reference', 'RB-FIXED-PAYMENT',
      'request_id', 'release-blocker-fixed-payment'
    ))
  $$,
  'a payment under the independent fixed-fee agreement succeeds'
);
select is(
  (select total_income::numeric from public.owner_balances where owner_id = '00000000-0000-0000-0000-000000000201'),
  65::numeric,
  'owner income combines collections from both agreements'
);
select is(
  (select commission::numeric from public.owner_balances where owner_id = '00000000-0000-0000-0000-000000000201'),
  1.25::numeric,
  'only the RATE agreement accrues a collection percentage'
);
select is(
  (
    select coalesce(sum((transaction ->> 'deduction')::numeric), 0)
    from jsonb_array_elements(
      public.rpt_owner_statement(
        '00000000-0000-0000-0000-000000000201',
        date '2026-08-01',
        date '2026-08-31'
      ) -> 'transactions'
    ) transaction
  ),
  1.25::numeric,
  'the owner statement applies each contract agreement without treating FIXED_MONTHLY as a rate'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated","app_metadata":{"user_role":"USER","company_id":"00000000-0000-4000-8000-000000000001"}}',
  true
);
select throws_ok(
  $$ select count(*) from public.financial_operation_idempotency $$,
  null,
  null,
  'browser users cannot read idempotency records directly'
);
reset role;

select * from finish();
rollback;
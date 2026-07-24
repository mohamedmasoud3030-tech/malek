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

select plan(65);

select has_table('public', 'tenant_deposits', 'tenant deposits table exists after a clean migration replay');
select has_table('public', 'deposit_transactions', 'deposit transactions table exists after a clean migration replay');
select has_table('public', 'owner_settlements', 'owner settlements table exists after a clean migration replay');
select ok(to_regprocedure('public.void_receipt_atomic(jsonb)') is not null, 'void_receipt_atomic is present');
select ok(to_regprocedure('public.create_deposit_atomic(jsonb)') is not null, 'create_deposit_atomic is present');
select ok(to_regprocedure('public.deduct_deposit_atomic(jsonb)') is not null, 'deduct_deposit_atomic is present');
select ok(to_regprocedure('public.refund_deposit_atomic(jsonb)') is not null, 'refund_deposit_atomic is present');
select ok(to_regprocedure('public.create_owner_settlement_draft_atomic(jsonb)') is not null, 'create_owner_settlement_draft_atomic is present');
select ok(to_regprocedure('public.approve_owner_settlement_atomic(jsonb)') is not null, 'approve_owner_settlement_atomic is present');
select ok(to_regprocedure('public.pay_owner_settlement_atomic(jsonb)') is not null, 'pay_owner_settlement_atomic is present');
select ok(
  not exists (
    select 1
    from (values ('tenant_deposits'), ('deposit_transactions'), ('owner_settlements')) as required(table_name)
    left join pg_class c on c.relname = required.table_name
    left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where c.oid is null or not c.relrowsecurity
  ),
  'RLS is enabled on deposit and settlement lifecycle tables'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000001101',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'lifecycle-admin@rentrix.test', 'not-used',
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000001102',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'lifecycle-user@rentrix.test', 'not-used',
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
  )
on conflict (id) do nothing;

insert into public.users (id, email, name, role, status, is_active)
values
  ('00000000-0000-0000-0000-000000001101', 'lifecycle-admin@rentrix.test', 'Lifecycle Admin', 'ADMIN', 'ACTIVE', true),
  ('00000000-0000-0000-0000-000000001102', 'lifecycle-user@rentrix.test', 'Lifecycle User', 'USER', 'ACTIVE', true)
on conflict (id) do update
set role = excluded.role, status = excluded.status, is_active = excluded.is_active;

insert into public.company_members (company_id, user_id, role)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000001101', 'OWNER'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000001102', 'MEMBER')
on conflict (company_id, user_id) do update set role = excluded.role;

insert into public.accounts (id, no, name, company_id)
values ('1111', '1111', 'Cash', '00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.owners (id, full_name, company_id)
values ('00000000-0000-0000-0000-000000001201', 'Lifecycle Owner', '00000000-0000-4000-8000-000000000001');

insert into public.properties (id, title, type, address, status, company_id)
values ('00000000-0000-0000-0000-000000001301', 'Lifecycle Property', 'residential', 'Release Gate', 'active', '00000000-0000-4000-8000-000000000001');

insert into public.units (id, property_id, unit_number, status, rent_amount, company_id)
values ('00000000-0000-0000-0000-000000001401', '00000000-0000-0000-0000-000000001301', 'LC-1', 'available', 1000, '00000000-0000-4000-8000-000000000001');

insert into public.people (id, full_name, type, company_id)
values ('00000000-0000-0000-0000-000000001501', 'Lifecycle Tenant', 'tenant', '00000000-0000-4000-8000-000000000001');

insert into public.property_owners (
  property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on, company_id
) values (
  '00000000-0000-0000-0000-000000001301',
  '00000000-0000-0000-0000-000000001201',
  100, true, date '2026-01-01', date '2027-12-31', '00000000-0000-4000-8000-000000000001'
);

insert into public.owner_agreements (
  id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on
) values (
  '00000000-0000-0000-0000-000000001601',
  '00000000-0000-0000-0000-000000001201',
  '00000000-0000-0000-0000-000000001301',
  'property_management', 'RATE', 10, date '2026-01-01', date '2027-12-31'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001101","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-000000000001"}}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    select public.create_contract_atomic(
      '00000000-0000-0000-0000-000000001301',
      '00000000-0000-0000-0000-000000001401',
      '00000000-0000-0000-0000-000000001501',
      '00000000-0000-0000-0000-000000001601',
      date '2026-09-01', date '2027-08-31', 1000, 'monthly', null,
      'active', null, 'release-lifecycle-contract', null
    )
  $$,
  'authenticated ADMIN creates the lifecycle contract'
);

insert into public.invoices (id, contract_id, issue_date, due_date, amount, paid_amount, tax_amount, status, company_id)
select
  '00000000-0000-0000-0000-000000001701',
  id::uuid,
  date '2026-09-01',
  date '2026-09-05',
  1000,
  0,
  0,
  'UNPAID',
  '00000000-0000-4000-8000-000000000001'
from public.contracts
where notes = 'release-lifecycle-contract';

select lives_ok(
  $$
    select public.record_invoice_payment_atomic(jsonb_build_object(
      'invoice_id', '00000000-0000-0000-0000-000000001701',
      'amount', 250,
      'method', 'cash',
      'date', '2026-09-05',
      'reference', 'RL-PAYMENT-1',
      'request_id', 'release-lifecycle-payment-1'
    ))
  $$,
  'authenticated payment creates the linked payment and receipt'
);

select lives_ok(
  $$
    select public.void_receipt_atomic(jsonb_build_object(
      'receipt_id', (select id::text from public.payments where reference_number = 'RL-PAYMENT-1'),
      'reason', 'release lifecycle reversal',
      'request_id', 'release-lifecycle-void-1'
    ))
  $$,
  'payment-backed identifier voids the linked receipt atomically'
);

select lives_ok(
  $$
    select public.void_receipt_atomic(jsonb_build_object(
      'receipt_id', (select id::text from public.payments where reference_number = 'RL-PAYMENT-1'),
      'reason', 'release lifecycle reversal',
      'request_id', 'release-lifecycle-void-1'
    ))
  $$,
  'replaying the same void request is idempotent'
);

select is(
  (select status::text from public.payments where reference_number = 'RL-PAYMENT-1'),
  'VOID',
  'void marks the canonical payment VOID'
);
select is(
  (
    select r.status::text
    from public.receipts r
    join public.payments p on p.receipt_id::text = r.id::text
    where p.reference_number = 'RL-PAYMENT-1'
  ),
  'VOID',
  'void marks the linked receipt VOID'
);
select is(
  (select paid_amount::numeric from public.invoices where id = '00000000-0000-0000-0000-000000001701'),
  0::numeric,
  'void restores the invoice paid amount'
);
select is(
  (public.rpt_daily_collection(date '2026-09-05', date '2026-09-05')->>'total')::numeric,
  0::numeric,
  'voided payments are excluded from daily collection reporting'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.financial_operation_idempotency
    -- Phase 3A-1B: idempotency keys are company-namespaced (<op>:<company_uuid>).
    where operation_name = 'void_receipt_atomic:00000000-0000-4000-8000-000000000001'
      and request_id = 'release-lifecycle-void-1'
  ),
  1,
  'void replay stores one idempotency record'
);
select is(
  (
    select count(*)::integer
    from public.journal_entries
    where entity_type = 'receipt_void'
      and entity_id = (
        select r.id::text
        from public.receipts r
        join public.payments p on p.receipt_id::text = r.id::text
        where p.reference_number = 'RL-PAYMENT-1'
      )
  ),
  (
    select count(*)::integer
    from public.journal_entries
    where source_id::text = (
      select r.id::text
      from public.receipts r
      join public.payments p on p.receipt_id::text = r.id::text
      where p.reference_number = 'RL-PAYMENT-1'
    )
      and coalesce(entity_type, '') <> 'receipt_void'
  ),
  'void mirrors every original receipt journal line'
);
select is(
  (
    select coalesce(sum(amount) filter (where upper(type) = 'DEBIT'), 0)::numeric
    from public.journal_entries
    where entity_type = 'receipt_void'
      and entity_id = (
        select r.id::text
        from public.receipts r
        join public.payments p on p.receipt_id::text = r.id::text
        where p.reference_number = 'RL-PAYMENT-1'
      )
  ),
  (
    select coalesce(sum(amount) filter (where upper(type) = 'CREDIT'), 0)::numeric
    from public.journal_entries
    where entity_type = 'receipt_void'
      and entity_id = (
        select r.id::text
        from public.receipts r
        join public.payments p on p.receipt_id::text = r.id::text
        where p.reference_number = 'RL-PAYMENT-1'
      )
  ),
  'void reversal journal is balanced'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001102","role":"authenticated","app_metadata":{"user_role":"USER","company_id":"00000000-0000-4000-8000-000000000001"}}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    select public.create_deposit_atomic(jsonb_build_object(
      'contract_id', (select id::text from public.contracts where notes = 'release-lifecycle-contract'),
      'tenant_id', '00000000-0000-0000-0000-000000001501',
      'property_id', '00000000-0000-0000-0000-000000001301',
      'unit_id', '00000000-0000-0000-0000-000000001401',
      'amount', 200,
      'received_date', '2026-09-05',
      'request_id', 'release-lifecycle-deposit-denied'
    ))
  $$,
  null,
  null,
  'USER cannot create a tenant deposit'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001101","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-000000000001"}}',
  true
);

select lives_ok(
  $$
    select public.create_deposit_atomic(jsonb_build_object(
      'contract_id', (select id::text from public.contracts where notes = 'release-lifecycle-contract'),
      'tenant_id', '00000000-0000-0000-0000-000000001501',
      'property_id', '00000000-0000-0000-0000-000000001301',
      'unit_id', '00000000-0000-0000-0000-000000001401',
      'amount', 200,
      'received_date', '2026-09-05',
      'notes', 'release lifecycle deposit',
      'request_id', 'release-lifecycle-deposit-1'
    ))
  $$,
  'ADMIN creates a tenant deposit'
);
select lives_ok(
  $$
    select public.create_deposit_atomic(jsonb_build_object(
      'contract_id', (select id::text from public.contracts where notes = 'release-lifecycle-contract'),
      'tenant_id', '00000000-0000-0000-0000-000000001501',
      'property_id', '00000000-0000-0000-0000-000000001301',
      'unit_id', '00000000-0000-0000-0000-000000001401',
      'amount', 200,
      'received_date', '2026-09-05',
      'notes', 'release lifecycle deposit',
      'request_id', 'release-lifecycle-deposit-1'
    ))
  $$,
  'deposit creation replay is idempotent'
);
select is(
  (select count(*)::integer from public.tenant_deposits where request_id = 'release-lifecycle-deposit-1'),
  1,
  'deposit creation replay persists one deposit'
);
select is(
  (select remaining_amount::numeric from public.tenant_deposits where request_id = 'release-lifecycle-deposit-1'),
  200::numeric,
  'new deposit starts with the full remaining amount'
);
select throws_ok(
  $$
    select public.deduct_deposit_atomic(jsonb_build_object(
      'deposit_id', (select id from public.tenant_deposits where request_id = 'release-lifecycle-deposit-1'),
      'amount', 250,
      'reason', 'maintenance_damage',
      'description', 'overdraw must fail',
      'charged_date', '2026-09-06',
      'request_id', 'release-lifecycle-deposit-overdraw'
    ))
  $$,
  null,
  null,
  'deposit overdraw is rejected before mutation'
);
select lives_ok(
  $$
    select public.deduct_deposit_atomic(jsonb_build_object(
      'deposit_id', (select id from public.tenant_deposits where request_id = 'release-lifecycle-deposit-1'),
      'amount', 50,
      'reason', 'maintenance_damage',
      'description', 'release lifecycle deduction',
      'charged_date', '2026-09-06',
      'request_id', 'release-lifecycle-deposit-deduct-1'
    ))
  $$,
  'deposit deduction succeeds'
);
select lives_ok(
  $$
    select public.deduct_deposit_atomic(jsonb_build_object(
      'deposit_id', (select id from public.tenant_deposits where request_id = 'release-lifecycle-deposit-1'),
      'amount', 50,
      'reason', 'maintenance_damage',
      'description', 'release lifecycle deduction',
      'charged_date', '2026-09-06',
      'request_id', 'release-lifecycle-deposit-deduct-1'
    ))
  $$,
  'deposit deduction replay is idempotent'
);
select is(
  (select deducted_amount::numeric from public.tenant_deposits where request_id = 'release-lifecycle-deposit-1'),
  50::numeric,
  'deposit deduction mutates the balance once'
);
select is(
  (select remaining_amount::numeric from public.tenant_deposits where request_id = 'release-lifecycle-deposit-1'),
  150::numeric,
  'deposit remaining amount reflects the deduction'
);
select is(
  (select count(*)::integer from public.deposit_transactions where request_id = 'release-lifecycle-deposit-deduct-1'),
  1,
  'deduction replay writes one immutable transaction'
);
select lives_ok(
  $$
    select public.refund_deposit_atomic(jsonb_build_object(
      'deposit_id', (select id from public.tenant_deposits where request_id = 'release-lifecycle-deposit-1'),
      'amount', 150,
      'payment_method', 'bank_transfer',
      'refund_date', '2026-09-07',
      'notes', 'release lifecycle refund',
      'request_id', 'release-lifecycle-deposit-refund-1'
    ))
  $$,
  'remaining deposit is refunded'
);
select lives_ok(
  $$
    select public.refund_deposit_atomic(jsonb_build_object(
      'deposit_id', (select id from public.tenant_deposits where request_id = 'release-lifecycle-deposit-1'),
      'amount', 150,
      'payment_method', 'bank_transfer',
      'refund_date', '2026-09-07',
      'notes', 'release lifecycle refund',
      'request_id', 'release-lifecycle-deposit-refund-1'
    ))
  $$,
  'deposit refund replay is idempotent'
);
select is(
  (select remaining_amount::numeric from public.tenant_deposits where request_id = 'release-lifecycle-deposit-1'),
  0::numeric,
  'fully settled deposit has zero remaining'
);
select is(
  (select refunded_amount::numeric from public.tenant_deposits where request_id = 'release-lifecycle-deposit-1'),
  150::numeric,
  'deposit refund is applied once'
);
select is(
  (select status::text from public.tenant_deposits where request_id = 'release-lifecycle-deposit-1'),
  'refunded',
  'fully settled deposit reaches refunded status'
);
select is(
  (
    select count(*)::integer
    from public.deposit_transactions
    where deposit_id = (select id from public.tenant_deposits where request_id = 'release-lifecycle-deposit-1')
  ),
  3,
  'deposit ledger contains held, deduction, and refund transactions'
);

reset role;

select is(
  (
    select coalesce(sum(amount) filter (where upper(type) = 'DEBIT'), 0)::numeric
    from public.journal_entries
    where source_id::text = (select id from public.tenant_deposits where request_id = 'release-lifecycle-deposit-1')
  ),
  400::numeric,
  'deposit lifecycle posts the expected total debits'
);
select is(
  (
    select coalesce(sum(amount) filter (where upper(type) = 'CREDIT'), 0)::numeric
    from public.journal_entries
    where source_id::text = (select id from public.tenant_deposits where request_id = 'release-lifecycle-deposit-1')
  ),
  400::numeric,
  'deposit lifecycle posts equal credits'
);

-- P1 fixture evolution (failure category: incomplete fixture/harness — the old
-- assertions pinned the client-trusted-amounts behavior itself). The settlement
-- block below now proves SERVER-side derivation: a second, non-voided payment
-- of 750 on 2026-09-10 (the 250 payment from the void lifecycle stays VOID and
-- must be excluded) and one POSTED OWNER-charged expense of 50 on 2026-09-12.
-- Derived tuple for 2026-09-01..2026-09-30 under the RATE 10% agreement:
-- gross 750, fee 75, expenses 50, tax 0 (company VAT disabled) ⇒ net 625.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001101","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-000000000001"}}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    select public.record_invoice_payment_atomic(jsonb_build_object(
      'invoice_id', '00000000-0000-0000-0000-000000001701',
      'amount', 750,
      'method', 'bank_transfer',
      'date', '2026-09-10',
      'reference', 'RL-PAYMENT-2',
      'request_id', 'release-lifecycle-payment-2'
    ))
  $$,
  'second lifecycle payment stays posted for settlement derivation'
);

reset role;

insert into public.expenses (property_id, category, amount, expense_date, date_time, status, charged_to, description, company_id)
values (
  '00000000-0000-0000-0000-000000001301', 'maintenance', 50, date '2026-09-12', '2026-09-12',
  'POSTED', 'OWNER', 'release lifecycle owner expense', '00000000-0000-4000-8000-000000000001'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001101","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-000000000001"}}',
  true
);
set local role authenticated;

-- The payload deliberately carries FORGED amounts (9999/1/1/1): P1 must ignore
-- every client-sent amount key and persist the server-derived tuple instead.
select lives_ok(
  $$
    select public.create_owner_settlement_draft_atomic(jsonb_build_object(
      'owner_id', '00000000-0000-0000-0000-000000001201',
      'property_id', '00000000-0000-0000-0000-000000001301',
      'period_start', '2026-09-01',
      'period_end', '2026-09-30',
      'gross_collected', 9999,
      'office_fee', 1,
      'owner_expenses', 1,
      'tax_amount', 1,
      'notes', 'release lifecycle settlement',
      'request_id', '10000000-0000-0000-0000-000000000001'
    ))
  $$,
  'owner settlement draft is created despite forged client amounts'
);
select lives_ok(
  $$
    select public.create_owner_settlement_draft_atomic(jsonb_build_object(
      'owner_id', '00000000-0000-0000-0000-000000001201',
      'property_id', '00000000-0000-0000-0000-000000001301',
      'period_start', '2026-09-01',
      'period_end', '2026-09-30',
      'gross_collected', 9999,
      'office_fee', 1,
      'owner_expenses', 1,
      'tax_amount', 1,
      'notes', 'release lifecycle settlement',
      'request_id', '10000000-0000-0000-0000-000000000001'
    ))
  $$,
  'owner settlement draft replay is idempotent'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.owner_settlements
    where request_id = '10000000-0000-0000-0000-000000000001'::uuid
  ),
  1,
  'settlement draft replay persists one row'
);
select is(
  (
    select gross_collected::numeric
    from public.owner_settlements
    where request_id = '10000000-0000-0000-0000-000000000001'::uuid
  ),
  750::numeric,
  'settlement gross is server-derived from posted collections (voided 250 excluded), not the forged payload'
);
select is(
  (
    select office_fee::numeric
    from public.owner_settlements
    where request_id = '10000000-0000-0000-0000-000000000001'::uuid
  ),
  75::numeric,
  'settlement office fee is server-derived from the RATE agreement: 10% of 750'
);
select is(
  (
    select owner_expenses::numeric
    from public.owner_settlements
    where request_id = '10000000-0000-0000-0000-000000000001'::uuid
  ),
  50::numeric,
  'settlement owner expenses are server-derived from POSTED OWNER expenses'
);
select is(
  (
    select tax_amount::numeric
    from public.owner_settlements
    where request_id = '10000000-0000-0000-0000-000000000001'::uuid
  ),
  0::numeric,
  'settlement tax stays zero while company VAT is disabled (ADR 0001: disabled by default)'
);
select is(
  (
    select net_payable::numeric
    from public.owner_settlements
    where request_id = '10000000-0000-0000-0000-000000000001'::uuid
  ),
  625::numeric,
  'settlement net payable reconciles the derived tuple: 750 - 75 - 50'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001101","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-000000000001"}}',
  true
);
set local role authenticated;

select throws_ok(
  $$
    select public.create_owner_settlement_draft_atomic(jsonb_build_object(
      'owner_id', '00000000-0000-0000-0000-000000001201',
      'property_id', '00000000-0000-0000-0000-000000001301',
      'period_start', '2026-09-01',
      'period_end', '2026-09-30',
      'gross_collected', 9999,
      'office_fee', 1,
      'owner_expenses', 1,
      'tax_amount', 1,
      'request_id', '10000000-0000-0000-0000-000000000002'
    ))
  $$,
  null,
  null,
  'duplicate active settlement period is rejected'
);
select lives_ok(
  $$
    select public.approve_owner_settlement_atomic(jsonb_build_object(
      'settlement_id', (
        select id from public.owner_settlements
        where request_id = '10000000-0000-0000-0000-000000000001'::uuid
      ),
      'request_id', '10000000-0000-0000-0000-000000000003'
    ))
  $$,
  'settlement draft is approved'
);
select lives_ok(
  $$
    select public.approve_owner_settlement_atomic(jsonb_build_object(
      'settlement_id', (
        select id from public.owner_settlements
        where request_id = '10000000-0000-0000-0000-000000000001'::uuid
      ),
      'request_id', '10000000-0000-0000-0000-000000000003'
    ))
  $$,
  'settlement approval replay is idempotent'
);

reset role;

select is(
  (
    select status::text from public.owner_settlements
    where request_id = '10000000-0000-0000-0000-000000000001'::uuid
  ),
  'APPROVED',
  'approved settlement reaches APPROVED status'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001101","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-000000000001"}}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    select public.pay_owner_settlement_atomic(jsonb_build_object(
      'settlement_id', (
        select id from public.owner_settlements
        where request_id = '10000000-0000-0000-0000-000000000001'::uuid
      ),
      'method', 'bank_transfer',
      'payment_reference', 'RL-SETTLEMENT-PAYMENT',
      'request_id', '10000000-0000-0000-0000-000000000004'
    ))
  $$,
  'approved settlement is paid'
);
select lives_ok(
  $$
    select public.pay_owner_settlement_atomic(jsonb_build_object(
      'settlement_id', (
        select id from public.owner_settlements
        where request_id = '10000000-0000-0000-0000-000000000001'::uuid
      ),
      'method', 'bank_transfer',
      'payment_reference', 'RL-SETTLEMENT-PAYMENT',
      'request_id', '10000000-0000-0000-0000-000000000004'
    ))
  $$,
  'settlement payment replay is idempotent'
);

reset role;

select is(
  (
    select status::text from public.owner_settlements
    where request_id = '10000000-0000-0000-0000-000000000001'::uuid
  ),
  'PAID',
  'paid settlement reaches PAID status'
);
select is(
  (
    select count(*)::integer
    from public.journal_entries
    where entity_type = 'owner_settlement_payment'
      and entity_id = (
        select id from public.owner_settlements
        where request_id = '10000000-0000-0000-0000-000000000001'::uuid
      )
  ),
  2,
  'settlement payment posts one debit and one credit'
);
select is(
  (
    select coalesce(sum(amount) filter (where upper(type) = 'DEBIT'), 0)::numeric
    from public.journal_entries
    where entity_type = 'owner_settlement_payment'
      and entity_id = (
        select id from public.owner_settlements
        where request_id = '10000000-0000-0000-0000-000000000001'::uuid
      )
  ),
  625::numeric,
  'settlement payment debits owner payable for the server-derived net amount'
);
select is(
  (
    select coalesce(sum(amount) filter (where upper(type) = 'CREDIT'), 0)::numeric
    from public.journal_entries
    where entity_type = 'owner_settlement_payment'
      and entity_id = (
        select id from public.owner_settlements
        where request_id = '10000000-0000-0000-0000-000000000001'::uuid
      )
  ),
  625::numeric,
  'settlement payment credits cash for the server-derived net amount'
);
select is(
  (
    select count(distinct batch_id)::integer
    from public.journal_entries
    where entity_type = 'owner_settlement_payment'
      and entity_id = (
        select id from public.owner_settlements
        where request_id = '10000000-0000-0000-0000-000000000001'::uuid
      )
  ),
  1,
  'settlement payment journal entries share one batch'
);
select is(
  (
    select count(*)::integer
    from public.audit_log
    where entity = 'owner_settlements'
      and entity_id = (
        select id from public.owner_settlements
        where request_id = '10000000-0000-0000-0000-000000000001'::uuid
      )
      and action in ('CREATE', 'APPROVE', 'PAY')
  ),
  3,
  'settlement lifecycle records create, approve, and pay audit evidence'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001101","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-000000000001"}}',
  true
);
set local role authenticated;

select throws_ok(
  $$
    select public.pay_owner_settlement_atomic(jsonb_build_object(
      'settlement_id', (
        select id from public.owner_settlements
        where request_id = '10000000-0000-0000-0000-000000000001'::uuid
      ),
      'method', 'bank_transfer',
      'payment_reference', 'RL-SETTLEMENT-DUPLICATE',
      'request_id', '10000000-0000-0000-0000-000000000005'
    ))
  $$,
  null,
  null,
  'a paid settlement cannot be paid a second time'
);
select throws_ok(
  $$
    select public.cancel_owner_settlement_atomic(jsonb_build_object(
      'settlement_id', (
        select id from public.owner_settlements
        where request_id = '10000000-0000-0000-0000-000000000001'::uuid
      ),
      'reason', 'paid settlement must require controlled reversal',
      'request_id', '10000000-0000-0000-0000-000000000006'
    ))
  $$,
  null,
  null,
  'a paid settlement cannot be cancelled directly'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.financial_operation_idempotency
    where operation_name in (
      'create_owner_settlement_draft_atomic',
      'approve_owner_settlement_atomic',
      'pay_owner_settlement_atomic'
    )
      and request_id in (
        '10000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000004'
      )
  ),
  3,
  'settlement lifecycle stores one idempotency record per successful operation'
);

select * from finish();
rollback;

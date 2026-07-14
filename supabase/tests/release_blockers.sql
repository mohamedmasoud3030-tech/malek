begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

select has_table('public', 'contracts', 'contracts table exists after a clean migration replay');
select has_table('public', 'invoices', 'invoices table exists after a clean migration replay');
select has_table('public', 'payments', 'payments table exists after a clean migration replay');
select has_table('public', 'receipts', 'receipts table exists after a clean migration replay');

select ok(
  to_regprocedure('public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text)') is not null,
  'create_contract_atomic is present with the browser contract signature'
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
      ('receipt_allocations'), ('financial_operation_idempotency'), ('journal_entries')
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

insert into public.owners (id, full_name)
values ('00000000-0000-0000-0000-000000000201', 'Release Owner');

insert into public.properties (id, title, type, address, status)
values ('00000000-0000-0000-0000-000000000301', 'Release Property', 'residential', 'Release Gate', 'active');

insert into public.units (id, property_id, unit_number, status, rent_amount)
values ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000301', 'RG-1', 'available', 100);

insert into public.people (id, full_name, type)
values ('00000000-0000-0000-0000-000000000501', 'Release Tenant', 'tenant');

insert into public.owner_agreements (
  id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on
) values (
  '00000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000301',
  'property_management', 'RATE', 5, date '2026-01-01', date '2027-12-31'
);

set local role anon;
select throws_ok(
  $$ select count(*) from public.contracts $$,
  'anonymous users cannot read operational contracts'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated","app_metadata":{"user_role":"USER"}}',
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
      'active', null, 'release-blocker-user-denied', null
    )
  $$,
  'USER cannot create contracts through the privileged RPC'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated","app_metadata":{"user_role":"ADMIN"}}',
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
      'active', null, 'release-blocker-contract', null
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
      'active', null, 'release-blocker-overlap', null
    )
  $$,
  'overlapping contracts on the same unit are rejected'
);

insert into public.invoices (id, contract_id, issue_date, due_date, amount, paid_amount, tax_amount, status)
select
  '00000000-0000-0000-0000-000000000701', id, date '2026-08-01', date '2026-08-05', 100, 0, 0, 'UNPAID'
from public.contracts
where notes = 'release-blocker-contract';

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
  'overpayment is rejected atomically'
);
select is(
  (select count(*)::integer from public.payments where invoice_id = '00000000-0000-0000-0000-000000000701'),
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
  'negative payments are rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated","app_metadata":{"user_role":"USER"}}',
  true
);
select throws_ok(
  $$ select count(*) from public.financial_operation_idempotency $$,
  'browser users cannot read idempotency records directly'
);
reset role;

select * from finish();
rollback;

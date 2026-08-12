-- S02-T05 / D-002 behavioral pgTAP proof.
-- Runs on the isolated fresh PostgreSQL/Supabase replay. It proves that changing
-- a reserved payment after draft creation cannot approve or pay the settlement
-- using the stale stored monetary tuple, and that the rejected PAY attempt leaves
-- no journal side effect.

begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into public.companies (id, name, slug)
values ('c3100000-0000-4000-8000-000000000001', 'S02 D002 Company', 's02-d002-company');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  'a3100000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 's02-d002@test.invalid', 'not-used',
  now(), now(), now(), '{}'::jsonb, '{}'::jsonb
);

insert into public.users (id, email, name, role, status, is_active)
values (
  'a3100000-0000-4000-8000-000000000001',
  's02-d002@test.invalid', 'S02 D002 Admin', 'ADMIN', 'ACTIVE', true
), (
  'a3100000-0000-4000-8000-000000000009',
  's02-d002-checker@test.invalid', 'S02 D002 Checker', 'ADMIN', 'ACTIVE', true
);

insert into public.company_members (company_id, user_id, role)
values (
  'c3100000-0000-4000-8000-000000000001',
  'a3100000-0000-4000-8000-000000000001',
  'ADMIN'
), (
  'c3100000-0000-4000-8000-000000000001',
  'a3100000-0000-4000-8000-000000000009',
  'ADMIN'
);

insert into public.owners (id, full_name, name, company_id)
values (
  'b3100000-0000-4000-8000-000000000001',
  'مالك اختبار D-002', 'مالك اختبار D-002',
  'c3100000-0000-4000-8000-000000000001'
);

insert into public.properties (id, title, name, type, address, company_id)
values (
  'd3100000-0000-4000-8000-000000000001',
  'عقار D-002', 'عقار D-002', 'سكني', 'مسقط',
  'c3100000-0000-4000-8000-000000000001'
);

insert into public.property_owners (
  property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on, company_id
) values (
  'd3100000-0000-4000-8000-000000000001',
  'b3100000-0000-4000-8000-000000000001',
  100, true, date '2026-01-01', date '2027-12-31',
  'c3100000-0000-4000-8000-000000000001'
);

insert into public.owner_agreements (
  id, owner_id, property_id, agreement_type, commission_type,
  commission_value, starts_on, ends_on, company_id
) values (
  'aa310000-0000-4000-8000-000000000001',
  'b3100000-0000-4000-8000-000000000001',
  'd3100000-0000-4000-8000-000000000001',
  'property_management', 'RATE', 10,
  date '2026-01-01', date '2027-12-31',
  'c3100000-0000-4000-8000-000000000001'
);

insert into public.units (id, property_id, unit_number, company_id)
values (
  'e3100000-0000-4000-8000-000000000001',
  'd3100000-0000-4000-8000-000000000001',
  'U-D002', 'c3100000-0000-4000-8000-000000000001'
);

insert into public.people (id, full_name, type, company_id)
values (
  'f3100000-0000-4000-8000-000000000001',
  'مستأجر D-002', 'tenant',
  'c3100000-0000-4000-8000-000000000001'
);

insert into public.contracts (
  id, property_id, unit_id, tenant_id, start_date, end_date,
  rent_amount, status, agreement_id, company_id
) values (
  'cc310000-0000-4000-8000-000000000001',
  'd3100000-0000-4000-8000-000000000001',
  'e3100000-0000-4000-8000-000000000001',
  'f3100000-0000-4000-8000-000000000001',
  '2026-01-01', '2026-12-31', 12000, 'active',
  'aa310000-0000-4000-8000-000000000001',
  'c3100000-0000-4000-8000-000000000001'
);

insert into public.invoices (
  id, contract_id, issue_date, due_date, amount, paid_amount, tax_amount, status, company_id
) values (
  'dd310000-0000-4000-8000-000000000001',
  'cc310000-0000-4000-8000-000000000001',
  '2026-07-01', '2026-07-05', 1000, 1000, 0, 'PAID',
  'c3100000-0000-4000-8000-000000000001'
);

insert into public.receipts (id, amount, status, company_id)
values (
  'ab310000-0000-4000-8000-000000000001', 1000, 'POSTED',
  'c3100000-0000-4000-8000-000000000001'
);

insert into public.payments (
  id, invoice_id, contract_id, amount, payment_method, payment_date,
  status, receipt_id, company_id
) values (
  'ab310000-0000-4000-8000-000000000001',
  'dd310000-0000-4000-8000-000000000001',
  'cc310000-0000-4000-8000-000000000001',
  1000, 'cash', date '2026-07-05', 'POSTED',
  'ab310000-0000-4000-8000-000000000001',
  'c3100000-0000-4000-8000-000000000001'
);

update public.receipts
set payment_id = id
where id = 'ab310000-0000-4000-8000-000000000001';

-- Act through the real authenticated role and JWT company context.
select set_config(
  'request.jwt.claims',
  '{"sub":"a3100000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"c3100000-0000-4000-8000-000000000001"}}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.create_owner_settlement_draft_atomic('{"request_id":"41000000-0000-4000-8000-000000000001","owner_id":"b3100000-0000-4000-8000-000000000001","property_id":"d3100000-0000-4000-8000-000000000001","period_start":"2026-07-01","period_end":"2026-07-31"}'::jsonb)$$,
  'server-derived D-002 draft creates successfully'
);

select is(
  (
    select net_payable::numeric
    from public.owner_settlements
    where request_id = '41000000-0000-4000-8000-000000000001'::uuid
  ),
  900.000::numeric,
  'draft stores the canonical 1000 less 10 percent net payout'
);

-- payments.amount is numeric(14,2) in the current replayed schema. Use the
-- smallest positive delta that can actually persist today (0.010). The guard's
-- tolerance remains 0.001 so it is already compatible with a future 3dp column.
reset role;
update public.payments
set amount = 1000.01
where id = 'ab310000-0000-4000-8000-000000000001';

select is(
  (select amount::numeric from public.payments where id = 'ab310000-0000-4000-8000-000000000001'),
  1000.01::numeric,
  'precondition: stale payment mutation persisted and was not rounded away'
);

set local role authenticated;

select throws_ok(
  $$select public.approve_owner_settlement_atomic(jsonb_build_object(
      'settlement_id', (select id from public.owner_settlements where request_id = '41000000-0000-4000-8000-000000000001'::uuid),
      'request_id', '41000000-0000-4000-8000-000000000002'
    ))$$,
  '22023',
  'OWNER_SETTLEMENT_STALE_TOTALS: source amounts changed after draft creation; cancel and recreate the settlement.',
  'smallest currently representable payment tamper blocks approval deterministically'
);

select is(
  (select status from public.owner_settlements where request_id = '41000000-0000-4000-8000-000000000001'::uuid),
  'DRAFT',
  'failed stale approval leaves the settlement DRAFT'
);

-- Restore the source, approve legitimately, then tamper again before PAY.
reset role;
update public.payments
set amount = 1000.00
where id = 'ab310000-0000-4000-8000-000000000001';
-- Approval is performed by a separate ADMIN; the draft maker must not self-approve.
select set_config('request.jwt.claims', '{"sub":"a3100000-0000-4000-8000-000000000009","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"c3100000-0000-4000-8000-000000000001"}}', true);
set local role authenticated;

select lives_ok(
  $$select public.approve_owner_settlement_atomic(jsonb_build_object(
      'settlement_id', (select id from public.owner_settlements where request_id = '41000000-0000-4000-8000-000000000001'::uuid),
      'request_id', '41000000-0000-4000-8000-000000000002'
    ))$$,
  'approval succeeds when live sources still match the stored tuple'
);

reset role;
update public.payments
set amount = 1100.00
where id = 'ab310000-0000-4000-8000-000000000001';
set local role authenticated;

select throws_ok(
  $$select public.pay_owner_settlement_atomic(jsonb_build_object(
      'settlement_id', (select id from public.owner_settlements where request_id = '41000000-0000-4000-8000-000000000001'::uuid),
      'request_id', '41000000-0000-4000-8000-000000000003',
      'method', 'bank_transfer',
      'payment_reference', 'D002-TAMPER'
    ))$$,
  '22023',
  'OWNER_SETTLEMENT_STALE_TOTALS: source amounts changed after draft creation; cancel and recreate the settlement.',
  'post-approval payment tamper blocks PAY deterministically'
);

select is(
  (select status from public.owner_settlements where request_id = '41000000-0000-4000-8000-000000000001'::uuid),
  'APPROVED',
  'failed stale PAY leaves the settlement APPROVED'
);

reset role;
select is(
  (
    select count(*)::integer
    from public.journal_entries
    where entity_type = 'owner_settlement_payment'
      and entity_id = (
        select id from public.owner_settlements
        where request_id = '41000000-0000-4000-8000-000000000001'::uuid
      )
  ),
  0,
  'failed stale PAY leaves zero owner-settlement journal rows'
);

select * from finish();
rollback;
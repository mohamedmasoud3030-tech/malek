-- Cross-layer value-contract checks for user-facing writes.
-- These assertions keep UI option values, service payloads, constraints, and
-- trigger/RPC helpers on the same canonical vocabulary.
begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select ok(
  (
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'maintenance_records'
      and c.conname = 'maintenance_records_priority_check'
  ) like all (array['%''low''%', '%''medium''%', '%''high''%', '%''urgent''%']),
  'maintenance priorities accept every value submitted by the request form'
);

select ok(
  (
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'maintenance_records'
      and c.conname = 'maintenance_records_status_check'
  ) like all (array['%''open''%', '%''in_progress''%', '%''resolved''%', '%''closed''%']),
  'maintenance statuses accept every value used by the lifecycle UI and RPC'
);

select ok(
  (
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'commissions'
      and c.conname = 'check_commission_status'
  ) like all (array['%''pending''%', '%''approved''%', '%''paid''%', '%''cancelled''%']),
  'commission statuses accept every value submitted by the commissions workspace'
);

select ok(
  pg_get_functiondef('public.update_unit_status()'::regprocedure) like '%v_target_status := ''occupied''%'
  and pg_get_functiondef('public.update_unit_status()'::regprocedure) like '%v_target_status := ''maintenance''%'
  and pg_get_functiondef('public.update_unit_status()'::regprocedure) like '%v_target_status := ''available''%'
  and pg_get_functiondef('public.update_unit_status()'::regprocedure) not like '%''OCCUPIED''%'
  and pg_get_functiondef('public.update_unit_status()'::regprocedure) not like '%''MAINTENANCE''%'
  and pg_get_functiondef('public.update_unit_status()'::regprocedure) not like '%''AVAILABLE''%'
  and pg_get_functiondef('public.update_unit_status()'::regprocedure) not like '%''ACTIVE''%',
  'unit-status trigger writes only canonical lowercase unit states'
);

select ok(
  pg_get_functiondef('public.check_unit_maintenance_block(uuid)'::regprocedure) like '%(''open'', ''in_progress'')%'
  and pg_get_functiondef('public.check_unit_maintenance_block(uuid)'::regprocedure) like '%deleted_at is null%'
  and pg_get_functiondef('public.check_unit_maintenance_block(uuid)'::regprocedure) not like '%''NEW''%',
  'unit maintenance blocker recognizes current request states and ignores soft-deleted rows'
);

create temporary table expected_value_contracts (
  table_name text not null,
  column_name text not null,
  expected_value text not null
) on commit drop;

insert into expected_value_contracts (table_name, column_name, expected_value)
values
  ('automation_rules', 'rule_type', 'contract_expiry'),
  ('automation_rules', 'rule_type', 'overdue_invoice'),
  ('automation_rules', 'rule_type', 'maintenance_overdue'),
  ('automation_rules', 'rule_type', 'payment_reminder'),
  ('automation_rules', 'rule_type', 'large_payment_alert'),
  ('automation_rules', 'rule_type', 'unit_status'),
  ('automation_rules', 'rule_type', 'custom'),
  ('bank_reconciliation_matches', 'matched_entity_type', 'payment'),
  ('bank_reconciliation_matches', 'matched_entity_type', 'receipt'),
  ('bank_reconciliation_matches', 'matched_entity_type', 'expense'),
  ('bank_reconciliation_matches', 'matched_entity_type', 'manual_adjustment'),
  ('bank_statement_lines', 'status', 'unmatched'),
  ('bank_statement_lines', 'status', 'matched'),
  ('bank_statement_lines', 'status', 'ignored'),
  ('communication_records', 'channel', 'phone'),
  ('communication_records', 'channel', 'whatsapp'),
  ('communication_records', 'channel', 'email'),
  ('communication_records', 'channel', 'meeting'),
  ('communication_records', 'channel', 'note'),
  ('communication_records', 'direction', 'inbound'),
  ('communication_records', 'direction', 'outbound'),
  ('communication_records', 'direction', 'internal'),
  ('communication_records', 'status', 'logged'),
  ('communication_records', 'status', 'follow_up'),
  ('communication_records', 'status', 'resolved'),
  ('communication_records', 'status', 'archived'),
  ('deposit_transactions', 'type', 'held'),
  ('deposit_transactions', 'type', 'deduction'),
  ('deposit_transactions', 'type', 'refund'),
  ('deposit_transactions', 'payment_method', 'cash'),
  ('deposit_transactions', 'payment_method', 'bank_transfer'),
  ('deposit_transactions', 'payment_method', 'check'),
  ('owner_agreements', 'agreement_type', 'property_management'),
  ('owner_agreements', 'agreement_type', 'master_lease'),
  ('owner_agreements', 'commission_type', 'FIXED_MONTHLY'),
  ('owner_agreements', 'commission_type', 'RATE'),
  ('owner_settlements', 'status', 'DRAFT'),
  ('owner_settlements', 'status', 'APPROVED'),
  ('owner_settlements', 'status', 'PAID'),
  ('owner_settlements', 'status', 'CANCELLED'),
  ('payment_terms_templates', 'interval_type', 'monthly'),
  ('payment_terms_templates', 'interval_type', 'quarterly'),
  ('payment_terms_templates', 'interval_type', 'biannual'),
  ('payment_terms_templates', 'interval_type', 'annual'),
  ('payment_terms_templates', 'interval_type', 'custom'),
  ('people', 'type', 'tenant'),
  ('people', 'type', 'owner'),
  ('people', 'type', 'contact'),
  ('tenant_deposits', 'status', 'held'),
  ('tenant_deposits', 'status', 'partially_refunded'),
  ('tenant_deposits', 'status', 'refunded'),
  ('tenant_deposits', 'status', 'forfeited_damage'),
  ('tenant_deposits', 'status', 'forfeited_arrears'),
  ('tenant_deposits', 'status', 'partially_deducted'),
  ('units', 'status', 'available'),
  ('units', 'status', 'occupied'),
  ('units', 'status', 'maintenance'),
  ('units', 'status', 'reserved'),
  ('utility_meters', 'responsible_party', 'tenant'),
  ('utility_meters', 'responsible_party', 'landlord'),
  ('utility_meters', 'responsible_party', 'company'),
  ('utility_meters', 'utility_type', 'electricity'),
  ('utility_meters', 'utility_type', 'water'),
  ('utility_meters', 'utility_type', 'sanitation'),
  ('utility_meters', 'utility_type', 'internet'),
  ('utility_meters', 'utility_type', 'gas'),
  ('utility_meters', 'utility_type', 'other'),
  ('vault_documents', 'category', 'all'),
  ('vault_documents', 'category', 'contracts'),
  ('vault_documents', 'category', 'identity'),
  ('vault_documents', 'category', 'receipts'),
  ('vault_documents', 'category', 'maintenance'),
  ('vault_documents', 'category', 'expenses'),
  ('vault_documents', 'category', 'utilities'),
  ('vault_documents', 'category', 'other');

create temporary view missing_value_contracts as
select expected.table_name, expected.column_name, expected.expected_value
from expected_value_contracts expected
where not exists (
  select 1
  from pg_constraint constraint_record
  join pg_class relation_record
    on relation_record.oid = constraint_record.conrelid
  join pg_namespace namespace_record
    on namespace_record.oid = relation_record.relnamespace
  join pg_attribute attribute_record
    on attribute_record.attrelid = relation_record.oid
   and attribute_record.attname = expected.column_name
   and attribute_record.attnum = any(constraint_record.conkey)
  where namespace_record.nspname = 'public'
    and relation_record.relname = expected.table_name
    and constraint_record.contype = 'c'
    and position(
      quote_literal(expected.expected_value)
      in pg_get_constraintdef(constraint_record.oid)
    ) > 0
);

select diag(
  'Missing constrained value contract: '
  || table_name || '.' || column_name || '=' || quote_literal(expected_value)
)
from missing_value_contracts;

select ok(
  not exists (select 1 from missing_value_contracts),
  'all audited user-facing constrained values remain accepted by the replayed schema contract'
);

select * from finish();
rollback;

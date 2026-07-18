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
  pg_get_functiondef('public.update_unit_status()'::regprocedure) like '%status = ''occupied''%'
  and pg_get_functiondef('public.update_unit_status()'::regprocedure) like '%status = ''maintenance''%'
  and pg_get_functiondef('public.update_unit_status()'::regprocedure) like '%status = ''available''%'
  and pg_get_functiondef('public.update_unit_status()'::regprocedure) not like '%''OCCUPIED''%'
  and pg_get_functiondef('public.update_unit_status()'::regprocedure) not like '%''MAINTENANCE''%'
  and pg_get_functiondef('public.update_unit_status()'::regprocedure) not like '%''AVAILABLE''%',
  'unit-status trigger writes only canonical lowercase unit states'
);

select ok(
  pg_get_functiondef('public.check_unit_maintenance_block(uuid)'::regprocedure) like '%(''open'', ''in_progress'')%'
  and pg_get_functiondef('public.check_unit_maintenance_block(uuid)'::regprocedure) like '%deleted_at is null%'
  and pg_get_functiondef('public.check_unit_maintenance_block(uuid)'::regprocedure) not like '%''NEW''%',
  'unit maintenance blocker recognizes current request states and ignores soft-deleted rows'
);

with expected_values(table_name, constraint_name, expected_value) as (
  values
    ('automation_rules', 'automation_rules_rule_type_check', 'contract_expiry'),
    ('automation_rules', 'automation_rules_rule_type_check', 'overdue_invoice'),
    ('automation_rules', 'automation_rules_rule_type_check', 'maintenance_overdue'),
    ('automation_rules', 'automation_rules_rule_type_check', 'payment_reminder'),
    ('automation_rules', 'automation_rules_rule_type_check', 'large_payment_alert'),
    ('automation_rules', 'automation_rules_rule_type_check', 'unit_status'),
    ('automation_rules', 'automation_rules_rule_type_check', 'custom'),
    ('bank_reconciliation_matches', 'bank_reconciliation_matches_type_chk', 'payment'),
    ('bank_reconciliation_matches', 'bank_reconciliation_matches_type_chk', 'receipt'),
    ('bank_reconciliation_matches', 'bank_reconciliation_matches_type_chk', 'expense'),
    ('bank_reconciliation_matches', 'bank_reconciliation_matches_type_chk', 'manual_adjustment'),
    ('bank_statement_lines', 'bank_statement_lines_status_chk', 'unmatched'),
    ('bank_statement_lines', 'bank_statement_lines_status_chk', 'matched'),
    ('bank_statement_lines', 'bank_statement_lines_status_chk', 'ignored'),
    ('communication_records', 'communication_records_channel_chk', 'phone'),
    ('communication_records', 'communication_records_channel_chk', 'whatsapp'),
    ('communication_records', 'communication_records_channel_chk', 'email'),
    ('communication_records', 'communication_records_channel_chk', 'meeting'),
    ('communication_records', 'communication_records_channel_chk', 'note'),
    ('communication_records', 'communication_records_direction_chk', 'inbound'),
    ('communication_records', 'communication_records_direction_chk', 'outbound'),
    ('communication_records', 'communication_records_direction_chk', 'internal'),
    ('communication_records', 'communication_records_status_chk', 'logged'),
    ('communication_records', 'communication_records_status_chk', 'follow_up'),
    ('communication_records', 'communication_records_status_chk', 'resolved'),
    ('communication_records', 'communication_records_status_chk', 'archived'),
    ('deposit_transactions', 'deposit_transactions_type_check', 'held'),
    ('deposit_transactions', 'deposit_transactions_type_check', 'deduction'),
    ('deposit_transactions', 'deposit_transactions_type_check', 'refund'),
    ('deposit_transactions', 'deposit_transactions_payment_method_check', 'cash'),
    ('deposit_transactions', 'deposit_transactions_payment_method_check', 'bank_transfer'),
    ('deposit_transactions', 'deposit_transactions_payment_method_check', 'check'),
    ('owner_agreements', 'owner_agreements_agreement_type_check', 'property_management'),
    ('owner_agreements', 'owner_agreements_agreement_type_check', 'master_lease'),
    ('owner_agreements', 'owner_agreements_commission_type_check', 'FIXED_MONTHLY'),
    ('owner_agreements', 'owner_agreements_commission_type_check', 'RATE'),
    ('owner_settlements', 'owner_settlements_status_check', 'DRAFT'),
    ('owner_settlements', 'owner_settlements_status_check', 'APPROVED'),
    ('owner_settlements', 'owner_settlements_status_check', 'PAID'),
    ('owner_settlements', 'owner_settlements_status_check', 'CANCELLED'),
    ('payment_terms_templates', 'payment_terms_templates_interval_type_check', 'monthly'),
    ('payment_terms_templates', 'payment_terms_templates_interval_type_check', 'quarterly'),
    ('payment_terms_templates', 'payment_terms_templates_interval_type_check', 'biannual'),
    ('payment_terms_templates', 'payment_terms_templates_interval_type_check', 'annual'),
    ('payment_terms_templates', 'payment_terms_templates_interval_type_check', 'custom'),
    ('people', 'people_type_check', 'tenant'),
    ('people', 'people_type_check', 'owner'),
    ('people', 'people_type_check', 'contact'),
    ('tenant_deposits', 'tenant_deposits_status_check', 'held'),
    ('tenant_deposits', 'tenant_deposits_status_check', 'partially_refunded'),
    ('tenant_deposits', 'tenant_deposits_status_check', 'refunded'),
    ('tenant_deposits', 'tenant_deposits_status_check', 'forfeited_damage'),
    ('tenant_deposits', 'tenant_deposits_status_check', 'forfeited_arrears'),
    ('tenant_deposits', 'tenant_deposits_status_check', 'partially_deducted'),
    ('units', 'units_status_canonical_check', 'available'),
    ('units', 'units_status_canonical_check', 'occupied'),
    ('units', 'units_status_canonical_check', 'maintenance'),
    ('units', 'units_status_canonical_check', 'reserved'),
    ('utility_meters', 'utility_meters_responsible_party_check', 'tenant'),
    ('utility_meters', 'utility_meters_responsible_party_check', 'landlord'),
    ('utility_meters', 'utility_meters_responsible_party_check', 'company'),
    ('utility_meters', 'utility_meters_utility_type_check', 'electricity'),
    ('utility_meters', 'utility_meters_utility_type_check', 'water'),
    ('utility_meters', 'utility_meters_utility_type_check', 'sanitation'),
    ('utility_meters', 'utility_meters_utility_type_check', 'internet'),
    ('utility_meters', 'utility_meters_utility_type_check', 'gas'),
    ('utility_meters', 'utility_meters_utility_type_check', 'other'),
    ('vault_documents', 'vault_documents_category_check', 'all'),
    ('vault_documents', 'vault_documents_category_check', 'contracts'),
    ('vault_documents', 'vault_documents_category_check', 'identity'),
    ('vault_documents', 'vault_documents_category_check', 'receipts'),
    ('vault_documents', 'vault_documents_category_check', 'maintenance'),
    ('vault_documents', 'vault_documents_category_check', 'expenses'),
    ('vault_documents', 'vault_documents_category_check', 'utilities'),
    ('vault_documents', 'vault_documents_category_check', 'other')
), constraint_definitions as (
  select
    t.relname as table_name,
    c.conname as constraint_name,
    pg_get_constraintdef(c.oid) as definition
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and c.contype = 'c'
)
select ok(
  not exists (
    select 1
    from expected_values expected
    left join constraint_definitions actual
      on actual.table_name = expected.table_name
     and actual.constraint_name = expected.constraint_name
    where actual.definition is null
       or position(quote_literal(expected.expected_value) in actual.definition) = 0
  ),
  'all audited user-facing constrained values remain accepted by the live schema contract'
);

select * from finish();
rollback;

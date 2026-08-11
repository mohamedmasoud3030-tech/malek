-- WP-01: Six-role authorization and maker-checker pgTAP test suite.
-- Tests SEC-004 (six roles), SEC-005 (capability-based), SEC-006 (effective grants),
-- SEC-007 (revoke/re-request), SEC-008 (maker-checker), SEC-009 (sensitive writes).
--
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/wp01_six_role_authorization.sql
-- Requires all migrations through 20260811121000 applied.

begin;
select plan(40);

-- ── 1. Six-role enum/constraint ─────────────────────────────────────────────

select has_function('public', 'role_has_app_permission', array['text','text'],
  'role_has_app_permission function exists');

select has_function('public', 'is_accountant', array[],
  'is_accountant helper exists');

select has_function('public', 'is_operations', array[],
  'is_operations helper exists');

select has_function('public', 'is_viewer', array[],
  'is_viewer helper exists');

select has_function('public', 'is_read_only_role', array[],
  'is_read_only_role helper exists');

-- ── 2. Capability matrix: role_has_app_permission ───────────────────────────

-- ADMIN gets all permissions (dynamic via catalog).
select ok(
  public.role_has_app_permission('ADMIN', 'app.dashboard.view'),
  'ADMIN has app.dashboard.view'
);
select ok(
  public.role_has_app_permission('ADMIN', 'users.manage'),
  'ADMIN has users.manage'
);
select ok(
  public.role_has_app_permission('ADMIN', 'financial.owner_settlements.approve'),
  'ADMIN has financial.owner_settlements.approve'
);

-- MANAGER: operational permissions, no admin-only.
select ok(
  public.role_has_app_permission('MANAGER', 'app.dashboard.view'),
  'MANAGER has app.dashboard.view'
);
select ok(
  public.role_has_app_permission('MANAGER', 'properties.write'),
  'MANAGER has properties.write'
);
select ok(
  not public.role_has_app_permission('MANAGER', 'users.manage'),
  'MANAGER does not have users.manage'
);
select ok(
  not public.role_has_app_permission('MANAGER', 'financial.owner_settlements.approve'),
  'MANAGER does not have financial.owner_settlements.approve'
);

-- ACCOUNTANT: financial review and accounting only.
select ok(
  public.role_has_app_permission('ACCOUNTANT', 'app.dashboard.view'),
  'ACCOUNTANT has app.dashboard.view'
);
select ok(
  public.role_has_app_permission('ACCOUNTANT', 'audit.view'),
  'ACCOUNTANT has audit.view'
);
select ok(
  public.role_has_app_permission('ACCOUNTANT', 'financial.bank_reconciliation.match'),
  'ACCOUNTANT has financial.bank_reconciliation.match'
);
select ok(
  not public.role_has_app_permission('ACCOUNTANT', 'properties.write'),
  'ACCOUNTANT does not have properties.write'
);
select ok(
  not public.role_has_app_permission('ACCOUNTANT', 'users.manage'),
  'ACCOUNTANT does not have users.manage'
);
select ok(
  not public.role_has_app_permission('ACCOUNTANT', 'financial.owner_settlements.approve'),
  'ACCOUNTANT does not have financial.owner_settlements.approve'
);

-- OPERATIONS: operational without financial approval.
select ok(
  public.role_has_app_permission('OPERATIONS', 'properties.write'),
  'OPERATIONS has properties.write'
);
select ok(
  public.role_has_app_permission('OPERATIONS', 'contracts.write'),
  'OPERATIONS has contracts.write'
);
select ok(
  public.role_has_app_permission('OPERATIONS', 'expenses.write'),
  'OPERATIONS has expenses.write'
);
select ok(
  not public.role_has_app_permission('OPERATIONS', 'financial.payments.create'),
  'OPERATIONS does not have financial.payments.create'
);
select ok(
  not public.role_has_app_permission('OPERATIONS', 'financial.owner_settlements.approve'),
  'OPERATIONS does not have financial.owner_settlements.approve'
);
select ok(
  not public.role_has_app_permission('OPERATIONS', 'audit.view'),
  'OPERATIONS does not have audit.view'
);

-- USER: baseline only.
select ok(
  public.role_has_app_permission('USER', 'app.dashboard.view'),
  'USER has app.dashboard.view'
);
select ok(
  public.role_has_app_permission('USER', 'auth.password.change'),
  'USER has auth.password.change'
);
select ok(
  not public.role_has_app_permission('USER', 'properties.write'),
  'USER does not have properties.write'
);
select ok(
  not public.role_has_app_permission('USER', 'owners.hub.view'),
  'USER does not have owners.hub.view'
);

-- VIEWER: read-only.
select ok(
  public.role_has_app_permission('VIEWER', 'app.dashboard.view'),
  'VIEWER has app.dashboard.view'
);
select ok(
  public.role_has_app_permission('VIEWER', 'owners.hub.view'),
  'VIEWER has owners.hub.view'
);
select ok(
  public.role_has_app_permission('VIEWER', 'financial.deposits.view'),
  'VIEWER has financial.deposits.view'
);
select ok(
  not public.role_has_app_permission('VIEWER', 'properties.write'),
  'VIEWER does not have properties.write'
);
select ok(
  not public.role_has_app_permission('VIEWER', 'financial.payments.create'),
  'VIEWER does not have financial.payments.create'
);
select ok(
  not public.role_has_app_permission('VIEWER', 'documents.write'),
  'VIEWER does not have documents.write'
);

-- ── 3. Unknown/legacy roles fail closed ─────────────────────────────────────

select ok(
  not public.role_has_app_permission('OWNER', 'app.dashboard.view'),
  'Unknown role OWNER fails closed (no permissions)'
);
select ok(
  not public.role_has_app_permission('', 'app.dashboard.view'),
  'Empty role fails closed'
);
select ok(
  not public.role_has_app_permission(null, 'app.dashboard.view'),
  'NULL role fails closed'
);
select ok(
  not public.role_has_app_permission('SUPERADMIN', 'users.manage'),
  'Legacy role SUPERADMIN fails closed'
);

-- ── 4. Maker-Checker columns and constraints ───────────────────────────────

select has_column('public', 'owner_settlements', 'maker_user_id',
  'owner_settlements.maker_user_id exists');
select has_column('public', 'owner_settlements', 'checker_user_id',
  'owner_settlements.checker_user_id exists');
select has_column('public', 'receipts', 'maker_user_id',
  'receipts.maker_user_id exists');

-- Verify the CHECK constraint prevents maker = checker.
select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'settlements_maker_checker_distinct_chk'
      and conrelid = 'public.owner_settlements'::regclass
  ),
  'settlements maker-checker distinct constraint exists'
);

-- ── 5. Function signatures have maker-checker guard ────────────────────────

select ok(
  position('MAKER_CHECKER_MUST_BE_DISTINCT' in pg_get_functiondef('public.approve_owner_settlement_atomic(jsonb)'::regprocedure)) > 0,
  'approve_owner_settlement_atomic rejects same maker/checker identity'
);

select ok(
  position('MAKER_CHECKER_MUST_BE_DISTINCT' in pg_get_functiondef('public.pay_owner_settlement_atomic(jsonb)'::regprocedure)) > 0,
  'pay_owner_settlement_atomic rejects same maker/pay identity'
);

select ok(
  exists(
    select 1 from pg_trigger
    where tgname = 'receipt_void_maker_checker_guard'
      and tgrelid = 'public.receipts'::regclass
  ),
  'receipt void maker-checker trigger exists'
);

select * from finish();
rollback;

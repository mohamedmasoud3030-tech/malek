-- WP-01: Six-role authorization and maker-checker database contract suite.
-- Tests SEC-004/SEC-005 capability behavior plus SEC-008 database guard presence.
-- Full end-to-end maker/checker identity journeys remain required before GAP-002
-- can be closed, especially the receipt VOID request/approve lifecycle.
--
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/wp01_six_role_authorization.sql
-- Requires all migrations through 20260811121000 applied.

begin;
select plan(32);

-- ── Foundation functions ────────────────────────────────────────────────────
select isnt(
  (select count(*) from pg_proc where proname = 'role_has_app_permission'),
  0::bigint,
  'role_has_app_permission function exists'
);

select isnt(
  (select count(*) from pg_proc where proname = 'is_accountant'),
  0::bigint,
  'is_accountant helper exists'
);

select isnt(
  (select count(*) from pg_proc where proname = 'is_operations'),
  0::bigint,
  'is_operations helper exists'
);

select isnt(
  (select count(*) from pg_proc where proname = 'is_viewer'),
  0::bigint,
  'is_viewer helper exists'
);

-- ── 1. Six-role capability matrix ──────────────────────────────────────────
select ok(
  public.role_has_app_permission('ADMIN', 'users.manage'),
  'ADMIN: has users.manage'
);
select ok(
  public.role_has_app_permission('ADMIN', 'financial.owner_settlements.approve'),
  'ADMIN: has financial.owner_settlements.approve'
);

select ok(
  public.role_has_app_permission('MANAGER', 'properties.write'),
  'MANAGER: has properties.write'
);
select ok(
  not public.role_has_app_permission('MANAGER', 'users.manage'),
  'MANAGER: denied users.manage'
);
select ok(
  not public.role_has_app_permission('MANAGER', 'financial.owner_settlements.approve'),
  'MANAGER: denied financial.owner_settlements.approve'
);

select ok(
  public.role_has_app_permission('ACCOUNTANT', 'audit.view'),
  'ACCOUNTANT: has audit.view'
);
select ok(
  public.role_has_app_permission('ACCOUNTANT', 'financial.bank_reconciliation.match'),
  'ACCOUNTANT: has financial.bank_reconciliation.match'
);
select ok(
  not public.role_has_app_permission('ACCOUNTANT', 'properties.write'),
  'ACCOUNTANT: denied properties.write'
);
select ok(
  not public.role_has_app_permission('ACCOUNTANT', 'financial.owner_settlements.approve'),
  'ACCOUNTANT: denied financial.owner_settlements.approve'
);

select ok(
  public.role_has_app_permission('OPERATIONS', 'properties.write'),
  'OPERATIONS: has properties.write'
);
select ok(
  not public.role_has_app_permission('OPERATIONS', 'financial.payments.create'),
  'OPERATIONS: denied financial.payments.create'
);
select ok(
  not public.role_has_app_permission('OPERATIONS', 'audit.view'),
  'OPERATIONS: denied audit.view'
);

select ok(
  public.role_has_app_permission('USER', 'app.dashboard.view'),
  'USER: has app.dashboard.view'
);
select ok(
  not public.role_has_app_permission('USER', 'properties.write'),
  'USER: denied properties.write'
);

select ok(
  public.role_has_app_permission('VIEWER', 'owners.hub.view'),
  'VIEWER: has owners.hub.view'
);
select ok(
  not public.role_has_app_permission('VIEWER', 'properties.write'),
  'VIEWER: denied properties.write'
);
select ok(
  not public.role_has_app_permission('VIEWER', 'documents.write'),
  'VIEWER: denied documents.write'
);

-- ── 2. Unknown/legacy roles fail closed ─────────────────────────────────────
select ok(
  not public.role_has_app_permission('OWNER', 'app.dashboard.view'),
  'Unknown role OWNER fails closed'
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
  'Legacy SUPERADMIN fails closed'
);

-- ── 3. Settlement maker-checker authoritative DB boundary ──────────────────
select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'settlements_maker_checker_distinct_chk'
      and conrelid = 'public.owner_settlements'::regclass
  ),
  'settlements maker-checker distinct constraint exists'
);

select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'settlements_approved_identity_required_chk'
      and conrelid = 'public.owner_settlements'::regclass
  ),
  'approved/paid settlements require maker and checker identities on governed writes'
);

select has_column(
  'public',
  'owner_settlements',
  'maker_user_id',
  'owner_settlements.maker_user_id exists'
);

select has_column(
  'public',
  'owner_settlements',
  'checker_user_id',
  'owner_settlements.checker_user_id exists'
);

select has_trigger(
  'public',
  'owner_settlements',
  'owner_settlement_maker_checker_guard',
  'owner settlements have an authoritative maker-checker transition guard'
);

select has_column(
  'public',
  'receipts',
  'maker_user_id',
  'receipts.maker_user_id exists but VOID lifecycle remains open'
);

-- ── 4. CHECK constraint on users.role validates six roles ───────────────────
select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'users_role_valid_chk'
      and conrelid = 'public.users'::regclass
  ),
  'users role CHECK constraint exists for six canonical roles'
);

select * from finish();
rollback;

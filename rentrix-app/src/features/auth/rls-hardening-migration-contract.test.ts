import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('RLS hardening for secondary tables', () => {
  it('creates hardened RLS policies for lands, leads, commissions, communication_records', () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../supabase/migrations/20260717000005_harden_rls_secondary_tables.sql');
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    const tables = ['lands', 'leads', 'commissions', 'communication_records', 'utility_meters', 'utility_bills', 'vault_documents', 'tenant_deposits', 'deposit_transactions', 'automation_rules'];

    for (const table of tables) {
      // Our migration uses dynamic loop, so check that table name appears and RLS hardening logic exists
      expect(sql).toContain(table);
    }

    expect(sql).toContain('is_admin_or_manager()');
    expect(sql).toContain('is_app_user()');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('app_read_');
    expect(sql).toContain('manager_write_');
  });

  it('revokes delete for secondary tables', () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../supabase/migrations/20260717000005_harden_rls_secondary_tables.sql');
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('revoke delete');
    expect(sql).toContain('lands');
    expect(sql).toContain('leads');
    expect(sql).toContain('commissions');
    expect(sql).toContain('communication_records');
  });

  it('existing permissive app_user policies are dropped', () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../supabase/migrations/20260717000005_harden_rls_secondary_tables.sql');
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('drop policy if exists');
    expect(sql).toContain('app_user_lands');
    expect(sql).toContain('app_user_leads');
    expect(sql).toContain('app_user_commissions');
  });
});

describe('financial reports source of truth', () => {
  it('rpt_daily_collection uses payments as source and excludes VOID and deleted', () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../supabase/migrations/20260716000003_restore_payment_void_report_parity.sql');
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    // Extract rpt_daily_collection function definition part
    const rptStart = sql.indexOf('create function public.rpt_daily_collection');
    const rptEnd = sql.indexOf('create or replace function public.void_receipt_atomic', rptStart);
    const rptSection = rptEnd > 0 ? sql.slice(rptStart, rptEnd) : sql.slice(rptStart);

    expect(rptSection).toContain('from public.payments');
    expect(rptSection).toContain('deleted_at is null');
    expect(rptSection).toContain("upper(coalesce(p.status, 'posted')) <> 'void'");
    expect(rptSection).toContain('source');
    expect(rptSection).toContain("'payments'");

    // The rpt section itself should not use receipts as source, but void receipt part may
    expect(rptSection).not.toContain('from public.receipts');
  });

  it('void receipt atomic preserves journal integrity', () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../supabase/migrations/20260716000003_restore_payment_void_report_parity.sql');
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('void_receipt_atomic');
    expect(sql).toContain('journal_entries');
    // Allow either is_admin_or_manager or users role check for admin/manager
    const hasRoleCheck = sql.includes('is_admin_or_manager()') || sql.includes("role::text in ('admin', 'manager')") || sql.includes("role in ('admin', 'manager')");
    expect(hasRoleCheck).toBe(true);
    expect(sql).toContain('financial_operation_idempotency');
  });
});

describe('RLS app-user helper contract', () => {
  it('keeps public and compatibility helpers non-recursive', () => {
    const migrationPath = resolve(
      import.meta.dirname,
      '../../../../supabase/migrations/20260717000010_fix_is_app_user_rls_recursion.sql',
    );
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    const publicStart = sql.indexOf('create or replace function public.is_app_user()');
    const privateStart = sql.indexOf('create or replace function app_private.is_app_user()');

    expect(publicStart).toBeGreaterThanOrEqual(0);
    expect(privateStart).toBeGreaterThan(publicStart);

    const publicSection = sql.slice(publicStart, privateStart);
    const privateSection = sql.slice(privateStart);

    expect(publicSection).toContain('select auth.uid() is not null');
    expect(publicSection).not.toContain('app_private.is_app_user()');
    expect(privateSection).toContain('select public.is_app_user()');
    expect(privateSection).not.toContain('select app_private.is_app_user()');
    expect(sql).toContain('grant execute on function public.is_app_user() to authenticated, service_role');
  });
});


import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(__dirname, '../../../../supabase/migrations/20260706101000_align_payment_receipt_reporting_source.sql');
const migrationSql = readFileSync(migrationPath, 'utf8');

describe('report RPC migration contracts', () => {
  it('defines rpt_daily_collection on payments, matching the payment-backed Receipts UI source of truth', () => {
    expect(migrationSql).toMatch(/CREATE OR REPLACE FUNCTION public\.rpt_daily_collection\(p_from date, p_to date\)/i);
    expect(migrationSql).toMatch(/FROM public\.payments p/i);
    expect(migrationSql).not.toMatch(/FROM public\.receipts/i);
  });

  it('excludes voided and soft-deleted payments from daily collection totals', () => {
    expect(migrationSql).toMatch(/p\.deleted_at IS NULL/i);
    expect(migrationSql).toMatch(/UPPER\(COALESCE\(p\.status, 'POSTED'\)\) <> 'VOID'/i);
  });

  it('guards the security-definer aggregate behind the app-user report access policy', () => {
    expect(migrationSql).toMatch(/IF NOT public\.is_app_user\(\) THEN/i);
    expect(migrationSql).toMatch(/Authenticated app user is required to run daily collection reports/i);
  });
});

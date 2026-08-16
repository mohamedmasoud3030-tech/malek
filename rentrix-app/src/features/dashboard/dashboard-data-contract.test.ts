import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * R1 — Dashboard Truth architecture guard.
 *
 * The dashboard feature must never rebuild client-side truth:
 *   - one authoritative RPC (rpt_dashboard_snapshot) is the only data source,
 *   - no dataset fan-out (contracts/maintenance/invoice list reads),
 *   - no rows.length or client filtering as a KPI source.
 */
describe('dashboard frontend/backend data contract (R1)', () => {
  const read = (file: string) => readFileSync(resolve(import.meta.dirname, file), 'utf8');

  it('loads the snapshot exclusively through the authoritative read model RPC', () => {
    const snapshotSource = read('dashboard-snapshot.ts');
    expect(snapshotSource).toContain("supabase.rpc('rpt_dashboard_snapshot'");
    // No table reads and no legacy report/list fan-out from the snapshot module.
    expect(snapshotSource).not.toContain('supabase.from(');
    expect(snapshotSource).not.toContain('listContracts');
    expect(snapshotSource).not.toContain('listMaintenance');
    expect(snapshotSource).not.toContain('getDashboardArrearsReports');
    expect(snapshotSource).not.toContain('getFinancialPeriodSummaryReport');
  });

  it('never derives an authoritative KPI from rows.length or client filtering', () => {
    const sources = [
      read('dashboard-snapshot.ts'),
      read('dashboard-page.tsx'),
      read('components/alert-center.tsx'),
      read('components/kpi-grid.tsx'),
      read('components/hero-banner.tsx'),
      read('components/dashboard-charts.tsx'),
    ].join('\n');
    // The forbidden client-derivation patterns from the pre-R1 dashboard.
    expect(sources).not.toContain('activeContracts.length');
    expect(sources).not.toMatch(/filter\([^)]*\)\.length/);
    expect(sources).not.toContain('pageSize: 500');
  });

  it('keeps the page free of raw table/count queries and keeps retry semantics explicit', () => {
    const pageSource = read('dashboard-page.tsx');
    expect(pageSource).toContain('retry: false');
    expect(pageSource).not.toContain('listBankStatementLines');
    expect(pageSource).not.toContain('fetchPendingSettlementsCount');
  });

  it('pins the authoritative read model migration: credit-aware arrears and no row caps', () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, '../../../../supabase/migrations/20260821000000_r1_dashboard_truth_read_model.sql'),
      'utf8',
    ).toLowerCase();

    // Single company-isolated read model.
    expect(migration).toContain('create or replace function public.rpt_dashboard_snapshot(');
    expect(migration).toContain('public.require_company_id()');
    // Credit-aware remaining everywhere a receivable is measured.
    expect(migration).toContain('coalesce(i.credited_amount, 0)');
    // OMR 3dp policy.
    expect(migration).toContain('public._r3');
    // Reports parity: aged receivables becomes credit-aware too.
    expect(migration).toContain('create or replace function public.rpt_aged_receivables(');
    // Security posture.
    expect(migration).toContain('revoke all on function public.rpt_dashboard_snapshot(date, date, date) from public, anon');
    expect(migration).toContain('grant execute on function public.rpt_dashboard_snapshot(date, date, date) to authenticated, service_role');
  });
});

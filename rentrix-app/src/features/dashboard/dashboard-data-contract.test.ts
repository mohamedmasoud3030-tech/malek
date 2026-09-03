import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Dashboard Truth architecture guard.
 *
 * The command center must never rebuild client-side truth:
 *   - one authoritative RPC (rpt_dashboard_snapshot) is the KPI source,
 *   - the collection sparkline reads the server daily aggregate RPC,
 *   - the monthly chart consumes the canonical Reports cashflow service,
 *   - no dataset fan-out becomes a KPI, and no rows.length or client
 *     filtering of capped reads is presented as an authoritative number.
 */
describe('dashboard frontend/backend data contract', () => {
  const read = (file: string) => readFileSync(resolve(import.meta.dirname, file), 'utf8');

  it('loads the snapshot exclusively through the authoritative read model RPC', () => {
    const snapshotSource = read('dashboard-snapshot.ts');
    expect(snapshotSource).toContain("supabase.rpc('rpt_dashboard_snapshot'");
    expect(snapshotSource).not.toContain('supabase.from(');
    expect(snapshotSource).not.toContain('listContracts');
    expect(snapshotSource).not.toContain('listMaintenance');
    expect(snapshotSource).not.toContain('getDashboardArrearsReports');
    expect(snapshotSource).not.toContain('getFinancialPeriodSummaryReport');
  });

  it('reads the collection series from the server daily aggregate, never from row reads', () => {
    const seriesSource = read('daily-collection-series.ts');
    expect(seriesSource).toContain("supabase.rpc('rpt_daily_collection'");
    expect(seriesSource).not.toContain('supabase.from(');
    expect(seriesSource).toContain('retry: false');
  });

  it('never derives an authoritative KPI from rows.length or client filtering', () => {
    const sources = [
      read('dashboard-snapshot.ts'),
      read('dashboard-page.tsx'),
      read('components/office-pulse.tsx'),
      read('components/financial-performance-section.tsx'),
      read('components/needs-attention-section.tsx'),
      read('components/occupancy-section.tsx'),
      read('components/collections-section.tsx'),
      read('components/maintenance-section.tsx'),
      read('components/upcoming-contracts-section.tsx'),
      read('components/property-health-section.tsx'),
    ].join('\n');
    // Retired client-derivation patterns must never return.
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

  it('keeps the monthly chart on the canonical Reports cashflow service', () => {
    const pageSource = read('dashboard-page.tsx');
    expect(pageSource).toContain('useFinancialCashflowReport');
    expect(pageSource).not.toContain('supabase.from(\'payments\'');
    expect(pageSource).not.toContain('supabase.from(\'expenses\'');
  });
});

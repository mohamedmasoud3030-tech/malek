import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Dashboard Truth architecture guard.
 *
 * The compact command center keeps one authoritative snapshot for KPIs,
 * server aggregate series for charts, and only supplemental reads required to
 * classify actionable conditions in the unified attention queue.
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

  it('does not mount a decorative daily-collection query beside the authoritative snapshot', () => {
    const pageSource = read('dashboard-page.tsx');
    const pulseSource = read('components/office-pulse.tsx');
    expect(pageSource).not.toContain('useDailyCollectionSeries');
    expect(pageSource).not.toContain('daily-collection-series');
    expect(pulseSource).not.toContain('Sparkline');
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
    ].join('\n');
    expect(sources).not.toContain('activeContracts.length');
    expect(sources).not.toMatch(/filter\([^)]*\)\.length/);
    expect(sources).not.toContain('pageSize: 500');
  });

  it('keeps the page free of raw table/count queries and removed detail-section renderers', () => {
    const pageSource = read('dashboard-page.tsx');
    expect(pageSource).toContain('retry: false');
    expect(pageSource).not.toContain('listBankStatementLines');
    expect(pageSource).not.toContain('fetchPendingSettlementsCount');
    expect(pageSource).not.toContain('MaintenanceSection');
    expect(pageSource).not.toContain('UpcomingContractsSection');
    expect(pageSource).not.toContain('PropertyHealthSection');
    expect(pageSource).not.toContain('OwnerObligationsSection');
  });

  it('does not start supplemental reads before the authoritative snapshot exists', () => {
    const pageSource = read('dashboard-page.tsx');
    const utilityHookSource = read('../utilities/use-utilities.ts');
    expect(pageSource).toContain('const supplementalEnabled = Boolean(snapshot);');
    expect(pageSource).toContain('{ enabled: supplementalEnabled }');
    expect(pageSource).toContain('useUtilityBills(undefined, { enabled: supplementalEnabled })');
    expect(pageSource).toContain("useMaintenance('all', '', { enabled: supplementalEnabled })");
    expect(pageSource).toContain('attentionSourcesLoading');
    expect(utilityHookSource).toContain('enabled: options?.enabled ?? true');
  });

  it('keeps cashflow failure and retry owned by the performance panel instead of the global attention alert', () => {
    const pageSource = read('dashboard-page.tsx');
    expect(pageSource).toContain('chartIsError={cashflowQuery.isError && !cashflowQuery.data}');
    expect(pageSource).toContain('onChartRetry={retryCashflow}');
    expect(pageSource).not.toContain('const hasSupplementalError = cashflowQuery.isError');
    expect(pageSource).not.toContain('const supplementalIsFetching = cashflowQuery.isFetching');
  });

  it('activates vacancy detail reads only from authoritative snapshot vacancy truth', () => {
    const pageSource = read('dashboard-page.tsx');
    const occupancySource = read('components/occupancy-section.tsx');
    expect(pageSource).toContain('const needsVacancyDetails = (snapshot?.occupancy.vacantUnits ?? 0) > 0;');
    expect(pageSource).toContain('useAllUnits({ enabled: needsVacancyDetails })');
    expect(pageSource).toContain("useAllContracts('all', { enabled: needsVacancyDetails })");
    expect(pageSource).toContain('enabled: needsVacancyDetails');
    expect(pageSource).not.toContain('hasVacantUnit');
    expect(occupancySource).not.toContain('?? analytics.occupancyRate');
    expect(occupancySource).not.toContain('?? analytics.occupiedUnits');
    expect(occupancySource).not.toContain('?? analytics.availableUnits');
    expect(occupancySource).toContain('snapshot.portfolio.units');
  });

  it('keeps the monthly chart on the canonical Reports cashflow service', () => {
    const pageSource = read('dashboard-page.tsx');
    expect(pageSource).toContain('useFinancialCashflowReport');
    expect(pageSource).not.toContain("supabase.from('payments'");
    expect(pageSource).not.toContain("supabase.from('expenses'");
  });
});

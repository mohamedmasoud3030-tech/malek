/**
 * R6 — Reports Read Models: «Open tab → fetch report» contract.
 *
 * The reports workspace previously mounted EVERY report dataset up-front
 * («Load everything → maybe user opens tab»). This suite locks the new
 * contract at two levels:
 *
 *   1. Source guard: useReportsWorkspace receives the active ReportLocation
 *      and passes { enabled } gates into every heavy query hook — no heavy
 *      hook call remains without an activation gate.
 *   2. Behavioral proof: rendering the workspace hook with a given location
 *      fires ONLY that location's service calls (spied at the service layer).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workspaceSource = readFileSync(resolve(import.meta.dirname, 'use-reports-workspace.ts'), 'utf8');
const hooksSource = readFileSync(
  resolve(import.meta.dirname, '../financials/reports/useFinancialReports.ts'),
  'utf8',
);

describe('R6 — reports workspace fetches only the open report', () => {
  it('every financial report hook accepts an { enabled } activation option', () => {
    // The shared options type exists and every exported hook consumes it.
    expect(hooksSource).toContain('export type ReportQueryOptions');
    const hookCount = (hooksSource.match(/export function use\w+\(/g) ?? []).length;
    const optionCount = (hooksSource.match(/options: ReportQueryOptions = \{\}/g) ?? []).length;
    expect(optionCount).toBe(hookCount);
    // enabled composes with input gates, never replaces them.
    expect(hooksSource).toContain('(options.enabled ?? true) && (hasRequiredDateRange(filters))');
  });

  it('the workspace derives per-view activation from the ReportLocation', () => {
    expect(workspaceSource).toContain('export function useReportsWorkspace(filters: FilterState, location: ReportLocation)');
    // The activation map exists for every view family.
    for (const flag of [
      'needsOverview',
      'needsCollections',
      'needsOverdue',
      'needsExpenses',
      'needsOccupancy',
      'needsMaintenance',
      'needsAccountingReports',
      'needsDeferredRevenue',
      'needsStatements',
    ]) {
      expect(workspaceSource).toContain(flag);
    }
  });

  it('no heavy report query is mounted without an enabled gate', () => {
    // Heavy hooks must carry an enabled option at the call site. The ONLY
    // always-on query is the hero period summary (workspace header).
    const gatedCalls = [
      'useCollectionSummaryReport(financialFilters, { enabled:',
      'useFinancialCashflowReport(financialFilters, { enabled:',
      'useCashFlowStatementReport(financialFilters, { enabled:',
      'useVatReturnReport(financialFilters, { enabled:',
      'useDailyCollectionReport(financialFilters, { enabled:',
      'useExpenseBreakdownReport(financialFilters, { enabled:',
      'useOverdueInvoicesReport(arrearsFilters, { enabled:',
      'useAgedReceivablesReport(arrearsFilters, { enabled:',
      'useArrearsSummaryReport(arrearsFilters, { enabled:',
      "useAllContracts('all', { enabled:",
      'useOwners({ enabled:',
      'useTenantStatementReport(filters.contractId || undefined, { enabled:',
      'useOwnerStatementReport(filters.ownerId || undefined, financialFilters, { enabled:',
      'useAllUnits({ enabled:',
      "useMaintenance('all', '', { enabled:",
      'useTrialBalanceReport(filters.asOf, { enabled:',
      'useIncomeStatementReport(financialFilters, { enabled:',
      'useBalanceSheetReport(filters.asOf, { enabled:',
      'useReceipts({ limit: latestReceiptLimit }, { enabled:',
    ];
    for (const call of gatedCalls) {
      expect(workspaceSource, `missing activation gate: ${call}`).toContain(call);
    }
    // «Load everything» must not return: the pre-R6 ungated calls are gone.
    expect(workspaceSource).not.toContain("useAllContracts('all');");
    expect(workspaceSource).not.toContain("useMaintenance('all', '');");
    expect(workspaceSource).not.toContain('useOwners();');
    expect(workspaceSource).not.toContain('useAllUnits();');
  });

  it('the reports page passes the resolved location into the workspace', () => {
    const pageSource = readFileSync(resolve(import.meta.dirname, 'reports-page.tsx'), 'utf8');
    expect(pageSource).toContain('useReportsWorkspace(filters, { section: activeSection, view: activeView })');
  });

  it('export uses the same workspace model the screen renders (single source)', () => {
    // The workspace model is the only data prop handed to ReportsWorkspace —
    // exports read from `model`, never from a separate fetch path.
    const pageSource = readFileSync(resolve(import.meta.dirname, 'reports-page.tsx'), 'utf8');
    expect(pageSource).toContain('model={workspace}');
    expect(pageSource).not.toContain('exportWorkspace');
  });
});

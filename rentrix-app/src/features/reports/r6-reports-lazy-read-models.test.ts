/**
 * R6 — Reports Read Models: «Open tab → fetch report» contract.
 *
 * The retained Reports read model previously mounted EVERY report dataset up-front
 * («Load everything → maybe user opens tab»). This suite locks the new
 * contract at two levels:
 *
 *   1. Source guard: useReportsWorkspace receives the active canonical ReportLocation
 *      and passes { enabled } gates into every heavy query hook — no heavy
 *      hook call remains without an activation gate.
 *   2. Behavioral proof: rendering the read-model hook with a given location
 *      fires ONLY that location's service calls (spied at the service layer).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string) =>
  readFileSync(resolve(import.meta.dirname, relativePath), 'utf8')
    .replaceAll('"', "'")
    .replace(/\s+/g, ' ');

const workspaceSource = source('use-reports-workspace.ts');
const hooksSource = source('../financials/reports/useFinancialReports.ts');
const compactWorkspaceSource = workspaceSource.replace(/\s/g, '');

describe('R6 — Reports fetches only the open canonical body', () => {
  it('every financial report hook accepts an { enabled } activation option', () => {
    expect(hooksSource).toContain('export type ReportQueryOptions');
    const hookCount = (hooksSource.match(/export function use\w+\(/g) ?? [])
      .length;
    const optionCount = (
      hooksSource.match(/options: ReportQueryOptions = \{\}/g) ?? []
    ).length;
    expect(optionCount).toBe(hookCount);
    expect(hooksSource).toContain(
      '(options.enabled ?? true) && (hasRequiredDateRange(filters))',
    );
  });

  it('the read model derives per-view activation from the canonical ReportLocation', () => {
    expect(workspaceSource).toContain('options: ReportsWorkspaceOptions = {}');
    for (const flag of [
      'needsOverview',
      'needsCollections',
      'needsOverdue',
      'needsExpenses',
      'needsOccupancy',
      'needsMaintenance',
      'needsAccountingReports',
      'needsDeferredRevenue',
      'needsTenantStatement',
      'needsOwnerStatement',
      'needsFinancialStatements',
    ]) {
      expect(workspaceSource).toContain(flag);
    }
  });

  it('no heavy report query is mounted without an enabled gate', () => {
    const gatedCalls = [
      'useFinancialPeriodSummaryReport(financialFilters, { enabled:',
      'useCollectionSummaryReport(financialFilters, { enabled:',
      'useFinancialCashflowReport(financialFilters, { enabled:',
      'useVatReturnReport(financialFilters, { enabled:',
      'useDailyCollectionReport(financialFilters, { enabled:',
      'useExpenseBreakdownReport(expenseFilters, { enabled:',
      'useOverdueInvoicesReport(arrearsFilters, { enabled:',
      'useAgedReceivablesReport(arrearsFilters, { enabled:',
      'useArrearsSummaryReport(arrearsFilters, { enabled:',
      "useAllContracts('all', { enabled:",
      'useOwners({ enabled:',
      'useTenantStatementReport(filters.contractId || undefined, { enabled:',
      'useOwnerStatementReport(filters.ownerId || undefined, financialFilters, { enabled:',
      'useAllUnits({ enabled:',
      "useMaintenance('all', '', { enabled:",
      'useAccountingTrialBalanceReport(filters.asOf, { enabled:',
      'useAccountingIncomeStatementReport(financialFilters, { enabled:',
      'useAccountingBalanceSheetReport(filters.asOf, { enabled:',
      'useReceipts({ limit: latestReceiptLimit }, { enabled:',
    ];
    for (const call of gatedCalls) {
      expect(
        compactWorkspaceSource,
        `missing activation gate: ${call}`,
      ).toContain(call.replace(/\s/g, ''));
    }

    const statementsSource = source('components/StatementsSection.tsx');
    const authoritySource = source('accounting-report-authority.ts');
    const statementServiceSource = source(
      '../financials/reports/financial-statements-service.ts',
    );
    expect(workspaceSource).not.toContain('useCashFlowStatementReport(');
    expect(hooksSource).not.toContain('useCashFlowStatementReport(');
    expect(statementServiceSource).not.toContain('getCashFlowStatementReport');
    expect(statementServiceSource).not.toContain(
      "supabase.rpc('rpt_cash_flow'",
    );
    expect(statementsSource).toMatch(
      /useAuthoritativeGlCashFlow\(\s*filters\?\.from,\s*filters\?\.to,\s*showFinancial,?\s*\)/,
    );
    expect(authoritySource).toContain(
      'enabled: enabled && Boolean(from && to)',
    );

    expect(workspaceSource).not.toContain("useAllContracts('all');");
    expect(workspaceSource).not.toContain("useMaintenance('all', '');");
    expect(workspaceSource).not.toContain('useOwners();');
    expect(workspaceSource).not.toContain('useAllUnits();');
    expect(workspaceSource).not.toContain('needsStatements');
    expect(workspaceSource).toContain('enabled: needsOwnerStatement');
    expect(workspaceSource).toContain('ownerReportPayloadQuery');
    expect(workspaceSource).toContain('loadPremiumOwnerReportPayload');
  });

  it('the product page passes its explicit target location and statement focus to the retained read model', () => {
    const pageSource = source('reports-page.tsx');
    const premiumSource = source('premium/report-product-page.tsx');
    expect(pageSource).toContain('<ReportsCatalog');
    expect(pageSource).not.toContain('useReportsWorkspace');
    expect(premiumSource).toContain('useReportsWorkspace(');
    expect(premiumSource).toContain(
      '{ section: target.section, view: target.view }',
    );
    expect(premiumSource).toContain(
      '{ statementFocus: product.statementFocus }',
    );
  });

  it('documents the bounded-read limitation honestly (no silent truncation)', () => {
    const helpers = source('reports-page.helpers.ts');
    expect(helpers).toContain('latestReceiptLimit = 100');
    const paginatedRead = source(
      '../financials/reports/report-paginated-read.ts',
    );
    expect(paginatedRead).toContain('تعذر تحميل كامل بيانات');
    const contractService = source('../contracts/services/contractService.ts');
    expect(contractService).toContain('truncated: boolean');
  });

  it('document output uses the same product read model the body renders (single source)', () => {
    const productPage = source('premium/report-product-page.tsx');
    expect(productPage).toContain('model={model}');
    expect(productPage).not.toContain('exportWorkspace');
  });
});

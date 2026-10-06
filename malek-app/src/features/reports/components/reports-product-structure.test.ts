import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPORT_PRODUCTS } from '../report-products';

const componentsDir = resolve(import.meta.dirname);
const reportsDir = resolve(componentsDir, '..');
const read = (path: string) => readFileSync(path, 'utf8').replaceAll('"', "'");

describe('Reports canonical product architecture', () => {
  it('uses the product page and one direct body dispatcher, with no workspace chrome or adapters', () => {
    const productPage = read(
      resolve(reportsDir, 'premium/report-product-page.tsx'),
    );
    expect(productPage).toContain('<ReportsFilterSurface');
    expect(productPage).toContain('<ReportViewPanel');
    expect(productPage).not.toContain('<ReportsWorkspace');
    expect(productPage).not.toContain('ReportsShell');

    expect(existsSync(resolve(reportsDir, 'workspace'))).toBe(false);
    for (const retired of [
      'report-workspaces.ts',
      'reports-section-model.ts',
      'report-view-registry.ts',
      'reports-page.sections.ts',
      'directory/report-directory-groups.ts',
    ]) {
      expect(
        existsSync(resolve(reportsDir, retired)),
        `${retired} must stay deleted`,
      ).toBe(false);
    }
  });

  it('keeps each retained body in its own lazy chunk without an adapter layer', () => {
    const panel = read(resolve(componentsDir, 'report-view-panel.tsx'));
    expect(panel.match(/lazy\(\(\) =>/g) ?? []).toHaveLength(16);
    for (const body of [
      'AccountingReportsSection',
      'GeneralLedgerCoreSection',
      'DeferredRevenueReportSection',
      'StatementsSection',
      'OverviewSection',
      'CollectionsSection',
      'OverdueSection',
      'FollowUpSection',
      'CollectionMovementSection',
      'ExpensesSection',
      'PropertyAnalyticsSection',
      'OccupancySection',
      'ExpiringContractsSection',
      'MaintenanceReportSection',
      'OperationsOverviewSection',
      'ServicesReportSection',
    ]) {
      expect(panel).toContain(`import('./${body}')`);
    }
    expect(panel).toContain('Suspense');
    expect(panel).not.toContain('/adapters/');
  });

  it('keeps product targets as the sole renderer and reachability authority', () => {
    const bodyLocations = REPORT_PRODUCTS.flatMap((product) =>
      product.targets
        .filter((target) => target.section !== 'statements')
        .map((target) => `${target.section}:${target.view}`),
    );
    expect(bodyLocations).toHaveLength(15);
    expect(new Set(bodyLocations).size).toBe(bodyLocations.length);
  });

  it('keeps the canonical dispatcher presentation-only and free of direct data-plane calls', () => {
    const source = read(resolve(componentsDir, 'report-view-panel.tsx'));
    expect(source).not.toMatch(
      /from '@\/features\/(accounting|financials)\/[^']*([Ss]ervice|useFinancialReports)/,
    );
    expect(source).not.toContain('supabase.');
  });
});

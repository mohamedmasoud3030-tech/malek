import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const reportsDir = resolve(dirname(fileURLToPath(import.meta.url)));
const read = (relative: string) => readFileSync(resolve(reportsDir, relative), 'utf8');

describe('reports closure — property scope wiring regressions', () => {
  it('keeps selected-property analytics scoped while benchmarking against an unscoped portfolio population', () => {
    const workspace = read('use-reports-workspace.ts');

    expect(workspace).toContain('const portfolioOccupancyRows = useMemo(');
    expect(workspace).toContain('benchmarkOccupancyRows: filters.propertyId ? portfolioOccupancyRows : undefined');
    expect(workspace).toContain('benchmarkExpenseRows: filters.propertyId ? portfolioExpenseQuery.data?.byProperty : undefined');
    expect(workspace).toContain('const previousScopedContracts = contracts.filter(');
    expect(workspace).toContain('buildVacancyAnalytics(\n        previousScopedUnits,\n        previousScopedContracts,');
  });

  it('keeps Property Golden previous-period occupancy on the same property scope as the current report', () => {
    const document = read('documents/professional-property-report.ts');

    expect(document).toContain('buildVacancyAnalytics(scopedUnits, scopedContracts, propertyTitlesById, prevRange.to)');
    expect(document).not.toContain('buildVacancyAnalytics(allUnits, allContracts, propertyTitlesById, prevRange.to)');
  });

  it('builds the Property Golden portfolio benchmark from the unfiltered unit universe', () => {
    const document = read('documents/professional-property-report.ts');

    expect(document).toContain('const fullPortfolioRows = buildOccupancyRows(allUnits, propertyTitlesById);');
    expect(document).toContain("model.sections.propertyPerformance.benchmark\n      .find((row) => row.key === 'expense_per_occupied')?.portfolio ?? null");
    expect(document).not.toContain('const portfolioRows = model.sections.occupancy.occupancyRows.filter');
  });

  it('never reads the hero fallback as the Property Golden authoritative collection rate', () => {
    const document = read('documents/professional-property-report.ts');

    expect(document).toContain('model.sections.collections.collectionRate ?? null');
    expect(document).not.toContain('model.hero.collectionRate');
  });
});

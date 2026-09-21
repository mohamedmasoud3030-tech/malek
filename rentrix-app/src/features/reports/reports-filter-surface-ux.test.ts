import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const reportsDir = resolve(process.cwd(), 'src/features/reports');
const read = (file: string) =>
  readFileSync(resolve(reportsDir, file), 'utf8');

describe('Reports filter UX contract', () => {
  it('uses the canonical defaults so custom dates are visible as active filters', () => {
    const surface = read('components/ReportsFilterSurface.tsx');
    expect(surface).toContain('getInitialReportsFilters');
    expect(surface).toContain('buildReportFilterSummary(filters, defaults');
    expect(surface).not.toContain('buildReportFilterSummary(filters, filters');
  });

  it('exposes active filter chips and clear-all through the shared FilterBar', () => {
    const surface = read('components/ReportsFilterSurface.tsx');
    const panel = read('components/FiltersPanel.tsx');
    expect(surface).toContain('activeFilters={activeFilters}');
    expect(surface).toContain('onClearAllFilters={activeFilters.length > 0 ? clearAllFilters : undefined}');
    expect(panel).toContain('activeFilters?: readonly ActiveFilterItem[]');
    expect(panel).toContain('onClearAllFilters?: () => void');
    expect(panel).toContain('activeFilters={activeFilters}');
    expect(panel).toContain('onClearAllFilters={onClearAllFilters}');
  });

  it('clears dependent selections together when removing a parent scope', () => {
    const surface = read('components/ReportsFilterSurface.tsx');
    expect(surface).toContain("propertyId: '', unitId: '', tenantId: '', contractId: ''");
    expect(surface).toContain("unitId: '', tenantId: '', contractId: ''");
  });
});

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const uiDir = resolve(dirname(fileURLToPath(import.meta.url)));
const srcDir = resolve(uiDir, '../..');
const featureDir = resolve(srcDir, 'features');

function collectReactSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return collectReactSourceFiles(path);
    if (extname(entry.name) !== '.tsx') return [];
    if (/\.(?:test|spec|e2e-fixture)\.tsx$/.test(entry.name)) return [];
    return [path];
  });
}

describe('canonical search and filter usage', () => {
  it('keeps raw search inputs out of feature surfaces', () => {
    const offenders = collectReactSourceFiles(featureDir)
      .filter((path) => /type=["']search["']/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(srcDir, path))
      .sort();

    expect(offenders).toEqual([]);
  });

  it('keeps feature registers from bypassing the FilterBar composition owner', () => {
    const offenders = collectReactSourceFiles(featureDir)
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        return source.includes("@/components/ui/search-input");
      })
      .map((path) => relative(srcDir, path))
      .sort();

    expect(offenders).toEqual([]);
  });

  it('keeps one composition owner for list-page search and filters', () => {
    const listPage = readFileSync(resolve(srcDir, 'components/layout/list-page.tsx'), 'utf8');
    const contractsPage = readFileSync(resolve(srcDir, 'features/contracts/ContractsListPage.tsx'), 'utf8');

    expect(listPage).toContain("import { FilterBar } from '@/components/ui/filter-bar'");
    expect(listPage).toContain('<FilterBar');
    expect(listPage).not.toContain('SearchInput');

    expect(contractsPage).toContain('<ContractFilters');
  });

  it('keeps complex register filtering inside the shared FilterBar system', () => {
    const filterBar = readFileSync(resolve(uiDir, 'filter-bar.tsx'), 'utf8');
    const invoiceFilters = readFileSync(resolve(srcDir, 'features/financials/components/invoice-filters.tsx'), 'utf8');
    const reportDirectory = readFileSync(resolve(srcDir, 'features/reports/directory/ReportDirectory.tsx'), 'utf8');

    expect(filterBar).toContain('<SearchInput');
    expect(filterBar).toContain('<BottomSheet');
    expect(filterBar).toContain('<ActiveFilterBar');

    expect(invoiceFilters).toContain('<FilterBar');
    expect(invoiceFilters).toContain('<FilterTabs');
    expect(invoiceFilters).not.toContain('<BottomSheet');
    expect(invoiceFilters).not.toContain('SlidersHorizontal');

    expect(reportDirectory).toContain('<FilterBar');
    expect(reportDirectory).toContain('<FilterTabs');
    expect(reportDirectory).not.toContain('type="search"');
  });

  it('prevents feature surfaces from rendering a second active-filter row', () => {
    const offenders = collectReactSourceFiles(featureDir)
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        return source.includes('<ActiveFilterBar') && (source.includes('<FilterBar') || source.includes('<ListPage'));
      })
      .map((path) => relative(srcDir, path))
      .sort();

    expect(offenders).toEqual([]);
  });

});

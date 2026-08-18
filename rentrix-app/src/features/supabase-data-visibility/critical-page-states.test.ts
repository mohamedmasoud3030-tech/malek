import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcRoot = resolve(import.meta.dirname, '../..');

function read(rel: string) {
  return readFileSync(resolve(srcRoot, rel), 'utf8');
}

const criticalPages = [
  {
    id: 'dashboard',
    file: 'features/dashboard/dashboard-page.tsx',
    error: 'تعذر تحميل بيانات اليوم',
    loading: 'isLoading',
    emptyGuard: 'snapshotUnavailable',
  },
  {
    id: 'contracts',
    file: 'features/contracts/ContractsListPage.tsx',
    error: 'تعذر تحميل العقود',
    loading: 'isLoading',
    empty: 'لا توجد عقود',
  },
  {
    id: 'properties',
    file: 'features/properties/properties-list-page.tsx',
    error: 'تعذر تحميل قائمة العقارات',
    loading: 'isLoading',
    empty: 'لم تُضف عقارات بعد',
  },
  {
    id: 'tenants',
    file: 'features/tenants/TenantsPage.tsx',
    error: "status={tenantsQuery.isLoading ? 'loading' : tenantsQuery.isError ? 'error'",
    loading: 'isLoading',
    empty: "'empty'",
  },
  {
    id: 'expenses',
    file: 'features/financials/expenses/expenses-page.tsx',
    error: 'isError',
    loading: 'isLoading',
  },
  {
    id: 'receipts',
    file: 'features/financials/receipts/receipts-page.tsx',
    error: 'isError',
    loading: 'isLoading',
  },
] as const;

describe('critical page data visibility — error is never an empty success', () => {
  for (const page of criticalPages) {
    it(`${page.id} distinguishes loading/error from a successful empty list`, () => {
      const source = read(page.file);
      expect(source, `${page.id} must branch on isError`).toContain(page.error);
      expect(source, `${page.id} must expose a loading branch`).toContain(page.loading);
      if ('empty' in page && page.empty) {
        expect(source, `${page.id} must have an explicit empty state`).toContain(page.empty);
      }
      if ('emptyGuard' in page && page.emptyGuard) {
        expect(source).toContain(page.emptyGuard);
      }
      expect(source).not.toMatch(/isError\s*\?\s*\[\]/);
      expect(source).not.toMatch(/error\s*\?\s*\[\s*\]/);
    });
  }

  it('keeps AsyncContentState as a single discriminant so empty cannot win over error', () => {
    const source = read('components/async-content-state.tsx');
    expect(source).toContain("status === 'loading'");
    expect(source).toContain("status === 'error'");
    expect(source).toContain("status === 'empty'");
    const loading = source.indexOf("status === 'loading'");
    const error = source.indexOf("status === 'error'");
    const empty = source.indexOf("status === 'empty'");
    expect(loading).toBeGreaterThan(-1);
    expect(error).toBeGreaterThan(loading);
    expect(empty).toBeGreaterThan(error);
  });
});

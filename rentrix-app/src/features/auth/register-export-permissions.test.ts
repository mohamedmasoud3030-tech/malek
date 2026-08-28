import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const propertiesPage = readFileSync(
  resolve(import.meta.dirname, '../properties/properties-list-page.tsx'),
  'utf8',
);
const contractsPage = readFileSync(
  resolve(import.meta.dirname, '../contracts/ContractsListPage.tsx'),
  'utf8',
);

describe('entity register export permissions', () => {
  it('keeps property register export inside property visibility authority', () => {
    expect(propertiesPage).toContain("const canExport = canAccess('properties.view');");
    expect(propertiesPage).not.toContain("const canExport = canAccess('financial.reports.export');");
  });

  it('keeps contract register export inside contract visibility authority', () => {
    expect(contractsPage).toContain("const canExport = canAccess('contracts.view');");
    expect(contractsPage).not.toContain("const canExport = canAccess('financial.reports.export');");
  });
});

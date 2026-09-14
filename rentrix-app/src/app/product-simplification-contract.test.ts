import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { workspaceChildNavItems } from './navigation/app-nav-items';
import { ROUTE_CONTRACT } from './navigation/route-contract';
import { FINANCE_SECTIONS } from '@/features/finance/shell/financeShellModel';
import { REPORT_PRODUCTS } from '@/features/reports/report-products';
import { settingsSectionRegistry } from '@/features/settings/registry/sectionRegistry';

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('production product simplification contract', () => {
  it('uses standalone entity routes instead of relationship, operations, or governance hubs', () => {
    const routeTree = source('./router/route-tree.ts');
    expect(routeTree).not.toContain('relationships-hub');
    expect(routeTree).not.toContain('operations-hub');
    expect(routeTree).not.toContain('governance-hub');
    expect(routeTree).toContain("@/features/contracts/ContractsListPage");
    expect(routeTree).toContain("@/features/maintenance/components/maintenance-workspace");
    expect(routeTree).toContain("@/features/utilities/components/utilities-workspace");
    expect(routeTree).toContain("@/features/documents-vault/components/documents-vault-workspace");
    expect(routeTree).toContain("/settings/company");
    expect(routeTree).toContain("/settings/users-permissions");
  });

  it('keeps standalone relationship navigation explicit', () => {
    expect(workspaceChildNavItems['/contracts'].map(([, labelKey]) => labelKey)).toEqual([
      'contracts', 'tenants', 'peopleDirectory', 'leads', 'communication',
    ]);
  });

  it('keeps standalone services navigation explicit', () => {
    expect(workspaceChildNavItems['/maintenance'].map(([, labelKey]) => labelKey)).toEqual([
      'maintenance', 'utilities', 'serviceProviders', 'documentsVault',
    ]);
  });

  it('keeps standalone governance navigation explicit', () => {
    expect(workspaceChildNavItems['/settings'].map(([, labelKey]) => labelKey)).toEqual([
      'companySettings', 'usersPermissions', 'automation', 'auditLog', 'adminSupport',
    ]);
  });

  it('keeps Portfolio canonical routes standalone', () => {
    // '/units' is retired as a top-level route: the units register is canonical
    // under the property detail subtree (/properties/$propertyId/units) and is
    // disclosed through the Portfolio workspace, so it is not a contract route.
    const portfolioEntries = ROUTE_CONTRACT.filter((entry) => ['/properties', '/lands', '/owners'].includes(entry.canonical));
    expect(portfolioEntries.filter((entry) => entry.isPrimaryNav).map((entry) => entry.canonical)).toEqual(['/properties']);
    expect(portfolioEntries.filter((entry) => !entry.isPrimaryNav).map((entry) => entry.canonical)).toEqual(['/lands', '/owners']);
  });

  it('keeps Money task-first while specialist views remain available', () => {
    expect(workspaceChildNavItems['/financials'].map(([, labelKey]) => labelKey)).toEqual(['invoices', 'receipts', 'expenses', 'commissions']);
    expect(FINANCE_SECTIONS.filter((section) => section.showInPrimaryNavigation).map((section) => section.id)).toEqual(['collections', 'fees', 'expenses', 'funds', 'banking']);
  });

  it('keeps company settings internals focused without restoring a governance hub', () => {
    expect(settingsSectionRegistry.filter((section) => section.showInPrimaryNavigation).map((section) => section.id)).toEqual(['office', 'identity', 'documents', 'notifications', 'system']);
    const settingsPage = source('../features/settings/settings-page.tsx');
    expect(settingsPage).toContain('routineDefinitions');
    expect(settingsPage).toContain('accessibleDefinitions');
  });

  it('keeps the report catalog canonical', () => {
    expect(REPORT_PRODUCTS.map((product) => product.id)).toEqual([
      'owner-comprehensive-statement',
      'tenant-statement',
      'collections-arrears-cheques',
      'portfolio-property-performance',
      'financial-settlement-pack',
    ]);
  });
});

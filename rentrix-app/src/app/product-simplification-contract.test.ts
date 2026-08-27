import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { workspaceChildNavItems } from './navigation/app-nav-items';
import { governanceHubSections } from '@/features/governance-hub/governance-hub-sections';

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('production product simplification contract', () => {
  it('keeps support, diagnostics, security duplication, and duplicate cost-center entry out of routine Settings navigation', () => {
    expect(workspaceChildNavItems['/settings'].map(([, labelKey]) => labelKey)).toEqual([
      'companySettings',
      'usersPermissions',
      'automation',
    ]);

    const hiddenSections = governanceHubSections
      .filter((section) => !section.showInPrimaryNavigation)
      .map((section) => section.id);

    expect(hiddenSections).toEqual([
      'cost-centers',
      'system-settings',
      'audit-log',
      'data-integrity',
      'security',
    ]);
  });

  it('keeps advanced routes available without advertising them as normal product destinations', () => {
    const nav = source('./navigation/app-nav-items.ts');
    expect(nav).not.toContain("['/admin-support', 'supportOperations'");
    expect(nav).not.toContain("['/settings', 'systemSettings'");
    expect(nav).not.toContain("['/settings', 'costCenters'");
  });

  it('keeps implementation diagnostics out of finance readiness copy', () => {
    const readiness = source('../features/financials/tax-authority/finance-readiness-section.tsx');
    for (const forbidden of [
      'company_settings.vat_rate',
      'TAX_PROFILE_MISSING',
      'FEE_TAX_TREATMENT_MISSING',
      'فشل مغلق',
      'READY /',
      'HARD_CLOSED',
      'OPEN.',
    ]) expect(readiness).not.toContain(forbidden);
  });

  it('keeps tax administration user-facing and does not leak implementation mechanics or raw mutation errors', () => {
    const taxWorkspace = source('../features/financials/tax-authority/tax-profile-workspace.tsx');
    for (const forbidden of [
      'company_settings.vat_rate',
      'Maker-Checker',
      'versioned',
      'RPC محكوم',
      'Snapshot',
      'FEE_TAX_TREATMENT_MISSING',
      'تفشل مغلقًا',
    ]) expect(taxWorkspace).not.toContain(forbidden);

    expect(taxWorkspace).not.toContain('onError: (e) => toast.error(e instanceof Error ? e.message');
    expect(taxWorkspace).toContain("onError: () => toast.error(friendlyTaxError('create'))");
    expect(taxWorkspace).toContain("onError: () => toast.error(friendlyTaxError('approve'))");
  });
});

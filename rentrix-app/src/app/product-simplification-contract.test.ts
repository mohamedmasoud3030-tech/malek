import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { workspaceChildNavItems } from './navigation/app-nav-items';
import { governanceHubSections } from '@/features/governance-hub/governance-hub-sections';
import { FINANCE_SECTIONS } from '@/features/finance/shell/financeShellModel';
import { leasingHubSections } from '@/features/relationships-hub/leasing-hub-sections';
import { portfolioHubSections } from '@/features/portfolio-hub/portfolio-hub-sections';
import { operationsHubSections } from '@/features/operations-hub/operations-hub.sections';

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

  it('keeps Portfolio routine navigation focused on properties, units and owners', () => {
    expect(portfolioHubSections.filter((section) => section.showInPrimaryNavigation).map((section) => section.id))
      .toEqual(['properties', 'units', 'owners']);
    expect(portfolioHubSections.filter((section) => !section.showInPrimaryNavigation).map((section) => section.id))
      .toEqual(['lands']);
    expect(workspaceChildNavItems['/properties'].map(([, labelKey]) => labelKey)).toEqual(['units', 'owners']);
  });

  it('keeps Leasing routine navigation focused on contracts and tenants', () => {
    expect(leasingHubSections.filter((section) => section.showInPrimaryNavigation).map((section) => section.id))
      .toEqual(['contracts', 'tenants']);
    expect(leasingHubSections.filter((section) => !section.showInPrimaryNavigation).map((section) => section.id))
      .toEqual(['people', 'leads', 'communication']);
    expect(workspaceChildNavItems['/contracts'].map(([, labelKey]) => labelKey)).toEqual(['tenants']);
  });

  it('keeps specialist Money tools available without advertising them as daily destinations', () => {
    expect(workspaceChildNavItems['/financials'].map(([, labelKey]) => labelKey)).toEqual([
      'invoices',
      'receipts',
      'arrears',
      'expenses',
    ]);

    expect(FINANCE_SECTIONS.filter((section) => section.showInPrimaryNavigation).map((section) => section.id))
      .toEqual(['overview', 'collections', 'expenses']);
    expect(FINANCE_SECTIONS.filter((section) => !section.showInPrimaryNavigation).map((section) => section.id))
      .toEqual(['fees', 'funds', 'banking']);
  });

  it('keeps Services routine navigation focused on maintenance and utilities', () => {
    expect(operationsHubSections.filter((section) => section.showInPrimaryNavigation).map((section) => section.id))
      .toEqual(['maintenance', 'utilities']);
    expect(operationsHubSections.filter((section) => !section.showInPrimaryNavigation).map((section) => section.id))
      .toEqual(['service_providers', 'documents_vault']);
    expect(workspaceChildNavItems['/maintenance'].map(([, labelKey]) => labelKey)).toEqual(['maintenance', 'utilities']);
  });

  it('keeps advanced routes available without advertising them as normal product destinations', () => {
    const nav = source('./navigation/app-nav-items.ts');
    for (const forbidden of [
      "['/admin-support', 'supportOperations'",
      "['/settings', 'systemSettings'",
      "['/settings', 'costCenters'",
      "['/properties', 'lands'",
      "['/contracts', 'peopleDirectory'",
      "['/contracts', 'leads'",
      "['/contracts', 'communication'",
      "['/financials', 'deposits'",
      "['/financials', 'ownerSettlements'",
      "['/financials', 'bankReconciliation'",
      "['/financials', 'commissions'",
      "['/maintenance', 'serviceProviders'",
      "['/maintenance', 'documentsVault'",
    ]) expect(nav).not.toContain(forbidden);
  });

  it('never renders raw backend errors through shared product error surfaces', () => {
    const errorState = source('../components/ui/error-state.tsx');
    const crudWriteError = source('../lib/data/crud-write-error.ts');

    expect(errorState).toContain('resolveSafeErrorMessage');
    expect(errorState).toContain('parseSupabaseDiagnostics');
    expect(errorState).not.toContain('return error.message');
    expect(errorState).not.toContain("typeof error === 'string' && error.trim() ? error");

    expect(crudWriteError).not.toContain('return message ?');
    expect(crudWriteError).toContain('أعد المحاولة، وإذا استمرت المشكلة تواصل مع مسؤول النظام');
  });

  it('keeps users and permission reviews free of hidden support mechanics and raw routes', () => {
    const users = source('../features/governance-hub/components/UserRolesWorkspace.tsx');
    expect(users).not.toContain("to=\"/admin-support\"");
    expect(users).not.toContain('بحث مقنّع');
    expect(users).not.toContain('مقترح غير منفذ');
    expect(users).not.toContain('المورد: {request.resource_route');
    expect(users).toContain('requestScopeLabel(request.resource_route)');
  });

  it('keeps fixed monthly accrual UI operator-facing', () => {
    const accrual = source('../features/financials/fixed-monthly-accruals/fixed-monthly-accrual-workspace.tsx');
    for (const forbidden of ['FIXED_MONTHLY', 'DAILY_ACCRUAL', 'الحساب 2100', 'error.message', 'نسخة {row.versionNo}']) {
      expect(accrual).not.toContain(forbidden);
    }
    expect(accrual).toContain('احتساب الاستحقاقات');
    expect(accrual).toContain('راجع جاهزية المالية والضريبة قبل التنفيذ');
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

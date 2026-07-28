import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { financeHubSectionIds, type FinanceHubSectionId } from './finance-hub-sections';

/**
 * Architecture contracts for the finance hub.
 *
 * These guard the structural promises of the refactor — one composition layer,
 * one rendering contract, no parallel implementations — so a future change that
 * quietly reintroduces a wrapper page or a second page shell fails here instead
 * of in review.
 */

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

/** The eight workspace bodies, in the same order as the section registry. */
const sectionSources: Record<FinanceHubSectionId, { path: string; exportName: string }> = {
  invoices: { path: '../financials/invoices/invoices-page.tsx', exportName: 'InvoicesWorkspace' },
  receipts: { path: '../financials/receipts/receipts-page.tsx', exportName: 'ReceiptsWorkspace' },
  expenses: { path: '../financials/expenses/expenses-page.tsx', exportName: 'ExpensesWorkspace' },
  arrears: { path: '../financials/arrears/arrears-page.tsx', exportName: 'ArrearsWorkspace' },
  deposits: { path: '../financials/deposits/deposits-page.tsx', exportName: 'DepositsWorkspace' },
  owner_settlements: { path: '../owners/owner-settlements-page.tsx', exportName: 'OwnerSettlementsWorkspace' },
  bank_reconciliation: { path: '../financials/reconciliation/bank-reconciliation-page.tsx', exportName: 'BankReconciliationWorkspace' },
  commissions: { path: '../commissions/commissions-page.tsx', exportName: 'CommissionsWorkspace' },
};

const entryPages = [
  'collections-hub-page.tsx',
  'expenses-arrears-hub-page.tsx',
  'deposits-settlements-hub-page.tsx',
  'banking-commissions-hub-page.tsx',
] as const;

describe('one rendering contract across every finance page', () => {
  it('exports a workspace component for all eight sections', () => {
    for (const sectionId of financeHubSectionIds) {
      const { path, exportName } = sectionSources[sectionId];
      expect(read(path), `${sectionId} must export ${exportName}`).toContain(`export function ${exportName}(`);
    }
  });

  it('gives every workspace the same embedded prop, not a bespoke mode union', () => {
    for (const sectionId of financeHubSectionIds) {
      const source = read(sectionSources[sectionId].path);

      expect(source, `${sectionId} must accept embedded`).toContain('embedded');
      expect(source, `${sectionId} must default to standalone`).toContain('embedded = false');
      // The abandoned intermediate contract; a mixed codebase is the thing the
      // "one consistent rendering contract" requirement rules out.
      expect(source, `${sectionId} must not reintroduce the mode union`).not.toContain("mode?: 'standalone' | 'embedded'");
      expect(source).not.toContain("mode === 'embedded'");
    }
  });

  it('keeps the standalone page wrapper for every section so existing routes still resolve', () => {
    const standalonePages = [
      ['../financials/invoices/invoices-page.tsx', 'InvoicesPage', 'InvoicesWorkspace'],
      ['../financials/receipts/receipts-page.tsx', 'ReceiptsPage', 'ReceiptsWorkspace'],
      ['../financials/expenses/expenses-page.tsx', 'ExpensesPage', 'ExpensesWorkspace'],
      ['../financials/arrears/arrears-page.tsx', 'ArrearsPage', 'ArrearsWorkspace'],
      ['../financials/deposits/deposits-page.tsx', 'DepositsPage', 'DepositsWorkspace'],
      ['../owners/owner-settlements-page.tsx', 'OwnerSettlementsPage', 'OwnerSettlementsWorkspace'],
      ['../financials/reconciliation/bank-reconciliation-page.tsx', 'BankReconciliationPage', 'BankReconciliationWorkspace'],
      ['../commissions/commissions-page.tsx', 'CommissionsPage', 'CommissionsWorkspace'],
    ] as const;

    for (const [path, pageName, workspaceName] of standalonePages) {
      const source = read(path);
      expect(source, `${pageName} must remain exported`).toContain(`export function ${pageName}()`);
      expect(source, `${pageName} must delegate to ${workspaceName}`).toContain(`<${workspaceName} />`);
    }
  });
});

describe('no duplicated page shells', () => {
  it('routes every finance workspace through the shared shell instead of its own layout', () => {
    // Commissions is the documented exception: its view renders its own
    // heading, so the page never owned a PageHeader and only drops the layout.
    const sharedShellSections = financeHubSectionIds.filter((id) => id !== 'commissions');

    for (const sectionId of sharedShellSections) {
      const source = read(sectionSources[sectionId].path);

      expect(source, `${sectionId} must use EmbeddableWorkspace`).toContain('EmbeddableWorkspace');
      expect(source, `${sectionId} must not import PageLayout directly`).not.toContain("from '@/components/layout/page-layout'");
      expect(source, `${sectionId} must not import PageHeader directly`).not.toContain("from '@/components/layout/page-header'");
    }
  });

  it('keeps the page shell in the hub workspace only, never in an entry page', () => {
    for (const entryPage of entryPages) {
      const source = read(`./${entryPage}`);

      expect(source, `${entryPage} must not render its own layout`).not.toContain('PageLayout');
      expect(source, `${entryPage} must not render its own header`).not.toContain('PageHeader');
      expect(source, `${entryPage} must not build its own tab bar`).not.toContain('SectionTabs');
    }
  });

  it('declares the shell exactly once in the shared workspace', () => {
    const source = read('./finance-hub-workspace.tsx');

    expect(source.match(/<PageLayout/g) ?? []).toHaveLength(1);
    expect(source.match(/<PageHeader/g) ?? []).toHaveLength(1);
  });
});

describe('no parallel implementations', () => {
  it('makes every entry page a thin wrapper over the shared workspace', () => {
    for (const entryPage of entryPages) {
      const source = read(`./${entryPage}`);

      expect(source, `${entryPage} must render the shared workspace`).toContain('<FinanceHubWorkspace');
      expect(source, `${entryPage} must pass a default section`).toContain('defaultSection=');
      // A thin selector; anything much larger means logic is drifting back into
      // the wrapper pages the refactor removed.
      expect(source.split('\n').length, `${entryPage} should stay a thin entry point`).toBeLessThan(30);
    }
  });

  it('keeps the section registry as the single source of truth for the tab set', () => {
    const workspace = read('./finance-hub-workspace.tsx');

    expect(workspace).toContain("from './finance-hub-sections'");
    // Tabs must come from the registry, not from a second hard-coded list.
    expect(workspace).not.toMatch(/const\s+\w*[Ss]ections\s*:\s*readonly\s+SectionTabItem/);
  });

  it('registers exactly the eight required sections, in a stable order', () => {
    expect([...financeHubSectionIds]).toEqual([
      'invoices',
      'receipts',
      'expenses',
      'arrears',
      'deposits',
      'owner_settlements',
      'bank_reconciliation',
      'commissions',
    ]);
  });
});

describe('lazy loading and permission wiring', () => {
  it('code-splits every section body', () => {
    const source = read('./finance-hub-workspace.tsx');

    for (const sectionId of financeHubSectionIds) {
      expect(source, `${sectionId} must be lazily imported`).toMatch(new RegExp(`${sectionId}:\\s*lazy\\(`));
    }
  });

  it('validates permissions in the workspace rather than trusting the route alone', () => {
    const source = read('./finance-hub-workspace.tsx');

    expect(source).toContain('useAuth');
    expect(source).toContain('resolveFinanceHubState');
    expect(source).toContain('AccessDenied');
  });
});

describe('route compatibility', () => {
  const routeTree = read('../../app/router/route-tree.ts');

  it('keeps all four finance hub routes registered', () => {
    for (const path of ['/finance/collections', '/finance/expenses', '/finance/deposits', '/finance/banking']) {
      expect(routeTree).toContain(`path: '${path}'`);
    }
  });

  it('keeps every legacy finance route registered so old links still resolve', () => {
    for (const path of ['/invoices', '/receipts', '/expenses', '/arrears', '/deposits', '/owner-settlements', '/bank-reconciliation', '/commissions']) {
      expect(routeTree).toContain(`path: '${path}'`);
    }
  });

  it('points each hub route at its entry page component', () => {
    const expectedComponents = [
      ['/finance/collections', 'CollectionsHubPage'],
      ['/finance/expenses', 'ExpensesArrearsHubPage'],
      ['/finance/deposits', 'DepositsSettlementsHubPage'],
      ['/finance/banking', 'BankingCommissionsHubPage'],
    ] as const;

    for (const [path, component] of expectedComponents) {
      const pathIndex = routeTree.indexOf(`path: '${path}'`);
      const routeEnd = routeTree.indexOf('});', pathIndex);
      expect(routeTree.slice(pathIndex, routeEnd)).toContain(component);
    }
  });
});

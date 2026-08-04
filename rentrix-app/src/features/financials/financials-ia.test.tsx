import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { financialWorkflowGroups } from './financials-workflow-groups';

const readPage = () => readFileSync(new URL('./financials-page.tsx', import.meta.url), 'utf8');

describe('Stage 2 — /financials operational summary IA', () => {
  it('keeps a stable page identity with a single H1-style PageHeader', () => {
    const source = readPage();
    expect(source).toContain('<PageHeader');
    expect(source).toContain("translateSharedLabel('financialsSectionSummary', language)");
  });

  it('does not render a duplicated WorkspaceSubNav directory row', () => {
    const source = readPage();
    expect(source).not.toContain('WorkspaceSubNav');
  });

  it('does not embed a hardcoded seven-card destination directory', () => {
    const source = readPage();
    // The old page listed every destination as its own card grid. The summary
    // now derives its destination surface from the workflow-group registry.
    expect(source).toContain('financialWorkflowGroups');
    expect(source).toContain('visibleGroups');
    expect(source).not.toContain('مساحات العمل المالية');
  });

  it('does not embed duplicate lists that belong to the destination workspaces', () => {
    const source = readPage();
    // No receipts/invoices/expenses list rendering on the summary page.
    expect(source).not.toContain('ReceiptsWorkspace');
    expect(source).not.toContain('InvoicesWorkspace');
    expect(source).not.toContain('ExpensesWorkspace');
  });
});

describe('financial workflow groups', () => {
  it('opens the correct finance hub entry routes directly', () => {
    const routes = financialWorkflowGroups.map((group) => group.route).sort();
    expect(routes).toEqual([
      '/finance/banking',
      '/finance/collections',
      '/finance/deposits',
      '/finance/expenses',
    ]);
  });

  it('keeps a small, meaningful number of workflow groups', () => {
    expect(financialWorkflowGroups.length).toBeGreaterThanOrEqual(2);
    expect(financialWorkflowGroups.length).toBeLessThanOrEqual(5);
  });

  it('gives every group a permission-guarded destination chip list', () => {
    for (const group of financialWorkflowGroups) {
      expect(group.destinations.length, `${group.id} should have destination chips`).toBeGreaterThan(0);
      expect('permission' in group).toBe(true);
      for (const destination of group.destinations) {
        expect(typeof destination.label).toBe('string');
        expect('permission' in destination).toBe(true);
      }
    }
  });
});

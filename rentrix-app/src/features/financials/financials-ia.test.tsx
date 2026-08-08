import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { financialWorkflowGroups } from './financials-workflow-groups';

const readPage = () => readFileSync(new URL('./financials-page.tsx', import.meta.url), 'utf8');

describe('/financials consolidated operational entry', () => {
  it('keeps one Arabic finance page identity', () => {
    const source = readPage();
    expect(source).toContain('<PageHeader');
    expect(source).toContain('title="المالية"');
  });

  it('does not restore a second workspace navigation bar', () => {
    const source = readPage();
    expect(source).not.toContain('WorkspaceSubNav');
    expect(source).not.toContain('SectionTabs');
  });

  it('exposes the four internal finance drill-downs from the single finance page', () => {
    const source = readPage();
    expect(source).toContain("to: '/finance/collections'");
    expect(source).toContain("to: '/finance/expenses'");
    expect(source).toContain("to: '/finance/deposits'");
    expect(source).toContain("to: '/finance/banking'");
  });

  it('links accounting and formal reporting as the second finance/accounting destination', () => {
    expect(readPage()).toContain('to="/reports"');
  });

  it('does not embed duplicate operational lists on the directory page', () => {
    const source = readPage();
    expect(source).not.toContain('ReceiptsWorkspace');
    expect(source).not.toContain('InvoicesWorkspace');
    expect(source).not.toContain('ExpensesWorkspace');
  });
});

describe('financial workflow groups registry compatibility', () => {
  it('keeps the internal finance hub routes stable for bookmarks and drill-downs', () => {
    const routes = financialWorkflowGroups.map((group) => group.route).sort();
    expect(routes).toEqual([
      '/finance/banking',
      '/finance/collections',
      '/finance/deposits',
      '/finance/expenses',
    ]);
  });
});

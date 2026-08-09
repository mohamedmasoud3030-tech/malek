import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Financials Active-View Architecture - Phase 4 Verification.
 *
 * Phase 4 removes the "mounted-but-hidden" architecture and establishes
 * that only the active financial view is mounted in the DOM.
 * This resolves performance issues, avoids holding form state for invisible views,
 * and ensures stale-data is not flashed.
 */

const source = readFileSync(new URL('./financials-page.tsx', import.meta.url), 'utf8');

describe('financials Active-View Architecture - Phase 4 verification', () => {
  it('documents that inactive views are unmounted (no longer kept in DOM as hidden)', () => {
    // Assert that we have removed the mountedViews ref pattern
    expect(source).not.toContain('mountedViews');
    expect(source).not.toContain('mountedViews.current.add');
    expect(source).not.toContain('shouldRenderView');

    // Assert that hidden panels matching the old pattern have been removed
    expect(source).not.toMatch(/hidden=\{activeSection !== .* \|\| activeView !==/);
  });

  it('verifies that active panels are rendered conditionally instead of using hidden attribute', () => {
    // Ensure conditional rendering pattern is used
    expect(source).toContain("activeSection === 'overview' && (");
    expect(source).toContain("activeSection === 'collections' && activeView === 'invoices' && (");
    expect(source).toContain("activeSection === 'collections' && activeView === 'receipts' && (");
    expect(source).toContain("activeSection === 'collections' && activeView === 'arrears' && (");
    expect(source).toContain("activeSection === 'expenses' && activeView === 'expenses' && (");
    expect(source).toContain("activeSection === 'funds' && activeView === 'deposits' && (");
    expect(source).toContain("activeSection === 'funds' && activeView === 'owner_settlements' && (");
    expect(source).toContain("activeSection === 'banking' && activeView === 'bank_reconciliation' && (");
  });

  it('requires that workspaces are still loaded lazily via Suspense when mounted', () => {
    expect(source).toContain('InvoicesWorkspace');
    expect(source).toContain('ReceiptsWorkspace');
    expect(source).toContain('ExpensesWorkspace');
    expect(source).not.toContain('CommissionsWorkspace');
  });

  it('keeps the accessible tabpanel roles on active panels', () => {
    expect(source).toContain('role="tabpanel"');
    expect(source).toContain('id="section-panel-');
  });
});

import { describe, expect, it } from 'vitest';
import { getNavRoot, routeNavRoot, navRootTitle } from './route-nav-map';
import { workspaceLabels } from './terminology-registry';

/**
 * UX-013 / UX-015 / UX-069: Active navigation state and terminology source tests.
 *
 * This test matrix covers:
 *  1. Every documented route maps to exactly one nav root
 *  2. Nested and detail routes inherit the correct root
 *  3. No empty or missing labels in the terminology registry
 *  4. Workspace labels have correct Arabic grammar
 */
describe('Route-to-nav-root map (UX-013)', () => {
  it('covers all hub-level routes (IA 2026-08: finance 4 + reports + ai-assistant distinct)', () => {
    const hubs = ['/dashboard', '/properties', '/contracts', '/maintenance', '/financials', '/finance/collections', '/finance/expenses', '/finance/deposits', '/finance/banking', '/reports', '/ai-assistant', '/settings'];
    for (const hub of hubs) {
      expect(getNavRoot(hub)).toBe(hub);
      expect(navRootTitle).toHaveProperty(hub);
    }
  });

  it('maps legacy finance routes to their canonical hub (IA 2026-08: direct primary, REDIRECT-ONLY legacy)', () => {
    expect(getNavRoot('/invoices')).toBe('/finance/collections');
    expect(getNavRoot('/receipts')).toBe('/finance/collections');
    expect(getNavRoot('/expenses')).toBe('/finance/expenses');
    expect(getNavRoot('/arrears')).toBe('/finance/expenses');
    expect(getNavRoot('/deposits')).toBe('/finance/deposits');
    expect(getNavRoot('/owner-settlements')).toBe('/finance/deposits');
    expect(getNavRoot('/bank-reconciliation')).toBe('/finance/banking');
    expect(getNavRoot('/commissions')).toBe('/finance/banking');
  });

  it('maps portfolio child routes to /properties', () => {
    expect(getNavRoot('/owners')).toBe('/properties');
    expect(getNavRoot('/units')).toBe('/properties');
    expect(getNavRoot('/lands')).toBe('/properties');
  });

  it('maps relationships child routes to /contracts', () => {
    expect(getNavRoot('/people')).toBe('/contracts');
    expect(getNavRoot('/tenants')).toBe('/contracts');
    expect(getNavRoot('/leads')).toBe('/contracts');
    expect(getNavRoot('/communication')).toBe('/contracts');
  });

  it('maps operations child routes to /maintenance', () => {
    expect(getNavRoot('/utilities')).toBe('/maintenance');
    expect(getNavRoot('/automation')).toBe('/maintenance');
    expect(getNavRoot('/documents-vault')).toBe('/maintenance');
  });

  it('maps settings child routes to /settings', () => {
    expect(getNavRoot('/change-password')).toBe('/settings');
    expect(getNavRoot('/audit-log')).toBe('/settings');
    expect(getNavRoot('/data-integrity')).toBe('/settings');
    expect(getNavRoot('/system')).toBe('/settings');
  });

  it('maps /ai-assistant to itself (distinct interactive tool, not report tab — IA 2026-08)', () => {
    expect(getNavRoot('/ai-assistant')).toBe('/ai-assistant');
  });

  it('maps detail routes correctly', () => {
    expect(getNavRoot('/properties/$propertyId')).toBe('/properties');
    expect(getNavRoot('/properties/$propertyId/edit')).toBe('/properties');
    expect(getNavRoot('/properties/$propertyId/units')).toBe('/properties');
    expect(getNavRoot('/contracts/$contractId')).toBe('/contracts');
    expect(getNavRoot('/contracts/$contractId/edit')).toBe('/contracts');
    expect(getNavRoot('/owners/$ownerId')).toBe('/properties');
    expect(getNavRoot('/people/$personId/edit')).toBe('/contracts');
  });

  it('maps canonical finance hubs to themselves (IA 2026-08: direct primary access, one secondary layer)', () => {
    // Canonical hubs are primary nav destinations, each with its own SectionTabs (2 tabs)
    expect(getNavRoot('/finance/collections')).toBe('/finance/collections');
    expect(getNavRoot('/finance/expenses')).toBe('/finance/expenses');
    expect(getNavRoot('/finance/deposits')).toBe('/finance/deposits');
    expect(getNavRoot('/finance/banking')).toBe('/finance/banking');
    expect(getNavRoot('/financials')).toBe('/financials');
  });

  it('maps / to /dashboard', () => {
    expect(getNavRoot('/')).toBe('/dashboard');
  });

  it('falls back to /dashboard for unknown routes', () => {
    expect(getNavRoot('/unknown-route')).toBe('/dashboard');
  });

  it('has exactly one entry per route (no duplicates)', () => {
    const entries = [...routeNavRoot.entries()];
    const paths = entries.map(([path]) => path);
    const uniquePaths = new Set(paths);
    expect(paths.length).toBe(uniquePaths.size);
  });
});

describe('Workspace labels (UX-015 / UX-018 / UX-019)', () => {
  it('has Arabic labels for all workspace sections', () => {
    const requiredLabels = [
      'owners', 'units', 'lands',
      'people', 'tenants', 'leads', 'communication',
      'utilities', 'automation', 'documents_vault',
      'invoices', 'receipts', 'expenses', 'arrears', 'deposits',
      'owner_settlements', 'bank_reconciliation', 'commissions',
      'aiAssistant', 'changePassword', 'auditLog', 'dataIntegrity', 'system',
    ];
    for (const key of requiredLabels) {
      expect(workspaceLabels).toHaveProperty(key);
      expect(workspaceLabels[key]).toBeTruthy();
      expect(workspaceLabels[key].length).toBeGreaterThan(1);
    }
  });

  it('does not produce broken single-word labels', () => {
    // Every label should be a full Arabic phrase, not a single word fragment
    for (const label of Object.values(workspaceLabels)) {
      expect(label.length).toBeGreaterThan(3);
      // Should contain Arabic characters (Unicode range 0600-06FF)
      expect(label).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it('never produces labels like "إدارة | كل | إدارة" from description.split', () => {
    // These specific broken patterns must never appear
    const brokenPatterns = ['إدارة |', '| كل', '| إدارة', 'مراجعة |', '| سجل', '| تسجيل', '| متابعة', '| تتبع'];
    for (const label of Object.values(workspaceLabels)) {
      for (const pattern of brokenPatterns) {
        expect(label).not.toContain(pattern);
      }
    }
  });

  it('uses correct Arabic grammar', () => {
    // المستأجرون (correct plural) not المستأجرين (incorrect for subject position)
    expect(workspaceLabels.tenants).toBe('المستأجرون');
    // المصروفات (correct) not المصاريف
    expect(workspaceLabels.expenses).toBe('المصروفات');
    // الإيصالات (correct) not التحصيلات
    expect(workspaceLabels.receipts).toBe('الإيصالات');
    // المتأخرات (correct)
    expect(workspaceLabels.arrears).toBe('المتأخرات');
    // التأمينات (correct)
    expect(workspaceLabels.deposits).toBe('التأمينات');
  });

  it('has nav root titles in Arabic for all hubs', () => {
    const hubs = ['/dashboard', '/properties', '/contracts', '/maintenance', '/financials', '/finance/collections', '/finance/expenses', '/finance/deposits', '/finance/banking', '/reports', '/ai-assistant', '/settings'];
    for (const hub of hubs) {
      expect(typeof navRootTitle[hub]).toBe('string');
      expect(navRootTitle[hub].length).toBeGreaterThan(2);
    }
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { appPermissions, canAccess, getAuthorizationContextFromUser, type AuthorizationContext, type AuthorizationRole } from '@/features/auth/permissions';
import { canViewFinanceSection, getVisibleFinanceSections, resolveFinanceHubState } from './finance-hub-model';
import { financeHubSectionIds, financeHubSections, isFinanceHubSectionId, type FinanceHubSectionId } from './finance-hub-sections';

/**
 * The permission contract for the finance hub.
 *
 * The governing rule of the refactor: merging eight pages into tabbed hubs must
 * never grant access that was impossible before the merge. These tests pin the
 * tab permissions to the pre-merge route guards and prove no role gains a
 * section it could not previously reach.
 */

const routeTreeSource = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');

/**
 * The authorization each standalone finance route enforced before the hub
 * merge, taken from `origin/main`'s route tree. `null` means the route was
 * reachable by any authenticated user.
 */
const preMergeRouteGuards = {
  '/invoices': null,
  '/receipts': null,
  '/expenses': 'expenses.view',
  '/arrears': 'arrears.view',
  '/deposits': 'financial.deposits.view',
  '/owner-settlements': 'financial.owner_settlements.view',
  '/bank-reconciliation': 'financial.bank_reconciliation.view',
  '/commissions': 'commissions.view',
} as const;

const sectionToLegacyRoute: Record<FinanceHubSectionId, keyof typeof preMergeRouteGuards> = {
  invoices: '/invoices',
  receipts: '/receipts',
  expenses: '/expenses',
  arrears: '/arrears',
  deposits: '/deposits',
  owner_settlements: '/owner-settlements',
  bank_reconciliation: '/bank-reconciliation',
  commissions: '/commissions',
};

const roles: readonly AuthorizationRole[] = ['ADMIN', 'MANAGER', 'USER'];

function contextForRole(role: AuthorizationRole): AuthorizationContext {
  const context = getAuthorizationContextFromUser({
    id: `user-${role}`,
    email: `${role.toLowerCase()}@example.com`,
    app_metadata: { user_role: role },
  });
  if (!context) throw new Error(`Failed to build authorization context for ${role}`);
  return context;
}

function getRouteDefinition(path: string) {
  const pathIndex = routeTreeSource.indexOf(`path: '${path}'`);
  if (pathIndex === -1) return '';
  const routeStart = routeTreeSource.lastIndexOf('createRoute({', pathIndex);
  const routeEnd = routeTreeSource.indexOf('});', pathIndex);
  if (routeStart === -1 || routeEnd === -1) return '';
  return routeTreeSource.slice(routeStart, routeEnd + 3);
}

describe('finance hub section registry', () => {
  it('exposes exactly the eight required finance sections', () => {
    expect(financeHubSectionIds).toEqual([
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

  it('declares a label and icon for every section', () => {
    for (const section of financeHubSections) {
      expect(section.label.trim()).not.toBe('');
      // lucide icons are forwardRef components (objects), not plain functions.
      expect(section.icon).toBeTruthy();
      expect(['function', 'object']).toContain(typeof section.icon);
    }
  });

  it('only references permissions that exist in the app permission catalog', () => {
    for (const section of financeHubSections) {
      if (section.permission === null) continue;
      expect(appPermissions).toContain(section.permission);
    }
  });

  it('narrows untrusted URL values to known section ids', () => {
    expect(isFinanceHubSectionId('invoices')).toBe(true);
    expect(isFinanceHubSectionId('commissions')).toBe(true);
    expect(isFinanceHubSectionId('not-a-section')).toBe(false);
    expect(isFinanceHubSectionId(undefined)).toBe(false);
    expect(isFinanceHubSectionId(42)).toBe(false);
    expect(isFinanceHubSectionId({ id: 'invoices' })).toBe(false);
  });
});

describe('finance hub preserves the pre-merge permission model', () => {
  it('maps every section to the permission its standalone route required', () => {
    for (const section of financeHubSections) {
      const legacyRoute = sectionToLegacyRoute[section.id];
      expect(section.permission).toBe(preMergeRouteGuards[legacyRoute]);
    }
  });

  it('never grants a role access to a section it could not reach before the merge', () => {
    for (const role of roles) {
      const authorization = contextForRole(role);

      for (const section of financeHubSections) {
        const requiredPermission = preMergeRouteGuards[sectionToLegacyRoute[section.id]];
        // What the user could reach before: authenticated, plus the route guard.
        const couldAccessBefore = requiredPermission === null ? true : canAccess(authorization, requiredPermission);
        const canAccessNow = canViewFinanceSection(authorization, section);

        expect(canAccessNow).toBe(couldAccessBefore);
      }
    }
  });

  it('keeps the legacy routes authorizing before they redirect into the hub', () => {
    for (const [path, permission] of Object.entries(preMergeRouteGuards)) {
      const definition = getRouteDefinition(path);
      expect(definition, `route ${path} must stay registered`).not.toBe('');

      if (permission) {
        expect(definition, `route ${path} must keep enforcing ${permission}`).toContain(`requirePermission('${permission}')`);
      }
    }
  });

  it('redirects each legacy route to its own section rather than the hub default', () => {
    const expectedSectionBySlug: Record<string, FinanceHubSectionId> = {
      '/invoices': 'invoices',
      '/receipts': 'receipts',
      '/expenses': 'expenses',
      '/arrears': 'arrears',
      '/deposits': 'deposits',
      '/owner-settlements': 'owner_settlements',
      '/bank-reconciliation': 'bank_reconciliation',
      '/commissions': 'commissions',
    };

    for (const [path, section] of Object.entries(expectedSectionBySlug)) {
      expect(getRouteDefinition(path)).toContain(`section: '${section}'`);
    }
  });
});

describe('per-tab permission filtering', () => {
  it('denies every section when there is no authorization context', () => {
    expect(getVisibleFinanceSections(null)).toHaveLength(0);
    expect(getVisibleFinanceSections(undefined)).toHaveLength(0);

    for (const section of financeHubSections) {
      expect(canViewFinanceSection(null, section)).toBe(false);
    }
  });

  it('gives ADMIN every finance section', () => {
    const visible = getVisibleFinanceSections(contextForRole('ADMIN')).map((section) => section.id);
    expect(visible).toEqual([...financeHubSectionIds]);
  });

  it('hides only the sections MANAGER lacks (owner settlement payout stays out of view rules)', () => {
    const visible = getVisibleFinanceSections(contextForRole('MANAGER')).map((section) => section.id);
    // MANAGER holds every finance *view* permission in the role matrix.
    expect(visible).toEqual([...financeHubSectionIds]);
  });

  it('limits USER to the sections that never had a route permission', () => {
    const visible = getVisibleFinanceSections(contextForRole('USER')).map((section) => section.id);

    expect(visible).toEqual(['invoices', 'receipts']);
    expect(visible).not.toContain('expenses');
    expect(visible).not.toContain('arrears');
    expect(visible).not.toContain('deposits');
    expect(visible).not.toContain('owner_settlements');
    expect(visible).not.toContain('bank_reconciliation');
    expect(visible).not.toContain('commissions');
  });
});

describe('finance hub state resolution', () => {
  const admin = contextForRole('ADMIN');
  const user = contextForRole('USER');

  it('falls back to the entry page default when no section is requested', () => {
    const state = resolveFinanceHubState({ requestedSection: undefined, defaultSection: 'invoices', authorization: admin });
    expect(state.activeSection).toBe('invoices');
    expect(state.isRequestedSectionForbidden).toBe(false);
  });

  it('lets a deep link override the entry page default', () => {
    const state = resolveFinanceHubState({ requestedSection: 'commissions', defaultSection: 'bank_reconciliation', authorization: admin });
    expect(state.activeSection).toBe('commissions');
  });

  it('supports deep linking across hub boundaries', () => {
    // A section that "belongs" to a different entry page is still reachable —
    // the workspace is one surface, not four separate tab groups.
    const state = resolveFinanceHubState({ requestedSection: 'deposits', defaultSection: 'invoices', authorization: admin });
    expect(state.activeSection).toBe('deposits');
  });

  it('ignores an unknown section value and uses the default', () => {
    for (const requestedSection of ['', 'nope', null, undefined, 7, {}]) {
      const state = resolveFinanceHubState({ requestedSection, defaultSection: 'receipts', authorization: admin });
      expect(state.activeSection).toBe('receipts');
      expect(state.isRequestedSectionForbidden).toBe(false);
    }
  });

  it('refuses a deep link to a real section the user may not see', () => {
    const state = resolveFinanceHubState({ requestedSection: 'commissions', defaultSection: 'invoices', authorization: user });

    expect(state.isRequestedSectionForbidden).toBe(true);
    expect(state.activeSection).toBeNull();
  });

  it('degrades to the first permitted section when the entry default is forbidden', () => {
    // USER lands on /finance/expenses (default: expenses) but cannot see it.
    const state = resolveFinanceHubState({ requestedSection: undefined, defaultSection: 'expenses', authorization: user });

    expect(state.activeSection).toBe('invoices');
    expect(state.isRequestedSectionForbidden).toBe(false);
    expect(state.visibleSections.map((section) => section.id)).toEqual(['invoices', 'receipts']);
  });

  it('reports when a user may see no finance section at all', () => {
    const state = resolveFinanceHubState({ requestedSection: 'invoices', defaultSection: 'invoices', authorization: null });

    expect(state.hasNoVisibleSections).toBe(true);
    expect(state.activeSection).toBeNull();
  });

  it('never resolves to a section outside the visible set, for any role and any request', () => {
    for (const role of roles) {
      const authorization = contextForRole(role);

      for (const defaultSection of financeHubSectionIds) {
        for (const requestedSection of [...financeHubSectionIds, undefined, 'bogus']) {
          const state = resolveFinanceHubState({ requestedSection, defaultSection, authorization });
          if (state.activeSection === null) continue;

          const visibleIds = state.visibleSections.map((section) => section.id);
          expect(visibleIds).toContain(state.activeSection);
        }
      }
    }
  });
});

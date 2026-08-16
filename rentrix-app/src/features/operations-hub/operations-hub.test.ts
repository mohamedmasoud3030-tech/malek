import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getVisibleOperationsHubSections,
  operationsHubSections,
  type OperationsHubPermission,
} from './operations-hub.sections';
import {
  getVisibleOperationsSections,
  isOperationsHubSectionId,
  resolveOperationsHubState,
} from './operations-hub-model';
import type { AuthorizationContext } from '@/features/auth/permissions';

const routeTree = readFileSync(resolve(import.meta.dirname, '../../app/router/route-tree.ts'), 'utf8');
const routeDefinition = (path: string) => {
  const pathIndex = routeTree.indexOf(`path: '${path}'`);
  const routeStart = routeTree.lastIndexOf('createRoute({', pathIndex);
  const routeEnd = routeTree.indexOf('});', pathIndex);
  return routeTree.slice(routeStart, routeEnd + 3);
};

const admin: AuthorizationContext = { userId: 'admin', email: null, role: 'ADMIN' };
const user: AuthorizationContext = { userId: 'user', email: null, role: 'USER' };

describe('Services workspace contract', () => {
  it('owns exactly four operational capabilities with no duplicate Automation authority', () => {
    expect(operationsHubSections.map((section) => section.id)).toEqual([
      'maintenance', 'service_providers', 'utilities', 'documents_vault',
    ]);
    expect(new Set(operationsHubSections.map((section) => section.id)).size).toBe(4);
    expect(isOperationsHubSectionId('automation')).toBe(false);
  });

  it('keeps authenticated-only sections while filtering permission-gated ones', () => {
    expect(getVisibleOperationsHubSections(() => false).map((section) => section.id)).toEqual([
      'utilities', 'documents_vault',
    ]);
    const granted = new Set<OperationsHubPermission>(['maintenance.view']);
    expect(getVisibleOperationsHubSections((permission) => granted.has(permission)).map((section) => section.id)).toEqual([
      'maintenance', 'utilities', 'documents_vault',
    ]);
  });

  it('preserves state in one Services composition layer', () => {
    const component = readFileSync(resolve(import.meta.dirname, './operations-hub-workspace.tsx'), 'utf8');
    expect(component).toContain("title = 'الخدمات'");
    expect(component).toContain('mountedSections');
    expect(component).toContain("to: '/maintenance'");
    expect(component).not.toContain('AutomationWorkspace');
  });

  it('keeps compatibility routes pointed at their single owning workspace', () => {
    expect(routeDefinition('/utilities')).toContain("to: '/maintenance'");
    expect(routeDefinition('/utilities')).toContain("section: 'utilities'");
    expect(routeDefinition('/documents-vault')).toContain("to: '/maintenance'");
    expect(routeDefinition('/documents-vault')).toContain("section: 'documents_vault'");
    expect(routeDefinition('/automation')).toContain("requirePermission('automation.view')");
    expect(routeDefinition('/automation')).toContain("to: '/settings'");
    expect(routeDefinition('/automation')).toContain("section: 'automation'");
  });
});

describe('Services permission and deep-link model', () => {
  it('returns all four Services sections for ADMIN', () => {
    expect(getVisibleOperationsSections(admin).map((section) => section.id)).toEqual([
      'maintenance', 'service_providers', 'utilities', 'documents_vault',
    ]);
  });

  it('opens valid deep links and rejects removed Automation as a Services section', () => {
    expect(resolveOperationsHubState({
      requestedSection: 'documents_vault', defaultSection: 'maintenance', authorization: admin,
    }).activeSection).toBe('documents_vault');
    expect(resolveOperationsHubState({
      requestedSection: 'automation', defaultSection: 'maintenance', authorization: admin,
    }).activeSection).toBe('maintenance');
  });

  it('fails closed for real forbidden Services sections', () => {
    const state = resolveOperationsHubState({
      requestedSection: 'maintenance', defaultSection: 'maintenance', authorization: user,
    });
    expect(state.activeSection).toBeNull();
    expect(state.isRequestedSectionForbidden).toBe(true);
  });

  it('falls back to the first permitted service when the default is forbidden', () => {
    expect(resolveOperationsHubState({
      requestedSection: undefined, defaultSection: 'maintenance', authorization: user,
    }).activeSection).toBe('utilities');
  });
});

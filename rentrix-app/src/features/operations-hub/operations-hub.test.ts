import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getAccessibleOperationsHubSections,
  getVisibleOperationsHubSections,
  operationsHubSections,
  type OperationsHubPermission,
} from './operations-hub.sections';
import {
  getAccessibleOperationsSections,
  getVisibleOperationsSections,
  isOperationsHubSectionId,
  resolveOperationsHubState,
} from './operations-hub-model';
import type { AuthorizationContext } from '@/features/auth/permissions';

const routeTree = readFileSync(resolve(import.meta.dirname, '../../app/router/route-tree.ts'), 'utf8');
const admin: AuthorizationContext = { userId: 'admin', email: null, role: 'ADMIN' };
const user: AuthorizationContext = { userId: 'user', email: null, role: 'USER' };

describe('Services workspace contract', () => {
  it('owns four capabilities but advertises only maintenance and utilities', () => {
    expect(operationsHubSections.map((section) => [section.id, section.showInPrimaryNavigation])).toEqual([
      ['maintenance', true],
      ['service_providers', false],
      ['utilities', true],
      ['documents_vault', false],
    ]);
    expect(new Set(operationsHubSections.map((section) => section.id)).size).toBe(4);
    expect(isOperationsHubSectionId('automation')).toBe(false);
  });

  it('keeps hidden capabilities accessible while routine tabs stay focused', () => {
    expect(getAccessibleOperationsHubSections(() => false).map((section) => section.id)).toEqual([
      'utilities', 'documents_vault',
    ]);
    expect(getVisibleOperationsHubSections(() => false).map((section) => section.id)).toEqual(['utilities']);

    const granted = new Set<OperationsHubPermission>(['maintenance.view', 'service_providers.view']);
    expect(getAccessibleOperationsHubSections((permission) => granted.has(permission)).map((section) => section.id)).toEqual([
      'maintenance', 'service_providers', 'utilities', 'documents_vault',
    ]);
    expect(getVisibleOperationsHubSections((permission) => granted.has(permission)).map((section) => section.id)).toEqual([
      'maintenance', 'utilities',
    ]);
  });

  it('preserves state in one Services composition layer', () => {
    const component = readFileSync(resolve(import.meta.dirname, './operations-hub-workspace.tsx'), 'utf8');
    expect(component).toContain("title ?? activeSectionDefinition.label");
    expect(component).toContain('mountedSections');
    expect(component).toContain("to: '/maintenance'");
    expect(component).not.toContain('AutomationWorkspace');
  });

  it('keeps retired compatibility URL aliases out of the route tree entirely', () => {
    for (const path of ['/utilities', '/documents-vault', '/automation']) {
      expect(routeTree, `retired ${path} must not be registered`).not.toContain(`path: '${path}'`);
    }
    // The hub keeps the search-param deep links that used to be URLs.
    expect(routeTree).toContain("path: '/maintenance'");
  });
});

describe('Services permission and deep-link model', () => {
  it('keeps all four Services capabilities accessible for ADMIN but only two visible as tabs', () => {
    expect(getAccessibleOperationsSections(admin).map((section) => section.id)).toEqual([
      'maintenance', 'service_providers', 'utilities', 'documents_vault',
    ]);
    expect(getVisibleOperationsSections(admin).map((section) => section.id)).toEqual([
      'maintenance', 'utilities',
    ]);
  });

  it('opens hidden valid deep links and rejects removed Automation as a Services section', () => {
    const documents = resolveOperationsHubState({
      requestedSection: 'documents_vault', defaultSection: 'maintenance', authorization: admin,
    });
    expect(documents.activeSection).toBe('documents_vault');
    expect(documents.visibleSections.map((section) => section.id)).toEqual(['maintenance', 'utilities']);

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

  it('falls back to the first visible service when the default is forbidden', () => {
    expect(resolveOperationsHubState({
      requestedSection: undefined, defaultSection: 'maintenance', authorization: user,
    }).activeSection).toBe('utilities');
  });
});

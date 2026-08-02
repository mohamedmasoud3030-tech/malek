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
  resolveOperationsHubState,
} from './operations-hub-model';
import type { AuthorizationContext } from '@/features/auth/permissions';

describe('operations hub contract', () => {
  it('maps every operational workspace once in the intended order', () => {
    expect(operationsHubSections.map((section) => section.id)).toEqual([
      'maintenance',
      'utilities',
      'automation',
      'documents_vault',
    ]);
    expect(new Set(operationsHubSections.map((section) => section.id)).size).toBe(
      operationsHubSections.length,
    );
  });

  it('keeps authenticated-only tabs while filtering permission-gated tabs', () => {
    const denied = getVisibleOperationsHubSections(() => false);
    expect(denied.map((section) => section.id)).toEqual(['utilities', 'documents_vault']);

    const granted = new Set<OperationsHubPermission>(['maintenance.view']);
    const visible = getVisibleOperationsHubSections((permission) => granted.has(permission));
    expect(visible.map((section) => section.id)).toEqual([
      'maintenance',
      'utilities',
      'documents_vault',
    ]);
  });

  it('uses the shared auth hook seam and preserves visited workspace state', () => {
    const component = readFileSync(
      resolve(import.meta.dirname, './operations-hub-workspace.tsx'),
      'utf8',
    );
    const sections = readFileSync(
      resolve(import.meta.dirname, './operations-hub.sections.ts'),
      'utf8',
    );

    expect(component).toContain("import { useAuth } from '@/hooks/use-auth'");
    expect(component).toContain('resolveOperationsHubState');
    expect(component).toContain('mountedSections');
    expect(component).toContain("mode=\"embedded\"");
    expect(component).not.toContain('key={activeSection}');
    expect(sections).not.toContain('@/features/auth/');
  });
});

describe('operations hub model', () => {
  const admin: AuthorizationContext = {
    userId: 'u-admin',
    email: 'admin@example.com',
    role: 'ADMIN',
  };
  const user: AuthorizationContext = {
    userId: 'u-user',
    email: 'user@example.com',
    role: 'USER',
  };

  it('returns all sections for ADMIN', () => {
    expect(getVisibleOperationsSections(admin).map((s) => s.id)).toEqual([
      'maintenance',
      'utilities',
      'automation',
      'documents_vault',
    ]);
  });

  it('honours deep-link section when permitted', () => {
    const state = resolveOperationsHubState({
      requestedSection: 'automation',
      defaultSection: 'maintenance',
      authorization: admin,
    });
    expect(state.activeSection).toBe('automation');
    expect(state.isRequestedSectionForbidden).toBe(false);
  });

  it('flags forbidden deep links without falling back silently', () => {
    const state = resolveOperationsHubState({
      requestedSection: 'automation',
      defaultSection: 'maintenance',
      authorization: user,
    });
    expect(state.activeSection).toBeNull();
    expect(state.isRequestedSectionForbidden).toBe(true);
  });

  it('degrades to first permitted section when default is forbidden', () => {
    const state = resolveOperationsHubState({
      requestedSection: undefined,
      defaultSection: 'maintenance',
      authorization: user,
    });
    expect(state.activeSection).toBe('utilities');
  });
});

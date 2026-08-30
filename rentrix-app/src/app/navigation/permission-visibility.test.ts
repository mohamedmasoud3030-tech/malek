import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAllNavItems, navGroups, quickCreateItems, workspaceChildNavItems } from './app-nav-items';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');
const protectedLayoutSource = readFileSync(new URL('../../routes/_protected.tsx', import.meta.url), 'utf8');

function routeHasPermission(path: string, perm: string): boolean {
  const token = `path: '${path}'`;
  const idx = routeTreeSource.indexOf(token);
  if (idx === -1) return false;
  const start = routeTreeSource.lastIndexOf('createRoute({', idx);
  const end = routeTreeSource.indexOf('});', idx);
  const block = routeTreeSource.slice(start, end + 3);
  if (block.includes(`'${perm}'`)) return true;
  // Workspace roots (e.g. /properties) are guarded at the protected-layout
  // level via workspacePermissionForPath; a route-level guard is not required.
  return layoutGuardCoversPath(path, perm);
}

function routeBlock(path: string): string {
  const token = `path: '${path}'`;
  const idx = routeTreeSource.indexOf(token);
  return routeTreeSource.slice(routeTreeSource.lastIndexOf('createRoute({', idx), routeTreeSource.indexOf('});', idx) + 3);
}

function layoutGuardCoversPath(path: string, perm: string): boolean {
  const token = `pathname === '${path}'`;
  const idx = protectedLayoutSource.indexOf(token);
  if (idx === -1) return false;
  const end = protectedLayoutSource.indexOf('return', idx);
  return protectedLayoutSource.slice(idx, end).includes(`'${perm}'`) || (
    protectedLayoutSource.slice(end, protectedLayoutSource.indexOf(';', end)).includes(`'${perm}'`)
  );
}

describe('permission visibility — task-centric IA must not widen access', () => {
  it('every nav item with a permission has that permission on its route guard', () => {
    for (const [to, , , , perm, search] of getAllNavItems()) {
      if (!perm || search) continue;
      expect(routeHasPermission(to, perm), `nav ${to} requires ${perm} but route guard missing`).toBe(true);
    }
    // Quick-create deep links without search params are route-guarded; the
    // search-carrying items are handled by the destination workspace itself.
    for (const [to, , , perm, search] of quickCreateItems) {
      if (!perm || search) continue;
      expect(routeHasPermission(to, perm), `quick-create ${to} requires ${perm} but route guard missing`).toBe(true);
    }
  });

  it('permission-less tenant navigation remains auth-only', () => {
    const token = `path: '/tenants'`;
    const idx = routeTreeSource.indexOf(token);
    const block = routeTreeSource.slice(routeTreeSource.lastIndexOf('createRoute({', idx), routeTreeSource.indexOf('});', idx) + 3);
    expect(block).not.toMatch(/requirePermission\(/);
  });

  it('owners hub and detail both remain permission-gated', () => {
    expect(routeHasPermission('/owners', 'owners.hub.view')).toBe(true);
    expect(routeHasPermission('/owners/$ownerId', 'owners.detail.view')).toBe(true);
  });

  it('secondary portfolio/leasing/service capabilities keep their existing guards', () => {
    expect(routeHasPermission('/lands', 'lands.view')).toBe(true);
    expect(routeHasPermission('/leads', 'leads.view')).toBe(true);
    expect(routeHasPermission('/communication', 'communication.view')).toBe(true);
    expect(routeHasPermission('/service-providers', 'service_providers.view')).toBe(true);
    expect(routeHasPermission('/service-providers/new', 'service_providers.write')).toBe(true);
    expect(routeHasPermission('/service-providers/$providerId', 'service_providers.view')).toBe(true);
    expect(routeHasPermission('/service-providers/$providerId/edit', 'service_providers.write')).toBe(true);
  });

  it('Money children keep their financial permissions', () => {
    expect(routeHasPermission('/commissions', 'commissions.view')).toBe(true);
    expect(routeHasPermission('/expenses', 'expenses.view')).toBe(true);
    expect(routeHasPermission('/arrears', 'arrears.view')).toBe(true);
    expect(routeHasPermission('/deposits', 'financial.deposits.view')).toBe(true);
    expect(routeHasPermission('/owner-settlements', 'financial.owner_settlements.view')).toBe(true);
    expect(routeHasPermission('/bank-reconciliation', 'financial.bank_reconciliation.view')).toBe(true);
  });

  it('settings children keep their governed permissions', () => {
    expect(routeHasPermission('/settings', 'settings.manage')).toBe(false);
    expect(routeHasPermission('/audit-log', 'audit.view')).toBe(true);
    expect(routeHasPermission('/data-integrity', 'integrity.view')).toBe(true);
    expect(routeHasPermission('/system', 'system.view')).toBe(true);
    expect(routeHasPermission('/change-password', 'auth.password.change')).toBe(true);
  });

  it('does not invent a people.view permission', () => {
    expect(routeHasPermission('/people', 'people.view')).toBe(false);
    expect(routeTreeSource).not.toContain("requirePermission('people.view')");
    // Creating/editing a person stays aligned with the leasing workspace
    // (people are contract counterparties), never with a dedicated people perm.
    const newBlock = routeBlock('/people/new');
    expect(newBlock).toContain("requirePermission('contracts.create')");
    const editBlock = routeBlock('/people/$personId/edit');
    expect(editBlock).toContain("requirePermission('contracts.edit')");
  });

  it('does not use adminOnly groups to bypass item permissions', () => {
    expect(navGroups.filter(([, , adminOnly]) => adminOnly)).toHaveLength(0);
  });

  it('pins progressive-disclosure workspace membership', () => {
    expect(workspaceChildNavItems['/properties'].length).toBe(2);
    expect(workspaceChildNavItems['/contracts'].length).toBe(1);
    expect(workspaceChildNavItems['/financials'].length).toBe(3);
    expect(workspaceChildNavItems['/maintenance'].length).toBe(2);
    expect(workspaceChildNavItems['/reports'].length).toBe(0);
    expect(workspaceChildNavItems['/settings'].length).toBe(2);
    expect(workspaceChildNavItems['/people']).toBeUndefined();
    expect(workspaceChildNavItems['/lands']).toBeUndefined();
    expect(workspaceChildNavItems['/commissions']).toBeUndefined();
  });
});

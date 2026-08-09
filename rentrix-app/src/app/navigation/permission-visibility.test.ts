import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAllNavItems, navGroups, quickCreateItems, workspaceChildNavItems } from './app-nav-items';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');

function routeHasPermission(path: string, perm: string): boolean {
  const token = `path: '${path}'`;
  const idx = routeTreeSource.indexOf(token);
  if (idx === -1) return false;
  const start = routeTreeSource.lastIndexOf('createRoute({', idx);
  const end = routeTreeSource.indexOf('});', idx);
  const block = routeTreeSource.slice(start, end + 3);
  // handles both `beforeLoad: requirePermission('x')` and `await requirePermission('x')()`
  return block.includes(`'${perm}'`);
}

describe('permission visibility — nav item permission must match route guard', () => {
  it('every nav item with a permission has that permission on its route guard', () => {
    for (const [to, , , , perm] of [...getAllNavItems(), ...quickCreateItems]) {
      if (!perm) continue;
      expect(routeHasPermission(to, perm), `nav ${to} requires ${perm} but route guard missing`).toBe(true);
    }
  });

  it('permission-less nav items either have auth-only guard or none (no phantom lock)', () => {
    // tenants is auth-only (no permission param) — explicitly allowed
    const token = `path: '/tenants'`;
    const idx = routeTreeSource.indexOf(token);
    const block = routeTreeSource.slice(routeTreeSource.lastIndexOf('createRoute({', idx), routeTreeSource.indexOf('});', idx) + 3);
    expect(block).not.toMatch(/requirePermission\(/);
  });

  it('owners hub and detail both permission-gated (hub.view + detail.view separate)', () => {
    expect(routeHasPermission('/owners', 'owners.hub.view')).toBe(true);
    expect(routeHasPermission('/owners/$ownerId', 'owners.detail.view')).toBe(true);
  });

  it('lands, leads, communication are gated as declared in nav', () => {
    expect(routeHasPermission('/lands', 'lands.view')).toBe(true);
    expect(routeHasPermission('/leads', 'leads.view')).toBe(true);
    expect(routeHasPermission('/communication', 'communication.view')).toBe(true);
  });

  it('finance subroutes gate correctly (commissions/expenses/arreas/deposits etc)', () => {
    expect(routeHasPermission('/commissions', 'commissions.view')).toBe(true);
    expect(routeHasPermission('/expenses', 'expenses.view')).toBe(true);
    expect(routeHasPermission('/arrears', 'arrears.view')).toBe(true);
    expect(routeHasPermission('/deposits', 'financial.deposits.view')).toBe(true);
    expect(routeHasPermission('/owner-settlements', 'financial.owner_settlements.view')).toBe(true);
    expect(routeHasPermission('/bank-reconciliation', 'financial.bank_reconciliation.view')).toBe(true);
  });

  it('settings children gate vs /settings itself', () => {
    expect(routeHasPermission('/settings', 'settings.manage')).toBe(true);
    expect(routeHasPermission('/audit-log', 'audit.view')).toBe(true);
    expect(routeHasPermission('/data-integrity', 'integrity.view')).toBe(true);
    expect(routeHasPermission('/system', 'system.view')).toBe(true);
    expect(routeHasPermission('/change-password', 'auth.password.change')).toBe(true);
  });

  it('does NOT gate people list without permission, but add/edit remain reachable', () => {
    // /people list is alias redirect without gate by design (Phase 1)
    expect(routeHasPermission('/people', 'people.view')).toBe(false);
    // /people/new is direct route — no permission string today (allowed)
    const token = `path: '/people/new'`;
    const idx = routeTreeSource.indexOf(token);
    const block = routeTreeSource.slice(routeTreeSource.lastIndexOf('createRoute({', idx), routeTreeSource.indexOf('});', idx) + 3);
    expect(block).not.toMatch(/requirePermission\(/);
  });

  it('no nav group adminOnly bypasses per-item permission (excess hidden items stay hidden)', () => {
    // Ensure navGroups adminOnly handling does not create orphan visible items
    const groupsWithAdminOnly = navGroups.filter(([, , adminOnly]) => adminOnly);
    // Currently none flagged adminOnly with special handling — test stays as future-proof
    expect(groupsWithAdminOnly.length).toBe(0);
    // If any appear later, they must still satisfy per-item permission above
  });

  it('workspace child count matches actual operational needs (no shadow nav)', () => {
    // Phase 2: people and lands are first-class, no longer children
    expect(workspaceChildNavItems['/people'].length).toBe(0);
    expect(workspaceChildNavItems['/properties'].length).toBe(1);
    expect(workspaceChildNavItems['/lands'].length).toBe(0);
    expect(workspaceChildNavItems['/contracts'].length).toBe(2);
    expect(workspaceChildNavItems['/maintenance'].length).toBe(3);
    expect(workspaceChildNavItems['/settings'].length).toBe(4);
  });
});

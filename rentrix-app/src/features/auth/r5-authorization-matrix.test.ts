/**
 * R5 — Permissions & Effective Authorization: the full role × capability matrix.
 *
 * The R5 model separates view/action capabilities (resource.view vs
 * resource.export/approve/pay/…) and locks an explicit allow/deny matrix for
 * every sensitive financial action across all six roles:
 *   ADMIN / MANAGER / ACCOUNTANT / OPERATIONS / USER / VIEWER.
 *
 * Every cell below is an intentional business decision. Changing a cell means
 * changing the authorization contract — do it deliberately, never as a side
 * effect. Navigation, routes, UI affordances and route guards consume the
 * same vocabulary (canAccess), so this matrix IS the effective authorization.
 */
import { describe, expect, it } from 'vitest';
import {
  appPermissions,
  authorizationRoles,
  canAccess,
  financialOperationPermissions,
  getPermissionLabel,
  type AppPermission,
  type AuthorizationContext,
  type AuthorizationRole,
} from './permissions';

function contextFor(role: AuthorizationRole): AuthorizationContext {
  return { userId: `user-${role}`, email: `${role.toLowerCase()}@malek.test`, role };
}

type MatrixRow = { permission: AppPermission } & Record<AuthorizationRole, boolean>;

/** The LOCKED financial authorization matrix (R5 exit gate). */
const financialMatrix: MatrixRow[] = [
  // View capabilities — reading is separated from acting.
  { permission: 'financial.reports.view',               ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATIONS: false, USER: false, VIEWER: true },
  { permission: 'expenses.view',                        ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATIONS: true,  USER: false, VIEWER: true },
  { permission: 'arrears.view',                         ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATIONS: true,  USER: false, VIEWER: true },
  { permission: 'financial.deposits.view',              ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATIONS: false, USER: false, VIEWER: true },
  { permission: 'financial.bank_reconciliation.view',   ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATIONS: false, USER: false, VIEWER: true },
  { permission: 'financial.owner_settlements.view',     ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATIONS: false, USER: false, VIEWER: true },
  { permission: 'financial.fixed_monthly_accruals.view', ADMIN: true, MANAGER: false, ACCOUNTANT: true, OPERATIONS: false, USER: false, VIEWER: false },

  // Action capabilities — every sensitive financial mutation.
  // Governance V1: MANAGER is an operational office manager and is denied
  // sensitive financial control. ACCOUNTANT holds the accounting mutations.
  { permission: 'financial.invoices.generate',          ADMIN: true, MANAGER: false, ACCOUNTANT: true, OPERATIONS: false, USER: false, VIEWER: false },
  { permission: 'financial.invoices.export',            ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATIONS: false, USER: false, VIEWER: false },
  { permission: 'financial.payments.create',            ADMIN: true, MANAGER: false, ACCOUNTANT: true, OPERATIONS: false, USER: false, VIEWER: false },
  { permission: 'financial.receipts.void',              ADMIN: true, MANAGER: false, ACCOUNTANT: false, OPERATIONS: false, USER: false, VIEWER: false },
  { permission: 'financial.reports.export',             ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATIONS: false, USER: false, VIEWER: false },
  { permission: 'financial.bank_reconciliation.match',  ADMIN: true, MANAGER: false, ACCOUNTANT: true, OPERATIONS: false, USER: false, VIEWER: false },
  { permission: 'financial.owner_settlements.approve',  ADMIN: true, MANAGER: false, ACCOUNTANT: false, OPERATIONS: false, USER: false, VIEWER: false },
  { permission: 'financial.owner_settlements.pay',      ADMIN: true, MANAGER: false, ACCOUNTANT: false, OPERATIONS: false, USER: false, VIEWER: false },
  { permission: 'financial.fixed_monthly_accruals.execute', ADMIN: true, MANAGER: false, ACCOUNTANT: true, OPERATIONS: false, USER: false, VIEWER: false },
  { permission: 'financial.fixed_monthly_accruals.reverse', ADMIN: true, MANAGER: false, ACCOUNTANT: true, OPERATIONS: false, USER: false, VIEWER: false },
  { permission: 'expenses.write',                       ADMIN: true, MANAGER: true, ACCOUNTANT: false, OPERATIONS: false, USER: false, VIEWER: false },
  { permission: 'contracts.write',                      ADMIN: true, MANAGER: true, ACCOUNTANT: false, OPERATIONS: false, USER: false, VIEWER: false },
];

describe('R5 — locked financial authorization matrix (allow AND deny)', () => {
  for (const row of financialMatrix) {
    for (const role of authorizationRoles) {
      const expected = row[role];
      it(`${role} ${expected ? 'CAN' : 'CANNOT'} ${row.permission}`, () => {
        expect(canAccess(contextFor(role), row.permission)).toBe(expected);
      });
    }
  }
});

describe('R5 — view/action separation invariants', () => {
  it('viewing reports never implies exporting them (VIEWER proves the split)', () => {
    const viewer = contextFor('VIEWER');
    expect(canAccess(viewer, 'financial.reports.view')).toBe(true);
    expect(canAccess(viewer, 'financial.reports.export')).toBe(false);
  });

  it('the reports view capability exists as its own catalog entry with a label', () => {
    expect(appPermissions).toContain('financial.reports.view');
    expect(getPermissionLabel('financial.reports.view')).toBe('عرض التقارير المالية');
    expect(financialOperationPermissions.viewReports).toBe('financial.reports.view');
    expect(financialOperationPermissions.exportReports).toBe('financial.reports.export');
  });

  it('settlement approve/pay stay ADMIN-only (maker/checker escalation path)', () => {
    for (const role of authorizationRoles) {
      const can = canAccess(contextFor(role), 'financial.owner_settlements.approve');
      expect(can).toBe(role === 'ADMIN');
    }
  });

  it('null/absent context is denied everything (fail closed)', () => {
    for (const row of financialMatrix) {
      expect(canAccess(null, row.permission)).toBe(false);
      expect(canAccess(undefined, row.permission)).toBe(false);
    }
  });

  it('an explicit per-user grant extends a role without mutating the bundle', () => {
    const user: AuthorizationContext = {
      userId: 'user-granted',
      email: 'granted@malek.test',
      role: 'USER',
      grantedPermissions: ['financial.reports.view'],
    };
    expect(canAccess(user, 'financial.reports.view')).toBe(true);
    // The USER bundle itself stays untouched.
    expect(canAccess(contextFor('USER'), 'financial.reports.view')).toBe(false);
  });
});

describe('R5 — route/navigation vocabulary alignment', () => {
  it('the /reports route and nav item gate on VIEW, export stays an action', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const routeTree = readFileSync(resolve(process.cwd(), 'src/app/router/route-tree.ts'), 'utf8');
    const navItems = readFileSync(resolve(process.cwd(), 'src/app/navigation/app-nav-items.ts'), 'utf8');
    const reportsPage = readFileSync(resolve(process.cwd(), 'src/features/reports/reports-page.tsx'), 'utf8');

    expect(routeTree).toContain("requirePermission('financial.reports.view')");
    expect(routeTree).not.toContain("requirePermission('financial.reports.export')");
    expect(navItems).toContain("'financial.reports.view'");
    // The page distinguishes the two capabilities.
    expect(reportsPage).toContain('financialOperationPermissions.viewReports');
    expect(reportsPage).toContain('financialOperationPermissions.exportReports');
  });
});

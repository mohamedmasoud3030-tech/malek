/**
 * P0-1 Permission authority parity — source-level regression lock.
 *
 * `public.app_permission_catalog` is the single permission authority. The
 * effective resolver fails closed for any code that is absent from it, for
 * every role including ADMIN, so a code that exists only in the frontend model
 * or only in `supabase/seed.sql` is an unreachable capability in production.
 *
 * This suite derives the authoritative catalog from the forward migration chain
 * alone (never from seed.sql) and locks:
 *   1. migration-backed catalog === frontend `appPermissions` (exact, sorted);
 *   2. seed.sql declares no permission authority at all;
 *   3. every route guard permission is catalog-backed;
 *   4. every navigation gate permission is catalog-backed and resolves through
 *      the same `canAccess` authority as the route guard;
 *   5. the server six-role matrix never references a code the catalog lacks, so
 *      non-admin roles cannot silently lose a role-default capability;
 *   6. no unintended widening: admin_only/requestable flags, the owner-assignable
 *      set and the compatibility-parent exclusions are pinned;
 *   7. the retired legacy alias `settings.manage` stays gone.
 *
 * Runtime proof (fail-closed unknown codes, effective projection, migration-only
 * database replay) lives in `permission-catalog-authority.pglite.test.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAllNavItems, navGroups, quickCreateItems, workspaceChildNavItems } from '@/app/navigation/app-nav-items';
import { ROUTE_CONTRACT } from '@/app/navigation/route-contract';
import { appPermissions, canAccess, canAccessRoute, canShowNavigationItem, type AppPermission } from './permissions';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const migrationsDir = resolve(repoRoot, 'supabase/migrations');

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function migrationFiles(): string[] {
  return readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
}

type CatalogRow = { labelAr: string; adminOnly: boolean; requestable: boolean };

const CATALOG_INSERT = /insert\s+into\s+public\.app_permission_catalog[\s\S]*?;/gi;
const CATALOG_ROW = /\(\s*'([a-z0-9_.]+)'\s*,\s*'([^']*)'\s*,\s*(true|false)\s*,\s*(true|false)\s*\)/g;
const CATALOG_NON_REQUESTABLE =
  /update\s+public\.app_permission_catalog\s+set\s+requestable\s*=\s*false\s+where\s+permission\s+in\s*\(([^)]*)\)/gi;

/**
 * Replays the catalog writes of the migration chain in file order and returns
 * the resulting authoritative rows. Deterministic: same files, same result.
 */
function migrationBackedCatalog(): Map<string, CatalogRow> {
  const catalog = new Map<string, CatalogRow>();
  for (const file of migrationFiles()) {
    const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
    for (const statement of sql.matchAll(CATALOG_INSERT)) {
      for (const row of statement[0].matchAll(CATALOG_ROW)) {
        catalog.set(row[1], { labelAr: row[2], adminOnly: row[3] === 'true', requestable: row[4] === 'true' });
      }
    }
    for (const statement of sql.matchAll(CATALOG_NON_REQUESTABLE)) {
      for (const permission of statement[1].matchAll(/'([a-z0-9_.]+)'/g)) {
        const existing = catalog.get(permission[1]);
        if (existing) catalog.set(permission[1], { ...existing, requestable: false });
      }
    }
  }
  return catalog;
}

const catalog = migrationBackedCatalog();
const catalogCodes = [...catalog.keys()].sort();
const frontendCodes = [...appPermissions].sort();

/** The last forward migration that defines the six-role compatibility matrix. */
function serverRoleMatrix(): Map<string, Set<string>> {
  let definition = '';
  for (const file of migrationFiles()) {
    const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
    const index = sql.lastIndexOf('function public.role_has_app_permission');
    if (index >= 0) definition = sql.slice(index);
  }
  expect(definition, 'role_has_app_permission must be defined by the migration chain').not.toBe('');
  const matrix = new Map<string, Set<string>>();
  for (const role of ['MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER'] as const) {
    const roleIndex = definition.indexOf(`when '${role}' then`);
    expect(roleIndex, `${role} branch must exist`).toBeGreaterThan(-1);
    const branch = definition.slice(roleIndex, definition.indexOf(']::text[])', roleIndex));
    matrix.set(role, new Set([...branch.matchAll(/'([a-z0-9_.]+)'/g)].map((match) => match[1])));
  }
  return matrix;
}

const roleMatrix = serverRoleMatrix();

/** Permissions the owner-facing employee editor offers (UserRolesWorkspace). */
const protectedLayoutSource = read('rentrix-app/src/routes/_protected.tsx');

type LayoutWorkspaceRule = { exact: string[]; prefixes: string[]; permission: string };

/**
 * Workspace roots and their children are permission-gated in the protected
 * layout (`workspacePermissionForPath`) instead of the route tree. Derive those
 * rules so a contract permission can be proven gated at either level.
 */
function layoutWorkspaceRules(): LayoutWorkspaceRule[] {
  const start = protectedLayoutSource.indexOf('function workspacePermissionForPath');
  const end = protectedLayoutSource.indexOf('export function ProtectedRouteComponent');
  expect(start, 'workspacePermissionForPath must exist').toBeGreaterThan(-1);
  const block = protectedLayoutSource.slice(start, end);
  const returns = [...block.matchAll(/return '([a-z0-9_.]+)';/g)];
  return returns.map((match, index) => {
    const from = index === 0 ? 0 : (returns[index - 1].index ?? 0) + returns[index - 1][0].length;
    const condition = block.slice(from, match.index ?? 0);
    return {
      exact: [...condition.matchAll(/pathname === '([^']+)'/g)].map((entry) => entry[1]),
      prefixes: [...condition.matchAll(/pathname\.startsWith\('([^']+)'\)/g)].map((entry) => entry[1]),
      permission: match[1],
    };
  });
}

function layoutGuardCoversPath(pathname: string, permission: string): boolean {
  return layoutWorkspaceRules().some(
    (rule) =>
      rule.permission === permission
      && (rule.exact.includes(pathname) || rule.prefixes.some((prefix) => pathname.startsWith(prefix))),
  );
}

function ownerEditorPermissions(): string[] {
  const source = read('rentrix-app/src/features/governance-hub/components/UserRolesWorkspace.tsx');
  const block = source.slice(source.indexOf('employeeCapabilityGroups'), source.indexOf('] as const;'));
  return [...block.matchAll(/'([a-z0-9_.]+)'/g)].map((match) => match[1]);
}

describe('P0-1 permission authority parity — migration-backed catalog', () => {
  it('derives a deterministic catalog from the forward migrations alone', () => {
    expect(migrationFiles().length).toBeGreaterThan(0);
    // Re-deriving must be stable: same chain, same codes, same flags.
    const second = migrationBackedCatalog();
    expect([...second.keys()].sort()).toEqual(catalogCodes);
    for (const code of catalogCodes) {
      expect(second.get(code), code).toEqual(catalog.get(code));
    }
  });

  it('matches the frontend AppPermission vocabulary exactly', () => {
    expect(catalogCodes).toEqual(frontendCodes);
    expect(catalogCodes.length).toBe(appPermissions.length);
  });

  it('has no frontend code that only seed.sql or the role map declares', () => {
    const catalogBacked = new Set(catalogCodes);
    expect(appPermissions.filter((permission) => !catalogBacked.has(permission))).toEqual([]);
  });
});

describe('P0-1 permission authority parity — seed.sql is not an authority', () => {
  it('declares no app_permission_catalog rows at all', () => {
    const seed = read('supabase/seed.sql');
    expect(seed).not.toMatch(/insert\s+into\s+public\.app_permission_catalog/i);
    expect(seed).not.toMatch(/update\s+public\.app_permission_catalog/i);
  });

  it('cannot define a permission absent from the migrations', () => {
    // Defensive lock: if a permission literal is ever reintroduced into the
    // reference seed it must already be migration-backed.
    const seed = read('supabase/seed.sql');
    const seeded = [...seed.matchAll(/\(\s*'([a-z0-9_.]+\.[a-z0-9_.]+)'\s*,\s*'[^']*'\s*,\s*(?:true|false)\s*,\s*(?:true|false)\s*\)/g)]
      .map((match) => match[1]);
    const catalogBacked = new Set(catalogCodes);
    expect(seeded.filter((permission) => !catalogBacked.has(permission))).toEqual([]);
  });
});

describe('P0-1 permission authority parity — route guards and navigation', () => {
  it('every route guard references an intentional catalog-backed permission', () => {
    const routeTree = read('rentrix-app/src/app/router/route-tree.ts');
    const guarded = [...routeTree.matchAll(/requirePermission\(\s*'([a-z0-9_.]+)'\s*\)/g)].map((match) => match[1]);
    expect(guarded.length).toBeGreaterThan(0);
    const catalogBacked = new Set(catalogCodes);
    for (const permission of guarded) {
      expect(appPermissions as readonly string[], `route guard ${permission}`).toContain(permission);
      expect(catalogBacked.has(permission), `route guard ${permission} must be catalog-backed`).toBe(true);
    }
  });

  it('every navigation gate references the same catalog-backed authority', () => {
    const catalogBacked = new Set(catalogCodes);
    const navPermissions: string[] = [];
    for (const [, items] of navGroups) {
      for (const item of items) if (item[4]) navPermissions.push(item[4]);
    }
    for (const items of Object.values(workspaceChildNavItems)) {
      for (const item of items) if (item[4]) navPermissions.push(item[4]);
    }
    for (const item of quickCreateItems) if (item[3]) navPermissions.push(item[3]);
    for (const entry of getAllNavItems()) if (entry[4]) navPermissions.push(entry[4]);
    for (const route of ROUTE_CONTRACT) if (route.permission) navPermissions.push(route.permission);

    expect(navPermissions.length).toBeGreaterThan(0);
    for (const permission of navPermissions) {
      expect(appPermissions as readonly string[], `nav ${permission}`).toContain(permission);
      expect(catalogBacked.has(permission), `nav ${permission} must be catalog-backed`).toBe(true);
    }
  });

  it('resolves navigation visibility and route access through one authority', () => {
    // Both gates must delegate to canAccess; a second resolver would let the
    // sidebar and the route guard disagree about the same catalog.
    const source = read('rentrix-app/src/features/auth/permissions.ts');
    expect(source).toContain(
      'export function canShowNavigationItem(context: AuthorizationContext | null | undefined, permission: AppPermission | null | undefined): boolean {\n  return permission ? canAccess(context, permission) : true;',
    );
    expect(source).toContain(
      'export function canAccessRoute(context: AuthorizationContext | null | undefined, permission: AppPermission | null | undefined): boolean {\n  return permission ? canAccess(context, permission) : Boolean(context);',
    );

    // And every nav permission that the route contract declares must be gated
    // by the identical code, so a visible item is never an unreachable route.
    // Workspace roots are gated in the protected layout instead of the route
    // tree; both gates must resolve through the same catalog-backed code.
    const routeTree = read('rentrix-app/src/app/router/route-tree.ts');
    for (const route of ROUTE_CONTRACT) {
      if (!route.permission) continue;
      const token = `path: '${route.canonical}'`;
      if (!routeTree.includes(token)) continue;
      const index = routeTree.indexOf(token);
      const block = routeTree.slice(routeTree.lastIndexOf('createRoute({', index), routeTree.indexOf('});', index));
      expect(
        block.includes(`requirePermission('${route.permission}')`) || layoutGuardCoversPath(route.canonical, route.permission),
        `${route.canonical} must be gated by ${route.permission} at route or layout level`,
      ).toBe(true);
    }
  });

  it('gates the protected layout workspaces with catalog-backed permissions', () => {
    const catalogBacked = new Set(catalogCodes);
    const rules = layoutWorkspaceRules();
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.exact.length + rule.prefixes.length, rule.permission).toBeGreaterThan(0);
    }
    const layoutPermissions = rules.map((rule) => rule.permission);
    expect(layoutPermissions.length).toBeGreaterThan(0);
    for (const permission of layoutPermissions) {
      expect(appPermissions as readonly string[], `layout ${permission}`).toContain(permission);
      expect(catalogBacked.has(permission), `layout ${permission} must be catalog-backed`).toBe(true);
    }
  });
});

describe('P0-1 permission authority parity — no silent non-admin capability loss', () => {
  it('every six-role matrix code exists in the migration-backed catalog', () => {
    const catalogBacked = new Set(catalogCodes);
    for (const [role, codes] of roleMatrix) {
      const missing = [...codes].filter((permission) => !catalogBacked.has(permission));
      expect(missing, `${role} matrix codes absent from the catalog would fail closed`).toEqual([]);
    }
  });

  it('every frontend compatibility role map code is catalog-backed and server-declared', () => {
    const catalogBacked = new Set(catalogCodes);
    const source = read('rentrix-app/src/features/auth/permissions.ts');
    const block = source.slice(source.indexOf('const rolePermissions = {'), source.indexOf('} satisfies'));
    for (const role of ['MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER'] as const) {
      const roleIndex = block.indexOf(`  ${role}: new Set<AppPermission>([`);
      expect(roleIndex, `${role} compatibility map`).toBeGreaterThan(-1);
      const segment = block.slice(roleIndex, block.indexOf(']),', roleIndex));
      const clientCodes = [...segment.matchAll(/'([a-z0-9_.]+)'/g)].map((match) => match[1]);
      expect(clientCodes.length, role).toBeGreaterThan(0);
      const serverCodes = roleMatrix.get(role) ?? new Set<string>();
      for (const permission of clientCodes) {
        expect(catalogBacked.has(permission), `${role}/${permission} must be catalog-backed`).toBe(true);
        // The client compatibility fallback must never claim a capability the
        // server role matrix does not declare.
        expect(serverCodes.has(permission), `${role}/${permission} is not server-declared`).toBe(true);
      }
    }
  });

  it('keeps ADMIN authority equal to the catalog — no more, no less', () => {
    // ADMIN resolves through `exists(select 1 from app_permission_catalog)`, so
    // the client ADMIN bundle must be exactly the catalog. Anything extra would
    // be a client-only illusion; anything missing would hide a real capability.
    expect(frontendCodes).toEqual(catalogCodes);
    const owner = { userId: 'owner-1', email: 'owner@malek.test', role: 'ADMIN' } as const;
    for (const permission of appPermissions) {
      expect(canAccess(owner, permission), permission).toBe(true);
    }
  });
});

describe('P0-1 permission authority parity — no unintended widening', () => {
  it('pins the admin-only capability set', () => {
    const adminOnly = catalogCodes.filter((permission) => catalog.get(permission)?.adminOnly);
    expect(adminOnly).toEqual([
      'audit.view',
      'company.settings.manage',
      'financial.owner_settlements.approve',
      'financial.owner_settlements.pay',
      'financial.receipts.void',
      'integrity.view',
      'support.user_lookup.view',
      'system.view',
      'users.manage',
    ]);
  });

  it('pins the non-requestable set, including the legacy compatibility parents', () => {
    const nonRequestable = catalogCodes.filter((permission) => !catalog.get(permission)?.requestable);
    expect(nonRequestable).toEqual([
      'app.dashboard.view',
      'auth.password.change',
      'contracts.write',
      'maintenance.write',
      'permission_requests.review',
      'properties.write',
      'support.operations.view',
      'support.requests.triage',
      'support.user_lookup.view',
    ]);
  });

  it('keeps every owner-editor capability assignable through set_employee_permission', () => {
    // set_employee_permission rejects any code that is not requestable or that
    // is admin_only, so a drift here would silently break the owner editor.
    const editorPermissions = ownerEditorPermissions();
    expect(editorPermissions.length).toBeGreaterThan(0);
    for (const permission of editorPermissions) {
      const row = catalog.get(permission);
      expect(row, `${permission} must be catalog-backed`).toBeDefined();
      expect(row?.requestable, `${permission} must stay requestable`).toBe(true);
      expect(row?.adminOnly, `${permission} must stay assignable to employees`).toBe(false);
    }
  });

  it('keeps the retired legacy settings alias out of every authority', () => {
    expect(frontendCodes).not.toContain('settings.manage');
    expect(catalogCodes).not.toContain('settings.manage');
    expect(read('supabase/seed.sql')).not.toContain("'settings.manage'");
    for (const codes of roleMatrix.values()) expect(codes.has('settings.manage')).toBe(false);
    // The canonical settings authority remains the admin-only company scope.
    expect(catalog.get('company.settings.manage')?.adminOnly).toBe(true);
  });

  it('keeps unknown permission codes out of the typed vocabulary', () => {
    const catalogBacked = new Set(catalogCodes);
    for (const probe of ['made.up.permission', 'people.view', 'settings.manage', 'financial.reports.delete']) {
      expect(catalogBacked.has(probe), probe).toBe(false);
      expect((appPermissions as readonly string[]).includes(probe), probe).toBe(false);
    }
    // A resolved non-admin context denies anything outside its granted set.
    const employee = {
      userId: 'employee-1',
      email: 'employee@malek.test',
      role: 'USER',
      grantedPermissions: ['app.dashboard.view'] as readonly AppPermission[],
      effectivePermissionsResolved: true,
    } as const;
    expect(canAccess(employee, 'app.dashboard.view')).toBe(true);
    expect(canAccessRoute(employee, 'users.manage')).toBe(false);
    expect(canShowNavigationItem(employee, 'users.manage')).toBe(false);
  });
});

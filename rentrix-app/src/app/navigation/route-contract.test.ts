import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROUTE_CONTRACT, REDIRECT_ROUTES, TARGET_IA_TOP_LEVEL } from './route-contract';
import { getNavRoot, routeNavRoot } from './route-nav-map';
import { getAllNavItems } from './app-nav-items';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');

function hasRoutePath(path: string): boolean {
  return routeTreeSource.includes(`path: '${path}'`);
}

// Surfaces registered in route-tree.ts whose parent is a top-level segment.
// Returns { parent, path } for every createRoute call with a static path.
function topLevelRegisteredPaths(): { parent: string; path: string }[] {
  const blocks = routeTreeSource.split('createRoute({').slice(1);
  const out: { parent: string; path: string }[] = [];
  for (const block of blocks) {
    const parentMatch = block.match(/getParentRoute: \(\) => (\w+)/);
    const pathMatch = block.match(/path: '([^']+)'/);
    if (!parentMatch || !pathMatch) continue;
    if (pathMatch[1].startsWith('/')) {
      out.push({ parent: parentMatch[1], path: pathMatch[1] });
    }
  }
  return out;
}

describe('route-contract — single source of truth', () => {
  it('every canonical in contract is registered in route-tree.ts', () => {
    for (const entry of ROUTE_CONTRACT) {
      expect(hasRoutePath(entry.canonical), `canonical ${entry.canonical} not in route-tree`).toBe(true);
    }
  });

  it('every REDIRECT_ROUTES entry is registered and has redirect behavior', () => {
    for (const path of REDIRECT_ROUTES) {
      expect(hasRoutePath(path), `redirect route ${path} not in route-tree`).toBe(true);
      const token = `path: '${path}'`;
      const idx = routeTreeSource.indexOf(token);
      const snippet = routeTreeSource.slice(Math.max(0, idx - 400), idx + 800);
      expect(snippet).toMatch(/redirect|beforeLoad/);
    }
  });

  it('has no duplicate canonical entries', () => {
    const canonicals = ROUTE_CONTRACT.map((e) => e.canonical);
    expect(new Set(canonicals).size).toBe(canonicals.length);
  });

  it('every top-level registration in route-tree.ts is a contract route, redirect, or declared public surface', () => {
    // Regression lock for duplicate route trees: a NEW capability cannot ship
    // as a second top-level route without passing through the contract, where
    // it must be declared canonical, an alias, or a reviewed public surface.
    const knownCanonical = new Set<string>([
      ...ROUTE_CONTRACT.map((entry) => entry.canonical),
      ...REDIRECT_ROUTES,
      ...ROUTE_CONTRACT.flatMap((entry) => [...entry.legacyAliases]),
    ]);
    // Structural entry points that intentionally live outside the office IA
    // (auth flows, isolated token portals, dev tooling). Any addition here is
    // a product decision and must be justified in review.
    const structuralPublicRoutes = new Set([
      '/login',
      '/forgot-password',
      '/reset-password',
      '/tenant-portal',
      '/owner-portal',
      '/dev/design-system',
    ]);
    const topRouteParents = new Set(['rootRoute', 'authRoute', 'protectedRoute']);

    const topLevel = topLevelRegisteredPaths().filter((entry) => topRouteParents.has(entry.parent));
    expect(topLevel.length).toBeGreaterThan(50); // parser sanity: the registry is fully scanned

    for (const { path } of topLevel) {
      const covered = knownCanonical.has(path) || structuralPublicRoutes.has(path);
      expect(covered, `top-level route ${path} is not declared in ROUTE_CONTRACT/REDIRECT_ROUTES`).toBe(true);
    }
  });

  it('no capability path is registered twice at the top level', () => {
    // Two route objects for the same top-level path = a second competing
    // implementation sneaking in beside the canonical one.
    const paths = topLevelRegisteredPaths().map((entry) => `${entry.parent}${entry.path}`);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('all sidebarRoot values exist in routeNavRoot values', () => {
    const knownRoots = new Set(routeNavRoot.values());
    for (const entry of ROUTE_CONTRACT) {
      if (['/', '/login', '/privacy', '/terms', '/support', '/dev/design-system'].includes(entry.canonical)) continue;
      expect(knownRoots.has(entry.sidebarRoot), `unknown sidebarRoot ${entry.sidebarRoot} for ${entry.canonical}`).toBe(true);
    }
  });

  it('every non-public canonical maps correctly via getNavRoot', () => {
    for (const entry of ROUTE_CONTRACT) {
      if (['/', '/login', '/privacy', '/terms', '/support'].includes(entry.canonical)) continue;
      const testPath = entry.canonical.replace(/\/\$[^/]+/g, '/_id');
      expect(getNavRoot(testPath)).toBe(entry.sidebarRoot);
    }
  });

  it('legacy aliases never collide with canonicals', () => {
    const canonicals = new Set(ROUTE_CONTRACT.map((e) => e.canonical));
    const aliases = ROUTE_CONTRACT.flatMap((e) => [...e.legacyAliases]);
    for (const alias of aliases) {
      expect(canonicals.has(alias)).toBe(false);
    }
    expect(new Set(aliases).size).toBe(aliases.length);
  });

  it('pins exactly seven target IA roots', () => {
    expect(TARGET_IA_TOP_LEVEL).toEqual([
      '/dashboard',
      '/properties',
      '/contracts',
      '/financials',
      '/maintenance',
      '/reports',
      '/settings',
    ]);
    const canonicals = new Set(ROUTE_CONTRACT.map((e) => e.canonical));
    for (const path of TARGET_IA_TOP_LEVEL) {
      expect(canonicals.has(path), `target IA path ${path} missing from contract`).toBe(true);
      expect(ROUTE_CONTRACT.find((entry) => entry.canonical === path)?.isPrimaryNav).toBe(true);
    }
  });

  it('all visible nav items have a contract entry', () => {
    const navPaths = new Set(getAllNavItems().map(([to]) => to));
    for (const path of navPaths) {
      expect(ROUTE_CONTRACT.some((e) => e.canonical === path), `nav path ${path} missing in contract`).toBe(true);
    }
  });

  it('every contract entry has an Arabic title', () => {
    for (const entry of ROUTE_CONTRACT) {
      expect(entry.titleAr).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it('keeps secondary entities canonical but not global', () => {
    const expectedRoots: Record<string, string> = {
      '/owners': '/properties',
      '/lands': '/properties',
      '/tenants': '/contracts',
      '/people': '/contracts',
      '/leads': '/contracts',
      '/communication': '/contracts',
      '/commissions': '/financials',
    };

    for (const [path, root] of Object.entries(expectedRoots)) {
      const entry = ROUTE_CONTRACT.find((candidate) => candidate.canonical === path)!;
      expect(entry.isPrimaryNav).toBe(false);
      expect(entry.sidebarRoot).toBe(root);
    }
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROUTE_CONTRACT, REDIRECT_ROUTES, TARGET_IA_TOP_LEVEL } from './route-contract';
import { getNavRoot, routeNavRoot } from './route-nav-map';
import { getAllNavItems } from './app-nav-items';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');

function hasRoutePath(path: string): boolean {
  return routeTreeSource.includes(`path: '${path}'`);
}

describe('route-contract — single source of truth', () => {
  it('every canonical in contract is registered in route-tree.ts', () => {
    for (const entry of ROUTE_CONTRACT) {
      expect(hasRoutePath(entry.canonical), `canonical ${entry.canonical} not in route-tree`).toBe(true);
    }
  });

  it('every REDIRECT_ROUTES entry is registered and has a redirect beforeLoad', () => {
    for (const path of REDIRECT_ROUTES) {
      expect(hasRoutePath(path), `redirect route ${path} not in route-tree`).toBe(true);
      // receipt is special: conditional redirect (has receiptId branch). Others are unconditional.
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

  it('all sidebarRoot values exist in routeNavRoot values (or are known roots)', () => {
    const knownRoots = new Set(routeNavRoot.values());
    for (const entry of ROUTE_CONTRACT) {
      if (['/', '/login', '/privacy', '/terms', '/dev/design-system'].includes(entry.canonical)) continue;
      // phrasing: sidebarRoot must be a valid primary nav root
      expect(knownRoots.has(entry.sidebarRoot) || entry.sidebarRoot === '/dashboard', `unknown sidebarRoot ${entry.sidebarRoot} for ${entry.canonical}`).toBe(true);
    }
  });

  it('every non-public canonical maps correctly via getNavRoot', () => {
    for (const entry of ROUTE_CONTRACT) {
      if (['/', '/login', '/privacy', '/terms'].includes(entry.canonical)) continue;
      // dynamic segments like $propertyId need to test without params: getNavRoot handles prefix
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

  it('target IA top-level is a subset of canonicals or documented future routes', () => {
    const canonicals = new Set(ROUTE_CONTRACT.map((e) => e.canonical));
    for (const path of TARGET_IA_TOP_LEVEL) {
      // /lands and /people are currently aliases, not top-level — document explicitly
      // They are in canonical set but marked as redirect today.
      expect(canonicals.has(path), `target IA path ${path} missing from contract`).toBe(true);
    }
  });

  it('all visible nav items have a contract entry (no orphan nav)', () => {
    const navPaths = new Set(getAllNavItems().map(([to]) => to));
    for (const path of navPaths) {
      expect(ROUTE_CONTRACT.some((e) => e.canonical === path), `nav path ${path} missing in contract`).toBe(true);
    }
  });

  it('every contract entry has an Arabic title containing Arabic script', () => {
    for (const entry of ROUTE_CONTRACT) {
      expect(entry.titleAr).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it('documents Phase 2 canonical promotions with targetIANote', () => {
    const people = ROUTE_CONTRACT.find((e) => e.canonical === '/people')!;
    expect(people.targetIANote).toMatch(/Phase 2 canonical standalone/);
    expect(people.isPrimaryNav).toBe(true);
    expect(people.sidebarRoot).toBe('/people');
    const lands = ROUTE_CONTRACT.find((e) => e.canonical === '/lands')!;
    expect(lands.targetIANote).toMatch(/Phase 2 canonical standalone/);
    expect(lands.isPrimaryNav).toBe(true);
    expect(lands.sidebarRoot).toBe('/lands');
    const commissions = ROUTE_CONTRACT.find((e) => e.canonical === '/commissions')!;
    expect(commissions.targetIANote).toMatch(/Phase 2 canonical standalone/);
    expect(commissions.isPrimaryNav).toBe(true);
    expect(commissions.sidebarRoot).toBe('/commissions');
  });
});

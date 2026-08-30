/**
 * Canonical route-to-primary-navigation-root map.
 *
 * The bindings are DERIVED from ROUTE_CONTRACT so the contract stays the single
 * authority for route → sidebar-root semantics. Parametric canonicals
 * contribute their static path prefix (e.g. `/properties/$propertyId` adds
 * `/properties`); getNavRoot's prefix fallback then covers every deep link
 * under that prefix, exactly like the previous hand-written map.
 */
import { ROUTE_CONTRACT } from './route-contract';

function rootKeyFor(canonical: string): string | null {
  if (!canonical.startsWith('/')) return null;
  const paramIndex = canonical.indexOf('/$');
  if (paramIndex === -1) return canonical;
  const prefix = canonical.slice(0, paramIndex);
  return prefix === '' ? null : prefix;
}

export const routeNavRoot = new Map<string, string>();
for (const entry of ROUTE_CONTRACT) {
  const key = rootKeyFor(entry.canonical);
  if (key === null) continue;
  const existing = routeNavRoot.get(key);
  if (existing !== undefined && existing !== entry.sidebarRoot) {
    throw new Error(`route-contract conflict: ${key} resolves to both ${existing} and ${entry.sidebarRoot}`);
  }
  routeNavRoot.set(key, entry.sidebarRoot);
}

export function getNavRoot(pathname: string): string {
  if (routeNavRoot.has(pathname)) return routeNavRoot.get(pathname)!;

  const sortedKeys = [...routeNavRoot.keys()].sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (pathname.startsWith(key + '/') || pathname === key) {
      return routeNavRoot.get(key)!;
    }
  }

  return '/dashboard';
}

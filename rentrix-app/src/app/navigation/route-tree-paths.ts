import { readFileSync } from 'node:fs';

/**
 * Static route-tree path registry for structural tests.
 *
 * route-tree.ts registers routes with `createRoute({ getParentRoute: () => X,
 * path: '/...' })` and composes them into one tree. Naive substring matching
 * is wrong here: nested child paths (e.g. `/properties/$propertyId/units`
 * declares `path: '/units'`) must not be mistaken for top-level legacy routes.
 *
 * This helper parses the route declarations with a balanced-brace scanner and
 * resolves each route's full path through its parent chain.
 */

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');

export type ParsedRoute = {
  name: string;
  parent: string;
  path: string | null;
  fullPath: string;
  topLevel: boolean;
  block: string;
};

function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  let inString: string | null = null;
  let escaped = false;
  let inLineComment = false;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === inString) {
        inString = null;
      }
      continue;
    }
    if (char === '/' && next === '/') {
      inLineComment = true;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      inString = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseRouteDeclarations(): ParsedRoute[] {
  const routes: ParsedRoute[] = [];
  const declarationPattern = /const\s+(\w+Route)\s*=\s*createRoute\(\{/g;
  let match: RegExpExecArray | null;
  while ((match = declarationPattern.exec(routeTreeSource)) !== null) {
    const name = match[1];
    const openIndex = match.index + match[0].lastIndexOf('{');
    const closeIndex = findMatchingBrace(routeTreeSource, openIndex);
    if (closeIndex === -1) continue;
    const block = routeTreeSource.slice(openIndex, closeIndex + 1);
    const parentMatch = block.match(/getParentRoute:\s*\(\)\s*=>\s*(\w+)/);
    const pathMatch = block.match(/path:\s*'([^']*)'/);
    routes.push({
      name,
      parent: parentMatch?.[1] ?? 'rootRoute',
      path: pathMatch?.[1] ?? null,
      fullPath: '',
      topLevel: false,
      block,
    });
  }
  return routes;
}

const LAYOUT_ROOTS = new Set(['rootRoute', 'authRoute', 'protectedRoute']);

export function getRegisteredRoutePaths(): { full: Set<string>; topLevel: Set<string> } {
  const declarations = parseRouteDeclarations();
  const byName = new Map(declarations.map((route) => [route.name, route]));

  const fullPathOf = (route: ParsedRoute, cache: Map<string, string>): string => {
    const cached = cache.get(route.name);
    if (cached !== undefined) return cached;
    const parentPath = route.parent === 'rootRoute'
      ? '/'
      : byName.has(route.parent)
        ? fullPathOf(byName.get(route.parent)!, cache)
        : '/';
    const resolved = route.path === null
      ? parentPath
      : route.path === '/'
        ? parentPath
        : parentPath === '/'
          ? route.path
          : `${parentPath}${route.path}`;
    cache.set(route.name, resolved);
    return resolved;
  };

  const cache = new Map<string, string>();
  for (const route of declarations) {
    route.fullPath = fullPathOf(route, cache);
    route.topLevel = LAYOUT_ROOTS.has(route.parent) && route.path !== null;
  }

  return {
    full: new Set(declarations.map((route) => route.fullPath).filter(Boolean)),
    topLevel: new Set(
      declarations.filter((route) => route.topLevel).map((route) => route.fullPath).filter(Boolean),
    ),
  };
}

/** Full registered paths (including nested `/properties/$propertyId/units`). */
export function registeredRoutePaths(): string[] {
  return [...getRegisteredRoutePaths().full];
}

/** Paths registered directly under root, auth, or protected layouts. */
export function topLevelRoutePaths(): string[] {
  return [...getRegisteredRoutePaths().topLevel];
}

/** Returns the full `createRoute({ ... })` block that declares the given path. */
export function findRouteBlock(path: string): string {
  const routes = parseRouteDeclarations();
  const route = routes.find((candidate) => candidate.path === path);
  return route?.block ?? '';
}

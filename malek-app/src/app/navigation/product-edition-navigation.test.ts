import { describe, expect, it } from 'vitest';
import { activeProductEdition } from '@/lib/product-edition';
import { routeTree } from '@/app/router/route-tree';
import { getAllNavItems, quickCreateItems } from './app-nav-items';

type RuntimeRoute = Readonly<{
  options?: Readonly<{ path?: unknown }>;
  children?: Readonly<Record<string, RuntimeRoute>>;
}>;

function collectRegisteredPaths(route: RuntimeRoute): string[] {
  const currentPath = typeof route.options?.path === 'string' ? [route.options.path] : [];
  return [
    ...currentPath,
    ...Object.values(route.children ?? {}).flatMap(collectRegisteredPaths),
  ];
}

describe('curated-edition navigation', () => {
  it('uses the curated Vite mode without changing the standard default', () => {
    expect(activeProductEdition).toBe(
      import.meta.env.MODE === 'property-operations' ? 'property-operations' : 'standard',
    );
  });

  it('hides excluded routes from every navigation surface in the curated mode', () => {
    if (activeProductEdition === 'standard') return;

    const paths = [...getAllNavItems(), ...quickCreateItems].map(([to]) => to);
    for (const excludedPath of ['/lands', '/leads', '/communication', '/settings/automation']) {
      expect(paths).not.toContain(excludedPath);
    }
  });

  it('registers only the selected edition route surface', () => {
    const registeredPaths = collectRegisteredPaths(routeTree as unknown as RuntimeRoute);
    const excludedPaths = [
      '/lands',
      '/lands/$landId',
      '/leads',
      '/communication',
      '/ai-assistant',
      '/owner-portal',
      '/tenant-portal',
      '/settings/automation',
    ];

    if (activeProductEdition === 'property-operations') {
      for (const path of excludedPaths) expect(registeredPaths).not.toContain(path);
      for (const path of ['/dashboard', '/properties', '/owners', '/tenants', '/contracts', '/financials', '/maintenance', '/reports']) {
        expect(registeredPaths).toContain(path);
      }
      return;
    }

    for (const path of excludedPaths) expect(registeredPaths).toContain(path);
  });
});

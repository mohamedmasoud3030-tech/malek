import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');

describe('Navigation consolidation — documents vault standalone route', () => {
  it('registers /documents-vault as a canonical standalone destination', () => {
    expect(routeTreeSource).toContain("path: '/documents-vault'");
    expect(routeTreeSource).toContain("@/features/documents-vault/components/documents-vault-workspace");
    expect(routeTreeSource).not.toContain('operations-hub');
  });

  it('/maintenance legacy documents_vault deep links redirect directly to /documents-vault', () => {
    // The legacy operations mapping is declared immediately above the
    // /maintenance route that consumes it, so assert the mapping and its
    // consumer directly instead of relying on a fixed source window.
    const mapping = /const operationLegacy[^=]*=\s*\{([^}]*)\}/.exec(routeTreeSource);
    expect(mapping, 'operationLegacy mapping must exist').not.toBeNull();
    expect(mapping![1]).toContain("documents_vault: '/documents-vault'");
    expect(mapping![1]).toContain("utilities: '/utilities'");
    expect(mapping![1]).toContain("service_providers: '/service-providers'");

    const idx = routeTreeSource.indexOf("path: '/maintenance'");
    expect(idx).toBeGreaterThanOrEqual(0);
    const route = routeTreeSource.slice(
      routeTreeSource.lastIndexOf('createRoute({', idx),
      routeTreeSource.indexOf('});', idx) + 3,
    );
    // The route resolves ?section= / ?view= against that mapping and hard
    // redirects straight to the canonical standalone destination.
    expect(route).toContain('operationLegacy[key]');
    expect(route).toContain('throw redirect({ to: target');
  });

  it('does not retain an Operations Hub section model or retired route authority', () => {
    expect(routeTreeSource).not.toContain('isOperationsHubSectionId');
    expect(routeTreeSource).not.toContain('operations-hub-model');
    expect(routeTreeSource).not.toContain('OperationsHub');
  });
});

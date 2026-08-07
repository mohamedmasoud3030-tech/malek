import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeTreeSource = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');

describe('tenants route wiring (IA 2026-08: hub-canonical)', () => {
  it('tenants is REDIRECT-ONLY to Relationships hub (one canonical TenantsWorkspace)', () => {
    expect(routeTreeSource).toContain("path: '/tenants'");
    expect(routeTreeSource).toContain("throw redirect({ to: '/contracts'");
    expect(routeTreeSource).toContain("section: 'tenants'");
    // Canonical implementation is TenantsWorkspace embedded in RelationshipsHub at /contracts?section=tenants
  });

  it('no duplicate standalone tenants route file remains', () => {
    // File rentrix-app/src/routes/_protected.tenants.tsx deleted (was re-export)
    // Only redirect in route-tree remains for bookmark compat
    expect(routeTreeSource).not.toContain("import('@/routes/_protected.tenants'");
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TenantsRouteComponent } from '@/routes/_protected.tenants';
import { TenantsWorkspace } from './TenantsPage';

const routeTreeSource = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');

describe('tenants route wiring', () => {
  it('keeps /tenants as a first-class standalone destination', () => {
    expect(routeTreeSource).toContain("path: '/tenants'");
    expect(routeTreeSource).toContain("import('@/routes/_protected.tenants')");
    expect(TenantsRouteComponent).toBe(TenantsWorkspace);
  });

  it('does not redirect tenants back into the contracts hub', () => {
    const tenantDefinitionStart = routeTreeSource.indexOf("const tenantsRoute = createRoute");
    const tenantDefinitionEnd = routeTreeSource.indexOf('\n\n', tenantDefinitionStart);
    const tenantDefinition = routeTreeSource.slice(tenantDefinitionStart, tenantDefinitionEnd);
    expect(tenantDefinition).not.toContain("redirect({ to: '/contracts'");
    expect(tenantDefinition).not.toContain("section: 'tenants'");
  });
});

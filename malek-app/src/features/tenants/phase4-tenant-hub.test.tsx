import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeTreeSource = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');

describe('tenants route wiring', () => {
  it('keeps /tenants as a first-class standalone destination', () => {
    expect(routeTreeSource).toContain("path: '/tenants'");
    expect(routeTreeSource).toContain("import('@/features/tenants/TenantsPage')");
    expect(routeTreeSource).toContain("'TenantsWorkspace'");
  });

  it('does not redirect tenants back into the contracts hub', () => {
    const tenantDefinitionStart = routeTreeSource.indexOf("const tenantsRoute = createRoute");
    const tenantDefinitionEnd = routeTreeSource.indexOf('\n\n', tenantDefinitionStart);
    const tenantDefinition = routeTreeSource.slice(tenantDefinitionStart, tenantDefinitionEnd);
    expect(tenantDefinition).not.toContain("redirect({ to: '/contracts'");
    expect(tenantDefinition).not.toContain("section: 'tenants'");
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getSimulatedRole, setSimulatedRole } from '@/services/mock-role-simulator';

describe('audit-log route wiring', () => {
  it('keeps /audit-log a redirect-only alias; the page is composed by the governance hub', () => {
    const routeTreeSource = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');
    const idx = routeTreeSource.indexOf("path: '/audit-log'");
    const block = routeTreeSource.slice(routeTreeSource.lastIndexOf('createRoute({', idx), routeTreeSource.indexOf('});', idx) + 3);
    expect(block).toContain("settingsLegacyRedirect('audit.view'");
    expect(block).not.toContain('lazyRouteComponent');
    expect(routeTreeSource).toContain("import('@/features/governance-hub/components/GovernanceHubWorkspace')");
  });
});

describe('role simulator behavior', () => {
  it('toggles simulated role correctly through all three values', () => {
    setSimulatedRole('MANAGER');
    expect(getSimulatedRole()).toBe('MANAGER');
    setSimulatedRole('USER');
    expect(getSimulatedRole()).toBe('USER');
    setSimulatedRole('ADMIN');
    expect(getSimulatedRole()).toBe('ADMIN');
  });
});

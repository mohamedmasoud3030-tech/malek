import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('audit-log route wiring', () => {
  const routeTreeSource = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');

  function routeBlock(path: string): string {
    const token = `path: '${path}'`;
    const idx = routeTreeSource.indexOf(token);
    expect(idx, `${token} must be registered`).toBeGreaterThanOrEqual(0);
    return routeTreeSource.slice(
      routeTreeSource.lastIndexOf('createRoute({', idx),
      routeTreeSource.indexOf('});', idx) + 3,
    );
  }

  it('retires the top-level /audit-log alias in favour of the canonical settings route', () => {
    expect(routeTreeSource).not.toContain("path: '/audit-log'");
    expect(routeTreeSource).toContain("path: '/settings/audit-log'");
  });

  it('wires the canonical audit route straight to the audit feature, permission-gated', () => {
    const block = routeBlock('/settings/audit-log');
    expect(block).toContain("requirePermission('audit.view')");
    expect(block).toContain("@/features/audit/audit-log-page");
  });

  it('composes users & permissions through the canonical settings owner, not a hub', () => {
    const block = routeBlock('/settings/users-permissions');
    expect(block).toContain("requireAnyPermission('users.manage', 'permission_requests.review')");
    expect(block).toContain("@/features/settings/components/UserRolesWorkspace");
  });

  it('keeps the retired governance hub out of the route tree entirely', () => {
    expect(routeTreeSource).not.toContain('governance-hub');
    expect(routeTreeSource).not.toContain('GovernanceHubWorkspace');
  });
});

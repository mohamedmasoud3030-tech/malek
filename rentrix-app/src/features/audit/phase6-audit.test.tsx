import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('audit-log route wiring', () => {
  it('/audit-log standalone route is retired; the governance hub is the single composition point', () => {
    const routeTreeSource = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');
    expect(routeTreeSource).not.toContain("path: '/audit-log'");
    // Governance hub is the single composition point for the audit workspace.
    expect(routeTreeSource).toContain("import('@/features/governance-hub/components/GovernanceHubWorkspace')");
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('contracts route ownership', () => {
  it('routes the primary contracts entry through the unified Leasing workspace', () => {
    const routeTreeSource = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');
    expect(routeTreeSource).toContain("import('@/features/relationships-hub/leasing-hub-workspace')");
    expect(routeTreeSource).toContain("'LeasingHubPage'");
  });
});

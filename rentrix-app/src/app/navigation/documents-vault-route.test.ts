import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isOperationsHubSectionId } from '@/features/operations-hub/operations-hub-model';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');

describe('WP-06A — documents vault route consolidation', () => {
  it('/documents-vault standalone route is retired; the Operations Hub section is the single authority', () => {
    expect(routeTreeSource).not.toContain("path: '/documents-vault'");
  });

  it('cannot loop: /maintenance never redirects back to /documents-vault', () => {
    const maintenanceToken = "path: '/maintenance'";
    const idx = routeTreeSource.indexOf(maintenanceToken);
    const block = routeTreeSource.slice(idx, idx + 400);
    expect(block).not.toContain("to: '/documents-vault'");
  });

  it('documents_vault remains a real Operations Hub section (no silent fallback)', () => {
    expect(isOperationsHubSectionId('documents_vault')).toBe(true);
  });
});

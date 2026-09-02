import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(import.meta.dirname, '../..');
const route = readFileSync(resolve(sourceRoot, 'routes/_protected.maintenance.tsx'), 'utf8');
const hub = readFileSync(resolve(sourceRoot, 'features/operations-hub/operations-hub-workspace.tsx'), 'utf8');
const workspace = readFileSync(resolve(import.meta.dirname, 'components/maintenance-workspace.tsx'), 'utf8');
const controller = readFileSync(resolve(import.meta.dirname, 'useMaintenancePageController.ts'), 'utf8');

describe('maintenance production runtime wiring', () => {
  it('keeps the authenticated route wired through the operations hub to the live workspace', () => {
    expect(route).toContain("import { OperationsHubWorkspace }");
    expect(route).toContain('<OperationsHubWorkspace defaultSection="maintenance" mode="standalone" />');
    expect(hub).toContain("await import('@/features/maintenance/components/maintenance-workspace')");
    expect(hub).toContain('<MaintenanceWorkspace mode="embedded" />');
    expect(hub).toContain('maintenance: MaintenanceBody');
  });

  it('wires live search and filter state into the canonical controller/helper', () => {
    expect(workspace).toContain('useMaintenancePageController()');
    expect(workspace).toContain('searchValue={controller.query}');
    expect(workspace).toContain('onSearchChange={controller.setQuery}');
    expect(workspace).toContain('activeFilters={activeFilters}');
    expect(workspace).toContain('onClearAllFilters={clearAllFilters}');
    expect(controller).toContain('filterMaintenanceRequests(maintenanceRows');
    expect(controller).toContain('query,');
    expect(controller).toContain('searchableContextById,');
  });

  it('does not retain the disconnected legacy page wrapper', () => {
    expect(existsSync(resolve(import.meta.dirname, 'maintenance-page.tsx'))).toBe(false);
  });
});

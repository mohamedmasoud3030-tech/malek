import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(import.meta.dirname, '../..');
const routeTree = readFileSync(resolve(sourceRoot, 'app/router/route-tree.ts'), 'utf8');
const workspace = readFileSync(resolve(import.meta.dirname, 'components/maintenance-workspace.tsx'), 'utf8');
const controller = readFileSync(resolve(import.meta.dirname, 'useMaintenancePageController.ts'), 'utf8');

describe('maintenance production runtime wiring', () => {
  it('keeps the authenticated route wired directly to the live standalone workspace', () => {
    expect(routeTree).toContain("path: '/maintenance'");
    expect(routeTree).toContain("@/features/maintenance/components/maintenance-workspace");
    expect(routeTree).toContain("'MaintenanceWorkspace'");
    expect(routeTree).toContain("requirePermission('maintenance.view')");
    expect(routeTree).not.toContain('operations-hub');
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

  it('wires canonical attention and next action into the details overlay', () => {
    expect(workspace).toContain('<MaintenanceDetailsOverlay');
    expect(workspace).toContain('attention={controller.detailsAttention}');
    expect(workspace).toContain('nextAction={detailsNextAction}');
    expect(workspace).toContain('onRunNextAction={detailsNextAction ? runDetailsNextAction : undefined}');
    expect(workspace).toContain('getPrimaryMaintenanceAction(normalizeMaintenanceStatus(row.status)');
    expect(workspace).toContain('getMaintenanceStatusActionPermission');
    expect(workspace).toContain('controller.handleStatusAction(row, action.status)');
    expect(workspace).not.toContain('getMaintenanceStatusActions');
  });

  it('derives details-overlay attention from the canonical helper and operating date', () => {
    expect(controller).toContain('deriveMaintenanceAttention(detailsRequest, operatingDate)');
    expect(controller).toContain('detailsAttention,');
  });

  it('does not retain the disconnected legacy page wrapper', () => {
    expect(existsSync(resolve(import.meta.dirname, 'maintenance-page.tsx'))).toBe(false);
  });
});

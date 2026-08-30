import { describe, expect, it } from 'vitest';
import {
  REPORT_WORKSPACES,
  getReportWorkspace,
  getReportWorkspaceSubView,
  getWorkspaceForReportLocation,
  isWorkspaceSubView,
} from './report-workspaces';
import {
  buildWorkspaceSearch,
  resolveWorkspaceLocation,
} from './reports-section-model';

describe('report workspace registry — approved consolidation contract', () => {
  it('defines exactly the seven approved workspaces in order', () => {
    expect(REPORT_WORKSPACES.map((workspace) => workspace.id)).toEqual([
      'office',
      'collections',
      'leasing',
      'operations',
      'properties',
      'statements',
      'financial_review',
    ]);
  });

  it('labels every workspace in owner-facing Arabic, not implementation terms', () => {
    const allText = REPORT_WORKSPACES.map((workspace) => `${workspace.label} ${workspace.description}`).join(' ');
    expect(allText).toContain('أداء المكتب');
    expect(allText).toContain('التحصيل والمتأخرات');
    expect(allText).toContain('العقود والإشغال');
    expect(allText).toContain('التشغيل والمصروفات');
    expect(allText).toContain('العقارات والوحدات');
    expect(allText).toContain('الكشوف');
    expect(allText).toContain('المراجعة المالية');
    for (const term of ['analytics', 'accounting', 'statements', 'adapter', 'RPC', 'Supabase']) {
      expect(allText).not.toContain(term);
    }
  });

  it('marks the financial review as specialist and the six business workspaces as normal', () => {
    const specialist = REPORT_WORKSPACES.filter((workspace) => workspace.specialist).map((workspace) => workspace.id);
    expect(specialist).toEqual(['financial_review']);
  });

  it('gives every normal report destination exactly one owning workspace (single-home rule)', () => {
    const byLegacyView = new Map<string, string[]>();
    for (const workspace of REPORT_WORKSPACES) {
      for (const view of workspace.legacyViews) {
        const owners = byLegacyView.get(view) ?? [];
        owners.push(workspace.id);
        byLegacyView.set(view, owners);
      }
    }
    for (const [view, owners] of byLegacyView) {
      expect(owners, `view ${view} must have a single owner`).toEqual([owners[0]]);
    }
    // The two historical duplicates now have one canonical home each.
    expect(byLegacyView.get('expenses')).toEqual(['operations']);
    expect(byLegacyView.get('occupancy')).toEqual(['leasing']);
  });

  it('maps every legacy analytics/accounting view onto its workspace', () => {
    expect(getWorkspaceForReportLocation('analytics', 'overview')).toBe('office');
    expect(getWorkspaceForReportLocation('analytics', 'collections')).toBe('collections');
    expect(getWorkspaceForReportLocation('analytics', 'overdue')).toBe('collections');
    expect(getWorkspaceForReportLocation('analytics', 'follow_up')).toBe('collections');
    expect(getWorkspaceForReportLocation('analytics', 'collection_movement')).toBe('collections');
    expect(getWorkspaceForReportLocation('analytics', 'occupancy')).toBe('leasing');
    expect(getWorkspaceForReportLocation('analytics', 'expiring')).toBe('leasing');
    expect(getWorkspaceForReportLocation('analytics', 'maintenance_analytics')).toBe('operations');
    expect(getWorkspaceForReportLocation('analytics', 'expenses')).toBe('operations');
    expect(getWorkspaceForReportLocation('analytics', 'services')).toBe('operations');
    expect(getWorkspaceForReportLocation('analytics', 'operations_overview')).toBe('operations');
    expect(getWorkspaceForReportLocation('analytics', 'property_analytics')).toBe('properties');
    expect(getWorkspaceForReportLocation('statements', '')).toBe('statements');
    expect(getWorkspaceForReportLocation('accounting', 'accounting_reports')).toBe('financial_review');
    expect(getWorkspaceForReportLocation('accounting', 'general_ledger')).toBe('financial_review');
    expect(getWorkspaceForReportLocation('accounting', 'deferred_revenue')).toBe('financial_review');
  });
});

describe('workspace location resolution — deep-link compatibility', () => {
  it('resolves the user-facing workspace key with its default view', () => {
    expect(resolveWorkspaceLocation('collections', undefined, undefined)).toEqual({
      workspace: 'collections',
      section: 'analytics',
      view: 'collections',
    });
  });

  it('resolves a workspace plus a valid sub-view', () => {
    expect(resolveWorkspaceLocation('collections', 'overdue', undefined)).toEqual({
      workspace: 'collections',
      section: 'analytics',
      view: 'overdue',
    });
  });

  it('falls back to the workspace default for an invalid sub-view', () => {
    expect(resolveWorkspaceLocation('collections', 'not-a-view', undefined)).toEqual({
      workspace: 'collections',
      section: 'analytics',
      view: 'collections',
    });
  });

  it('keeps legacy section/view bookmarks working and maps them to their workspace', () => {
    expect(resolveWorkspaceLocation(undefined, undefined, 'accounting').workspace).toBe('financial_review');
    expect(resolveWorkspaceLocation(undefined, 'general_ledger', 'accounting')).toEqual({
      workspace: 'financial_review',
      section: 'accounting',
      view: 'general_ledger',
    });
    expect(resolveWorkspaceLocation(undefined, 'maintenance_analytics', 'analytics').workspace).toBe('operations');
    expect(resolveWorkspaceLocation(undefined, undefined, 'statements').workspace).toBe('statements');
  });

  it('lands unknown or missing values on the office launchpad', () => {
    expect(resolveWorkspaceLocation('bogus', undefined, undefined)).toEqual({
      workspace: 'office',
      section: 'analytics',
      view: 'overview',
    });
  });

  it('resolves the specialist workspace sub-views', () => {
    const workspace = getReportWorkspace('financial_review');
    expect(workspace).toBeDefined();
    expect(getReportWorkspaceSubView(workspace!, 'general_ledger')?.label).toBe('دفتر الأستاذ والشجرة');
    expect(isWorkspaceSubView(workspace!, 'deferred_revenue')).toBe(true);
    expect(isWorkspaceSubView(workspace!, 'overview')).toBe(false);
  });
});

describe('workspace navigation search builder', () => {
  it('sets the workspace key, carries the sub-view and drops the legacy section key', () => {
    expect(buildWorkspaceSearch({ from: '2026-08-01', section: 'analytics' }, 'collections', 'overdue')).toEqual({
      from: '2026-08-01',
      workspace: 'collections',
      view: 'overdue',
    });
  });

  it('deletes a stale view when the target workspace has no sub-view', () => {
    expect(buildWorkspaceSearch({ view: 'overdue', tenantId: 't1' }, 'properties')).toEqual({
      tenantId: 't1',
      workspace: 'properties',
    });
  });

  it('never destroys unrelated URL search parameters', () => {
    const previous = { propertyId: 'p1', section: 'accounting', view: 'general_ledger' };
    const next = buildWorkspaceSearch(previous, 'leasing', 'occupancy');
    expect(next.propertyId).toBe('p1');
    expect(next.workspace).toBe('leasing');
    expect(next.view).toBe('occupancy');
    expect('section' in next).toBe(false);
  });
});

describe('workspace filter configuration', () => {
  it('shows only business-relevant filters per workspace', () => {
    const get = (id: string) => getReportWorkspace(id)!;
    expect(get('office').visibleFilterFields).toEqual(['period', 'property', 'owner']);
    expect(get('collections').visibleFilterFields).toEqual(['period', 'asOf', 'property', 'unit', 'tenant', 'contract', 'status']);
    expect(get('operations').visibleFilterFields).toEqual(['period', 'property', 'unit', 'costCenter']);
    expect(get('statements').visibleFilterFields).toEqual(['period', 'property', 'owner', 'contract']);
    expect(get('financial_review').visibleFilterFields).toEqual(['period', 'asOf']);
  });
});

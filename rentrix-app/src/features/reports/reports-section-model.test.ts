import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  mergeReportSectionIntoSearch,
  REPORTS_SECTION_SEARCH_KEY,
  resolveReportLocation,
} from './reports-section-model';

describe('reports section URL model', () => {
  it('uses `section` as the URL search key', () => {
    expect(REPORTS_SECTION_SEARCH_KEY).toBe('section');
  });

  it('lands safely on understandable performance reporting when no section is requested', () => {
    expect(resolveReportLocation(undefined, undefined)).toEqual({ section: 'analytics', view: 'overview' });
    expect(resolveReportLocation(null, null)).toEqual({ section: 'analytics', view: 'overview' });
    expect(resolveReportLocation('', '')).toEqual({ section: 'analytics', view: 'overview' });
  });

  it('fails safely to performance reporting for unknown/malformed section values', () => {
    expect(resolveReportLocation('not-a-section', 'anything')).toEqual({ section: 'analytics', view: 'overview' });
    expect(resolveReportLocation(12345, {})).toEqual({ section: 'analytics', view: 'overview' });
  });

  it('preserves legacy/deep links to their correct nested report views', () => {
    expect(resolveReportLocation('overview', undefined)).toEqual({ section: 'analytics', view: 'overview' });
    expect(resolveReportLocation('collections', undefined)).toEqual({ section: 'analytics', view: 'collections' });
    expect(resolveReportLocation('overdue', undefined)).toEqual({ section: 'analytics', view: 'overdue' });
    expect(resolveReportLocation('expenses', undefined)).toEqual({ section: 'analytics', view: 'expenses' });
    expect(resolveReportLocation('property_analytics', undefined)).toEqual({ section: 'analytics', view: 'property_analytics' });
    expect(resolveReportLocation('occupancy', undefined)).toEqual({ section: 'analytics', view: 'occupancy' });
    expect(resolveReportLocation('maintenance_analytics', undefined)).toEqual({ section: 'analytics', view: 'maintenance_analytics' });
    expect(resolveReportLocation('accounting', undefined)).toEqual({ section: 'accounting', view: 'accounting_reports' });
    expect(resolveReportLocation('general_ledger', undefined)).toEqual({ section: 'accounting', view: 'general_ledger' });
    expect(resolveReportLocation('deferred_revenue', undefined)).toEqual({ section: 'accounting', view: 'deferred_revenue' });
    expect(resolveReportLocation('statements', undefined)).toEqual({ section: 'statements', view: '' });
  });

  it('safely handles malformed views while preserving explicit specialist sections', () => {
    expect(resolveReportLocation('accounting', 'garbage')).toEqual({ section: 'accounting', view: 'accounting_reports' });
    expect(resolveReportLocation('analytics', 'garbage')).toEqual({ section: 'analytics', view: 'overview' });
  });
});

describe('reports section URL sync and KPI drill-downs', () => {
  it('merges the section into the search while preserving unrelated params', () => {
    const previous = { e2e: '1', costCenterId: 'cc-1' };
    expect(mergeReportSectionIntoSearch(previous, 'analytics')).toEqual({
      e2e: '1',
      costCenterId: 'cc-1',
      section: 'analytics',
    });
  });

  it('overwrites an existing section param when switching tabs', () => {
    expect(mergeReportSectionIntoSearch({ section: 'analytics' }, 'statements')).toEqual({
      section: 'statements',
    });
  });

  it('keeps KPI drill-down section and view parameters authoritative', () => {
    expect(resolveReportLocation('analytics', 'collections')).toEqual({ section: 'analytics', view: 'collections' });
    expect(resolveReportLocation('analytics', 'occupancy')).toEqual({ section: 'analytics', view: 'occupancy' });
    expect(resolveReportLocation('analytics', 'overdue')).toEqual({ section: 'analytics', view: 'overdue' });
    expect(resolveReportLocation('analytics', 'overview')).toEqual({ section: 'analytics', view: 'overview' });
  });
});

describe('/accounting legacy bookmark semantics', () => {
  const routeTreeSource = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');

  it('/accounting is retired; reports section deep link is the single canonical destination', () => {
    expect(routeTreeSource).not.toContain("path: '/accounting'");
  });
});

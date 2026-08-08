import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reportSections } from './reports-page.sections';
import {
  DEFAULT_REPORT_SECTION,
  mergeReportSectionIntoSearch,
  REPORTS_SECTION_SEARCH_KEY,
  resolveReportLocation,
} from './reports-section-model';

describe('reports section URL model', () => {
  it('uses `section` as the URL search key', () => {
    expect(REPORTS_SECTION_SEARCH_KEY).toBe('section');
  });

  it('fails safely to the default when no section is requested', () => {
    expect(resolveReportLocation(undefined, undefined)).toEqual({ section: 'accounting', view: 'accounting_reports' });
    expect(resolveReportLocation(null, null)).toEqual({ section: 'accounting', view: 'accounting_reports' });
    expect(resolveReportLocation('', '')).toEqual({ section: 'accounting', view: 'accounting_reports' });
  });

  it('fails safely to default accounting_reports for unknown/malformed section values', () => {
    expect(resolveReportLocation('not-a-section', 'anything')).toEqual({ section: 'accounting', view: 'accounting_reports' });
    expect(resolveReportLocation(12345, {})).toEqual({ section: 'accounting', view: 'accounting_reports' });
  });

  it('maps legacy/old sections directly to their correct nested view equivalents authoritatively', () => {
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

  it('safely handles malformed and garbage views with clean default fallbacks (fail-safe)', () => {
    expect(resolveReportLocation('accounting', 'garbage')).toEqual({ section: 'accounting', view: 'accounting_reports' });
    expect(resolveReportLocation('analytics', 'garbage')).toEqual({ section: 'analytics', view: 'overview' });
  });
});

describe('reports section URL sync and KPI drill-downs (Point 1, 2)', () => {
  it('merges the section into the search while preserving unrelated params', () => {
    const previous = { e2e: '1', costCenterId: 'cc-1' };
    expect(mergeReportSectionIntoSearch(previous, 'accounting')).toEqual({
      e2e: '1',
      costCenterId: 'cc-1',
      section: 'accounting',
    });
  });

  it('overwrites an existing section param when switching tabs', () => {
    expect(mergeReportSectionIntoSearch({ section: 'analytics' }, 'statements')).toEqual({
      section: 'statements',
    });
  });

  it('asserts that Report KPI drills correctly update both section and view parameters', () => {
    // Proves that when resolving the Collections KPI destination, both macro-section and view are resolved correctly
    expect(resolveReportLocation('analytics', 'collections')).toEqual({ section: 'analytics', view: 'collections' });

    // Occupancy KPI
    expect(resolveReportLocation('analytics', 'occupancy')).toEqual({ section: 'analytics', view: 'occupancy' });

    // Outstanding KPI
    expect(resolveReportLocation('analytics', 'overdue')).toEqual({ section: 'analytics', view: 'overdue' });

    // Net Cash KPI
    expect(resolveReportLocation('analytics', 'overview')).toEqual({ section: 'analytics', view: 'overview' });
  });
});

describe('/accounting legacy bookmark semantics (Point 8)', () => {
  const routeTreeSource = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');

  it('preserves /accounting redirecting to accounting section and general_ledger view exactly', () => {
    expect(routeTreeSource).toContain("path: '/accounting'");
    expect(routeTreeSource).toContain("section: 'accounting'");
    expect(routeTreeSource).toContain("view: 'general_ledger'");
  });
});

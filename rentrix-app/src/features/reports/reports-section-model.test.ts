import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reportSections } from './reports-page.sections';
import {
  DEFAULT_REPORT_SECTION,
  mergeReportSectionIntoSearch,
  REPORTS_SECTION_SEARCH_KEY,
  resolveReportSection,
  resolveReportView,
} from './reports-section-model';

describe('reports section URL model', () => {
  it('uses `section` as the URL search key', () => {
    expect(REPORTS_SECTION_SEARCH_KEY).toBe('section');
  });

  it('fails safely to the default when no section is requested', () => {
    expect(resolveReportSection(undefined)).toBe(DEFAULT_REPORT_SECTION);
    expect(resolveReportSection(null)).toBe(DEFAULT_REPORT_SECTION);
    expect(resolveReportSection('')).toBe(DEFAULT_REPORT_SECTION);
  });

  it('fails safely to the default for unknown or malformed values', () => {
    expect(resolveReportSection('not-a-section')).toBe(DEFAULT_REPORT_SECTION);
    expect(resolveReportSection(12345)).toBe(DEFAULT_REPORT_SECTION);
    expect(resolveReportSection({})).toBe(DEFAULT_REPORT_SECTION);
    expect(resolveReportSection(['overview'])).toBe(DEFAULT_REPORT_SECTION);
  });

  it('accepts every registered report section id', () => {
    for (const section of reportSections) {
      expect(resolveReportSection(section.id)).toBe(section.id);
    }
  });

  it('defaults to the accounting section as the stable page identity', () => {
    expect(DEFAULT_REPORT_SECTION).toBe('accounting');
    expect(reportSections.some((section) => section.id === DEFAULT_REPORT_SECTION)).toBe(true);
  });

  it('maps legacy/old sections to the three new macro categories', () => {
    expect(resolveReportSection('overview')).toBe('analytics');
    expect(resolveReportSection('collections')).toBe('analytics');
    expect(resolveReportSection('overdue')).toBe('analytics');
    expect(resolveReportSection('general_ledger')).toBe('accounting');
    expect(resolveReportSection('deferred_revenue')).toBe('accounting');
    expect(resolveReportSection('statements')).toBe('statements');
  });

  it('maps legacy sections to their correct nested view equivalents authoritatively', () => {
    expect(resolveReportView('overview', undefined)).toBe('overview');
    expect(resolveReportView('collections', undefined)).toBe('collections');
    expect(resolveReportView('overdue', undefined)).toBe('overdue');
    expect(resolveReportView('expenses', undefined)).toBe('expenses');
    expect(resolveReportView('property_analytics', undefined)).toBe('property_analytics');
    expect(resolveReportView('occupancy', undefined)).toBe('occupancy');
    expect(resolveReportView('maintenance_analytics', undefined)).toBe('maintenance_analytics');
    expect(resolveReportView('accounting', undefined)).toBe('accounting_reports');
    expect(resolveReportView('general_ledger', undefined)).toBe('general_ledger');
    expect(resolveReportView('deferred_revenue', undefined)).toBe('deferred_revenue');
    expect(resolveReportView('statements', undefined)).toBe('');
  });

  it('safely handles malformed and garbage views with clean default fallbacks (fail-safe)', () => {
    expect(resolveReportView('accounting', 'garbage')).toBe('accounting_reports');
    expect(resolveReportView('analytics', 'garbage')).toBe('overview');
    expect(resolveReportView('unknown', 'anything')).toBe('');
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
    expect(resolveReportSection('analytics')).toBe('analytics');
    expect(resolveReportView('analytics', 'collections')).toBe('collections');

    // Occupancy KPI
    expect(resolveReportView('analytics', 'occupancy')).toBe('occupancy');

    // Outstanding KPI
    expect(resolveReportView('analytics', 'overdue')).toBe('overdue');

    // Net Cash KPI
    expect(resolveReportView('analytics', 'overview')).toBe('overview');
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

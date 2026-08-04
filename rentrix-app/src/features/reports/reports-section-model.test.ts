import { describe, expect, it } from 'vitest';
import { reportSections } from './reports-page.sections';
import {
  DEFAULT_REPORT_SECTION,
  mergeReportSectionIntoSearch,
  REPORTS_SECTION_SEARCH_KEY,
  resolveReportSection,
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

  it('defaults to the first/overview section as the stable page identity', () => {
    expect(DEFAULT_REPORT_SECTION).toBe('overview');
    // The default is always one of the registered sections.
    expect(reportSections.some((section) => section.id === DEFAULT_REPORT_SECTION)).toBe(true);
  });

  it('round-trips through the registered section list so bookmarks stay valid', () => {
    // A resolved id must always be re-resolvable to itself (idempotent).
    for (const id of ['overview', 'accounting', 'collections', 'statements']) {
      expect(resolveReportSection(resolveReportSection(id))).toBe(resolveReportSection(id));
    }
  });
});

describe('reports section URL sync', () => {
  it('merges the section into the search while preserving unrelated params', () => {
    const previous = { e2e: '1', costCenterId: 'cc-1' };
    expect(mergeReportSectionIntoSearch(previous, 'accounting')).toEqual({
      e2e: '1',
      costCenterId: 'cc-1',
      section: 'accounting',
    });
  });

  it('overwrites an existing section param when switching tabs', () => {
    expect(mergeReportSectionIntoSearch({ section: 'overview' }, 'collections')).toEqual({
      section: 'collections',
    });
  });

  it('resolves a direct link with a valid section and defaults on invalid', () => {
    // Direct link: /reports?section=statements
    expect(resolveReportSection('statements')).toBe('statements');
    // Direct link with an unknown section fails safe to the default.
    expect(resolveReportSection('bogus')).toBe(DEFAULT_REPORT_SECTION);
  });
});

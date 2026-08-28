import { describe, expect, it } from 'vitest';
import {
  REPORT_DIRECTORY_ENTRY_COUNT,
  filterReportGroups,
  reportGroups,
} from './report-directory-groups';

describe('report directory model', () => {
  it('keeps the published catalogue counts derived from the model, not hardcoded in UI', () => {
    expect(reportGroups).toHaveLength(6);
    expect(REPORT_DIRECTORY_ENTRY_COUNT).toBe(14);
    expect(reportGroups.reduce((total, group) => total + group.shortcuts.length, 0)).toBe(
      REPORT_DIRECTORY_ENTRY_COUNT,
    );
  });

  it('keeps accounting implementation views out of the owner-facing directory', () => {
    for (const group of reportGroups) {
      expect(group.section).not.toBe('accounting');
      for (const shortcut of group.shortcuts) {
        expect(shortcut.section).not.toBe('accounting');
        expect(typeof shortcut.view).toBe('string');
      }
    }
  });

  it('covers the main office decisions rather than implementation categories', () => {
    expect(reportGroups.map((group) => group.id)).toEqual([
      'office',
      'collections',
      'leases',
      'maintenance',
      'owners',
      'properties',
    ]);
  });

  it('keeps unit performance and settlements visible without creating duplicate data sources', () => {
    const shortcuts = reportGroups.flatMap((group) => group.shortcuts);
    const unitPerformance = shortcuts.find((shortcut) => shortcut.label === 'أداء الوحدة');
    const settlements = shortcuts.find((shortcut) => shortcut.label === 'التسويات');
    expect(unitPerformance).toMatchObject({ section: 'analytics', view: 'property_analytics' });
    expect(settlements).toMatchObject({ section: 'statements', view: '' });
  });
});

describe('report directory search', () => {
  it('returns the whole catalogue for an empty or whitespace query', () => {
    expect(filterReportGroups(reportGroups, '')).toHaveLength(6);
    expect(filterReportGroups(reportGroups, '   ')).toHaveLength(6);
  });

  it('finds relevant work areas by shortcut and description text', () => {
    const result = filterReportGroups(reportGroups, 'مصروفات');
    expect(result.map((group) => group.id)).toEqual(expect.arrayContaining(['collections', 'maintenance', 'properties']));
  });

  it('normalises Arabic alef variants so a partially-vocalised query still matches', () => {
    const result = filterReportGroups(reportGroups, 'الاشغال');
    expect(result.map((group) => group.id)).toContain('leases');
  });

  it('finds owner and tenant statements without exposing accounting terminology', () => {
    expect(filterReportGroups(reportGroups, 'المالك').map((group) => group.id)).toContain('owners');
    expect(filterReportGroups(reportGroups, 'المستاجر').map((group) => group.id)).toContain('owners');
  });

  it('finds the blueprint additions by their business names', () => {
    expect(filterReportGroups(reportGroups, 'التسويات').map((group) => group.id)).toContain('owners');
    expect(filterReportGroups(reportGroups, 'أداء الوحدة').map((group) => group.id)).toContain('properties');
  });

  it('returns an empty catalogue for an unknown query so the empty state can render', () => {
    expect(filterReportGroups(reportGroups, 'zzzz')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  REPORT_DIRECTORY_ENTRY_COUNT,
  filterReportGroups,
  reportGroups,
} from './report-directory-groups';

describe('report directory model', () => {
  it('keeps the published catalogue counts derived from the model, not hardcoded', () => {
    expect(reportGroups).toHaveLength(7);
    expect(REPORT_DIRECTORY_ENTRY_COUNT).toBe(14);
    expect(reportGroups.reduce((total, group) => total + group.shortcuts.length, 0)).toBe(
      REPORT_DIRECTORY_ENTRY_COUNT,
    );
  });

  it('points every entry at a navigable section/view pair', () => {
    for (const group of reportGroups) {
      expect(['accounting', 'statements', 'analytics']).toContain(group.section);
      for (const shortcut of group.shortcuts) {
        expect(['accounting', 'statements', 'analytics']).toContain(shortcut.section);
        expect(typeof shortcut.view).toBe('string');
      }
    }
  });
});

describe('report directory search', () => {
  it('returns the whole catalogue for an empty or whitespace query', () => {
    expect(filterReportGroups(reportGroups, '')).toHaveLength(7);
    expect(filterReportGroups(reportGroups, '   ')).toHaveLength(7);
  });

  it('finds a group by a shortcut label', () => {
    const result = filterReportGroups(reportGroups, 'مصروفات');
    expect(result.map((group) => group.id)).toEqual(['finance', 'properties', 'analytics']);
  });

  it('normalises Arabic alef variants so a partially-vocalised query still matches', () => {
    const result = filterReportGroups(reportGroups, 'الاشغال');
    expect(result.map((group) => group.id)).toContain('leases');
  });

  it('normalises taa marbuta so ه and ة spellings match the accounting/control family', () => {
    expect(filterReportGroups(reportGroups, 'المحاسبيه').map((group) => group.id)).toContain('control');
    expect(filterReportGroups(reportGroups, 'المحاسبية').map((group) => group.id)).toContain('control');
  });

  it('returns an empty catalogue for an unknown query so the empty state can render', () => {
    expect(filterReportGroups(reportGroups, 'zzzz')).toEqual([]);
  });
});

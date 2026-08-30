import { describe, expect, it } from 'vitest';
import {
  REPORT_DIRECTORY_ENTRY_COUNT,
  businessReportGroups,
  filterReportGroups,
  reportGroups,
  specialistReportGroups,
} from './report-directory-groups';

describe('report directory model — workspace consolidation', () => {
  it('keeps the published catalogue counts derived from the model, not hardcoded in UI', () => {
    expect(reportGroups).toHaveLength(7);
    expect(REPORT_DIRECTORY_ENTRY_COUNT).toBe(18);
    expect(reportGroups.reduce((total, group) => total + group.shortcuts.length, 0)).toBe(
      REPORT_DIRECTORY_ENTRY_COUNT,
    );
  });

  it('splits business workspaces from the visually secondary specialist review', () => {
    expect(businessReportGroups.map((group) => group.id)).toEqual([
      'office',
      'collections',
      'leasing',
      'operations',
      'properties',
      'statements',
    ]);
    expect(specialistReportGroups.map((group) => group.id)).toEqual(['financial_review']);
  });

  it('covers the approved business decisions rather than implementation categories', () => {
    expect(businessReportGroups.map((group) => group.title)).toEqual([
      'أداء المكتب',
      'التحصيل والمتأخرات',
      'العقود والإشغال',
      'التشغيل والمصروفات',
      'العقارات والوحدات',
      'الكشوف',
    ]);
  });

  it('keeps expenses and occupancy under exactly one owning group (single-home rule)', () => {
    const expensesOwners = reportGroups.filter((group) =>
      group.shortcuts.some((shortcut) => shortcut.view === 'expenses'),
    );
    const occupancyOwners = reportGroups.filter((group) =>
      group.shortcuts.some((shortcut) => shortcut.view === 'occupancy'),
    );
    expect(expensesOwners.map((group) => group.id)).toEqual(['operations']);
    expect(occupancyOwners.map((group) => group.id)).toEqual(['leasing']);
  });

  it('keeps the specialist accounting views only inside the specialist group', () => {
    for (const group of businessReportGroups) {
      for (const shortcut of group.shortcuts) {
        expect(shortcut.section).not.toBe('accounting');
      }
    }
    expect(specialistReportGroups[0].shortcuts.map((shortcut) => shortcut.view)).toEqual([
      'accounting_reports',
      'general_ledger',
      'deferred_revenue',
    ]);
  });

  it('keeps the statements party perspectives as doorways into one workspace', () => {
    const statements = reportGroups.find((group) => group.id === 'statements');
    expect(statements?.shortcuts.map((shortcut) => shortcut.label)).toEqual([
      'كشف المالك',
      'كشف المستأجر',
      'التسويات والحركة المرتبطة',
    ]);
    for (const shortcut of statements?.shortcuts ?? []) {
      expect(shortcut.section).toBe('statements');
    }
  });

  it('keeps unit performance and services visible without creating duplicate data sources', () => {
    const shortcuts = reportGroups.flatMap((group) => group.shortcuts);
    const services = shortcuts.find((shortcut) => shortcut.label === 'الخدمات والمرافق');
    const movement = shortcuts.find((shortcut) => shortcut.label === 'حركة التحصيل');
    const followUp = shortcuts.find((shortcut) => shortcut.label === 'المتابعة');
    expect(services).toMatchObject({ section: 'analytics', view: 'services' });
    expect(movement).toMatchObject({ section: 'analytics', view: 'collection_movement' });
    expect(followUp).toMatchObject({ section: 'analytics', view: 'follow_up' });
  });
});

describe('report directory search', () => {
  it('returns the whole catalogue for an empty or whitespace query', () => {
    expect(filterReportGroups(reportGroups, '')).toHaveLength(7);
    expect(filterReportGroups(reportGroups, '   ')).toHaveLength(7);
  });

  it('finds relevant work areas by shortcut and description text', () => {
    const result = filterReportGroups(reportGroups, 'مصروفات');
    expect(result.map((group) => group.id)).toEqual(expect.arrayContaining(['office', 'operations', 'properties']));
  });

  it('normalises Arabic alef variants so a partially-vocalised query still matches', () => {
    const result = filterReportGroups(reportGroups, 'الاشغال');
    expect(result.map((group) => group.id)).toContain('leasing');
  });

  it('finds owner and tenant statements without exposing accounting terminology', () => {
    expect(filterReportGroups(reportGroups, 'المالك').map((group) => group.id)).toContain('statements');
    expect(filterReportGroups(reportGroups, 'المستاجر').map((group) => group.id)).toContain('statements');
  });

  it('finds the approved workspace additions by their business names', () => {
    expect(filterReportGroups(reportGroups, 'المتابعة').map((group) => group.id)).toContain('collections');
    expect(filterReportGroups(reportGroups, 'الإشغال').map((group) => group.id)).toContain('leasing');
    expect(filterReportGroups(reportGroups, 'المراجعة المالية').map((group) => group.id)).toContain('financial_review');
  });

  it('returns an empty catalogue for an unknown query so the empty state can render', () => {
    expect(filterReportGroups(reportGroups, 'zzzz')).toEqual([]);
  });
});

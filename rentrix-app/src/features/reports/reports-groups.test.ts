import { describe, expect, it } from 'vitest';
import { reportSections } from './reports-page.sections';

describe('report sections grouping contract', () => {
  it('groups every report into clear understandable categories', () => {
    const validGroups = new Set([
      'الأداء المالي',
      'الأداء التشغيلي',
      'التحصيلات والذمم',
      'الضرائب ومحاسبة الفترات',
      'الكشوفات التفصيلية',
    ]);

    for (const section of reportSections) {
      expect(validGroups.has(section.group)).toBe(true);
    }

    const groups = new Set(reportSections.map((section) => section.group));
    expect(groups).toEqual(validGroups);
  });

  it('keeps collections, overdue, and cash/revenue in appropriate categories', () => {
    const getGroup = (id: string) => reportSections.find((s) => s.id === id)?.group;

    expect(getGroup('collections')).toBe('التحصيلات والذمم');
    expect(getGroup('overdue')).toBe('التحصيلات والذمم');
    expect(getGroup('overview')).toBe('الأداء المالي');
    expect(getGroup('expenses')).toBe('الأداء المالي');
    expect(getGroup('accounting')).toBe('الأداء المالي');
    expect(getGroup('deferred_revenue')).toBe('الضرائب ومحاسبة الفترات');
    expect(getGroup('statements')).toBe('الكشوفات التفصيلية');
  });
});

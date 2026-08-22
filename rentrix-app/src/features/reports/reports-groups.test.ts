import { describe, expect, it } from 'vitest';
import { getReportSectionsByCategory, reportCategories, reportSections } from './reports-page.sections';

describe('report sections grouping contract', () => {
  it('groups every report into clear understandable categories', () => {
    const validGroups = new Set([
      'الرقابة والمخرجات المحاسبية',
      'الكشوفات التفصيلية',
      'تحليلات الأداء والتشغيل',
    ]);

    for (const section of reportSections) {
      expect(validGroups.has(section.group)).toBe(true);
    }

    const groups = new Set(reportSections.map((section) => section.group));
    expect(groups).toEqual(validGroups);
  });
});

describe('report sections — Simplified 3-category consolidation contract', () => {
  it('assigns every report to exactly one of the three macro categories', () => {
    const categoryIds = new Set(reportCategories.map((category) => category.id));
    expect(categoryIds).toEqual(new Set(['accounting', 'statements', 'analytics']));

    for (const section of reportSections) {
      expect(categoryIds.has(section.category)).toBe(true);
    }
  });

  it('splits accounting from statements from analytics', () => {
    const accounting = getReportSectionsByCategory('accounting').map((section) => section.id);
    const statements = getReportSectionsByCategory('statements').map((section) => section.id);
    const analytics = getReportSectionsByCategory('analytics').map((section) => section.id);

    expect(accounting).toEqual(['accounting']);
    expect(statements).toEqual(['statements']);
    expect(analytics).toEqual(['analytics']);
  });
});

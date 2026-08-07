import { describe, expect, it } from 'vitest';
import { getReportSectionsByCategory, reportCategories, reportSections } from './reports-page.sections';

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

describe('report sections — Wave A 3-category consolidation contract', () => {
  it('assigns every report to exactly one of the three macro categories', () => {
    const categoryIds = new Set(reportCategories.map((category) => category.id));
    expect(categoryIds).toEqual(new Set(['live', 'analytical', 'formal']));

    for (const section of reportSections) {
      expect(categoryIds.has(section.category)).toBe(true);
    }
  });

  it('splits operational insights (live) from analytical views from formal reports', () => {
    const live = getReportSectionsByCategory('live').map((section) => section.id);
    const analytical = getReportSectionsByCategory('analytical').map((section) => section.id);
    const formal = getReportSectionsByCategory('formal').map((section) => section.id);

    // LIVE OPERATIONAL INSIGHTS: what needs attention today
    expect(live).toEqual(['overview', 'overdue', 'occupancy', 'collections']);
    // ANALYTICAL VIEWS: why it happens
    expect(analytical).toEqual(['property_analytics', 'expenses', 'maintenance_analytics']);
    // FORMAL REPORTS: auditable statements & accounting outputs
    expect(formal).toEqual(['deferred_revenue', 'statements', 'accounting']);

    // Every section appears in exactly one category cluster.
    const all = [...live, ...analytical, ...formal];
    expect(new Set(all).size).toBe(reportSections.length);
    expect(all.length).toBe(reportSections.length);
  });

  it('keeps the legacy groups intact as secondary labels for each section', () => {
    for (const section of reportSections) {
      expect(section.group.length).toBeGreaterThan(0);
    }
  });
});

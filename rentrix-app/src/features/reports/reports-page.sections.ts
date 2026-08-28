import { Scale, FileSpreadsheet, TrendingUp } from 'lucide-react';

export type ReportCategoryId = 'accounting' | 'statements' | 'analytics';

/**
 * Internal report-routing metadata. These ids preserve deep links and adapter
 * contracts; owner-facing navigation is provided by the report directory and
 * must not expose implementation categories such as accounting/analytics.
 */
export const reportCategories = [
  {
    id: 'accounting',
    label: 'المراجعة المالية',
    shortLabel: 'مراجعة مالية',
    icon: Scale,
    description: 'مخرجات رقابية متقدمة من المصدر المالي المعتمد.',
  },
  {
    id: 'statements',
    label: 'الكشوف',
    shortLabel: 'الكشوف',
    icon: FileSpreadsheet,
    description: 'كشوف الملاك والمستأجرين والحركة المرتبطة بهم.',
  },
  {
    id: 'analytics',
    label: 'الأداء والتشغيل',
    shortLabel: 'الأداء',
    icon: TrendingUp,
    description: 'مؤشرات التحصيل والإشغال والمصروفات والصيانة لمتابعة الأداء.',
  },
] as const;

export const reportSections = [
  {
    id: 'accounting',
    label: 'المراجعة المالية',
    icon: Scale,
    group: 'مخرجات رقابية متقدمة',
    category: 'accounting',
    description: 'مخرجات مالية رقابية متقدمة من المصدر المعتمد، وليست نقطة البداية في تجربة صاحب المكتب.',
  },
  {
    id: 'statements',
    label: 'الكشوف',
    icon: FileSpreadsheet,
    group: 'الكشوف التفصيلية',
    category: 'statements',
    description: 'اعرض كشف المالك أو المستأجر والحركة المرتبطة بهما.',
  },
  {
    id: 'analytics',
    label: 'الأداء والتشغيل',
    icon: TrendingUp,
    group: 'تقارير الأداء',
    category: 'analytics',
    description: 'تابع التحصيل والمتأخرات والمصروفات والإشغال والصيانة حسب العمل.',
  },
] as const;

export type ReportSectionId = (typeof reportSections)[number]['id'];

export function getReportSectionsByCategory(category: ReportCategoryId) {
  return reportSections.filter((section) => section.category === category);
}

export function getReportCategoryLabel(section: (typeof reportSections)[number]) {
  return reportCategories.find((category) => category.id === section.category)?.label ?? section.group;
}

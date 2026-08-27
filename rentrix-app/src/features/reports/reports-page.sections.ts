import { Scale, FileSpreadsheet, TrendingUp } from 'lucide-react';

export type ReportCategoryId = 'accounting' | 'statements' | 'analytics';

export const reportCategories = [
  {
    id: 'accounting',
    label: 'المحاسبة',
    shortLabel: 'المحاسبة',
    icon: Scale,
    description: 'ميزان المراجعة والقوائم ودفتر الأستاذ لمراجعة الأرصدة والحركة المحاسبية.',
  },
  {
    id: 'statements',
    label: 'الكشوف',
    shortLabel: 'الكشوف',
    icon: FileSpreadsheet,
    description: 'كشوف المستأجرين والملاك وحركة المكتب والتدفق النقدي والضريبة.',
  },
  {
    id: 'analytics',
    label: 'التحليلات',
    shortLabel: 'التحليلات',
    icon: TrendingUp,
    description: 'مؤشرات التحصيل والمتأخرات والمصروفات والإشغال والصيانة لمتابعة الأداء.',
  },
] as const;

export const reportSections = [
  {
    id: 'accounting',
    label: 'المحاسبة',
    icon: Scale,
    group: 'المخرجات المحاسبية',
    category: 'accounting',
    description: 'راجع الأرصدة والقوائم ودفتر الأستاذ من مكان واحد.',
  },
  {
    id: 'statements',
    label: 'الكشوف',
    icon: FileSpreadsheet,
    group: 'الكشوف التفصيلية',
    category: 'statements',
    description: 'اعرض كشف المستأجر أو المالك وحركة المكتب والتدفق النقدي والضريبة.',
  },
  {
    id: 'analytics',
    label: 'التحليلات',
    icon: TrendingUp,
    group: 'تحليلات الأداء',
    category: 'analytics',
    description: 'تابع التحصيل والمتأخرات والمصروفات، وافتح التحليلات المتخصصة من مكتبة التقارير.',
  },
] as const;

export type ReportSectionId = (typeof reportSections)[number]['id'];

export function getReportSectionsByCategory(category: ReportCategoryId) {
  return reportSections.filter((section) => section.category === category);
}

export function getReportCategoryLabel(section: (typeof reportSections)[number]) {
  return reportCategories.find((category) => category.id === section.category)?.label ?? section.group;
}

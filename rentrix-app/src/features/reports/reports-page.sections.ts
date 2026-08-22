import { Scale, FileSpreadsheet, TrendingUp, Gauge } from 'lucide-react';

export type ReportCategoryId = 'accounting' | 'statements' | 'analytics';

export const reportCategories = [
  {
    id: 'accounting',
    label: 'المحاسبة والرقابة',
    shortLabel: 'المحاسبة والرقابة',
    icon: Scale,
    description: 'شجرة الحسابات، قيود اليومية، الفترات المحاسبية، ميزان المراجعة، والاستحقاق والقوائم المالية.',
  },
  {
    id: 'statements',
    label: 'الكشوف',
    shortLabel: 'الكشوف',
    icon: FileSpreadsheet,
    description: 'كشف حساب المستأجر والمالك، كشف حركة المكتب، التدفق النقدي، والضرائب.',
  },
  {
    id: 'analytics',
    label: 'التحليلات',
    shortLabel: 'التحليلات',
    icon: TrendingUp,
    description: 'تحليلات الأداء والمصروفات والمتأخرات والإشغال والصيانة.',
  },
] as const;

export const reportSections = [
  {
    id: 'accounting',
    label: 'المحاسبة والرقابة',
    icon: Scale,
    group: 'الرقابة والمخرجات المحاسبية',
    category: 'accounting',
    description: 'ضوابط الأستاذ العام: شجرة الحسابات والفترات والقيود، مع ميزان المراجعة والقوائم المالية المبنية على القيود المرحّلة.',
  },
  {
    id: 'statements',
    label: 'الكشوف',
    icon: FileSpreadsheet,
    group: 'الكشوفات التفصيلية',
    category: 'statements',
    description: 'كشف حساب المستأجر والمالك وحركة المكتب والتدفق النقدي وضريبة القيمة المضافة.',
  },
  {
    id: 'analytics',
    label: 'التحليلات',
    icon: TrendingUp,
    group: 'تحليلات الأداء والتشغيل',
    category: 'analytics',
    description: 'التحصيل، المتأخرات، كفاءة الإشغال، الصيانة والمصروفات التشغيلية عبر الفلاتر.',
  },
] as const;

export type ReportSectionId = (typeof reportSections)[number]['id'];

export function getReportSectionsByCategory(category: ReportCategoryId) {
  return reportSections.filter((section) => section.category === category);
}

export function getReportCategoryLabel(section: (typeof reportSections)[number]) {
  return reportCategories.find((category) => category.id === section.category)?.label ?? section.group;
}

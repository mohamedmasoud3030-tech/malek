import { Scale, FileSpreadsheet, TrendingUp } from 'lucide-react';

export type ReportCategoryId = 'accounting' | 'statements' | 'analytics';

export const reportCategories = [
  {
    id: 'accounting',
    label: 'المحاسبة والرقابة',
    shortLabel: 'المحاسبة والرقابة',
    icon: Scale,
    description: 'مطابقة الدفاتر المساعدة مع الأستاذ العام، شجرة الحسابات، القيود، الفترات، ميزان المراجعة والقوائم المالية.',
  },
  {
    id: 'statements',
    label: 'الكشوف',
    shortLabel: 'الكشوف',
    icon: FileSpreadsheet,
    description: 'كشف المستأجر والمالك، حركة المكتب التشغيلية، التدفق النقدي المبني على الأستاذ العام، والضرائب.',
  },
  {
    id: 'analytics',
    label: 'التحليلات',
    shortLabel: 'التحليلات',
    icon: TrendingUp,
    description: 'تحليلات الأداء والمصروفات والمتأخرات والإشغال والصيانة؛ لا تُستخدم بدل القوائم المحاسبية.',
  },
] as const;

export const reportSections = [
  {
    id: 'accounting',
    label: 'المحاسبة والرقابة',
    icon: Scale,
    group: 'الرقابة والمخرجات المحاسبية',
    category: 'accounting',
    description: 'ضوابط الأستاذ العام ومطابقة Subledger↔GL، مع شجرة الحسابات والفترات والقيود وميزان المراجعة والقوائم المبنية على القيود المرحّلة.',
  },
  {
    id: 'statements',
    label: 'الكشوف',
    icon: FileSpreadsheet,
    group: 'الكشوفات التفصيلية',
    category: 'statements',
    description: 'كشف المستأجر والمالك وحركة المكتب التشغيلية، مع Cash Flow محاسبي من 1111/1120 وضريبة القيمة المضافة.',
  },
  {
    id: 'analytics',
    label: 'التحليلات',
    icon: TrendingUp,
    group: 'تحليلات الأداء والتشغيل',
    category: 'analytics',
    description: 'التحصيل والمتأخرات والإشغال والصيانة والمصروفات التشغيلية عبر الفلاتر؛ مؤشرات تشغيلية وليست ربحًا أو تدفقًا نقديًا محاسبيًا.',
  },
] as const;

export type ReportSectionId = (typeof reportSections)[number]['id'];

export function getReportSectionsByCategory(category: ReportCategoryId) {
  return reportSections.filter((section) => section.category === category);
}

export function getReportCategoryLabel(section: (typeof reportSections)[number]) {
  return reportCategories.find((category) => category.id === section.category)?.label ?? section.group;
}

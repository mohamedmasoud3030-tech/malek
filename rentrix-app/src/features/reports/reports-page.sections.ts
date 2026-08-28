import { BarChart3, FileSpreadsheet, ShieldCheck } from 'lucide-react';

export type ReportCategoryId = 'accounting' | 'statements' | 'analytics';

/**
 * User-facing report families. Stable internal ids preserve deep links and
 * loaders while the office-owner experience uses operational language.
 */
export const reportCategories = [
  {
    id: 'analytics',
    label: 'الأداء والمتابعة',
    shortLabel: 'الأداء',
    icon: BarChart3,
    description: 'صورة مفهومة لأداء المكتب والعقارات والتحصيل والإشغال والصيانة.',
  },
  {
    id: 'statements',
    label: 'الكشوف',
    shortLabel: 'الكشوف',
    icon: FileSpreadsheet,
    description: 'كشوف الملاك والمستأجرين والحركة التفصيلية القابلة للبحث والتصدير.',
  },
  {
    id: 'accounting',
    label: 'الرقابة والتسويات',
    shortLabel: 'الرقابة',
    icon: ShieldCheck,
    description: 'طبقة رقابية خلفية تحفظ دقة الأرصدة والتسويات دون عرض دفاتر خام كواجهة أساسية.',
  },
] as const;

export const reportSections = [
  {
    id: 'analytics',
    label: 'الأداء والمتابعة',
    icon: BarChart3,
    group: 'تقارير الأداء',
    category: 'analytics',
    description: 'ابدأ بالخلاصة: مؤشرات ومقارنات واضحة، ثم انزل إلى الجدول التفصيلي عند الحاجة.',
  },
  {
    id: 'statements',
    label: 'الكشوف',
    icon: FileSpreadsheet,
    group: 'الكشوف التفصيلية',
    category: 'statements',
    description: 'افتح كشف المالك أو المستأجر ثم ابحث وصفِّ ورتّب وصدّر التفاصيل.',
  },
  {
    id: 'accounting',
    label: 'الرقابة والتسويات',
    icon: ShieldCheck,
    group: 'الرقابة الداخلية',
    category: 'accounting',
    description: 'طبقة داخلية للتحقق والتسوية؛ المحاسبة تعمل تحت التقارير ولا تقود تجربة صاحب المكتب.',
  },
] as const;

export type ReportSectionId = (typeof reportSections)[number]['id'];

export function getReportSectionsByCategory(category: ReportCategoryId) {
  return reportSections.filter((section) => section.category === category);
}

export function getReportCategoryLabel(section: (typeof reportSections)[number]) {
  return reportCategories.find((category) => category.id === section.category)?.label ?? section.group;
}

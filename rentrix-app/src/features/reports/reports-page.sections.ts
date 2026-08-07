import { AlertTriangle, BarChart3, Building2, ClipboardList, FileSpreadsheet, Gauge, Layers, Scale, TrendingUp, WalletCards, Wrench } from 'lucide-react';

/**
 * Wave A (reports consolidation): every reachable report is grouped into one
 * of three macro categories so the workspace stops feeling fragmented:
 *
 *   live        — LIVE OPERATIONAL INSIGHTS: what needs attention today
 *   analytical  — ANALYTICAL VIEWS: why it happens (drivers, breakdowns)
 *   formal      — FORMAL REPORTS: auditable statements & accounting outputs
 *
 * The legacy `group` labels are preserved unchanged (deep links and the
 * grouping contract depend on them); `category` is the new navigation-level
 * grouping rendered by the ReportsWorkspace tab clusters.
 */
export type ReportCategoryId = 'live' | 'analytical' | 'formal';

export const reportCategories = [
  {
    id: 'live',
    label: 'الرؤى التشغيلية الحية',
    shortLabel: 'رؤى حية',
    icon: Gauge,
    description: 'ما يحتاج انتباهك اليوم: التحصيل، المتأخرات، الإشغال، والنظرة العامة.',
  },
  {
    id: 'analytical',
    label: 'التحليلات',
    shortLabel: 'تحليلات',
    icon: TrendingUp,
    description: 'لماذا يحدث ذلك: أداء العقارات والمصروفات والصيانة عبر الفلاتر.',
  },
  {
    id: 'formal',
    label: 'التقارير الرسمية',
    shortLabel: 'رسمية',
    icon: FileSpreadsheet,
    description: 'الكشوفات والمخرجات المحاسبية القابلة للتدقيق والطباعة.',
  },
] as const;

export const reportSections = [
  {
    id: 'overview',
    label: 'نظرة عامة',
    icon: BarChart3,
    group: 'الأداء المالي',
    category: 'live',
    description: 'ملخص السيولة والإشغال وكفاءة التحصيل وأحدث الحركات في قراءة واحدة.',
  },
  {
    id: 'property_analytics',
    label: 'العقارات',
    icon: Building2,
    group: 'الأداء التشغيلي',
    category: 'analytical',
    description: 'أداء كل عقار من حيث الإشغال والشواغر والمصروفات التشغيلية.',
  },
  {
    id: 'overdue',
    label: 'المتأخرات',
    icon: AlertTriangle,
    group: 'التحصيلات والذمم',
    category: 'live',
    description: 'الفواتير المتأخرة وتعتيق الذمم وأولوية التحصيل حسب العمر والقيمة.',
  },
  {
    id: 'occupancy',
    label: 'الإشغال',
    icon: Building2,
    group: 'الأداء التشغيلي',
    category: 'live',
    description: 'الإشغال والشواغر والعقود القريبة من الانتهاء وفرص إعادة التأجير.',
  },
  {
    id: 'collections',
    label: 'التحصيلات',
    icon: WalletCards,
    group: 'التحصيلات والذمم',
    category: 'live',
    description: 'التحصيل اليومي وطرق السداد والإيصالات وسجل العقود الجاري.',
  },
  {
    id: 'expenses',
    label: 'المصروفات',
    icon: ClipboardList,
    group: 'الأداء المالي',
    category: 'analytical',
    description: 'المصروفات حسب التصنيف والعقار ومتوسط الحركة وتركيز التكلفة.',
  },
  {
    id: 'maintenance_analytics',
    label: 'الصيانة',
    icon: Wrench,
    group: 'الأداء التشغيلي',
    category: 'analytical',
    description: 'حجم البلاغات وحالات التنفيذ والأولوية والتغطية التشغيلية للفريق.',
  },
  {
    id: 'deferred_revenue',
    label: 'الاستحقاق',
    icon: Layers,
    group: 'الضرائب ومحاسبة الفترات',
    category: 'formal',
    description: 'التحصيلات المقدمة المرتبطة بالعقود وجدول الاعتراف بالإيراد والالتزام المؤجل.',
  },
  {
    id: 'statements',
    label: 'الكشوف',
    icon: FileSpreadsheet,
    group: 'الكشوفات التفصيلية',
    category: 'formal',
    description: 'كشف المستأجر والمالك وحركة المكتب والتدفق النقدي والضريبة.',
  },
  {
    id: 'accounting',
    label: 'المحاسبة',
    icon: Scale,
    group: 'الأداء المالي',
    category: 'formal',
    description: 'ميزان المراجعة والدخل والمركز المالي من مصادر القيود المحاسبية المعتمدة.',
  },
] as const;

export type ReportSectionId = (typeof reportSections)[number]['id'];

/** Sections ordered per category for grouped tab clusters. */
export function getReportSectionsByCategory(category: ReportCategoryId) {
  return reportSections.filter((section) => section.category === category);
}

export function getReportCategoryLabel(section: (typeof reportSections)[number]) {
  return reportCategories.find((category) => category.id === section.category)?.label ?? section.group;
}

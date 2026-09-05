import type { ComponentType } from 'react';
import {
  Building2,
  FileText,
  Landmark,
  ReceiptText,
  UserRound,
} from 'lucide-react';
import type { ReportProductId } from '@/lib/report-product-ids';
import type { ReportFilterFieldId } from './reports-workspace-filters';

/** Internal renderer locations; product targets below are their sole owner. */
export type ReportSectionId = 'accounting' | 'statements' | 'analytics';
export type AccountingReportViewId =
  | 'accounting_reports'
  | 'general_ledger'
  | 'deferred_revenue';
export type AnalyticsReportViewId =
  | 'overview'
  | 'collections'
  | 'overdue'
  | 'follow_up'
  | 'collection_movement'
  | 'expenses'
  | 'property_analytics'
  | 'occupancy'
  | 'expiring'
  | 'maintenance_analytics'
  | 'operations_overview'
  | 'services';
/** `''` denotes a statement product with no sub-view. */
export type ReportViewId = AccountingReportViewId | AnalyticsReportViewId | '';

export type { ReportProductId } from '@/lib/report-product-ids';

export type StatementProductFocus = 'owner' | 'tenant' | 'financial' | 'all';

/**
 * One addressable body of a report product. Product targets deliberately own
 * their renderer location and filter scope; no workspace/navigation registry
 * participates in the canonical Reports UX.
 */
export type ReportProductTarget = Readonly<{
  id: string;
  label: string;
  description: string;
  section: ReportSectionId;
  view: ReportViewId;
  visibleFilterFields: readonly ReportFilterFieldId[];
  documentKind?:
    | 'owner-pack'
    | 'tenant-statement'
    | 'rent-roll'
    | 'aged-arrears'
    | 'property-pack'
    | 'portfolio-performance';
}>;

export type ReportProduct = Readonly<{
  id: ReportProductId;
  title: string;
  englishTitle: string;
  description: string;
  businessQuestion: string;
  icon: ComponentType<{ className?: string }>;
  outputs: readonly string[];
  statementFocus?: StatementProductFocus;
  targets: readonly ReportProductTarget[];
}>;

const PERIOD_PROPERTY_OWNER = ['period', 'property', 'owner'] as const;
const PERIOD_PROPERTY_CONTRACT = ['period', 'property', 'contract'] as const;
const COLLECTION_SCOPE = [
  'period',
  'asOf',
  'property',
  'unit',
  'tenant',
  'contract',
  'status',
] as const;
const LEASING_SCOPE = ['period', 'asOf', 'property', 'unit', 'tenant'] as const;
const OPERATIONS_SCOPE = ['period', 'property', 'unit', 'costCenter'] as const;
const PROPERTY_SCOPE = ['period', 'property', 'unit'] as const;
const FINANCIAL_SCOPE = ['period', 'asOf'] as const;

const ownerTargets: readonly ReportProductTarget[] = [
  {
    id: 'statement',
    label: 'كشف المالك',
    description:
      'الحركة المعتمدة، الاستقطاعات، العمولات والتسويات مع مستند المالك المهني الكامل.',
    section: 'statements',
    view: '',
    visibleFilterFields: PERIOD_PROPERTY_OWNER,
    documentKind: 'owner-pack',
  },
];

const tenantTargets: readonly ReportProductTarget[] = [
  {
    id: 'statement',
    label: 'كشف المستأجر',
    description:
      'استحقاقات العقد، التحصيلات والعكوس والرصيد الجاري من مصدر كشف المستأجر المعتمد.',
    section: 'statements',
    view: '',
    visibleFilterFields: PERIOD_PROPERTY_CONTRACT,
    documentKind: 'tenant-statement',
  },
];

const collectionsTargets: readonly ReportProductTarget[] = [
  {
    id: 'period',
    label: 'المستحق والتحصيل',
    description: 'المستحق والمحصّل والمتبقي للفترة.',
    section: 'analytics',
    view: 'collections',
    visibleFilterFields: COLLECTION_SCOPE,
    documentKind: 'rent-roll',
  },
  {
    id: 'arrears',
    label: 'المتأخرات والأعمار',
    description: 'الأرصدة المتأخرة وأعمار الدين والانكشافات.',
    section: 'analytics',
    view: 'overdue',
    visibleFilterFields: COLLECTION_SCOPE,
    documentKind: 'aged-arrears',
  },
  {
    id: 'follow-up',
    label: 'المتابعة',
    description: 'أولوية المتابعة مع روابط التنفيذ التشغيلي.',
    section: 'analytics',
    view: 'follow_up',
    visibleFilterFields: COLLECTION_SCOPE,
  },
  {
    id: 'movement',
    label: 'حركة التحصيل',
    description: 'التحصيل اليومي وطرق السداد والإيصالات المرتبطة.',
    section: 'analytics',
    view: 'collection_movement',
    visibleFilterFields: COLLECTION_SCOPE,
  },
];

const portfolioTargets: readonly ReportProductTarget[] = [
  {
    id: 'property',
    label: 'أداء العقار',
    description: 'الأداء المالي والتشغيلي للعقار والوحدات.',
    section: 'analytics',
    view: 'property_analytics',
    visibleFilterFields: PROPERTY_SCOPE,
    documentKind: 'property-pack',
  },
  {
    id: 'office',
    label: 'صورة المحفظة',
    description: 'الصورة التنفيذية المجمعة للمحفظة من المصادر المعتمدة.',
    section: 'analytics',
    view: 'overview',
    visibleFilterFields: PERIOD_PROPERTY_OWNER,
    documentKind: 'portfolio-performance',
  },
  {
    id: 'occupancy',
    label: 'الإشغال والشغور',
    description: 'حالات الوحدات ومدد الشغور حسب العقار.',
    section: 'analytics',
    view: 'occupancy',
    visibleFilterFields: LEASING_SCOPE,
  },
  {
    id: 'expiring',
    label: 'انتهاء العقود',
    description: 'العقود القريبة من الانتهاء والدخل المعرض للخطر.',
    section: 'analytics',
    view: 'expiring',
    visibleFilterFields: LEASING_SCOPE,
  },
  {
    id: 'operations',
    label: 'التشغيل',
    description: 'قراءة موحدة لمصادر تكلفة التشغيل دون خلط محاسبي.',
    section: 'analytics',
    view: 'operations_overview',
    visibleFilterFields: OPERATIONS_SCOPE,
  },
  {
    id: 'maintenance',
    label: 'الصيانة',
    description: 'تكلفة الصيانة وحالاتها وأولوياتها.',
    section: 'analytics',
    view: 'maintenance_analytics',
    visibleFilterFields: OPERATIONS_SCOPE,
  },
  {
    id: 'expenses',
    label: 'المصروفات',
    description: 'المصروفات المسجلة حسب الفترة والعقار والتصنيف.',
    section: 'analytics',
    view: 'expenses',
    visibleFilterFields: OPERATIONS_SCOPE,
  },
  {
    id: 'services',
    label: 'الخدمات والمرافق',
    description: 'فواتير الخدمات وجهة التحمل وإثباتات السداد المتاحة.',
    section: 'analytics',
    view: 'services',
    visibleFilterFields: OPERATIONS_SCOPE,
  },
];

const financialTargets: readonly ReportProductTarget[] = [
  {
    id: 'financial-movement',
    label: 'الحركة والتسويات',
    description:
      'الحركة المالية والكاش فلو من المصادر المعتمدة دون إنشاء دفتر موازٍ.',
    section: 'statements',
    view: '',
    visibleFilterFields: ['period'],
  },
  {
    id: 'statements',
    label: 'القوائم وميزان المراجعة',
    description: 'ميزان المراجعة وقائمة الدخل والمركز المالي.',
    section: 'accounting',
    view: 'accounting_reports',
    visibleFilterFields: FINANCIAL_SCOPE,
  },
  {
    id: 'ledger',
    label: 'دفتر الأستاذ',
    description: 'دفتر الأستاذ والشجرة من GL المعتمد.',
    section: 'accounting',
    view: 'general_ledger',
    visibleFilterFields: FINANCIAL_SCOPE,
  },
  {
    id: 'revenue',
    label: 'تسوية الإيرادات',
    description: 'مراجعة الإيراد المؤجل والتسوية المرتبطة به.',
    section: 'accounting',
    view: 'deferred_revenue',
    visibleFilterFields: FINANCIAL_SCOPE,
  },
];

export const REPORT_PRODUCTS: readonly ReportProduct[] = [
  {
    id: 'owner-comprehensive-statement',
    title: 'كشف المالك الشامل',
    englishTitle: 'Owner Comprehensive Statement',
    description:
      'مستند الثقة الرئيسي للمالك: التحصيل، المصروفات، الصيانة، العمولات، الشغور والتسويات في كشف واحد.',
    businessQuestion:
      'ماذا حدث فعليًا لأموال وأصول المالك خلال الفترة، وما صافي المستحق له؟',
    icon: FileText,
    outputs: ['معاينة', 'طباعة', 'PDF', 'Excel', 'مشاركة'],
    statementFocus: 'owner',
    targets: ownerTargets,
  },
  {
    id: 'tenant-statement',
    title: 'كشف حساب المستأجر',
    englishTitle: 'Tenant Statement',
    description:
      'حركة عقد المستأجر من الاستحقاق إلى السداد الجزئي أو الكامل مع الرصيد والمراجع المتاحة.',
    businessQuestion:
      'ما الذي استحق على هذا المستأجر، وما الذي دُفع، وما الرصيد المتبقي؟',
    icon: UserRound,
    outputs: ['معاينة', 'طباعة', 'PDF', 'Excel', 'مشاركة'],
    statementFocus: 'tenant',
    targets: tenantTargets,
  },
  {
    id: 'collections-arrears-cheques',
    title: 'التحصيل والمتأخرات والشيكات',
    englishTitle: 'Collections, Arrears & Cheques',
    description:
      'المستحق مقابل المحصل، الدفعات الجزئية، أعمار الديون والمتابعة. لا تُعرض دورة شيكات غير موجودة في المصدر.',
    businessQuestion:
      'من عليه مبالغ الآن، منذ متى، وما الذي يجب متابعته أولًا؟',
    icon: ReceiptText,
    outputs: ['معاينة', 'طباعة/PDF حسب القسم', 'Excel', 'مشاركة'],
    targets: collectionsTargets,
  },
  {
    id: 'portfolio-property-performance',
    title: 'أداء المحفظة والعقارات',
    englishTitle: 'Portfolio & Property Performance',
    description:
      'تركيب المحفظة والإشغال والشغور والتحصيل والمصروفات والصيانة وانتهاء العقود في منتج تحليلي واحد.',
    businessQuestion:
      'أي العقارات تعمل جيدًا، وأين توجد خسارة أو شغور أو تكلفة تشغيل تحتاج قرارًا؟',
    icon: Building2,
    outputs: ['معاينة', 'طباعة', 'PDF', 'Excel حيث يفيد', 'مشاركة'],
    targets: portfolioTargets,
  },
  {
    id: 'financial-settlement-pack',
    title: 'الحزمة المالية والتسويات',
    englishTitle: 'Financial & Settlement Pack',
    description:
      'الحركة المالية، التسويات، القوائم ودفتر الأستاذ وتسوية الإيرادات من المصادر المحاسبية المعتمدة.',
    businessQuestion:
      'هل الحركة المالية والتسويات والمخرجات المحاسبية متسقة وقابلة للمراجعة؟',
    icon: Landmark,
    outputs: ['معاينة', 'طباعة/PDF حسب القسم', 'Excel', 'مشاركة'],
    statementFocus: 'financial',
    targets: financialTargets,
  },
] as const;

export function getReportProductFilterFields(
  target: ReportProductTarget,
): readonly ReportFilterFieldId[] {
  return target.visibleFilterFields;
}

export function getReportProduct(value: unknown): ReportProduct | undefined {
  if (typeof value !== 'string') return undefined;
  return REPORT_PRODUCTS.find((product) => product.id === value.trim());
}

/** Canonical product target lookup: only target IDs are valid on new URLs. */
export function getReportProductTarget(
  product: ReportProduct,
  value: unknown,
): ReportProductTarget {
  if (typeof value === 'string') {
    const match = product.targets.find((target) => target.id === value);
    if (match) return match;
  }
  return product.targets[0];
}

export function getReportProductTargetForLocation(
  section: ReportSectionId,
  view: ReportViewId,
):
  | Readonly<{ product: ReportProduct; target: ReportProductTarget }>
  | undefined {
  for (const product of REPORT_PRODUCTS) {
    const target = product.targets.find(
      (candidate) => candidate.section === section && candidate.view === view,
    );
    if (target) return { product, target };
  }
  return undefined;
}

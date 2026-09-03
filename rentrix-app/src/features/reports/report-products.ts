import type { ComponentType } from 'react';
import { Building2, FileText, Landmark, ReceiptText, UserRound } from 'lucide-react';
import type { ReportSectionId } from './reports-page.sections';
import type { ReportViewId } from './report-view-registry';
import type { ReportWorkspaceId } from './report-workspaces';

export type ReportProductId =
  | 'owner-comprehensive-statement'
  | 'tenant-statement'
  | 'collections-arrears-cheques'
  | 'portfolio-property-performance'
  | 'financial-settlement-pack';

export type StatementProductFocus = 'owner' | 'tenant' | 'financial' | 'all';

export type ReportProductTarget = Readonly<{
  id: string;
  label: string;
  description: string;
  workspace: ReportWorkspaceId;
  section: ReportSectionId;
  view: ReportViewId;
  /**
   * Which canonical document the premium action bar may offer for this
   * target. Only documented, source-backed builders are allowed; a target
   * without one shows preview/permissions truthfully and keeps the
   * section-owned exports inside its body — the bar never invents a
   * document type to make a button appear.
   */
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

const ownerTargets: readonly ReportProductTarget[] = [
  {
    id: 'statement',
    label: 'كشف المالك',
    description: 'الحركة المعتمدة، الاستقطاعات، العمولات والتسويات مع مستند المالك المهني الكامل.',
    workspace: 'statements',
    section: 'statements',
    view: '',
    documentKind: 'owner-pack',
  },
];

const tenantTargets: readonly ReportProductTarget[] = [
  {
    id: 'statement',
    label: 'كشف المستأجر',
    description: 'استحقاقات العقد، التحصيلات والعكوس والرصيد الجاري من مصدر كشف المستأجر المعتمد.',
    workspace: 'statements',
    section: 'statements',
    view: '',
    documentKind: 'tenant-statement',
  },
];

const collectionsTargets: readonly ReportProductTarget[] = [
  { id: 'period', label: 'المستحق والتحصيل', description: 'المستحق والمحصّل والمتبقي للفترة.', workspace: 'collections', section: 'analytics', view: 'collections', documentKind: 'rent-roll' },
  { id: 'arrears', label: 'المتأخرات والأعمار', description: 'الأرصدة المتأخرة وأعمار الدين والانكشافات.', workspace: 'collections', section: 'analytics', view: 'overdue', documentKind: 'aged-arrears' },
  { id: 'follow-up', label: 'المتابعة', description: 'أولوية المتابعة مع روابط التنفيذ التشغيلي.', workspace: 'collections', section: 'analytics', view: 'follow_up' },
  { id: 'movement', label: 'حركة التحصيل', description: 'التحصيل اليومي وطرق السداد والإيصالات المرتبطة.', workspace: 'collections', section: 'analytics', view: 'collection_movement' },
];

const portfolioTargets: readonly ReportProductTarget[] = [
  { id: 'property', label: 'أداء العقار', description: 'الأداء المالي والتشغيلي للعقار والوحدات.', workspace: 'properties', section: 'analytics', view: 'property_analytics', documentKind: 'property-pack' },
  { id: 'office', label: 'صورة المحفظة', description: 'الصورة التنفيذية المجمعة للمحفظة من المصادر المعتمدة.', workspace: 'office', section: 'analytics', view: 'overview', documentKind: 'portfolio-performance' },
  { id: 'occupancy', label: 'الإشغال والشغور', description: 'حالات الوحدات ومدد الشغور حسب العقار.', workspace: 'leasing', section: 'analytics', view: 'occupancy' },
  { id: 'expiring', label: 'انتهاء العقود', description: 'العقود القريبة من الانتهاء والدخل المعرض للخطر.', workspace: 'leasing', section: 'analytics', view: 'expiring' },
  { id: 'operations', label: 'التشغيل', description: 'قراءة موحدة لمصادر تكلفة التشغيل دون خلط محاسبي.', workspace: 'operations', section: 'analytics', view: 'operations_overview' },
  { id: 'maintenance', label: 'الصيانة', description: 'تكلفة الصيانة وحالاتها وأولوياتها.', workspace: 'operations', section: 'analytics', view: 'maintenance_analytics' },
  { id: 'expenses', label: 'المصروفات', description: 'المصروفات المسجلة حسب الفترة والعقار والتصنيف.', workspace: 'operations', section: 'analytics', view: 'expenses' },
  { id: 'services', label: 'الخدمات والمرافق', description: 'فواتير الخدمات وجهة التحمل وإثباتات السداد المتاحة.', workspace: 'operations', section: 'analytics', view: 'services' },
];

const financialTargets: readonly ReportProductTarget[] = [
  { id: 'financial-movement', label: 'الحركة والتسويات', description: 'الحركة المالية والكاش فلو من المصادر المعتمدة دون إنشاء دفتر موازٍ.', workspace: 'statements', section: 'statements', view: '' },
  { id: 'statements', label: 'القوائم وميزان المراجعة', description: 'ميزان المراجعة وقائمة الدخل والمركز المالي.', workspace: 'financial_review', section: 'accounting', view: 'accounting_reports' },
  { id: 'ledger', label: 'دفتر الأستاذ', description: 'دفتر الأستاذ والشجرة من GL المعتمد.', workspace: 'financial_review', section: 'accounting', view: 'general_ledger' },
  { id: 'revenue', label: 'تسوية الإيرادات', description: 'مراجعة الإيراد المؤجل والتسوية المرتبطة به.', workspace: 'financial_review', section: 'accounting', view: 'deferred_revenue' },
];

export const REPORT_PRODUCTS: readonly ReportProduct[] = [
  {
    id: 'owner-comprehensive-statement',
    title: 'كشف المالك الشامل',
    englishTitle: 'Owner Comprehensive Statement',
    description: 'مستند الثقة الرئيسي للمالك: التحصيل، المصروفات، الصيانة، العمولات، الشغور والتسويات في كشف واحد.',
    businessQuestion: 'ماذا حدث فعليًا لأموال وأصول المالك خلال الفترة، وما صافي المستحق له؟',
    icon: FileText,
    outputs: ['معاينة', 'طباعة', 'PDF', 'Excel', 'مشاركة'],
    statementFocus: 'owner',
    targets: ownerTargets,
  },
  {
    id: 'tenant-statement',
    title: 'كشف حساب المستأجر',
    englishTitle: 'Tenant Statement',
    description: 'حركة عقد المستأجر من الاستحقاق إلى السداد الجزئي أو الكامل مع الرصيد والمراجع المتاحة.',
    businessQuestion: 'ما الذي استحق على هذا المستأجر، وما الذي دُفع، وما الرصيد المتبقي؟',
    icon: UserRound,
    outputs: ['معاينة', 'طباعة', 'PDF', 'Excel', 'مشاركة'],
    statementFocus: 'tenant',
    targets: tenantTargets,
  },
  {
    id: 'collections-arrears-cheques',
    title: 'التحصيل والمتأخرات والشيكات',
    englishTitle: 'Collections, Arrears & Cheques',
    description: 'المستحق مقابل المحصل، الدفعات الجزئية، أعمار الديون والمتابعة. لا تُعرض دورة شيكات غير موجودة في المصدر.',
    businessQuestion: 'من عليه مبالغ الآن، منذ متى، وما الذي يجب متابعته أولًا؟',
    icon: ReceiptText,
    outputs: ['معاينة', 'طباعة/PDF حسب القسم', 'Excel', 'مشاركة'],
    targets: collectionsTargets,
  },
  {
    id: 'portfolio-property-performance',
    title: 'أداء المحفظة والعقارات',
    englishTitle: 'Portfolio & Property Performance',
    description: 'تركيب المحفظة والإشغال والشغور والتحصيل والمصروفات والصيانة وانتهاء العقود في منتج تحليلي واحد.',
    businessQuestion: 'أي العقارات تعمل جيدًا، وأين توجد خسارة أو شغور أو تكلفة تشغيل تحتاج قرارًا؟',
    icon: Building2,
    outputs: ['معاينة', 'طباعة', 'PDF', 'Excel حيث يفيد', 'مشاركة'],
    targets: portfolioTargets,
  },
  {
    id: 'financial-settlement-pack',
    title: 'الحزمة المالية والتسويات',
    englishTitle: 'Financial & Settlement Pack',
    description: 'الحركة المالية، التسويات، القوائم ودفتر الأستاذ وتسوية الإيرادات من المصادر المحاسبية المعتمدة.',
    businessQuestion: 'هل الحركة المالية والتسويات والمخرجات المحاسبية متسقة وقابلة للمراجعة؟',
    icon: Landmark,
    outputs: ['معاينة', 'طباعة/PDF حسب القسم', 'Excel', 'مشاركة'],
    statementFocus: 'financial',
    targets: financialTargets,
  },
] as const;

/** Real route (not a dialog) for opening a premium product. */
export function reportProductPath(product: ReportProduct | Pick<ReportProduct, 'id'>): string {
  return `/reports/${product.id}`;
}

export function getReportProduct(value: unknown): ReportProduct | undefined {
  if (typeof value !== 'string') return undefined;
  return REPORT_PRODUCTS.find((product) => product.id === value.trim());
}

export function getReportProductTarget(product: ReportProduct, value: unknown): ReportProductTarget {
  if (typeof value === 'string') {
    const match = product.targets.find((target) => target.id === value || target.view === value);
    if (match) return match;
  }
  return product.targets[0];
}

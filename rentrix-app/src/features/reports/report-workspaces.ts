import type { ComponentType } from 'react';
import {
  BarChart3,
  Building2,
  FileText,
  ReceiptText,
  Scale,
  UsersRound,
  Wrench,
} from 'lucide-react';
import type { ReportSectionId } from './reports-page.sections';
import type { ReportViewId } from './report-view-registry';
import type { ReportFilterFieldId, ReportsFilterState } from './reports-workspace-filters';

/**
 * MALEK Reports Center — workspace registry.
 *
 * The owner-facing reports center is organised around seven business
 * workspaces: six daily decision surfaces plus one specialist financial
 * review. Every workspace maps onto the existing `(section, view)` routing
 * contract — the registry is the single configuration point for:
 *
 *   - Arabic labels and descriptions (never implementation terminology),
 *   - normal vs specialist classification,
 *   - owned sub-views and legacy view-id compatibility,
 *   - which global filters are relevant to the workspace's business question,
 *   - permitted drill-through destinations.
 *
 * The legacy `?section=&view=` deep links stay resolvable; new user-facing
 * navigation uses `?workspace=&view=`.
 */

export type ReportWorkspaceId =
  | 'office'
  | 'collections'
  | 'leasing'
  | 'operations'
  | 'properties'
  | 'statements'
  | 'financial_review';

export type ReportWorkspaceSubView = Readonly<{
  /** Internal routing view id (legacy-compatible). */
  id: ReportViewId;
  /** Arabic user-facing label. */
  label: string;
  description?: string;
}>;

export type ReportWorkspace = Readonly<{
  id: ReportWorkspaceId;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  /** Specialist surfaces stay accessible but visually secondary. */
  specialist: boolean;
  defaultSection: ReportSectionId;
  defaultView: ReportViewId;
  subViews: readonly ReportWorkspaceSubView[];
  /** Legacy view ids that resolve into this workspace. */
  legacyViews: readonly ReportViewId[];
  /** Global filters shown for this workspace's business question. */
  visibleFilterFields: readonly ReportFilterFieldId[];
  /** Workspaces this surface may drill through to. */
  drillTargets: readonly ReportWorkspaceId[];
}>;

export const REPORT_WORKSPACES: readonly ReportWorkspace[] = [
  {
    id: 'office',
    label: 'أداء المكتب',
    description:
      'قراءة تنفيذية مختصرة للمستحق والمحصّل والمتبقي والمتأخر والإشغال والمصروفات، مع أهم الحالات التي تحتاج تدخلًا — وكل مؤشر يقودك إلى ورشة العمل المختصة به.',
    icon: BarChart3,
    specialist: false,
    defaultSection: 'analytics',
    defaultView: 'overview',
    subViews: [],
    legacyViews: ['overview'],
    visibleFilterFields: ['period', 'property', 'owner'],
    drillTargets: ['collections', 'leasing', 'operations', 'properties', 'statements'],
  },
  {
    id: 'collections',
    label: 'التحصيل والمتأخرات',
    description:
      'كم كان المستحق وكم تم تحصيله وكم تبقى، ومن المتأخر وبأي عمر دين، ومن يحتاج متابعة أولًا — الفترة وأعمار الدين معروضان بمعنييهما الزمنيين المنفصلين.',
    icon: ReceiptText,
    specialist: false,
    defaultSection: 'analytics',
    defaultView: 'collections',
    subViews: [
      { id: 'collections', label: 'ملخص الفترة', description: 'المستحق والمحصّل والمتبقي خلال الفترة مع سجل الإيجارات.' },
      { id: 'overdue', label: 'المتأخرات والأعمار', description: 'المبالغ المتأخرة ومدد التأخير وأعمار الديون وأعلى الانكشافات.' },
      { id: 'follow_up', label: 'المتابعة', description: 'قائمة متابعة مرتبة حسب الخطر والقيمة، مع روابط للشاشات التشغيلية — التقارير تحدد الإجراء والتشغيل ينفذه.' },
      { id: 'collection_movement', label: 'حركة التحصيل', description: 'التحصيل اليومي حسب طرق السداد وأحدث الإيصالات المرتبطة.' },
    ],
    legacyViews: ['collections', 'overdue', 'follow_up', 'collection_movement'],
    visibleFilterFields: ['period', 'asOf', 'property', 'unit', 'tenant', 'contract', 'status'],
    drillTargets: ['office', 'properties', 'statements'],
  },
  {
    id: 'leasing',
    label: 'العقود والإشغال',
    description:
      'ما المشغول وما الشاغر وكم استمر الشغور، وأي العقود تقترب من الانتهاء وتحتاج قرار تجديد، وكم الإيجار المعرض للخطر.',
    icon: FileText,
    specialist: false,
    defaultSection: 'analytics',
    defaultView: 'occupancy',
    subViews: [
      { id: 'occupancy', label: 'الإشغال والشغور', description: 'نسب الإشغال والوحدات الشاغرة ومدد الشغور حسب العقار.' },
      { id: 'expiring', label: 'العقود القريبة من الانتهاء', description: 'العقود المنتهية قريبًا بالأيام المتبقية والدخل المعرض للخطر.' },
    ],
    legacyViews: ['occupancy', 'expiring'],
    visibleFilterFields: ['period', 'asOf', 'property', 'unit', 'tenant'],
    drillTargets: ['office', 'properties', 'statements'],
  },
  {
    id: 'operations',
    label: 'التشغيل والمصروفات',
    description:
      'من أين تأتي تكلفة التشغيل ولماذا: الصيانة، والمصروفات المسجلة، والخدمات والمرافق — مؤشرات منفصلة المصدر تُعرض بلا جمع تلقائي.',
    icon: Wrench,
    specialist: false,
    defaultSection: 'analytics',
    defaultView: 'operations_overview',
    subViews: [
      { id: 'operations_overview', label: 'نظرة تشغيلية', description: 'مؤشرات التكلفة المنفصلة المصدر وأبرز مواضع الإنفاق.' },
      { id: 'maintenance_analytics', label: 'الصيانة', description: 'الطلبات والحالات والأولويات وتكلفة الصيانة حسب النطاق.' },
      { id: 'expenses', label: 'المصروفات', description: 'المصروفات المسجلة حسب الفترة والتصنيف والعقار.' },
      { id: 'services', label: 'الخدمات والمرافق', description: 'فواتير الخدمات وجهة التحمل والمدفوع والمتبقي وإثباتات الدفع.' },
    ],
    legacyViews: ['operations_overview', 'maintenance_analytics', 'expenses', 'services'],
    visibleFilterFields: ['period', 'property', 'unit', 'costCenter'],
    drillTargets: ['office', 'properties'],
  },
  {
    id: 'properties',
    label: 'العقارات والوحدات',
    description:
      'أداء العقار والوحدة من الإشغال والتحصيل والمصروفات والصيانة — مؤشرات من مصادرها المعتمدة، والتفاصيل الأعمق بالانتقال إلى ورشة العمل المالكة لها.',
    icon: Building2,
    specialist: false,
    defaultSection: 'analytics',
    defaultView: 'property_analytics',
    subViews: [],
    legacyViews: ['property_analytics'],
    visibleFilterFields: ['period', 'property', 'unit'],
    drillTargets: ['collections', 'leasing', 'operations', 'statements'],
  },
  {
    id: 'statements',
    label: 'الكشوف',
    description:
      'كشف المالك وكشف المستأجر والتسويات والحركة المرتبطة بكل طرف — من المصدر المحاسبي المعتمد.',
    icon: UsersRound,
    specialist: false,
    defaultSection: 'statements',
    defaultView: '',
    subViews: [],
    legacyViews: [],
    visibleFilterFields: ['period', 'property', 'owner', 'contract'],
    drillTargets: ['office', 'properties'],
  },
  {
    id: 'financial_review',
    label: 'المراجعة المالية',
    description:
      'مخرجات محاسبية متقدمة للمختصين: ميزان المراجعة والقوائم، دفتر الأستاذ والشجرة، وتسوية الإيرادات — خارج التنقل اليومي.',
    icon: Scale,
    specialist: true,
    defaultSection: 'accounting',
    defaultView: 'accounting_reports',
    subViews: [
      { id: 'accounting_reports', label: 'ميزان المراجعة والقوائم' },
      { id: 'general_ledger', label: 'دفتر الأستاذ والشجرة' },
      { id: 'deferred_revenue', label: 'تسوية الإيرادات' },
    ],
    legacyViews: ['accounting_reports', 'general_ledger', 'deferred_revenue'],
    visibleFilterFields: ['period', 'asOf'],
    drillTargets: [],
  },
] as const;

/** `?workspace=` is the user-facing deep-link key for the reports center. */
export const WORKSPACE_SEARCH_KEY = 'workspace';

export function getReportWorkspace(id: unknown): ReportWorkspace | undefined {
  if (typeof id !== 'string') return undefined;
  const normalized = id.toLowerCase().trim();
  return REPORT_WORKSPACES.find((workspace) => workspace.id === normalized);
}

export function getReportWorkspaceSubView(workspace: ReportWorkspace, view: ReportViewId): ReportWorkspaceSubView | undefined {
  return workspace.subViews.find((subView) => subView.id === view);
}

export function isWorkspaceSubView(workspace: ReportWorkspace, view: ReportViewId): boolean {
  return workspace.subViews.some((subView) => subView.id === view);
}

/**
 * Map a legacy `(section, view)` location onto its owning workspace. Every
 * legacy id must land somewhere so old bookmarks keep working.
 */
export function getWorkspaceForReportLocation(section: ReportSectionId, view: ReportViewId): ReportWorkspaceId {
  const workspace = REPORT_WORKSPACES.find(
    (candidate) => candidate.defaultSection === section && candidate.legacyViews.includes(view),
  );
  if (workspace) return workspace.id;
  if (section === 'statements') return 'statements';
  return 'office';
}

export type ReportDrillHandler = (
  workspace: ReportWorkspaceId,
  view?: ReportViewId,
  filterPatch?: Partial<ReportsFilterState>,
) => void;

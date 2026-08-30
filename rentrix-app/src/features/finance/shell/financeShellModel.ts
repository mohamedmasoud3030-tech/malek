/**
 * Finance workspace navigation, permissions and deep-link resolution.
 *
 * The routine shell is task-first: operators land on invoices and move between
 * the few independent money jobs they actually perform. Specialist/history
 * views remain addressable without competing in the daily navigation.
 */
import {
  BadgeDollarSign,
  CalendarDays,
  ClipboardList,
  FileCheck,
  FileSpreadsheet,
  HandCoins,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  WalletCards,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { canAccess, type AppPermission, type AuthorizationContext } from '@/features/auth/permissions';

export type FinanceSectionId =
  | 'overview'
  | 'collections'
  | 'expenses'
  | 'fees'
  | 'funds'
  | 'banking';

export type FinanceViewId =
  | 'overview'
  | 'invoices'
  | 'receipts'
  | 'arrears'
  | 'expenses'
  | 'commissions'
  | 'deposits'
  | 'owner_settlements'
  | 'fixed_monthly_accruals'
  | 'bank_reconciliation';

export interface FinanceViewDefinition {
  id: FinanceViewId;
  sectionId: FinanceSectionId;
  label: string;
  icon: LucideIcon;
  permission: AppPermission | null;
  /** Hidden views stay deep-linkable but do not become another routine tab. */
  showInSectionNavigation?: boolean;
}

export interface FinanceSectionDefinition {
  id: FinanceSectionId;
  label: string;
  icon: LucideIcon;
  defaultViewId: FinanceViewId | null;
  showInPrimaryNavigation: boolean;
}

export const FINANCE_SECTIONS: readonly FinanceSectionDefinition[] = [
  { id: 'collections', label: 'التحصيل', icon: ReceiptText, defaultViewId: 'invoices', showInPrimaryNavigation: true },
  { id: 'fees', label: 'دخل المكتب', icon: BadgeDollarSign, defaultViewId: 'fixed_monthly_accruals', showInPrimaryNavigation: true },
  { id: 'expenses', label: 'المصروفات', icon: WalletCards, defaultViewId: 'expenses', showInPrimaryNavigation: true },
  {
    id: 'funds',
    label: 'أموال الملاك',
    icon: HandCoins,
    defaultViewId: 'owner_settlements',
    showInPrimaryNavigation: true,
  },
  { id: 'banking', label: 'البنوك', icon: Landmark, defaultViewId: 'bank_reconciliation', showInPrimaryNavigation: true },
  // Compatibility only. The old cockpit is no longer a routine destination.
  { id: 'overview', label: 'وضع المال', icon: LayoutDashboard, defaultViewId: 'overview', showInPrimaryNavigation: false },
];

export const FINANCE_VIEWS: readonly FinanceViewDefinition[] = [
  { id: 'invoices', sectionId: 'collections', label: 'الفواتير', icon: FileSpreadsheet, permission: null },
  { id: 'receipts', sectionId: 'collections', label: 'الإيصالات', icon: ReceiptText, permission: null },
  { id: 'arrears', sectionId: 'collections', label: 'المتأخرات', icon: ClipboardList, permission: 'arrears.view', showInSectionNavigation: false },
  { id: 'fixed_monthly_accruals', sectionId: 'fees', label: 'أتعاب الإدارة', icon: CalendarDays, permission: 'financial.fixed_monthly_accruals.view' },
  { id: 'commissions', sectionId: 'fees', label: 'العمولات', icon: BadgeDollarSign, permission: 'commissions.view' },
  { id: 'expenses', sectionId: 'expenses', label: 'المصروفات', icon: WalletCards, permission: 'expenses.view' },
  { id: 'owner_settlements', sectionId: 'funds', label: 'تسويات الملاك', icon: HandCoins, permission: 'financial.owner_settlements.view' },
  { id: 'deposits', sectionId: 'funds', label: 'تأمينات المستأجرين', icon: FileCheck, permission: 'financial.deposits.view' },
  { id: 'bank_reconciliation', sectionId: 'banking', label: 'المطابقة البنكية', icon: Landmark, permission: 'financial.bank_reconciliation.view' },
  { id: 'overview', sectionId: 'overview', label: 'وضع المال', icon: LayoutDashboard, permission: null, showInSectionNavigation: false },
];

export function isViewPermitted(
  authorization: AuthorizationContext | null | undefined,
  view: FinanceViewDefinition,
): boolean {
  if (!authorization) return false;
  return view.permission === null ? true : canAccess(authorization, view.permission);
}

export function getPermittedViews(
  authorization: AuthorizationContext | null | undefined,
): FinanceViewDefinition[] {
  return FINANCE_VIEWS.filter((view) => isViewPermitted(authorization, view));
}

export function getRoutineFinanceViews(
  authorization: AuthorizationContext | null | undefined,
  sectionId: FinanceSectionId | null,
): FinanceViewDefinition[] {
  if (!sectionId) return [];
  return getPermittedViews(authorization).filter(
    (view) => view.sectionId === sectionId && view.showInSectionNavigation !== false,
  );
}

/**
 * Resolve the first human-facing view for a section without assuming that the
 * configured default is permitted for the current role.
 */
export function getDefaultFinanceView(
  authorization: AuthorizationContext | null | undefined,
  sectionId: FinanceSectionId | null,
): FinanceViewDefinition | undefined {
  if (!sectionId) return undefined;
  const routineViews = getRoutineFinanceViews(authorization, sectionId);
  const section = FINANCE_SECTIONS.find((candidate) => candidate.id === sectionId);
  return routineViews.find((view) => view.id === section?.defaultViewId) ?? routineViews[0];
}

export function getPermittedSections(
  authorization: AuthorizationContext | null | undefined,
): FinanceSectionDefinition[] {
  const permittedViews = getPermittedViews(authorization);
  const permittedSectionIds = new Set(permittedViews.map((view) => view.sectionId));
  return FINANCE_SECTIONS.filter(
    (section) => section.showInPrimaryNavigation && permittedSectionIds.has(section.id),
  );
}

export interface FinancialsSearch {
  section?: string;
  view?: string;
}

export type ResolvedFinanceLocation = Readonly<{
  resolvedSectionId: FinanceSectionId;
  resolvedViewId: FinanceViewId;
  /** @deprecated Kept for old callers. Commissions now resolve into Income. */
  isLegacyCommissionsLink: boolean;
}>;

/** Resolve raw ?section=&view= to one coherent, permitted Money location. */
export function resolveFinanceLocation(
  rawSection: string,
  rawView: string,
  authorization: AuthorizationContext | null | undefined,
): ResolvedFinanceLocation {
  let sId: FinanceSectionId = 'collections';
  let vId: FinanceViewId = 'invoices';

  const sec = rawSection.toLowerCase().trim();
  const vi = rawView.toLowerCase().trim();

  // Old /financials and ?section=overview links now land on the primary job.
  if (!sec || sec === 'overview') {
    sId = 'collections';
    vId = 'invoices';
  } else if (['collections', 'invoices', 'receipts', 'arrears'].includes(sec)) {
    sId = 'collections';
    const defaultView = sec === 'collections' ? 'invoices' : sec;
    vId = (vi || defaultView) as FinanceViewId;
  } else if (sec === 'expenses') {
    sId = 'expenses';
    vId = 'expenses';
  } else if (sec === 'commissions' || vi === 'commissions') {
    sId = 'fees';
    vId = 'commissions';
  } else if (sec === 'fees' || sec === 'fixed_monthly_accruals' || vi === 'fixed_monthly_accruals') {
    sId = 'fees';
    vId = vi === 'commissions' ? 'commissions' : 'fixed_monthly_accruals';
  } else if (['funds', 'deposits', 'owner_settlements'].includes(sec)) {
    sId = 'funds';
    const defaultView = sec === 'funds' ? 'owner_settlements' : sec;
    vId = (vi || defaultView) as FinanceViewId;
  } else if (['banking', 'bank_reconciliation'].includes(sec)) {
    sId = 'banking';
    vId = 'bank_reconciliation';
  }

  const viewMeta = FINANCE_VIEWS.find((view) => view.id === vId);
  const permitted = viewMeta ? isViewPermitted(authorization, viewMeta) : false;
  if (!viewMeta || viewMeta.sectionId !== sId || !permitted) {
    const defaultView = getDefaultFinanceView(authorization, sId);
    if (defaultView) {
      vId = defaultView.id;
    } else {
      const firstSection = getPermittedSections(authorization)[0];
      const firstView = getDefaultFinanceView(authorization, firstSection?.id ?? null);
      sId = firstSection?.id ?? 'collections';
      vId = firstView?.id ?? 'invoices';
    }
  }

  return { resolvedSectionId: sId, resolvedViewId: vId, isLegacyCommissionsLink: false };
}

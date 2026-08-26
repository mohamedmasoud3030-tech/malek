/**
 * Finance Hub Unified Shell — Navigation, Permissions, Deep-Link Resolution.
 *
 * Single source of truth for finance navigation. Merges finance-hub/ and financials/
 * navigation models. All financial operational views (collections, expenses, fees,
 * funds, banking) resolve through this shell. Accounting views remain in accounting/.
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
}

export interface FinanceSectionDefinition {
  id: FinanceSectionId;
  label: string;
  icon: LucideIcon;
  defaultViewId: FinanceViewId | null;
}

export const FINANCE_SECTIONS: readonly FinanceSectionDefinition[] = [
  { id: 'overview', label: 'وضع المال', icon: LayoutDashboard, defaultViewId: 'overview' },
  { id: 'collections', label: 'المستحقات والتحصيل', icon: ReceiptText, defaultViewId: 'invoices' },
  { id: 'expenses', label: 'المصروفات والعمولات', icon: WalletCards, defaultViewId: 'expenses' },
  { id: 'fees', label: 'الأتعاب والاستحقاقات', icon: CalendarDays, defaultViewId: 'fixed_monthly_accruals' },
  { id: 'funds', label: 'التأمينات والملاك', icon: FileCheck, defaultViewId: 'deposits' },
  { id: 'banking', label: 'البنوك والمطابقة', icon: Landmark, defaultViewId: 'bank_reconciliation' },
];

export const FINANCE_VIEWS: readonly FinanceViewDefinition[] = [
  { id: 'overview', sectionId: 'overview', label: 'وضع المال', icon: LayoutDashboard, permission: null },
  { id: 'invoices', sectionId: 'collections', label: 'المستحقات والفواتير', icon: FileSpreadsheet, permission: null },
  { id: 'receipts', sectionId: 'collections', label: 'التحصيل والإيصالات', icon: ReceiptText, permission: null },
  { id: 'arrears', sectionId: 'collections', label: 'المتأخرات', icon: ClipboardList, permission: 'arrears.view' },
  { id: 'expenses', sectionId: 'expenses', label: 'المصروفات', icon: WalletCards, permission: 'expenses.view' },
  { id: 'commissions', sectionId: 'expenses', label: 'العمولات', icon: BadgeDollarSign, permission: 'commissions.view' },
  { id: 'fixed_monthly_accruals', sectionId: 'fees', label: 'استحقاق أتعاب الإدارة الشهرية', icon: CalendarDays, permission: 'financial.fixed_monthly_accruals.view' },
  { id: 'deposits', sectionId: 'funds', label: 'تأمينات المستأجرين', icon: FileCheck, permission: 'financial.deposits.view' },
  { id: 'owner_settlements', sectionId: 'funds', label: 'مستحقات وتسويات الملاك', icon: HandCoins, permission: 'financial.owner_settlements.view' },
  { id: 'bank_reconciliation', sectionId: 'banking', label: 'مطابقة كشف البنك', icon: Landmark, permission: 'financial.bank_reconciliation.view' },
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

export function getPermittedSections(
  authorization: AuthorizationContext | null | undefined,
): FinanceSectionDefinition[] {
  const permittedViews = getPermittedViews(authorization);
  const permittedSectionIds = new Set(permittedViews.map((view) => view.sectionId));
  return FINANCE_SECTIONS.filter((section) => permittedSectionIds.has(section.id));
}

export interface FinancialsSearch {
  section?: string;
  view?: string;
}

export type ResolvedFinanceLocation = Readonly<{
  resolvedSectionId: FinanceSectionId;
  resolvedViewId: FinanceViewId;
  /** @deprecated Commissions is now a first-class Money view. Always false. */
  isLegacyCommissionsLink: boolean;
}>;

/** Resolve raw ?section=&view= to one coherent, permitted Money location. */
export function resolveFinanceLocation(
  rawSection: string,
  rawView: string,
  authorization: AuthorizationContext | null | undefined,
): ResolvedFinanceLocation {
  let sId: FinanceSectionId = 'overview';
  let vId: FinanceViewId = 'overview';

  const sec = rawSection.toLowerCase().trim();
  const vi = rawView.toLowerCase().trim();

  if (sec === 'overview' || !sec) {
    sId = 'overview';
    vId = 'overview';
  } else if (['collections', 'invoices', 'receipts', 'arrears'].includes(sec)) {
    sId = 'collections';
    const defaultView = sec === 'collections' ? 'invoices' : sec;
    vId = (vi || defaultView) as FinanceViewId;
  } else if (sec === 'expenses') {
    sId = 'expenses';
    vId = vi === 'commissions' ? 'commissions' : 'expenses';
  } else if (sec === 'commissions' || vi === 'commissions') {
    sId = 'expenses';
    vId = 'commissions';
  } else if (sec === 'fees' || sec === 'fixed_monthly_accruals' || vi === 'fixed_monthly_accruals') {
    // Preserve old ?section=funds&view=fixed_monthly_accruals links while
    // giving management-fee accrual its truthful revenue/receivable home.
    sId = 'fees';
    vId = 'fixed_monthly_accruals';
  } else if (['funds', 'deposits', 'owner_settlements'].includes(sec)) {
    sId = 'funds';
    const defaultView = sec === 'funds' ? 'deposits' : sec;
    vId = (vi || defaultView) as FinanceViewId;
  } else if (['banking', 'bank_reconciliation'].includes(sec)) {
    sId = 'banking';
    vId = 'bank_reconciliation';
  }

  const viewMeta = FINANCE_VIEWS.find((view) => view.id === vId);
  if (viewMeta && viewMeta.sectionId !== sId) {
    const permittedSectionViews = FINANCE_VIEWS.filter(
      (view) => view.sectionId === sId && isViewPermitted(authorization, view),
    );
    if (permittedSectionViews[0]) {
      vId = permittedSectionViews[0].id;
    } else {
      sId = 'overview';
      vId = 'overview';
    }
  }

  return { resolvedSectionId: sId, resolvedViewId: vId, isLegacyCommissionsLink: false };
}
/**
 * R9 — Finance Shell / Information Architecture.
 *
 * ONE route model for the finance shell, extracted from financials-page.tsx so
 * the page renders workspaces while THIS module owns:
 *   - the section model (FinanceShell → Collections/Expenses/Owner Funds/Banking),
 *   - permission logic (view/section visibility),
 *   - URL compatibility + legacy deep-link resolution,
 *   - the structural coherence rules (section/view mismatch normalization).
 *
 * No business logic moved: workspaces stay in their features; the shell only
 * decides WHICH workspace mounts for a URL and a user.
 */
import {
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

export type FinanceSectionId = 'overview' | 'collections' | 'expenses' | 'funds' | 'banking';

export type FinanceViewId =
  | 'overview'
  | 'invoices'
  | 'receipts'
  | 'arrears'
  | 'expenses'
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
  { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard, defaultViewId: 'overview' },
  { id: 'collections', label: 'التحصيل والذمم', icon: ReceiptText, defaultViewId: 'invoices' },
  { id: 'expenses', label: 'المصروفات والمستحقات', icon: WalletCards, defaultViewId: 'expenses' },
  { id: 'funds', label: 'الأمانات والملاك', icon: FileCheck, defaultViewId: 'deposits' },
  { id: 'banking', label: 'البنوك والمطابقة', icon: Landmark, defaultViewId: 'bank_reconciliation' },
];

export const FINANCE_VIEWS: readonly FinanceViewDefinition[] = [
  { id: 'overview', sectionId: 'overview', label: 'نظرة عامة', icon: LayoutDashboard, permission: null },
  { id: 'invoices', sectionId: 'collections', label: 'الفواتير والتحصيل', icon: FileSpreadsheet, permission: null },
  { id: 'receipts', sectionId: 'collections', label: 'سجل الإيصالات', icon: ReceiptText, permission: null },
  { id: 'arrears', sectionId: 'collections', label: 'المتأخرات والديون', icon: ClipboardList, permission: 'arrears.view' },
  { id: 'expenses', sectionId: 'expenses', label: 'المصروفات', icon: WalletCards, permission: 'expenses.view' },
  { id: 'deposits', sectionId: 'funds', label: 'تأمينات المستأجرين', icon: FileCheck, permission: 'financial.deposits.view' },
  { id: 'owner_settlements', sectionId: 'funds', label: 'تسويات الملاك', icon: HandCoins, permission: 'financial.owner_settlements.view' },
  { id: 'fixed_monthly_accruals', sectionId: 'funds', label: 'استحقاق العمولة الشهرية', icon: CalendarDays, permission: 'financial.fixed_monthly_accruals.view' },
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
  const permittedSectionIds = new Set(permittedViews.map((v) => v.sectionId));
  return FINANCE_SECTIONS.filter((s) => permittedSectionIds.has(s.id));
}

export interface FinancialsSearch {
  section?: string;
  view?: string;
}

export type ResolvedFinanceLocation = Readonly<{
  resolvedSectionId: FinanceSectionId;
  resolvedViewId: FinanceViewId;
  /** True when the URL carries a retired commissions deep link. */
  isLegacyCommissionsLink: boolean;
}>;

/**
 * Deep-link contract: resolves raw ?section=&view= (including every legacy
 * spelling) to a coherent section/view pair. Pure — trivially testable.
 */
export function resolveFinanceLocation(
  rawSection: string,
  rawView: string,
  authorization: AuthorizationContext | null | undefined,
): ResolvedFinanceLocation {
  let sId: FinanceSectionId = 'overview';
  let vId: FinanceViewId = 'overview';

  const sec = rawSection.toLowerCase().trim();
  const vi = rawView.toLowerCase().trim();
  const isLegacyCommissionsLink = sec === 'commissions' || vi === 'commissions';

  if (sec === 'overview' || !sec) {
    sId = 'overview';
    vId = 'overview';
  } else if (['collections', 'invoices', 'receipts', 'arrears'].includes(sec)) {
    sId = 'collections';
    const defaultView = sec === 'collections' ? 'invoices' : sec;
    vId = (vi || defaultView) as FinanceViewId;
  } else if (sec === 'expenses') {
    sId = 'expenses';
    vId = 'expenses';
  } else if (isLegacyCommissionsLink) {
    // Redirect handled by the shell; map to a safe fallback so resolution
    // never crashes while the redirect is in flight.
    sId = 'expenses';
    vId = 'expenses';
  } else if (['funds', 'deposits', 'owner_settlements', 'fixed_monthly_accruals'].includes(sec)) {
    sId = 'funds';
    const defaultView = sec === 'funds' ? 'deposits' : sec;
    vId = (vi || defaultView) as FinanceViewId;
  } else if (['banking', 'bank_reconciliation'].includes(sec)) {
    sId = 'banking';
    vId = 'bank_reconciliation';
  }

  // Structural coherence: a view that does not belong to the resolved section
  // normalizes to the section's first permitted view (or overview).
  const viewMeta = FINANCE_VIEWS.find((v) => v.id === vId);
  if (viewMeta && viewMeta.sectionId !== sId) {
    const permittedSectionViews = FINANCE_VIEWS.filter(
      (v) => v.sectionId === sId && isViewPermitted(authorization, v),
    );
    if (permittedSectionViews[0]) {
      vId = permittedSectionViews[0].id;
    } else {
      sId = 'overview';
      vId = 'overview';
    }
  }

  return { resolvedSectionId: sId, resolvedViewId: vId, isLegacyCommissionsLink };
}

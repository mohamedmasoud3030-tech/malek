import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import {
  LayoutDashboard,
  ReceiptText,
  WalletCards,
  ShieldCheck,
  Landmark,
  FileSpreadsheet,
  ClipboardList,
  BadgeDollarSign,
  FileCheck,
  HandCoins,
  Building2
} from 'lucide-react';
import { useMemo, useRef, lazy, Suspense, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { useAuth } from '@/hooks/use-auth';
import { canAccess, type AppPermission } from '@/features/auth/permissions';
import { FinancialReportsPreviewSection } from './components/financial-reports-preview-section';
import { getTodayLocalDateString } from './financials-date-utils';
import { useCollectionSummaryReport } from './reports/useFinancialReports';
import { cn } from '@/lib/utils';
import { SectionTabs } from '@/components/ui/section-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AccessDenied } from '@/components/layout/access-denied';
import { translateSharedLabel } from '@/lib/i18n';

function getCurrentMonthReportRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    dateFrom: getTodayLocalDateString(firstDay),
    dateTo: getTodayLocalDateString(lastDay),
    status: 'all' as const,
  };
}

function SectionFallback() {
  return (
    <div className="space-y-3" role="status" aria-label="جارٍ تحميل القسم">
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </div>
  );
}

const InvoicesWorkspace = lazy(async () => ({
  default: (await import('@/features/financials/invoices/invoices-page')).InvoicesWorkspace,
}));
const ReceiptsWorkspace = lazy(async () => ({
  default: (await import('@/features/financials/receipts/receipts-page')).ReceiptsWorkspace,
}));
const ExpensesWorkspace = lazy(async () => ({
  default: (await import('@/features/financials/expenses/expenses-page')).ExpensesWorkspace,
}));
const ArrearsWorkspace = lazy(async () => ({
  default: (await import('@/features/financials/arrears/arrears-page')).ArrearsWorkspace,
}));
const DepositsWorkspace = lazy(async () => ({
  default: (await import('@/features/financials/deposits/deposits-page')).DepositsWorkspace,
}));
const OwnerSettlementsWorkspace = lazy(async () => ({
  default: (await import('@/features/owners/owner-settlements-page')).OwnerSettlementsWorkspace,
}));
const BankReconciliationWorkspace = lazy(async () => ({
  default: (await import('@/features/financials/reconciliation/bank-reconciliation-page')).BankReconciliationWorkspace,
}));
const CommissionsWorkspace = lazy(async () => ({
  default: (await import('@/features/commissions/commissions-page')).CommissionsWorkspace,
}));

// ==================================================
// APPROVED TYPED FINANCE VIEW MODEL (Points 3, 4)
// ==================================================

export type FinanceSectionId = 'overview' | 'collections' | 'expenses' | 'funds' | 'banking';

export type FinanceViewId =
  | 'overview'
  | 'invoices'
  | 'receipts'
  | 'arrears'
  | 'expenses'
  | 'commissions'
  | 'deposits'
  | 'owner_settlements'
  | 'bank_reconciliation';

export interface FinanceViewDefinition {
  id: FinanceViewId;
  sectionId: FinanceSectionId;
  label: string;
  icon: any;
  permission: AppPermission | null;
}

export interface FinanceSectionDefinition {
  id: FinanceSectionId;
  label: string;
  icon: any;
  defaultViewId: FinanceViewId | null;
}

export const FINANCE_SECTIONS: readonly FinanceSectionDefinition[] = [
  { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard, defaultViewId: 'overview' },
  { id: 'collections', label: 'التحصيل والذمم', icon: ReceiptText, defaultViewId: 'invoices' },
  { id: 'expenses', label: 'المصروفات والمستحقات', icon: WalletCards, defaultViewId: 'expenses' },
  { id: 'funds', label: 'الأمانات والملاك', icon: ShieldCheck, defaultViewId: 'deposits' },
  { id: 'banking', label: 'البنوك والمطابقة', icon: Landmark, defaultViewId: 'bank_reconciliation' },
];

export const FINANCE_VIEWS: readonly FinanceViewDefinition[] = [
  { id: 'overview', sectionId: 'overview', label: 'نظرة عامة', icon: LayoutDashboard, permission: null },
  { id: 'invoices', sectionId: 'collections', label: 'الفواتير والتحصيل', icon: FileSpreadsheet, permission: null },
  { id: 'receipts', sectionId: 'collections', label: 'سجل الإيصالات', icon: ReceiptText, permission: null },
  { id: 'arrears', sectionId: 'collections', label: 'المتأخرات والديون', icon: ClipboardList, permission: 'arrears.view' },
  { id: 'expenses', sectionId: 'expenses', label: 'المصروفات', icon: WalletCards, permission: 'expenses.view' },
  { id: 'commissions', sectionId: 'expenses', label: 'العمولات', icon: BadgeDollarSign, permission: 'commissions.view' },
  { id: 'deposits', sectionId: 'funds', label: 'تأمينات المستأجرين', icon: FileCheck, permission: 'financial.deposits.view' },
  { id: 'owner_settlements', sectionId: 'funds', label: 'تسويات الملاك', icon: HandCoins, permission: 'financial.owner_settlements.view' },
  { id: 'bank_reconciliation', sectionId: 'banking', label: 'مطابقة كشف البنك', icon: Landmark, permission: 'financial.bank_reconciliation.view' },
];

export function isViewPermitted(
  authorization: any,
  view: FinanceViewDefinition
): boolean {
  if (!authorization) return false;
  return view.permission === null ? true : canAccess(authorization, view.permission);
}

export function getPermittedViews(
  authorization: any
): FinanceViewDefinition[] {
  return FINANCE_VIEWS.filter((view) => isViewPermitted(authorization, view));
}

export function getPermittedSections(
  authorization: any
): FinanceSectionDefinition[] {
  const permittedViews = getPermittedViews(authorization);
  const permittedSectionIds = new Set(permittedViews.map(v => v.sectionId));
  return FINANCE_SECTIONS.filter(s => permittedSectionIds.has(s.id));
}

export interface FinancialsSearch {
  section?: string;
  view?: string;
}

/**
 * Rebuilt financials-page.tsx
 * Replaces the finance hub overview. It directly contains the operational Finance workspace
 * and uses ONE contextual navigation layer.
 */
export function FinancialsPage() {
  const { authorization } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as FinancialsSearch;

  const reportFilters = useMemo(() => getCurrentMonthReportRange(), []);
  const collectionReport = useCollectionSummaryReport(reportFilters);

  // Dynamic translated labels
  const summaryLabel = translateSharedLabel('financialsSectionSummary');
  const pageDescription = translateSharedLabel('financialsPageDescription');
  const pageHint = translateSharedLabel('financialsPageHint');

  // Visible / permitted views & sections for the current user
  const permittedViews = useMemo(() => getPermittedViews(authorization), [authorization]);
  const permittedSections = useMemo(() => getPermittedSections(authorization), [authorization]);

  // URL Deep link translation / Normalization
  const rawSection = search.section || '';
  const rawView = search.view || '';

  const { resolvedSectionId, resolvedViewId } = useMemo(() => {
    let sId: FinanceSectionId = 'overview';
    let vId: FinanceViewId = 'overview';

    const sec = rawSection.toLowerCase().trim();
    const vi = rawView.toLowerCase().trim();

    // Map legacy section values to sectionId and viewId
    if (sec === 'overview' || !sec) {
      sId = 'overview';
      vId = 'overview';
    } else if (['collections', 'invoices', 'receipts', 'arrears'].includes(sec)) {
      sId = 'collections';
      const defaultView = sec === 'collections' ? 'invoices' : sec;
      vId = (vi || defaultView) as FinanceViewId;
    } else if (['expenses', 'commissions'].includes(sec)) {
      sId = 'expenses';
      const defaultView = sec === 'expenses' ? 'expenses' : sec;
      vId = (vi || defaultView) as FinanceViewId;
    } else if (['funds', 'deposits', 'owner_settlements'].includes(sec)) {
      sId = 'funds';
      const defaultView = sec === 'funds' ? 'deposits' : sec;
      vId = (vi || defaultView) as FinanceViewId;
    } else if (['banking', 'bank_reconciliation'].includes(sec)) {
      sId = 'banking';
      vId = 'bank_reconciliation';
    }

    return { resolvedSectionId: sId, resolvedViewId: vId };
  }, [rawSection, rawView]);

  const { activeSection, activeView, isRequestedViewForbidden } = useMemo(() => {
    // If no permitted sections at all
    if (permittedSections.length === 0) {
      return { activeSection: null, activeView: null, isRequestedViewForbidden: false };
    }

    const matchedView = permittedViews.find(v => v.id === resolvedViewId);
    
    // Check if the explicitly requested view is forbidden
    const isExplicitlyRequested = Boolean(rawSection || rawView);
    const viewExists = FINANCE_VIEWS.some(v => v.id === resolvedViewId);
    const hasPermissionForView = Boolean(matchedView);

    if (isExplicitlyRequested && viewExists && !hasPermissionForView) {
      // Show AccessDenied for forbidden requests
      return { activeSection: null, activeView: null, isRequestedViewForbidden: true };
    }

    if (matchedView) {
      return { activeSection: resolvedSectionId, activeView: resolvedViewId, isRequestedViewForbidden: false };
    }

    // Default fallback to first permitted section and its first permitted view
    const fallbackSection = permittedSections.find(s => s.id === 'overview') || permittedSections[0];
    const sectionViews = permittedViews.filter(v => v.sectionId === fallbackSection.id);
    const fallbackView = sectionViews[0];

    return {
      activeSection: fallbackSection.id,
      activeView: fallbackView ? fallbackView.id : null,
      isRequestedViewForbidden: false
    };
  }, [resolvedSectionId, resolvedViewId, rawSection, rawView, permittedViews, permittedSections]);

  // Handle section and sub-view updates
  const handleSectionChange = useCallback((sectionId: FinanceSectionId) => {
    const sectionViews = FINANCE_VIEWS.filter(v => v.sectionId === sectionId);
    const permittedSectionViews = sectionViews.filter(v => isViewPermitted(authorization, v));
    const defaultView = permittedSectionViews[0] ? permittedSectionViews[0].id : '';

    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => {
        const next: Record<string, unknown> = { ...previous, section: sectionId };
        if (defaultView) {
          next.view = defaultView;
        } else {
          delete next.view;
        }
        return next;
      },
      replace: true,
    });
  }, [navigate, authorization]);

  const handleViewChange = useCallback((viewId: string) => {
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({ ...previous, view: viewId }),
      replace: true,
    });
  }, [navigate]);

  // Keep track of mounted sections to preserve their states
  const mountedViews = useRef(new Set<string>());
  if (activeSection === 'overview') {
    mountedViews.current.add('overview');
  } else if (activeView) {
    mountedViews.current.add(activeView);
  }

  // Get active section sub-views/tabs
  const subViews = useMemo(() => {
    return permittedViews.filter(v => v.sectionId === activeSection);
  }, [activeSection, permittedViews]);

  const activeSectionMeta = FINANCE_SECTIONS.find((s) => s.id === activeSection) ?? FINANCE_SECTIONS[0];

  if (isRequestedViewForbidden) {
    return (
      <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
        <AccessDenied message="ليس لديك صلاحية لعرض هذا القسم المالي." />
      </PageLayout>
    );
  }

  if (permittedSections.length === 0) {
    return (
      <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
        <AccessDenied message="ليس لديك صلاحية لعرض أي من أقسام المالية." />
      </PageLayout>
    );
  }

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
      <div data-finance-root className="space-y-5">
        <PageHeader
          title="المالية"
          description={pageDescription}
        />

        {pageHint ? (
          <div className="text-[11px] text-muted-foreground bg-muted/30 rounded-xl px-3 py-1.5 border border-border/40 inline-block font-medium">
            💡 {pageHint} (سجل {summaryLabel})
          </div>
        ) : null}

        <div className="flex flex-col gap-6 md:flex-row-reverse md:items-start">
          {/* Sidebar / Navigation Column (Right on RTL) */}
          <aside className="w-full md:w-64 shrink-0 space-y-4">
            {/* Desktop Navigation */}
            <nav aria-label="أقسام المالية" className="hidden md:flex flex-col gap-1.5 bg-card rounded-2xl border border-border/70 p-2 shadow-card">
              {permittedSections.map(section => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleSectionChange(section.id)}
                    className={cn(
                      "flex items-center gap-3 w-full px-4 py-3 text-xs font-black rounded-xl transition-colors text-right focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    <section.icon className="size-4 shrink-0" />
                    <span className="truncate">{section.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Mobile Select dropdown */}
            <div className="md:hidden bg-card border border-border/70 rounded-2xl p-3 shadow-card" data-finance-mobile-nav>
              <div className="flex items-center gap-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <activeSectionMeta.icon className="size-4" aria-hidden="true" />
                </span>
                <select
                  aria-label="أقسام المالية"
                  value={activeSection || 'overview'}
                  onChange={(e) => handleSectionChange(e.target.value as FinanceSectionId)}
                  className="min-h-11 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                  dir="rtl"
                >
                  {permittedSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </aside>

          {/* Content Column (Left on RTL) */}
          <main className="flex-1 min-w-0 space-y-4">
            {/* Sub-tabs / Horizontal Sub Navigation (Only if we have active view/sub-tabs) */}
            {subViews.length > 1 && (
              <div className="border-b border-border/50 pb-2">
                <SectionTabs
                  items={subViews}
                  activeId={activeView || ''}
                  onChange={handleViewChange}
                  ariaLabel="أقسام فرعية للمالية"
                />
              </div>
            )}

            {/* View Panels */}
            <div className="relative min-w-0">
              {/* Overview Operational Dashboard */}
              <div id="section-panel-overview" role="tabpanel" aria-labelledby="section-tab-overview" hidden={activeSection !== 'overview'}>
                <div className="space-y-5">
                  <section data-finance-section aria-label="ملخص التحصيل الشهري" className="space-y-3">
                    <FinancialReportsPreviewSection
                      reportFilters={reportFilters}
                      collectionSummary={collectionReport.data}
                      isLoading={collectionReport.isLoading}
                      isError={collectionReport.isError}
                      error={collectionReport.error}
                    />
                  </section>

                  <Link
                    to="/reports"
                    className="flex min-h-14 items-center gap-3 rounded-2xl border border-border/80 bg-card px-4 py-3 font-bold outline-none transition-colors hover:border-primary/30 hover:bg-primary/[0.025] focus-visible:ring-4 focus-visible:ring-primary/20"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
                      <Building2 className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm">المحاسبة والتقارير</span>
                      <span className="mt-0.5 block text-xs font-medium text-muted-foreground">دفتر الأستاذ والكشوف والتحليلات والتقارير الرسمية.</span>
                    </span>
                  </Link>
                </div>
              </div>

              {/* Collections & Receivables */}
              {mountedViews.current.has('invoices') && (
                <div id="section-panel-invoices" role="tabpanel" hidden={activeSection !== 'collections' || activeView !== 'invoices'}>
                  <Suspense fallback={<SectionFallback />}>
                    <InvoicesWorkspace embedded={true} />
                  </Suspense>
                </div>
              )}
              {mountedViews.current.has('receipts') && (
                <div id="section-panel-receipts" role="tabpanel" hidden={activeSection !== 'collections' || activeView !== 'receipts'}>
                  <Suspense fallback={<SectionFallback />}>
                    <ReceiptsWorkspace embedded={true} />
                  </Suspense>
                </div>
              )}
              {mountedViews.current.has('arrears') && (
                <div id="section-panel-arrears" role="tabpanel" hidden={activeSection !== 'collections' || activeView !== 'arrears'}>
                  <Suspense fallback={<SectionFallback />}>
                    <ArrearsWorkspace embedded={true} />
                  </Suspense>
                </div>
              )}

              {/* Expenses & Payables */}
              {mountedViews.current.has('expenses') && (
                <div id="section-panel-expenses" role="tabpanel" hidden={activeSection !== 'expenses' || activeView !== 'expenses'}>
                  <Suspense fallback={<SectionFallback />}>
                    <ExpensesWorkspace embedded={true} />
                  </Suspense>
                </div>
              )}
              {mountedViews.current.has('commissions') && (
                <div id="section-panel-commissions" role="tabpanel" hidden={activeSection !== 'expenses' || activeView !== 'commissions'}>
                  <Suspense fallback={<SectionFallback />}>
                    <CommissionsWorkspace embedded={true} />
                  </Suspense>
                </div>
              )}

              {/* Custody Funds & Owners */}
              {mountedViews.current.has('deposits') && (
                <div id="section-panel-deposits" role="tabpanel" hidden={activeSection !== 'funds' || activeView !== 'deposits'}>
                  <Suspense fallback={<SectionFallback />}>
                    <DepositsWorkspace />
                  </Suspense>
                </div>
              )}
              {mountedViews.current.has('owner_settlements') && (
                <div id="section-panel-owner_settlements" role="tabpanel" hidden={activeSection !== 'funds' || activeView !== 'owner_settlements'}>
                  <Suspense fallback={<SectionFallback />}>
                    <OwnerSettlementsWorkspace embedded={true} />
                  </Suspense>
                </div>
              )}

              {/* Banking & Reconciliation */}
              {mountedViews.current.has('bank_reconciliation') && (
                <div id="section-panel-bank_reconciliation" role="tabpanel" hidden={activeSection !== 'banking'}>
                  <Suspense fallback={<SectionFallback />}>
                    <BankReconciliationWorkspace embedded={true} />
                  </Suspense>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </PageLayout>
  );
}

export default FinancialsPage;

import { useNavigate, useSearch } from '@tanstack/react-router';
import { Suspense, lazy, useCallback, useMemo, useRef, type ComponentType } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { WorkspaceSubNav } from '@/components/layout/workspace-sub-nav';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionTabs } from '@/components/ui/section-tabs';
import { useAuth } from '@/hooks/use-auth';
import { resolveFinanceHubState } from './finance-hub-model';
import { financeHubSections, type FinanceHubSectionId } from './finance-hub-sections';

/**
 * The one composition layer for every finance workspace.
 *
 * Each finance entry route renders this with its own `defaultSection`; the
 * page shell (PageLayout + PageHeader) lives here and nowhere else, so the
 * embedded section bodies never render a second layout or header.
 *
 * Responsibilities:
 *  - URL synchronized tabs + deep linking via `?section=`
 *  - per-tab permission validation (never route-level only)
 *  - lazy loading each section body on first use
 *  - keeping mounted sections alive so tab switches preserve state
 */

/** `?section=` is the deep-link contract shared by every finance entry route. */
export const FINANCE_HUB_SECTION_SEARCH_KEY = 'section';

// Each section body is code-split, so visiting /finance/collections never
// downloads the bank-reconciliation or settlements bundles.
const sectionComponents: Record<FinanceHubSectionId, ComponentType> = {
  invoices: lazy(async () => ({
    default: (await import('@/features/financials/invoices/invoices-page')).InvoicesWorkspace,
  })),
  receipts: lazy(async () => ({
    default: (await import('@/features/financials/receipts/receipts-page')).ReceiptsWorkspace,
  })),
  expenses: lazy(async () => ({
    default: (await import('@/features/financials/expenses/expenses-page')).ExpensesWorkspace,
  })),
  arrears: lazy(async () => ({
    default: (await import('@/features/financials/arrears/arrears-page')).ArrearsWorkspace,
  })),
  deposits: lazy(async () => ({
    default: (await import('@/features/financials/deposits/deposits-page')).DepositsWorkspace,
  })),
  owner_settlements: lazy(async () => ({
    default: (await import('@/features/owners/owner-settlements-page')).OwnerSettlementsWorkspace,
  })),
  bank_reconciliation: lazy(async () => ({
    default: (await import('@/features/financials/reconciliation/bank-reconciliation-page')).BankReconciliationWorkspace,
  })),
  commissions: lazy(async () => ({
    default: (await import('@/features/commissions/commissions-page')).CommissionsWorkspace,
  })),
};

function SectionFallback() {
  return (
    <div className="space-y-3" role="status" aria-label="جارٍ تحميل القسم">
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </div>
  );
}

export type FinanceHubWorkspaceProps = Readonly<{
  /** Section shown when the URL does not request one. */
  defaultSection: FinanceHubSectionId;
  title: string;
  description: string;
}>;

export function FinanceHubWorkspace({ defaultSection, title, description }: FinanceHubWorkspaceProps) {
  const { authorization } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const requestedSection = search[FINANCE_HUB_SECTION_SEARCH_KEY];

  const { activeSection, visibleSections, isRequestedSectionForbidden, hasNoVisibleSections } = useMemo(
    () => resolveFinanceHubState({ requestedSection, defaultSection, authorization }),
    [requestedSection, defaultSection, authorization],
  );

  // Sections are mounted on first visit and then kept mounted (hidden) so
  // filters, scroll position, and in-flight forms survive a tab switch.
  const mountedSections = useRef(new Set<FinanceHubSectionId>());
  if (activeSection) mountedSections.current.add(activeSection);

  const handleSectionChange = useCallback(
    (nextSection: FinanceHubSectionId) => {
      // `replace` keeps tab switching out of the back-stack: Back should leave
      // the hub, not walk through every tab the user tried.
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => ({ ...previous, [FINANCE_HUB_SECTION_SEARCH_KEY]: nextSection }),
        replace: true,
      });
    },
    [navigate],
  );

  const shell = (children: React.ReactNode) => (
    <PageLayout dir="rtl" lang="ar" size="wide">
      <PageHeader title={title} description={description} />
      <WorkspaceSubNav rootPath="/financials" />
      {children}
    </PageLayout>
  );

  if (hasNoVisibleSections) {
    return shell(<AccessDenied message="ليس لديك صلاحية لعرض أي من أقسام المالية." />);
  }

  if (isRequestedSectionForbidden || !activeSection) {
    return shell(<AccessDenied message="ليس لديك صلاحية لعرض هذا القسم المالي." />);
  }

  return shell(
    <>
      <SectionTabs
        items={visibleSections}
        activeId={activeSection}
        onChange={handleSectionChange}
        ariaLabel="أقسام المالية"
      />

      {financeHubSections
        // Defence in depth: a section must be both already-mounted and still
        // permitted to render. If a role change removes access, the section is
        // unmounted rather than left alive behind `hidden`.
        .filter((section) => mountedSections.current.has(section.id) && visibleSections.some((visible) => visible.id === section.id))
        .map((section) => {
          const SectionBody = sectionComponents[section.id];
          const isActive = section.id === activeSection;

          return (
            <div
              key={section.id}
              id={`section-panel-${section.id}`}
              role="tabpanel"
              aria-labelledby={`section-tab-${section.id}`}
              data-finance-section={section.id}
              hidden={!isActive}
            >
              <Suspense fallback={<SectionFallback />}>
                <SectionBody />
              </Suspense>
            </div>
          );
        })}
    </>,
  );
}

import { lazy, Suspense } from 'react';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionTabPanel } from '@/components/ui/section-tabs';
import type { ReportAdapterProps } from './adapters/report-adapter-contract';
import type { ReportSectionId } from '../reports-page.sections';
import type { ReportViewId } from '../report-view-registry';

/**
 * WP-C — per-section code splitting (C.4). Each adapter chunk — and, inside it,
 * each report body — is pulled only when its section is activated, so opening
 * the reports page never downloads all eleven report bodies.
 */
const AccountingReportsAdapter = lazy(() =>
  import('./adapters/AccountingReportsAdapter').then((m) => ({ default: m.AccountingReportsAdapter })),
);
const StatementsReportsAdapter = lazy(() =>
  import('./adapters/StatementsReportsAdapter').then((m) => ({ default: m.StatementsReportsAdapter })),
);
const AnalyticsReportsAdapter = lazy(() =>
  import('./adapters/AnalyticsReportsAdapter').then((m) => ({ default: m.AnalyticsReportsAdapter })),
);

const SectionFallback = () => <LoadingState variant="section" label="جارٍ تحميل التقرير..." />;

type ReportsViewPanelProps = Readonly<
  Omit<ReportAdapterProps, 'view'> & {
    activeSection: ReportSectionId;
    activeView: ReportViewId;
  }
>;

/**
 * WP-C — the single place that turns `(section, view)` into a rendered report.
 *
 * Previously this was an eleven-branch JSX chain inline in
 * `ReportsWorkspace.tsx`; every new report needed a new branch and every branch
 * re-typed the same prop plumbing. Routing now delegates to one adapter per
 * section, and the adapter owns the view switch.
 */
export function ReportsViewPanel({
  activeSection,
  activeView,
  model,
  filters,
  canExportReports,
}: ReportsViewPanelProps) {
  const adapterProps: ReportAdapterProps = { view: activeView, model, filters, canExportReports };

  return (
    <div className="min-w-0" key={activeSection}>
      <Suspense fallback={<SectionFallback />}>
        {activeSection === 'accounting' ? (
          <SectionTabPanel id="accounting" activeId={activeSection}>
            <AccountingReportsAdapter {...adapterProps} />
          </SectionTabPanel>
        ) : null}

        {activeSection === 'statements' ? (
          <SectionTabPanel id="statements" activeId={activeSection}>
            <StatementsReportsAdapter {...adapterProps} />
          </SectionTabPanel>
        ) : null}

        {activeSection === 'analytics' ? (
          <SectionTabPanel id="analytics" activeId={activeSection}>
            <AnalyticsReportsAdapter {...adapterProps} />
          </SectionTabPanel>
        ) : null}
      </Suspense>
    </div>
  );
}

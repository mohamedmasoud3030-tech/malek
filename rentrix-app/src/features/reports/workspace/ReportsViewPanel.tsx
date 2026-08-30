import { lazy, Suspense } from 'react';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionTabPanel } from '@/components/ui/section-tabs';
import type { ReportAdapterProps } from './adapters/report-adapter-contract';
import type { ReportSectionId } from '../reports-page.sections';
import type { ReportViewId } from '../report-view-registry';
import type { ReportDrillHandler } from '../report-workspaces';

/**
 * WP-C — per-section code splitting (C.4). Each adapter chunk — and, inside it,
 * each report body — is pulled only when its section is activated, so opening
 * the reports page never downloads all report bodies.
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
    onDrill: ReportDrillHandler;
  }
>;

/**
 * WP-C — the single place that turns `(section, view)` into a rendered report.
 * One adapter per section owns its view switch; the drill-through handler is
 * forwarded so every report body can route into the owning workspace with the
 * current scope preserved.
 */
export function ReportsViewPanel({
  activeSection,
  activeView,
  model,
  filters,
  canExportReports,
  onDrill,
}: ReportsViewPanelProps) {
  const adapterProps: Omit<ReportAdapterProps, 'view'> = { model, filters, canExportReports, onDrill };

  return (
    <div className="min-w-0" key={activeSection}>
      <Suspense fallback={<SectionFallback />}>
        {activeSection === 'accounting' ? (
          <SectionTabPanel id="accounting" activeId={activeSection}>
            <AccountingReportsAdapter view={activeView} {...adapterProps} />
          </SectionTabPanel>
        ) : null}

        {activeSection === 'statements' ? (
          <SectionTabPanel id="statements" activeId={activeSection}>
            <StatementsReportsAdapter view={activeView} {...adapterProps} />
          </SectionTabPanel>
        ) : null}

        {activeSection === 'analytics' ? (
          <SectionTabPanel id="analytics" activeId={activeSection}>
            <AnalyticsReportsAdapter view={activeView} {...adapterProps} />
          </SectionTabPanel>
        ) : null}
      </Suspense>
    </div>
  );
}

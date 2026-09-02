import { lazy, Suspense } from 'react';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionTabPanel } from '@/components/ui/section-tabs';
import type { ReportAdapterProps } from './adapters/report-adapter-contract';
import type { ReportSectionId } from '../reports-page.sections';
import type { ReportViewId } from '../report-view-registry';
import type { ReportDrillHandler } from '../report-workspaces';
import type { StatementProductFocus } from '../report-products';

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
    statementFocus?: StatementProductFocus;
  }
>;

/** Single renderer that turns a preserved `(section, view)` read model into the opened report body. */
export function ReportsViewPanel({
  activeSection,
  activeView,
  model,
  filters,
  canExportReports,
  onDrill,
  statementFocus,
}: ReportsViewPanelProps) {
  const adapterProps: Omit<ReportAdapterProps, 'view'> = {
    model,
    filters,
    canExportReports,
    onDrill,
    statementFocus,
  };

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

import { useState } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { ReportsWorkspace } from './components/ReportsWorkspace';
import { getCurrentMonthFilters } from './reports-page.helpers';
import { useReportsWorkspace } from './use-reports-workspace';

export { escapeCsvValue } from '@/lib/csvExport';
export { buildReportCsvFilename, getTodayLocalDateString, toDateInputValue } from './reports-page.helpers';

export function ReportsPage() {
  const [filters, setFilters] = useState(() => getCurrentMonthFilters());
  const { authorization } = useAuth();
  const { language } = getAppLanguageState();
  const workspace = useReportsWorkspace(filters);
  const canExportReports = canAccess(authorization, financialOperationPermissions.exportReports);
  const canViewReports = canAccess(authorization, financialOperationPermissions.exportReports);

  if (!canViewReports) {
    return <AccessDenied message="عرض التقارير المالية متاح فقط للمدير أو المسؤول." />;
  }

  return (
    <PageLayout dir="rtl" size="wide" className="space-y-5 pb-8">
      <PageHeader
        title={translateSharedLabel('financialsSectionReports', language)}
        description={translateSharedLabel('reportsPageDescription', language)}
      />

      <aside
        aria-label={translateSharedLabel('reportsPageHint', language)}
        className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground"
      >
        {translateSharedLabel('reportsPageHint', language)}
      </aside>

      <ReportsWorkspace
        model={workspace}
        filters={filters}
        canExportReports={canExportReports}
        onFiltersChange={setFilters}
        onResetCurrentMonth={() => setFilters(getCurrentMonthFilters())}
      />
    </PageLayout>
  );
}

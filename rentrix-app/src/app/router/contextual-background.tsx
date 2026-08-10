import type { ReactNode } from 'react';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { PeopleListPage } from '@/features/people/people-list-page';
import { PortfolioHubPage } from '@/features/portfolio-hub/portfolio-hub-workspace';
import { ReportsPage } from '@/features/reports/reports-page';
import { TenantsWorkspace } from '@/features/tenants/TenantsPage';
import { ContractsListPage } from '@/features/contracts/ContractsListPage';

type BackgroundLocation = Readonly<{ pathname: string }>;

/**
 * Render the workspace that actually opened a route-native preview. The router
 * still owns the canonical detail URL; this component only supplies the visual
 * layer beneath the dialog, so Reports/Dashboard context is never replaced by
 * an unrelated entity list.
 */
export function ContextualBackground({ location, fallback }: Readonly<{
  location: BackgroundLocation | null;
  fallback: ReactNode;
}>) {
  switch (location?.pathname) {
    case '/dashboard': return <DashboardPage />;
    case '/reports': return <ReportsPage />;
    case '/people': return <PeopleListPage embedded />;
    case '/tenants': return <TenantsWorkspace embedded />;
    case '/properties': return <PortfolioHubPage />;
    case '/contracts': return <ContractsListPage />;
    default: return <>{fallback}</>;
  }
}

import { EntityFormE2EFixture } from '@/components/ui/entity-form.e2e-fixture';
import { LoginPage } from '@/features/auth/login-page';
import { DashboardWorkspaceE2EFixture } from '@/features/dashboard/dashboard-workspace.e2e-fixture';
import { ReportsWorkspaceE2EFixture } from '@/features/reports/reports-workspace.e2e-fixture';
import { SettingsWorkspaceE2EFixture } from '@/features/settings/settings-workspace.e2e-fixture';
import { OwnerDetailE2EFixture } from '@/features/owners/owner-detail.e2e-fixture';

export function LoginRouteComponent() {
  if (import.meta.env.VITE_E2E && typeof window !== 'undefined') {
    const search = new URLSearchParams(window.location.search);
    if (search.get('e2e-form-contract') === '1') {
      const mobileSurface = search.get('surface') === 'full-page' ? 'full-page' : 'bottom-sheet';
      return <EntityFormE2EFixture mobileSurface={mobileSurface} />;
    }

    if (search.get('e2e-dashboard-workspace') === '1') {
      return <DashboardWorkspaceE2EFixture />;
    }

    if (search.get('e2e-reports-workspace') === '1') {
      return <ReportsWorkspaceE2EFixture />;
    }

    if (search.get('e2e-settings-workspace') === '1') {
      return <SettingsWorkspaceE2EFixture />;
    }

    if (search.get('e2e-owner-detail-workspace') === '1') {
      return <OwnerDetailE2EFixture />;
    }
  }

  return <LoginPage />;
}

import { EntityFormE2EFixture } from '@/components/ui/entity-form.e2e-fixture';
import { LoginPage } from '@/features/auth/login-page';
import { DashboardWorkspaceE2EFixture } from '@/features/dashboard/dashboard-workspace.e2e-fixture';
import { ReportsWorkspaceE2EFixture } from '@/features/reports/reports-workspace.e2e-fixture';
import { SettingsWorkspaceE2EFixture } from '@/features/settings/settings-workspace.e2e-fixture';
import { OwnerDetailE2EFixture } from '@/features/owners/owner-detail.e2e-fixture';
import { PropertiesListE2EFixture } from '@/features/properties/properties-list.e2e-fixture';
import { ContractsListE2EFixture } from '@/features/contracts/contracts-list.e2e-fixture';
import { FinancialsHubE2EFixture } from '@/features/financials/financials-hub.e2e-fixture';
import { MaintenanceE2EFixture } from '@/features/maintenance/maintenance.e2e-fixture';
import { AiAssistantE2EFixture } from '@/features/ai-assistant/ai-assistant.e2e-fixture';
import { AutomationE2EFixture } from '@/features/automation/automation.e2e-fixture';
import { MaintenanceWorkspaceE2EFixture } from '@/features/maintenance/maintenance-workspace.e2e-fixture';
import { UtilitiesWorkspaceE2EFixture } from '@/features/utilities/utilities-workspace.e2e-fixture';
import { DocumentsVaultWorkspaceE2EFixture } from '@/features/documents-vault/documents-vault-workspace.e2e-fixture';
import { DepositsWorkspaceE2EFixture } from '@/features/financials/deposits/deposits-workspace.e2e-fixture';
import { AutomationWorkspaceE2EFixture } from '@/features/automation/automation-workspace.e2e-fixture';

export function LoginRouteComponent() {
  if (import.meta.env.VITE_E2E && typeof window !== 'undefined') {
    const search = new URLSearchParams(window.location.search);
    if (search.get('e2e-form-contract') === '1') {
      const requestedSurface = search.get('surface');
      const mobileSurface = requestedSurface === 'full-page' || requestedSurface === 'raw-dialog'
        ? requestedSurface
        : 'bottom-sheet';
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

    if (search.get('e2e-maintenance-workspace') === '1') {
      return <MaintenanceWorkspaceE2EFixture />;
    }

    if (search.get('e2e-utilities-workspace') === '1') {
      return <UtilitiesWorkspaceE2EFixture />;
    }

    if (search.get('e2e-vault-workspace') === '1') {
      return <DocumentsVaultWorkspaceE2EFixture />;
    }

    if (search.get('e2e-deposits-workspace') === '1') {
      return <DepositsWorkspaceE2EFixture />;
    }

    if (search.get('e2e-automation-workspace') === '1') {
      return <AutomationWorkspaceE2EFixture />;
    }

    // Marketing showcase captures (landing screenshots/video sources)
    if (search.get('e2e-showcase-properties') === '1') {
      return <PropertiesListE2EFixture />;
    }

    if (search.get('e2e-showcase-contracts') === '1') {
      return <ContractsListE2EFixture />;
    }

    if (search.get('e2e-showcase-financials') === '1') {
      return <FinancialsHubE2EFixture />;
    }

    if (search.get('e2e-showcase-maintenance') === '1') {
      return <MaintenanceE2EFixture />;
    }

    if (search.get('e2e-showcase-ai') === '1') {
      return <AiAssistantE2EFixture />;
    }

    if (search.get('e2e-showcase-automation') === '1') {
      return <AutomationE2EFixture />;
    }
  }

  return <LoginPage />;
}

import { lazy, type ReactNode } from 'react';

const EntityFormE2EFixture = lazy(() => import('@/components/ui/entity-form.e2e-fixture').then((module) => ({ default: module.EntityFormE2EFixture })));
const DashboardWorkspaceE2EFixture = lazy(() => import('@/features/dashboard/dashboard-workspace.e2e-fixture').then((module) => ({ default: module.DashboardWorkspaceE2EFixture })));
const ReportsWorkspaceE2EFixture = lazy(() => import('@/features/reports/reports-workspace.e2e-fixture').then((module) => ({ default: module.ReportsWorkspaceE2EFixture })));
const SettingsWorkspaceE2EFixture = lazy(() => import('@/features/settings/settings-workspace.e2e-fixture').then((module) => ({ default: module.SettingsWorkspaceE2EFixture })));
const OwnerDetailE2EFixture = lazy(() => import('@/features/owners/owner-detail.e2e-fixture').then((module) => ({ default: module.OwnerDetailE2EFixture })));
const PropertiesListE2EFixture = lazy(() => import('@/features/properties/properties-list.e2e-fixture').then((module) => ({ default: module.PropertiesListE2EFixture })));
const ContractsListE2EFixture = lazy(() => import('@/features/contracts/contracts-list.e2e-fixture').then((module) => ({ default: module.ContractsListE2EFixture })));
const ContractDetailE2EFixture = lazy(() => import('@/features/contracts/contract-detail.e2e-fixture').then((module) => ({ default: module.ContractDetailE2EFixture })));
const FinancialsHubE2EFixture = lazy(() => import('@/features/financials/financials-hub.e2e-fixture').then((module) => ({ default: module.FinancialsHubE2EFixture })));
const MaintenanceE2EFixture = lazy(() => import('@/features/maintenance/maintenance.e2e-fixture').then((module) => ({ default: module.MaintenanceE2EFixture })));
const AiAssistantE2EFixture = lazy(() => import('@/features/ai-assistant/ai-assistant.e2e-fixture').then((module) => ({ default: module.AiAssistantE2EFixture })));
const AutomationE2EFixture = lazy(() => import('@/features/automation/automation.e2e-fixture').then((module) => ({ default: module.AutomationE2EFixture })));
const MaintenanceWorkspaceE2EFixture = lazy(() => import('@/features/maintenance/maintenance-workspace.e2e-fixture').then((module) => ({ default: module.MaintenanceWorkspaceE2EFixture })));
const UtilitiesWorkspaceE2EFixture = lazy(() => import('@/features/utilities/utilities-workspace.e2e-fixture').then((module) => ({ default: module.UtilitiesWorkspaceE2EFixture })));
const DocumentsVaultWorkspaceE2EFixture = lazy(() => import('@/features/documents-vault/documents-vault-workspace.e2e-fixture').then((module) => ({ default: module.DocumentsVaultWorkspaceE2EFixture })));
const DepositsWorkspaceE2EFixture = lazy(() => import('@/features/financials/deposits/deposits-workspace.e2e-fixture').then((module) => ({ default: module.DepositsWorkspaceE2EFixture })));
const AutomationWorkspaceE2EFixture = lazy(() => import('@/features/automation/automation-workspace.e2e-fixture').then((module) => ({ default: module.AutomationWorkspaceE2EFixture })));
const ServiceProvidersWorkspaceE2EFixture = lazy(() => import('@/features/service-providers/service-providers-workspace.e2e-fixture').then((module) => ({ default: module.ServiceProvidersWorkspaceE2EFixture })));
const StateSurfacesE2EFixture = lazy(() => import('@/features/browser-ux/state-surfaces.e2e-fixture').then((module) => ({ default: module.StateSurfacesE2EFixture })));
const DialogFocusE2EFixture = lazy(() => import('@/features/browser-ux/dialog-focus.e2e-fixture').then((module) => ({ default: module.DialogFocusE2EFixture })));

export function LoginE2EFixture({ fallback }: Readonly<{ fallback: ReactNode }>) {
  if (typeof window === 'undefined') return fallback;

  const search = new URLSearchParams(window.location.search);
  let fixture: ReactNode = null;

  if (search.get('e2e-form-contract') === '1') {
    fixture = <EntityFormE2EFixture rawDialog={search.get('surface') === 'raw-dialog'} />;
  } else if (search.get('e2e-dashboard-workspace') === '1') {
    fixture = <DashboardWorkspaceE2EFixture />;
  } else if (search.get('e2e-reports-workspace') === '1') {
    fixture = <ReportsWorkspaceE2EFixture />;
  } else if (search.get('e2e-settings-workspace') === '1') {
    fixture = <SettingsWorkspaceE2EFixture />;
  } else if (search.get('e2e-owner-detail-workspace') === '1') {
    fixture = <OwnerDetailE2EFixture />;
  } else if (search.get('e2e-maintenance-workspace') === '1') {
    fixture = <MaintenanceWorkspaceE2EFixture />;
  } else if (search.get('e2e-utilities-workspace') === '1') {
    fixture = <UtilitiesWorkspaceE2EFixture />;
  } else if (search.get('e2e-vault-workspace') === '1') {
    fixture = <DocumentsVaultWorkspaceE2EFixture />;
  } else if (search.get('e2e-deposits-workspace') === '1') {
    fixture = <DepositsWorkspaceE2EFixture />;
  } else if (search.get('e2e-automation-workspace') === '1') {
    fixture = <AutomationWorkspaceE2EFixture />;
  } else if (search.get('e2e-service-providers-workspace') === '1') {
    fixture = <ServiceProvidersWorkspaceE2EFixture />;
  } else if (search.get('e2e-showcase-properties') === '1') {
    fixture = <PropertiesListE2EFixture />;
  } else if (search.get('e2e-showcase-contracts') === '1') {
    fixture = <ContractsListE2EFixture />;
  } else if (search.get('e2e-contract-detail-workspace') === '1') {
    fixture = <ContractDetailE2EFixture />;
  } else if (search.get('e2e-showcase-financials') === '1') {
    fixture = <FinancialsHubE2EFixture />;
  } else if (search.get('e2e-showcase-maintenance') === '1') {
    fixture = <MaintenanceE2EFixture />;
  } else if (search.get('e2e-showcase-ai') === '1') {
    fixture = <AiAssistantE2EFixture />;
  } else if (search.get('e2e-showcase-automation') === '1') {
    fixture = <AutomationE2EFixture />;
  } else if (search.get('e2e-dialog-focus') === '1') {
    fixture = <DialogFocusE2EFixture />;
  } else if (search.get('e2e-state-surfaces') === '1') {
    fixture = <StateSurfacesE2EFixture />;
  }

  return fixture ?? fallback;
}

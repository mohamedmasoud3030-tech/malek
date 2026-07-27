import { MaintenanceWorkspace } from './components/maintenance-workspace';

/**
 * Standalone /maintenance route entry point. Renders the shared
 * MaintenanceWorkspace in "standalone" mode (full PageLayout + PageHeader).
 * The same workspace also powers the embedded "الصيانة" tab inside the
 * operations hub — see src/features/operations-hub.
 */
export function MaintenancePage() {
  return <MaintenanceWorkspace mode="standalone" />;
}

export default MaintenancePage;

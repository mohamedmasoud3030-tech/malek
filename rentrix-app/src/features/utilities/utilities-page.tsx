import { UtilitiesWorkspace } from './components/utilities-workspace';

/**
 * Standalone /utilities route entry point. Renders the shared
 * UtilitiesWorkspace in "standalone" mode (full PageLayout + PageHeader).
 * The same workspace also powers the embedded "المرافق والعدادات" tab
 * inside the operations hub — see src/features/operations-hub.
 */
export function UtilitiesPage() {
  return <UtilitiesWorkspace mode="standalone" />;
}

export default UtilitiesPage;

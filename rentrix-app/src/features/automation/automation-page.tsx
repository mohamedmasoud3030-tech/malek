import { AutomationWorkspace } from './components/automation-workspace';

/**
 * Standalone /automation route entry point. Renders the shared
 * AutomationWorkspace in "standalone" mode (full PageLayout + PageHeader).
 * The same workspace also powers the embedded "الأتمتة والتنبيهات" tab
 * inside the operations hub — see src/features/operations-hub.
 */
export function AutomationPage() {
  return <AutomationWorkspace mode="standalone" />;
}

export default AutomationPage;

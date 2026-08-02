import { OperationsHubWorkspace } from '@/features/operations-hub/operations-hub-workspace';

/**
 * /maintenance renders the unified operations hub (maintenance, utilities,
 * automation, documents vault tabs) with the maintenance tab open by default.
 * The route path, permission guard (maintenance.view), and title in
 * route-tree.ts are unchanged. Sibling routes redirect here with ?section=.
 */
export function MaintenanceRouteComponent() {
  return <OperationsHubWorkspace defaultSection="maintenance" />;
}

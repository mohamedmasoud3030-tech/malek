import { OperationsHubWorkspace } from '@/features/operations-hub/operations-hub-workspace';

/**
 * /maintenance renders the unified operations hub (maintenance, utilities,
 * automation, documents vault tabs) with the maintenance tab open by default.
 * The hub route itself is authenticated-only; each tab independently enforces
 * the same permission as its legacy route. Sibling routes redirect here with
 * ?section= while keeping their original guards.
 */
export function MaintenanceRouteComponent() {
  return <OperationsHubWorkspace defaultSection="maintenance" mode="standalone" />;
}

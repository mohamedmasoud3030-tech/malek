import { OperationsHub } from '@/features/operations-hub/components/OperationsHub';

/**
 * /maintenance now renders the unified operations hub (maintenance,
 * utilities, automation, documents vault tabs) with the maintenance tab
 * open by default, instead of the bare maintenance page. The route path,
 * permission guard (maintenance.view), and title in route-tree.ts are
 * unchanged.
 */
export function MaintenanceRouteComponent() {
  return <OperationsHub defaultSection="maintenance" />;
}

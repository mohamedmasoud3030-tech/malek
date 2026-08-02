/**
 * Re-export so existing imports of
 * `@/features/operations-hub/components/OperationsHub` keep working.
 * The composition layer lives in operations-hub-workspace.tsx.
 */
export {
  OperationsHubWorkspace as OperationsHub,
  OperationsHubWorkspace,
  type OperationsHubWorkspaceProps as OperationsHubProps,
} from '../operations-hub-workspace';

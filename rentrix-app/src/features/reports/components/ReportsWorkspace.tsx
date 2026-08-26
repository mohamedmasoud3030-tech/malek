/**
 * WP-C compatibility seam. The reports workspace was split into
 * `features/reports/workspace/` (shell + navigation + view routing). This file
 * keeps the historical import path working for routes, fixtures and tests.
 */
export { ReportsWorkspace, type ReportsWorkspaceProps } from '../workspace/ReportsWorkspace';

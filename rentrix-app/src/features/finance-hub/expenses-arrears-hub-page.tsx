import { FinanceHubWorkspace } from './finance-hub-workspace';

/**
 * Entry page for the outflow/collection-risk cycle: money going out (expenses)
 * and money not yet collected (arrears). Registered at /finance/expenses.
 *
 * Like every finance entry page this is a thin default-section selector — all
 * composition (page shell, tabs, URL sync, permissions, lazy loading) lives in
 * the shared FinanceHubWorkspace so no wrapper page duplicates it.
 */
export function ExpensesArrearsHubPage() {
  return (
    <FinanceHubWorkspace
      defaultSection="expenses"
      title="المصروفات والذمم"
      description="تسجيل ومراجعة مصروفات العقارات، ومتابعة الذمم المتأخرة وأعمار الديون — في مكان واحد."
    />
  );
}

export default ExpensesArrearsHubPage;

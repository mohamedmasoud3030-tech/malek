import { FinanceHubWorkspace } from './finance-hub-workspace';

/**
 * Entry page for money held on behalf of others: tenant deposits held by the
 * office, and owner settlements paid out to owners. Registered at
 * /finance/deposits.
 *
 * Like every finance entry page this is a thin default-section selector — all
 * composition (page shell, tabs, URL sync, permissions, lazy loading) lives in
 * the shared FinanceHubWorkspace so no wrapper page duplicates it.
 */
export function DepositsSettlementsHubPage() {
  return (
    <FinanceHubWorkspace
      defaultSection="deposits"
      title="تسويات وضمانات"
      description="تأمينات المستأجرين المحتجزة، وتسويات الملاك المُعدّة والمعتمدة للصرف — في مكان واحد."
    />
  );
}

export default DepositsSettlementsHubPage;

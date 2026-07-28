import { FinanceHubWorkspace } from './finance-hub-workspace';

/**
 * Entry page for the daily collection cycle: an invoice becomes a receipt once
 * it is collected. Registered at /finance/collections.
 *
 * Like every finance entry page this is a thin default-section selector — all
 * composition (page shell, tabs, URL sync, permissions, lazy loading) lives in
 * the shared FinanceHubWorkspace so no wrapper page duplicates it.
 */
export function CollectionsHubPage() {
  return (
    <FinanceHubWorkspace
      defaultSection="invoices"
      title="التحصيل اليومي"
      description="الفواتير المستحقة وتسجيل دفعاتها، وسجل الإيصالات وطباعة سندات القبض — في مكان واحد."
    />
  );
}

export default CollectionsHubPage;

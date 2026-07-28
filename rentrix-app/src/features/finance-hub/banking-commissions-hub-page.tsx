import { FinanceHubWorkspace } from './finance-hub-workspace';

/**
 * Entry page for periodic (not daily) money reviews: matching bank records
 * against the ledger, and tracking office commission payouts. Registered at
 * /finance/banking.
 *
 * Like every finance entry page this is a thin default-section selector — all
 * composition (page shell, tabs, URL sync, permissions, lazy loading) lives in
 * the shared FinanceHubWorkspace so no wrapper page duplicates it.
 */
export function BankingCommissionsHubPage() {
  return (
    <FinanceHubWorkspace
      defaultSection="bank_reconciliation"
      title="البنوك والعمولات"
      description="مطابقة السجلات مع الحسابات البنكية، ومتابعة عمولات المكتب وحالات استحقاقها — في مكان واحد."
    />
  );
}

export default BankingCommissionsHubPage;

import type { QueryClient } from '@tanstack/react-query';
import { invalidateEntity } from './query-keys';

/** Read models affected by posted payments/deposit applications and reversals.
 * Query namespaces are deliberately enumerated: a financial posting changes
 * more than its originating register, but must not reset unrelated form data.
 * This invalidates projections only; it does not invent client-side balances.
 */
export const financialReadModelRoots = [
  'invoices', 'receipts', 'financialReports', 'accountingReports', 'reports-authority',
  'contract-payments', 'tenant-workspace', 'people', 'owners',
  'owner-financial-authority', 'dashboard-snapshot', 'deposit-invoices',
  'tenant-deposits', 'deposit-claims', 'deposit-refund-events',
] as const;

export function invalidateFinancialReadModels(client: QueryClient): Promise<void> {
  return invalidateEntity(client, ...financialReadModelRoots.map((root) => [root]));
}

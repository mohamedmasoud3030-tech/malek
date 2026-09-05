/**
 * Canonical tenant/owner statement ledger vocabulary (pure — no data access).
 *
 * The authoritative statement RPCs tag every movement with a fixed
 * `tx_type` (see `supabase/migrations/20260901000000_canonical_baseline.sql`):
 *  - `rpt_tenant_statement` lines: 'invoice' | 'receipt'
 *  - `rpt_owner_statement` transactions: 'payment' | 'expense' | 'settlement'
 *
 * The normalizers keep `type` as `string | null` because the RPC boundary is
 * untyped JSON; every surface (statement tables, Excel exports, printed
 * statements, the owner pack) labels a movement through this module so an
 * authoritative row is never shown under the generic fallback. Unknown values
 * fall back to a truthful generic label rather than a fabricated one.
 */
import type { TenantStatementReport } from './statements-reports-service';

export type TenantStatementLineType = 'invoice' | 'receipt';
export type OwnerStatementTransactionType = 'payment' | 'expense' | 'settlement';

export const tenantStatementLineTypeLabels: Readonly<Record<TenantStatementLineType, string>> = {
  invoice: 'فاتورة / استحقاق',
  receipt: 'دفعة / إيصال',
};

/**
 * Owner-statement expenses are only those the statement authority charged to
 * the owner (`_owner_statement_expenses` filters `charged_to = 'OWNER'`), so
 * the label states that explicitly instead of a bare «مصروف».
 */
export const ownerStatementTransactionTypeLabels: Readonly<Record<OwnerStatementTransactionType, string>> = {
  payment: 'تحصيل إيجار',
  expense: 'مصروف مُحمَّل على المالك',
  settlement: 'تسوية / صرف',
};

export const TENANT_STATEMENT_GENERIC_LINE_LABEL = 'حركة حساب';
export const OWNER_STATEMENT_GENERIC_TRANSACTION_LABEL = 'حركة مالية';

export function getTenantStatementLineTypeLabel(type: string | null | undefined): string {
  return tenantStatementLineTypeLabels[type as TenantStatementLineType] ?? TENANT_STATEMENT_GENERIC_LINE_LABEL;
}

export function getOwnerStatementTransactionTypeLabel(type: string | null | undefined): string {
  return ownerStatementTransactionTypeLabels[type as OwnerStatementTransactionType] ?? OWNER_STATEMENT_GENERIC_TRANSACTION_LABEL;
}

/**
 * Each authoritative tenant line exposes its post-movement running balance;
 * reverse the first movement to recover the opening balance — never hardcode 0.
 * With no lines the statement's final balance is the only authoritative figure.
 */
export function deriveTenantOpeningBalance(statement: TenantStatementReport): number {
  const firstLine = statement.lines[0];
  if (!firstLine) return statement.finalBalance || 0;
  return (firstLine.balance || 0) - (firstLine.debit || 0) + (firstLine.credit || 0);
}

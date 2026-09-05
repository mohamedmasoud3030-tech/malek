/**
 * Finance status semantics + filter preservation.
 *
 * Domain mapping only — no JSX, no tokens, no parallel primitives. Every
 * financial surface resolves a raw record status to one semantic tone through
 * these functions and then renders it with the canonical `StatusBadge`
 * (`@/components/ui/status-badge`), so "paid / partial / overdue / draft /
 * void" mean and look the same across invoices, expenses, commissions, bank
 * lines and deposits.
 *
 * This module replaces the presentation half of the former
 * `features/financials/components/finance-reporting-visual-foundations.tsx`,
 * whose visual wrappers duplicated `Alert`, `FilterBar`, `KpiCard`,
 * `LoadingState`, `ErrorState`, `EmptyState`, `StatusBadge` and the amount
 * island. Those wrappers are gone; the mapping below is the part that was
 * genuinely finance domain logic.
 */

import type { SemanticTone } from '@/components/ui/status-badge';
export type FinanceStatusKind =
  | 'posted'
  | 'paid'
  | 'success'
  | 'partial'
  | 'aging'
  | 'warning'
  | 'overdue'
  | 'blocked'
  | 'failed'
  | 'danger'
  | 'draft'
  | 'informational'
  | 'info'
  | 'archived'
  | 'void'
  | 'inactive'
  | 'neutral'
  | 'other';

const statusKindToTone: Record<FinanceStatusKind, SemanticTone> = {
  posted: 'success',
  paid: 'success',
  success: 'success',
  partial: 'warning',
  aging: 'warning',
  warning: 'warning',
  overdue: 'danger',
  blocked: 'danger',
  failed: 'danger',
  danger: 'danger',
  draft: 'info',
  informational: 'info',
  info: 'info',
  archived: 'neutral',
  void: 'neutral',
  inactive: 'neutral',
  neutral: 'neutral',
  other: 'neutral',
};

export function getFinanceStatusTone(kind: FinanceStatusKind): SemanticTone {
  return statusKindToTone[kind] ?? 'neutral';
}

export function mapInvoiceStatusToFinanceKind(rawStatus: string | null | undefined): FinanceStatusKind {
  const s = (rawStatus ?? '').toLowerCase().trim();
  if (['paid', 'posted'].includes(s)) return 'paid';
  if (['partial', 'partially_paid'].includes(s)) return 'partial';
  if (['overdue'].includes(s)) return 'overdue';
  if (['unpaid', 'open', 'draft'].includes(s)) return s === 'draft' ? 'draft' : 'info';
  if (['cancelled', 'void', 'archived'].includes(s)) return 'archived';
  if (['failed', 'blocked'].includes(s)) return 'failed';
  return 'other';
}

export function mapExpenseStatusToFinanceKind(status: string | null | undefined): FinanceStatusKind {
  const s = (status ?? '').toLowerCase();
  if (s === 'paid' || s === 'approved') return 'success';
  if (s === 'pending' || s === 'partial') return 'warning';
  if (s === 'overdue' || s === 'rejected') return 'danger';
  if (s === 'draft') return 'draft';
  if (s === 'void' || s === 'cancelled') return 'archived';
  return 'neutral';
}

export function mapCommissionStatusToFinanceKind(status: string | null | undefined): FinanceStatusKind {
  const s = (status ?? '').toLowerCase();
  if (s === 'paid') return 'paid';
  if (s === 'approved') return 'info';
  if (s === 'pending') return 'partial';
  if (s === 'cancelled') return 'archived';
  return 'neutral';
}

export function mapBankLineStatusToFinanceKind(status: string | null | undefined): FinanceStatusKind {
  const s = (status ?? '').toLowerCase();
  if (s === 'matched') return 'success';
  if (s === 'ignored') return 'archived';
  if (s === 'unmatched') return 'warning';
  return 'neutral';
}

export function mapDepositStatusToFinanceKind(status: string | null | undefined): FinanceStatusKind {
  const s = (status ?? '').toLowerCase();
  if (s === 'refunded') return 'success';
  if (s === 'held') return 'info';
  if (s === 'partial') return 'warning';
  if (s === 'void') return 'archived';
  return 'neutral';
}

// ─────────────────────────────────────────────
// Filter preservation utilities
// ─────────────────────────────────────────────

export type FinanceFilterContext = Record<string, unknown>;

export function preserveFinanceFilters(
  currentSearch: FinanceFilterContext,
  updates: FinanceFilterContext,
): FinanceFilterContext {
  return {
    ...currentSearch,
    ...updates,
  };
}

/**
 * Drill-down keeps the period/property/owner/tenant context the user already
 * narrowed by, and applies only the requested drill parameters on top.
 */
export function buildDrillDownSearch(
  currentSearch: FinanceFilterContext,
  drillParams: FinanceFilterContext,
): FinanceFilterContext {
  const preservedKeys = ['dateFrom', 'dateTo', 'propertyId', 'tenantId', 'ownerId', 'status', 'section', 'asOf', 'costCenterId', 'contractId'];
  const preserved: FinanceFilterContext = {};
  for (const key of preservedKeys) {
    if (currentSearch[key] !== undefined && currentSearch[key] !== '') {
      preserved[key] = currentSearch[key];
    }
  }
  return {
    ...preserved,
    ...drillParams,
  };
}

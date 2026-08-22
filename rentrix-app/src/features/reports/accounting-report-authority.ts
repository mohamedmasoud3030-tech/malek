import { useQuery } from '@tanstack/react-query';
import {
  getCashFlowReport,
  getReconciliation,
  type CashFlowReport,
  type ReconciliationRow,
} from '@/features/accounting/wp05Services';

export type ReconciliationReadiness = Readonly<{
  state: 'PASS' | 'FAIL' | 'NO_EVIDENCE';
  total: number;
  failed: number;
  maxAbsVariance: number;
}>;

export function summarizeReconciliationReadiness(rows: readonly ReconciliationRow[]): ReconciliationReadiness {
  if (rows.length === 0) {
    return { state: 'NO_EVIDENCE', total: 0, failed: 0, maxAbsVariance: 0 };
  }

  const failedRows = rows.filter(
    (row) => row.reconciliation_status !== 'PASS' || Math.abs(row.abs_variance) > 0.001,
  );

  return {
    state: failedRows.length === 0 ? 'PASS' : 'FAIL',
    total: rows.length,
    failed: failedRows.length,
    maxAbsVariance: rows.reduce((max, row) => Math.max(max, Math.abs(row.abs_variance)), 0),
  };
}

export function useAuthoritativeGlCashFlow(
  from: string | undefined,
  to: string | undefined,
  enabled = true,
) {
  return useQuery<CashFlowReport>({
    queryKey: ['reports-authority', 'gl-cash-flow', from ?? '', to ?? ''],
    queryFn: () => getCashFlowReport(from!, to!),
    enabled: enabled && Boolean(from && to),
  });
}

export function useSubledgerGlReconciliation(asOf: string | undefined, enabled = true) {
  return useQuery<ReconciliationRow[]>({
    queryKey: ['reports-authority', 'subledger-gl-reconciliation', asOf ?? ''],
    queryFn: () => getReconciliation(asOf!),
    enabled: enabled && Boolean(asOf),
  });
}

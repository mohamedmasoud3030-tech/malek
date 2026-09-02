import { useQuery } from '@tanstack/react-query';
import {
  getCashFlowReport,
  getReconciliationReport as getReconciliation,
  type CashFlowReport,
  type ReconciliationRow,
} from '@/features/accounting/reports/accountingReportsFacade';

export const REQUIRED_RECONCILIATION_ACCOUNT_NOS = ['1201', '1300', '2000', '2200', '2300'] as const;

export type ReconciliationReadiness = Readonly<{
  state: 'PASS' | 'FAIL' | 'NO_EVIDENCE';
  total: number;
  failed: number;
  maxAbsVariance: number;
  missingAccountNos: readonly string[];
}>;

export function summarizeReconciliationReadiness(rows: readonly ReconciliationRow[]): ReconciliationReadiness {
  const returnedAccountNos = new Set(rows.map((row) => row.account_no.trim()));
  const missingAccountNos = REQUIRED_RECONCILIATION_ACCOUNT_NOS.filter(
    (accountNo) => !returnedAccountNos.has(accountNo),
  );

  if (rows.length === 0) {
    return {
      state: 'NO_EVIDENCE',
      total: 0,
      failed: 0,
      maxAbsVariance: 0,
      missingAccountNos,
    };
  }

  const failedRows = rows.filter(
    (row) => row.reconciliation_status !== 'PASS' || Math.abs(row.abs_variance) > 0.001,
  );
  const failed = failedRows.length + missingAccountNos.length;

  return {
    state: failed === 0 ? 'PASS' : 'FAIL',
    total: rows.length + missingAccountNos.length,
    failed,
    maxAbsVariance: rows.reduce((max, row) => Math.max(max, Math.abs(row.abs_variance)), 0),
    missingAccountNos,
  };
}

export function isAccountingStatementOutputReady(
  readiness: ReconciliationReadiness,
  queryState: Readonly<{ isLoading: boolean; isError: boolean }>,
): boolean {
  return !queryState.isLoading && !queryState.isError && readiness.state === 'PASS';
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

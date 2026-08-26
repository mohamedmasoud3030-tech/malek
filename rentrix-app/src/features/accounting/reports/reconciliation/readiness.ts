export type ReconciliationReadiness = Readonly<{
  state: 'PASS' | 'FAIL' | 'NO_EVIDENCE';
  total: number;
  failed: number;
  maxAbsVariance: number;
  missingAccountNos: readonly string[];
}>;

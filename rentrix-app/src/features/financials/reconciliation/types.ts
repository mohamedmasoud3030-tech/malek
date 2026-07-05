import type { Database } from '@/types/database';

export type BankAccount = Database['public']['Tables']['bank_accounts']['Row'];
export type BankStatementLine = Database['public']['Tables']['bank_statement_lines']['Row'];
export type BankReconciliationMatch = Database['public']['Tables']['bank_reconciliation_matches']['Row'];
export type BankStatementLineStatus = BankStatementLine['status'];
export type MatchEntityType = BankReconciliationMatch['matched_entity_type'];

export type BankReconciliationFilters = Readonly<{
  bankAccountId: string;
  status: BankStatementLineStatus | 'all';
  from: string;
  to: string;
}>;

export type BankStatementLineFormValues = Readonly<{
  bank_account_id: string;
  transaction_date: string;
  description: string;
  reference: string;
  amount: string;
}>;

export type BankReconciliationMatchValues = Readonly<{
  statement_line_id: string;
  matched_entity_type: MatchEntityType;
  matched_entity_id: string;
  matched_amount: string;
  notes: string;
}>;

export type BankStatementImportValues = Readonly<{
  bank_account_id: string;
  statement_name: string;
  csv: string;
}>;

export type BankMatchCandidate = Readonly<{
  entity_type: MatchEntityType;
  entity_id: string;
  amount: number;
  date: string;
  label: string;
}>;

export type ReconciliationSummary = Readonly<{
  totalLines: number;
  unmatchedCount: number;
  matchedCount: number;
  ignoredCount: number;
  unmatchedAmount: number;
}>;

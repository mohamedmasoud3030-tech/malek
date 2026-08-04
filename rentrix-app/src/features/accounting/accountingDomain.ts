/**
 * Stage 3 — General Ledger Core domain types and OMR monetary contract.
 *
 * The approved accounting model (docs/decisions/0009-malek-canonical-accounting-model.md):
 *   * OMR precision is exactly 3 decimal places (C7 APPROVED, rounding unit 0.001);
 *   * the database is the source of truth for financial statements;
 *   * the frontend never authors journal lines — posting runs through the
 *     server-side engine (service contexts only).
 */
import type { Database } from '@/types/database';

export const OMR_PRECISION = 3 as const;
export const OMR_ROUNDING_UNIT = 0.001 as const;

/** Round a monetary value to the canonical OMR unit (0.001), server-style. */
export function roundOmr3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export type ChartAccount = Database['public']['Tables']['accounts']['Row'];
export type AccountType = ChartAccount['account_type'];
export type NormalBalance = ChartAccount['normal_balance'];

export type AccountingPeriod = Database['public']['Tables']['accounting_periods']['Row'];
export type AccountingPeriodStatus = AccountingPeriod['status'];

export type JournalBatch = Database['public']['Tables']['journal_batches']['Row'];
export type JournalBatchStatus = JournalBatch['status'];
export type JournalLine = Database['public']['Tables']['journal_lines']['Row'];

export type AccountClassification = Readonly<{
  accountType: AccountType;
  normalBalance: NormalBalance;
}>;

/** The 18 required Stage 3 accounts (mirrors provision_company_chart_of_accounts). */
export const REQUIRED_ACCOUNT_DEFINITIONS: ReadonlyArray<
  Readonly<{ accountNo: string; name: string } & AccountClassification>
> = [
  { accountNo: '1111', name: 'Cash', accountType: 'asset', normalBalance: 'debit' },
  { accountNo: '1120', name: 'Bank', accountType: 'asset', normalBalance: 'debit' },
  { accountNo: '1201', name: 'Tenant Receivable', accountType: 'asset', normalBalance: 'debit' },
  { accountNo: '1300', name: 'Due from Owners', accountType: 'asset', normalBalance: 'debit' },
  { accountNo: '1600', name: 'Right-of-Use Asset', accountType: 'asset', normalBalance: 'debit' },
  { accountNo: '2000', name: 'Owner Funds Payable', accountType: 'liability', normalBalance: 'credit' },
  { accountNo: '2100', name: 'VAT Payable', accountType: 'liability', normalBalance: 'credit' },
  { accountNo: '2200', name: 'Tenant Deposits Payable', accountType: 'liability', normalBalance: 'credit' },
  { accountNo: '2300', name: 'Broker Commissions Payable', accountType: 'liability', normalBalance: 'credit' },
  { accountNo: '2500', name: 'Lease Liability', accountType: 'liability', normalBalance: 'credit' },
  { accountNo: '4000', name: 'Sublease Rental Revenue', accountType: 'revenue', normalBalance: 'credit' },
  { accountNo: '4100', name: 'Management Fee Revenue', accountType: 'revenue', normalBalance: 'credit' },
  { accountNo: '4200', name: 'Brokerage Revenue', accountType: 'revenue', normalBalance: 'credit' },
  { accountNo: '4300', name: 'Damage Compensation Revenue', accountType: 'revenue', normalBalance: 'credit' },
  { accountNo: '6100', name: 'Company Operating Expense', accountType: 'expense', normalBalance: 'debit' },
  { accountNo: '6110', name: 'Broker Commission Expense', accountType: 'expense', normalBalance: 'debit' },
  { accountNo: '6200', name: 'ROU Depreciation', accountType: 'expense', normalBalance: 'debit' },
  { accountNo: '6300', name: 'Lease Interest Expense', accountType: 'expense', normalBalance: 'debit' },
];

/**
 * One journal line as accepted by the server-side posting engine
 * (gl_create_journal_batch / post_journal_event). Exactly one side must be a
 * positive amount; values are normalized to three decimals server-side.
 * These payloads are ONLY valid in server contexts — browser code must never
 * submit arbitrary debit/credit lines (the engine RPCs are service_role-only).
 */
export type JournalLineInput = Readonly<{
  account_id: string;
  debit?: number;
  credit?: number;
  line_description?: string | null;
  ref_source_id?: string | null;
  ref_entity_type?: string | null;
  ref_entity_id?: string | null;
}>;

/** Predefined business-event payload for the idempotent posting entry point. */
export type JournalEventInput = Readonly<{
  company_id: string;
  source_type: string;
  source_id: string;
  event_id: string;
  effective_date: string;
  description?: string | null;
  lines: JournalLineInput[];
}>;

export type PostJournalEventResult = Readonly<{
  success: boolean;
  idempotent?: boolean;
  batch_id: string;
  status: JournalBatchStatus;
  accounting_period_id?: string | null;
  period_resolution_reason?: string | null;
  effective_date?: string;
  posted_at?: string;
  debits?: number;
  credits?: number;
  lines?: Array<{ line_id: string; account_id: string; debit: number; credit: number }>;
}>;

export type ReverseJournalBatchResult = Readonly<{
  success: boolean;
  idempotent?: boolean;
  original_batch_id: string;
  reversal_batch_id: string;
  status: JournalBatchStatus;
  reversal_period_id?: string | null;
  reversal_period_reason?: string | null;
}>;

export type AccountingPeriodInput = Readonly<{
  name?: string | null;
  start_date: string;
  end_date: string;
  status?: AccountingPeriodStatus | null;
}>;

export type AccountingPeriodStatusInput = Readonly<{
  period_id: string;
  status: AccountingPeriodStatus;
  reason?: string | null;
}>;

export type ChartOfAccountsList = Readonly<{ company_id: string; accounts: ChartAccount[] }>;
export type AccountingPeriodsList = Readonly<{ company_id: string; periods: AccountingPeriod[] }>;
export type JournalBatchesList = Readonly<{ company_id: string; batches: JournalBatch[] }>;
export type JournalLinesList = Readonly<{ batch_id: string; lines: JournalLine[] }>;
export type ProvisionResult = Readonly<{
  success: boolean;
  company_id: string;
  created_count: number;
  existing_count: number;
  accounts: Array<{ account_no: string; name: string; account_type: string; normal_balance: string; currency_code: string; precision: number }>;
}>;

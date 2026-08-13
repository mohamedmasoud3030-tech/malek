import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';

export type FixedMonthlyAccrualStatus = 'POSTED' | 'REVERSED' | 'ZERO_AMOUNT' | 'SOURCE_ERROR';

export type FixedMonthlyAccrualRow = Readonly<{
  id: string;
  ownerAgreementId: string;
  agreementVersionId: string;
  versionNo: number;
  ownerName: string;
  propertyName: string;
  accrualDate: string;
  monthlyContractAmount: number;
  monthlyAmountOmr: number;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
  taxAuthorityStatus: string;
  status: FixedMonthlyAccrualStatus;
  journalBatchId: string | null;
  accountingPeriodId: string | null;
  postingDate: string | null;
  periodResolutionReason: string | null;
  latePosting: boolean;
  reversalId: string | null;
  reversalBatchId: string | null;
  reversalReason: string | null;
  reversedAt: string | null;
}>;

export type FixedMonthlyAccrualList = Readonly<{
  dateFrom: string;
  dateTo: string;
  totalCount: number;
  returnedCount: number;
  truncated: boolean;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
  reversedCount: number;
  taxAuthorityStatus: string;
  accruals: FixedMonthlyAccrualRow[];
}>;

export type FixedMonthlyRunResult = Readonly<{
  dateFrom: string;
  dateTo: string;
  attemptedDays: number;
  createdDays: number;
  idempotentDays: number;
  alreadyReversedDays: number;
  zeroAmountDays: number;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
}>;

export type FixedMonthlyReverseResult = Readonly<{
  accrualId: string;
  reversalId: string;
  originalBatchId: string | null;
  reversalBatchId: string | null;
  idempotent: boolean;
}>;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNullableString(value: unknown): string | null {
  return value == null ? null : asString(value) || null;
}

function asNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseRow(value: unknown): FixedMonthlyAccrualRow {
  const row = asRecord(value);
  return {
    id: asString(row.id),
    ownerAgreementId: asString(row.owner_agreement_id),
    agreementVersionId: asString(row.agreement_version_id),
    versionNo: asNumber(row.version_no),
    ownerName: asString(row.owner_name),
    propertyName: asString(row.property_name),
    accrualDate: asString(row.accrual_date),
    monthlyContractAmount: asNumber(row.monthly_contract_amount),
    monthlyAmountOmr: asNumber(row.monthly_amount_omr),
    netAmount: asNumber(row.net_amount),
    taxAmount: asNumber(row.tax_amount),
    grossAmount: asNumber(row.gross_amount),
    taxAuthorityStatus: asString(row.tax_authority_status),
    status: (asString(row.status) || 'SOURCE_ERROR') as FixedMonthlyAccrualStatus,
    journalBatchId: asNullableString(row.journal_batch_id),
    accountingPeriodId: asNullableString(row.accounting_period_id),
    postingDate: asNullableString(row.posting_date),
    periodResolutionReason: asNullableString(row.period_resolution_reason),
    latePosting: row.late_posting === true,
    reversalId: asNullableString(row.reversal_id),
    reversalBatchId: asNullableString(row.reversal_journal_batch_id),
    reversalReason: asNullableString(row.reversal_reason),
    reversedAt: asNullableString(row.reversed_at),
  };
}

export async function listFixedMonthlyAccruals(dateFrom: string, dateTo: string): Promise<FixedMonthlyAccrualList> {
  try {
    const { data, error } = await supabase.rpc('list_fixed_monthly_accruals', {
      p_payload: { date_from: dateFrom, date_to: dateTo },
    });
    if (error) throw error;
    const root = asRecord(data);
    const rows = Array.isArray(root.accruals) ? root.accruals : [];
    return {
      dateFrom: asString(root.date_from) || dateFrom,
      dateTo: asString(root.date_to) || dateTo,
      totalCount: asNumber(root.total_count),
      returnedCount: asNumber(root.returned_count),
      truncated: root.truncated === true,
      netAmount: asNumber(root.net_amount),
      taxAmount: asNumber(root.tax_amount),
      grossAmount: asNumber(root.gross_amount),
      reversedCount: asNumber(root.reversed_count),
      taxAuthorityStatus: asString(root.tax_authority_status),
      accruals: rows.map(parseRow),
    };
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل سجل استحقاقات العمولة الشهرية');
    throw error;
  }
}

export async function executeFixedMonthlyAccruals(
  dateFrom: string,
  dateTo: string,
  requestId: string,
): Promise<FixedMonthlyRunResult> {
  try {
    const { data, error } = await supabase.rpc('execute_fixed_monthly_accruals_atomic', {
      p_payload: {
        request_id: requestId,
        date_from: dateFrom,
        date_to: dateTo,
      },
    });
    if (error) throw error;
    const root = asRecord(data);
    return {
      dateFrom: asString(root.date_from) || dateFrom,
      dateTo: asString(root.date_to) || dateTo,
      attemptedDays: asNumber(root.attempted_days),
      createdDays: asNumber(root.created_days),
      idempotentDays: asNumber(root.idempotent_days),
      alreadyReversedDays: asNumber(root.already_reversed_days),
      zeroAmountDays: asNumber(root.zero_amount_days),
      netAmount: asNumber(root.net_amount),
      taxAmount: asNumber(root.tax_amount),
      grossAmount: asNumber(root.gross_amount),
    };
  } catch (error) {
    handleSupabaseError(error, 'تعذر تنفيذ استحقاقات العمولة الشهرية');
    throw error;
  }
}

export async function reverseFixedMonthlyAccrual(
  accrualId: string,
  reason: string,
  requestId: string,
): Promise<FixedMonthlyReverseResult> {
  try {
    const { data, error } = await supabase.rpc('reverse_fixed_monthly_accrual_atomic', {
      p_payload: {
        request_id: requestId,
        accrual_id: accrualId,
        reason,
      },
    });
    if (error) throw error;
    const root = asRecord(data);
    return {
      accrualId: asString(root.accrual_id),
      reversalId: asString(root.reversal_id),
      originalBatchId: asNullableString(root.original_batch_id),
      reversalBatchId: asNullableString(root.reversal_batch_id),
      idempotent: root.idempotent === true,
    };
  } catch (error) {
    handleSupabaseError(error, 'تعذر عكس استحقاق العمولة الشهرية');
    throw error;
  }
}

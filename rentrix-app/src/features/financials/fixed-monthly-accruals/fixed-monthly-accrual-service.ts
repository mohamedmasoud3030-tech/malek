import { z } from 'zod';
import { reportCountSchema, reportMoneySchema, reportNumberSchema } from '@/lib/report-value-schemas';
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

// Validate the server evidence before presenting success or monetary totals.
// Nullable posting metadata is legitimate for a zero-amount accrual; absent
// financial evidence is not. Contract precision is distinct from posted OMR.
const identifier = z.string().min(1);
const nullableText = z.string().nullable();
const dates = { date_from: z.string().date(), date_to: z.string().date() };
const amounts = { net_amount: reportMoneySchema, tax_amount: reportMoneySchema, gross_amount: reportMoneySchema };
const rowSchema = z.object({
  id: identifier, owner_agreement_id: identifier, agreement_version_id: identifier,
  version_no: reportCountSchema, owner_name: z.string(), property_name: z.string(),
  accrual_date: z.string().date(), monthly_contract_amount: reportNumberSchema,
  monthly_amount_omr: reportMoneySchema, ...amounts,
  tax_authority_status: identifier,
  status: z.enum(['POSTED', 'REVERSED', 'ZERO_AMOUNT', 'SOURCE_ERROR']),
  journal_batch_id: nullableText, accounting_period_id: nullableText,
  posting_date: z.string().date().nullable(), period_resolution_reason: nullableText,
  late_posting: z.boolean().nullable(), reversal_id: nullableText,
  reversal_journal_batch_id: nullableText, reversal_reason: nullableText,
  reversed_at: nullableText,
});
const listSchema = z.object({
  success: z.literal(true), ...dates, ...amounts,
  total_count: reportCountSchema, returned_count: reportCountSchema,
  reversed_count: reportCountSchema, truncated: z.boolean(),
  tax_authority_status: identifier, accruals: z.array(rowSchema),
}).refine(root => root.returned_count === root.accruals.length
  && root.total_count >= root.returned_count && root.reversed_count <= root.total_count,
  'Inconsistent fixed-fee register counts');
const runSchema = z.object({
  success: z.literal(true), ...dates, ...amounts,
  attempted_days: reportCountSchema, created_days: reportCountSchema,
  idempotent_days: reportCountSchema, already_reversed_days: reportCountSchema,
  zero_amount_days: reportCountSchema,
});
const reverseSchema = z.object({
  success: z.literal(true), accrual_id: identifier, reversal_id: identifier,
  original_batch_id: nullableText, reversal_batch_id: nullableText,
  idempotent: z.boolean(),
});

function parseRow(row: z.infer<typeof rowSchema>): FixedMonthlyAccrualRow {
  return {
    id: row.id,
    ownerAgreementId: row.owner_agreement_id,
    agreementVersionId: row.agreement_version_id,
    versionNo: row.version_no,
    ownerName: row.owner_name,
    propertyName: row.property_name,
    accrualDate: row.accrual_date,
    monthlyContractAmount: row.monthly_contract_amount,
    monthlyAmountOmr: row.monthly_amount_omr,
    netAmount: row.net_amount,
    taxAmount: row.tax_amount,
    grossAmount: row.gross_amount,
    taxAuthorityStatus: row.tax_authority_status,
    status: row.status,
    journalBatchId: row.journal_batch_id,
    accountingPeriodId: row.accounting_period_id,
    postingDate: row.posting_date,
    periodResolutionReason: row.period_resolution_reason,
    latePosting: row.late_posting ?? false,
    reversalId: row.reversal_id,
    reversalBatchId: row.reversal_journal_batch_id,
    reversalReason: row.reversal_reason,
    reversedAt: row.reversed_at,
  };
}

export async function listFixedMonthlyAccruals(dateFrom: string, dateTo: string): Promise<FixedMonthlyAccrualList> {
  try {
    const { data, error } = await supabase.rpc('list_fixed_monthly_accruals', {
      p_payload: { date_from: dateFrom, date_to: dateTo },
    });
    if (error) throw error;
    const root = listSchema.parse(data);
    return {
      dateFrom: root.date_from,
      dateTo: root.date_to,
      totalCount: root.total_count,
      returnedCount: root.returned_count,
      truncated: root.truncated,
      netAmount: root.net_amount,
      taxAmount: root.tax_amount,
      grossAmount: root.gross_amount,
      reversedCount: root.reversed_count,
      taxAuthorityStatus: root.tax_authority_status,
      accruals: root.accruals.map(parseRow),
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
    const root = runSchema.parse(data);
    return {
      dateFrom: root.date_from,
      dateTo: root.date_to,
      attemptedDays: root.attempted_days,
      createdDays: root.created_days,
      idempotentDays: root.idempotent_days,
      alreadyReversedDays: root.already_reversed_days,
      zeroAmountDays: root.zero_amount_days,
      netAmount: root.net_amount,
      taxAmount: root.tax_amount,
      grossAmount: root.gross_amount,
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
    const root = reverseSchema.parse(data);
    return {
      accrualId: root.accrual_id,
      reversalId: root.reversal_id,
      originalBatchId: root.original_batch_id,
      reversalBatchId: root.reversal_batch_id,
      idempotent: root.idempotent,
    };
  } catch (error) {
    handleSupabaseError(error, 'تعذر عكس استحقاق العمولة الشهرية');
    throw error;
  }
}

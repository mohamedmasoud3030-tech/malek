import { supabase } from '@/lib/supabase';

export type ShortStayReconciliationResult = Readonly<{
  status: 'reconciled';
  expired_contracts: number;
  released_units: number;
  as_of: string;
}>;

export type ShortStayExtensionInput = Readonly<{
  newEndDate: string;
  extensionAmount: number;
  requestId?: string;
}>;

export type ShortStayExtensionResult = Readonly<{
  status: 'extended';
  contract_id: string;
  old_end_date: string;
  new_end_date: string;
  extension_amount: number;
  new_contract_total: number;
  invoice_id: string;
  idempotent: boolean;
}>;

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reconcile date-driven Short Stay checkout state before operational reads.
 *
 * This is not a user-authored mutation: the server decides the current company,
 * which contracts are due, and which occupied units are safe to release. The
 * browser supplies no company, contract, unit, date, status or amount.
 */
export async function reconcileDueShortStays(): Promise<ShortStayReconciliationResult> {
  const { data, error } = await supabase.rpc('reconcile_due_short_stays_atomic');
  if (error) throw error;
  if (!isJsonObject(data) || data.status !== 'reconciled') {
    throw new Error('استجابة غير صالحة من مزامنة انتهاء الإقامة القصيرة');
  }
  return {
    status: 'reconciled',
    expired_contracts: Number(data.expired_contracts ?? 0),
    released_units: Number(data.released_units ?? 0),
    as_of: String(data.as_of ?? ''),
  } satisfies ShortStayReconciliationResult;
}

/**
 * A failed reconciliation must never hide the underlying read. Server-side
 * authorization still protects every table read; this helper merely prevents
 * a transient maintenance failure from blanking the whole workspace.
 */
export async function reconcileDueShortStaysBeforeRead(): Promise<void> {
  try {
    await reconcileDueShortStays();
  } catch (error) {
    console.warn('Short Stay reconciliation skipped before read', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

/**
 * Extend one active Short Stay before checkout. The server re-checks all
 * authority, overlap, owner-agreement, tax and GL invariants and creates the
 * supplemental RENT invoice atomically with the date change.
 */
export async function extendShortStayContract(
  contractId: string,
  input: ShortStayExtensionInput,
): Promise<ShortStayExtensionResult> {
  if (!contractId) throw new Error('معرف العقد مطلوب');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.newEndDate)) throw new Error('تاريخ النهاية الجديد غير صالح');
  if (!Number.isFinite(input.extensionAmount) || input.extensionAmount <= 0) {
    throw new Error('مبلغ التمديد يجب أن يكون أكبر من صفر');
  }

  const requestId = input.requestId ?? crypto.randomUUID();
  const { data, error } = await supabase.rpc('extend_short_stay_contract_atomic', {
    p_contract_id: contractId,
    p_new_end_date: input.newEndDate,
    p_extension_amount: input.extensionAmount,
    p_request_id: requestId,
  });
  if (error) throw error;
  if (
    !isJsonObject(data)
    || data.status !== 'extended'
    || typeof data.invoice_id !== 'string'
    || typeof data.new_contract_total !== 'number'
  ) {
    throw new Error('استجابة غير صالحة من تمديد الإقامة القصيرة');
  }
  return {
    status: 'extended',
    contract_id: String(data.contract_id ?? contractId),
    old_end_date: String(data.old_end_date ?? ''),
    new_end_date: String(data.new_end_date ?? input.newEndDate),
    extension_amount: Number(data.extension_amount ?? input.extensionAmount),
    new_contract_total: data.new_contract_total,
    invoice_id: data.invoice_id,
    idempotent: data.idempotent === true,
  } satisfies ShortStayExtensionResult;
}

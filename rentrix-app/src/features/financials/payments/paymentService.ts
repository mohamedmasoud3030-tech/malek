import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import type { Payment } from '@/types/domain';

export type PaymentPayload = { invoice_id: string; amount: number; method: Payment['payment_method']; date: string; reference: string | null; request_id: string };

export type PaymentResult = {
  status: 'recorded';
  request_id: string;
  invoice_id: string;
  payment_id: string;
  receipt_id: string;
  receipt_no?: string;
  success?: boolean;
  idempotent?: boolean;
};

export type PaymentRequestIdState = { current: string | null };

export function getOrCreatePaymentRequestId(state: PaymentRequestIdState, createId: () => string = () => crypto.randomUUID()) {
  state.current ??= createId();
  return state.current;
}

export function resetPaymentRequestId(state: PaymentRequestIdState) {
  state.current = null;
}

function parsePaymentResult(data: unknown): PaymentResult {
  if (!data || typeof data !== 'object') {
    throw new Error('تعذر تأكيد نتيجة تسجيل الدفعة من الخادم. حدّث السجل قبل إعادة المحاولة.');
  }

  const result = data as Partial<PaymentResult>;
  if (!result.receipt_id || !result.payment_id || !result.invoice_id || !result.request_id) {
    throw new Error('تم استلام استجابة غير مكتملة بعد تسجيل الدفعة. حدّث السجل قبل إعادة المحاولة.');
  }

  return { ...result, status: result.status ?? 'recorded' } as PaymentResult;
}

export async function recordInvoicePaymentAtomic(payload: PaymentPayload): Promise<PaymentResult> {
  const { data, error } = await supabase.rpc('record_invoice_payment_atomic', { payload });
  if (error) handleSupabaseError(error, 'تعذر تسجيل الدفعة');
  return parsePaymentResult(data);
}

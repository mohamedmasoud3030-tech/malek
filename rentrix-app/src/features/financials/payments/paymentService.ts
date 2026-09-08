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

function parsePaymentResult(data: unknown, payload: PaymentPayload): PaymentResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('تعذر تأكيد نتيجة تسجيل الدفعة من الخادم. حدّث السجل قبل إعادة المحاولة.');
  }

  const result = data as Partial<PaymentResult>;
  if (![result.receipt_id, result.payment_id, result.invoice_id, result.request_id].every((id) => typeof id === 'string' && id.trim().length > 0)) {
    throw new Error('تم استلام استجابة غير مكتملة بعد تسجيل الدفعة. حدّث السجل قبل إعادة المحاولة.');
  }

  if (result.status !== 'recorded' || (result.success !== undefined && result.success !== true)
      || result.invoice_id !== payload.invoice_id || result.request_id !== payload.request_id) {
    throw new Error('تعذر تأكيد ارتباط نتيجة الدفعة بالطلب الحالي. حدّث السجل قبل إعادة المحاولة.');
  }
  return result as PaymentResult;
}

export async function recordInvoicePaymentAtomic(payload: PaymentPayload): Promise<PaymentResult> {
  const { data, error } = await supabase.rpc('record_invoice_payment_atomic', { payload });
  if (error) handleSupabaseError(error, 'تعذر تسجيل الدفعة');
  return parsePaymentResult(data, payload);
}

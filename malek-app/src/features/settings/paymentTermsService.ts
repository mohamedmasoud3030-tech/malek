import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import type { Database } from '@/types/database';

export type PaymentTermsRecord = Database['public']['Tables']['payment_terms_templates']['Row'];
type PaymentTermsInsert = Database['public']['Tables']['payment_terms_templates']['Insert'];
type PaymentTermsUpdate = Database['public']['Tables']['payment_terms_templates']['Update'];

export const paymentTermsIntervalValues = ['monthly', 'quarterly', 'biannual', 'annual', 'custom'] as const;

export const paymentTermsIntervalLabels: Record<(typeof paymentTermsIntervalValues)[number], string> = {
  monthly: 'شهري',
  quarterly: 'ربع سنوي',
  biannual: 'نصف سنوي',
  annual: 'سنوي',
  custom: 'مخصص',
};

export type PaymentTermsFormValues = Readonly<{
  name: string;
  installments: number;
  interval_type: (typeof paymentTermsIntervalValues)[number];
  notes: string;
  is_active: boolean;
}>;

function paymentTermsPayload(values: PaymentTermsFormValues): PaymentTermsInsert {
  return {
    name: values.name.trim(),
    installments: Math.max(1, Math.trunc(Number(values.installments) || 1)),
    interval_type: values.interval_type,
    notes: values.notes.trim() || null,
    is_active: values.is_active,
  };
}

export async function listPaymentTerms(): Promise<PaymentTermsRecord[]> {
  const { data, error } = await supabase
    .from('payment_terms_templates')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<PaymentTermsRecord[]>();
  if (error) handleSupabaseError(error, 'تعذر تحميل شروط السداد');
  return data ?? [];
}

export async function savePaymentTerms(values: PaymentTermsFormValues, id?: string): Promise<PaymentTermsRecord> {
  const payload = paymentTermsPayload(values);
  if (!payload.name) throw new Error('اسم شرط السداد مطلوب.');

  if (id) {
    const updatePayload: PaymentTermsUpdate = { ...payload, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from('payment_terms_templates')
      .update(updatePayload)
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single()
      .returns<PaymentTermsRecord>();
    if (error) handleSupabaseError(error, 'تعذر تحديث شرط السداد');
    if (!data) throw new Error('تعذر تحديث شرط السداد');
    return data;
  }

  const { data, error } = await supabase
    .from('payment_terms_templates')
    .insert(payload)
    .select('*')
    .single()
    .returns<PaymentTermsRecord>();
  if (error) handleSupabaseError(error, 'تعذر إنشاء شرط السداد');
  if (!data) throw new Error('تعذر إنشاء شرط السداد');
  return data;
}

export async function archivePaymentTerms(id: string): Promise<void> {
  const updatePayload: PaymentTermsUpdate = { deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const { error } = await supabase
    .from('payment_terms_templates')
    .update(updatePayload)
    .eq('id', id)
    .is('deleted_at', null);
  if (error) handleSupabaseError(error, 'تعذر أرشفة شرط السداد');
}

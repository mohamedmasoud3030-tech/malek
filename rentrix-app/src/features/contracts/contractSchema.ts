import { z } from 'zod';

const money = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? NaN : Number(value)),
  z.number({ invalid_type_error: 'قيمة الدفعة التعاقدية مطلوبة' }).positive('قيمة الدفعة التعاقدية يجب أن تكون أكبر من صفر'),
);

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsedDate = new Date(year, month - 1, day);

  return parsedDate.getFullYear() === year
    && parsedDate.getMonth() === month - 1
    && parsedDate.getDate() === day;
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'التاريخ يجب أن يكون بصيغة YYYY-MM-DD')
  .refine(isValidDateInput, 'أدخل تاريخًا صحيحًا');

export const contractStatusValues = ['draft', 'active', 'expired', 'terminated'] as const;
export const paymentCycleValues = ['monthly', 'quarterly', 'semi_annual', 'annual'] as const;
export const leaseModeValues = ['long_term', 'short_stay'] as const;

export const leaseModeLabels: Record<(typeof leaseModeValues)[number], string> = {
  long_term: 'إيجار طويل المدى',
  short_stay: 'إقامة قصيرة',
};

export const contractStatusLabels: Record<(typeof contractStatusValues)[number], string> = {
  draft: 'مسودة',
  active: 'نشط',
  expired: 'منتهي',
  terminated: 'ملغي',
};

type ContractStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const contractStatusTone: Record<(typeof contractStatusValues)[number], ContractStatusTone> = {
  draft: 'neutral',
  active: 'success',
  expired: 'warning',
  terminated: 'danger',
};

export const paymentCycleLabels: Record<(typeof paymentCycleValues)[number], string> = {
  monthly: 'شهري',
  quarterly: 'ربع سنوي',
  semi_annual: 'نصف سنوي',
  annual: 'سنوي',
};

const billingDay = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? 1 : Number(value)),
  z.number({ invalid_type_error: 'يوم الفوترة مطلوب' })
    .int('يوم الفوترة يجب أن يكون عدداً صحيحاً')
    .min(1, 'يوم الفوترة يجب أن يكون بين 1 و28')
    .max(28, 'يوم الفوترة يجب أن يكون بين 1 و28'),
);

const graceDays = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? 0 : Number(value)),
  z.number({ invalid_type_error: 'أيام السماح مطلوبة' })
    .int('أيام السماح يجب أن تكون عدداً صحيحاً')
    .min(0, 'أيام السماح لا يمكن أن تكون سالبة')
    .max(90, 'أيام السماح يجب ألا تتجاوز 90 يوماً'),
);

// Short Stay (Architecture Lock 2026-08-27): the optional reference daily
// price is informational; the negotiated stay total (rent_amount) governs the
// obligation. OMR money precision, non-negative, at most 3 decimals.
const dailyReferenceRate = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
  z
    .number({ invalid_type_error: 'سعر اليوم المرجعي يجب أن يكون رقماً' })
    .min(0, 'سعر اليوم المرجعي لا يمكن أن يكون سالباً')
    .refine((value) => Number.isInteger(Math.round(value * 1000)) && Math.abs(value - Math.round(value * 1000) / 1000) < 1e-9, {
      message: 'سعر اليوم المرجعي يقبل ثلاث خانات عشرية كحد أقصى',
    })
    .nullable(),
);

export const contractSchemaBase = z.object({
  // Live properties use text ids; validate selection without narrowing the id format to UUID.
  property_id: z.string().trim().min(1, 'اختر العقار'),
  unit_id: z.string().uuid('اختر الوحدة'),
  tenant_id: z.string().uuid('اختر المستأجر'),
  agreement_id: z.string().uuid('لا توجد اتفاقية مالك تغطي فترة العقد').optional().nullable(),
  start_date: isoDate,
  end_date: isoDate,
  rent_amount: money,
  payment_cycle: z.enum(paymentCycleValues, { required_error: 'دورة السداد مطلوبة' }),
  // R4 — Billing Authority: the billing policy is an explicit contract term,
  // never a hidden default. billing_day anchors invoice issue dates inside
  // each period; due date = period end + grace_days (server declaration).
  billing_day: billingDay,
  grace_days: graceDays,
  // Short Stay mode: a small contract on the same unit (from/to, optional
  // reference daily rate, negotiated total). Long-term contracts must not
  // carry a reference daily rate — the server rejects it too.
  lease_mode: z.enum(leaseModeValues).default('long_term'),
  daily_reference_rate: dailyReferenceRate.default(null),
  payment_terms_id: z.string().uuid('اختر شرط سداد صحيح').or(z.literal('')).optional().transform((value) => value || null),
  status: z.enum(contractStatusValues, { required_error: 'الحالة مطلوبة' }),
  cancellation_reason: z.string().trim().optional().transform((value) => value || null),
  notes: z.string().trim().optional().transform((value) => value || null),
  attachment_url: z.string().nullable().optional(),
});

export const contractSchema = contractSchemaBase
  .refine((value) => value.end_date > value.start_date, { path: ['end_date'], message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية' })
  .refine((value) => value.lease_mode !== 'long_term' || value.daily_reference_rate == null, {
    path: ['daily_reference_rate'],
    message: 'سعر اليوم المرجعي خاص بعقود الإقامة القصيرة',
  });

export const renewalSchema = z.object({
  new_start: isoDate,
  new_end: isoDate,
  new_amount: money,
  agreement_id: z.string().uuid('اختر اتفاقية مالك صحيحة').optional().nullable(),
}).refine((value) => value.new_end > value.new_start, { path: ['new_end'], message: 'تاريخ النهاية يجب أن يكون بعد البداية' });

export type ContractFormValues = z.input<typeof contractSchema>;
export type ContractPayload = z.output<typeof contractSchema>;
export type RenewalPayload = z.output<typeof renewalSchema>;

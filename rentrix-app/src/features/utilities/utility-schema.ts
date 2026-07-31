// Utilities validation schema (meters and bills).
//
// The form uses the form-level schema (string values). The service
// layer re-parses with the payload schema (typed values) before
// any Supabase write. The two layers share constants and labels
// so the UI and the backend agree on the same enums.

import { z } from 'zod';

export const UTILITY_TYPE_VALUES = ['electricity', 'water', 'sanitation', 'internet', 'gas', 'other'] as const;
export const RESPONSIBLE_PARTY_VALUES = ['tenant', 'landlord', 'company'] as const;
export const UTILITY_BILL_STATUS_VALUES = ['unpaid', 'partially_paid', 'paid'] as const;
export const PAYOUT_METHOD_VALUES = ['bank_transfer', 'check', 'cash'] as const;

export type UtilityType = (typeof UTILITY_TYPE_VALUES)[number];
export type ResponsibleParty = (typeof RESPONSIBLE_PARTY_VALUES)[number];
export type UtilityBillStatus = (typeof UTILITY_BILL_STATUS_VALUES)[number];

export const UTILITY_TYPE_LABELS: Record<UtilityType, string> = {
  electricity: 'كهرباء',
  water: 'مياه',
  sanitation: 'صرف صحي',
  internet: 'إنترنت وتواصل',
  gas: 'غاز',
  other: 'مرافق أخرى',
};

export const RESPONSIBLE_PARTY_LABELS: Record<ResponsibleParty, string> = {
  tenant: 'المستأجر',
  landlord: 'المالك',
  company: 'شركة الإدارة',
};

export const UTILITY_BILL_STATUS_LABELS: Record<UtilityBillStatus, string> = {
  unpaid: 'مستحقة السداد',
  partially_paid: 'مدفوعة جزئياً',
  paid: 'مسددة بالكامل',
};

/** Reusable date-string validator (YYYY-MM-DD). */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'التاريخ يجب أن يكون بصيغة YYYY-MM-DD')
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }, 'تاريخ غير صحيح');

/** UUID validator. */
const uuid = z.string().uuid('المعرف يجب أن يكون UUID صحيحاً');

/** Positive number that becomes null on blank input. */
const positiveNumber = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : Number.NaN;
  },
  z.number().positive('القيمة يجب أن تكون أكبر من صفر').nullable(),
);

/** Non-negative number that becomes null on blank input. */
const nonNegativeNumber = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : Number.NaN;
  },
  z.number().nonnegative('القيمة لا يمكن أن تكون سالبة').nullable(),
);

// ── Meter schemas ───────────────────────────────────────────────────────────

/** Form-level meter schema (every value is a string). */
export const utilityMeterFormSchema = z.object({
  property_id: uuid,
  unit_id: z.string().nullable().optional(),
  utility_type: z.enum(UTILITY_TYPE_VALUES, { required_error: 'نوع المرفق مطلوب' }),
  meter_number: z.string().trim().min(1, 'رقم العداد مطلوب').max(64),
  account_number: z.string().trim().min(1, 'رقم الحساب مطلوب').max(64),
  provider_name: z.string().trim().max(200).optional().or(z.literal('')),
  responsible_party: z.enum(RESPONSIBLE_PARTY_VALUES, { required_error: 'الجهة المسؤولة مطلوبة' }),
  is_active: z.boolean().default(true),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export type UtilityMeterFormInput = z.input<typeof utilityMeterFormSchema>;
export type UtilityMeterFormValues = z.output<typeof utilityMeterFormSchema>;

/**
 * Service-layer meter payload. Re-parsed by the service before any
 * Supabase write so a hand-crafted call cannot bypass form rules.
 */
export const utilityMeterPayloadSchema = z.object({
  property_id: uuid,
  unit_id: z.string().nullable().optional(),
  utility_type: z.enum(UTILITY_TYPE_VALUES),
  meter_number: z.string().min(1).max(64),
  account_number: z.string().min(1).max(64),
  provider_name: z.string().max(200).nullable().optional(),
  responsible_party: z.enum(RESPONSIBLE_PARTY_VALUES),
  is_active: z.boolean(),
  notes: z.string().max(2000).nullable().optional(),
});

export type UtilityMeterPayload = z.output<typeof utilityMeterPayloadSchema>;

// ── Bill schemas ────────────────────────────────────────────────────────────

/** Form-level bill schema. */
export const utilityBillFormSchema = z
  .object({
    meter_id: z.string().nullable().optional(),
    property_id: uuid,
    unit_id: z.string().nullable().optional(),
    bill_number: z.string().trim().max(64).nullable().optional(),
    billing_period_start: z.union([z.string(), z.null()]).optional(),
    billing_period_end: z.union([z.string(), z.null()]).optional(),
    previous_reading: positiveNumber,
    current_reading: positiveNumber,
    consumption_units: positiveNumber,
    amount: z.preprocess(
      (value) => (value === '' || value === null || value === undefined ? Number.NaN : Number(value)),
      z.number({ invalid_type_error: 'قيمة المبلغ مطلوبة' }).positive('قيمة المبلغ يجب أن تكون أكبر من صفر'),
    ),
    paid_amount: nonNegativeNumber,
    due_date: isoDate,
    responsible_party: z.enum(RESPONSIBLE_PARTY_VALUES, { required_error: 'الجهة المسؤولة مطلوبة' }),
    attachment_url: z.string().max(500).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.billing_period_start && data.billing_period_end
      && data.billing_period_start > data.billing_period_end) {
      ctx.addIssue({
        code: 'custom',
        path: ['billing_period_end'],
        message: 'نهاية فترة الاستهلاك يجب أن تكون بعد بدايتها',
      });
    }
    if (data.previous_reading != null && data.current_reading != null
      && data.current_reading < data.previous_reading) {
      ctx.addIssue({
        code: 'custom',
        path: ['current_reading'],
        message: 'القراءة الحالية لا تقل عن القراءة السابقة',
      });
    }
  });

export type UtilityBillFormInput = z.input<typeof utilityBillFormSchema>;
export type UtilityBillFormValues = z.output<typeof utilityBillFormSchema>;

/** Service-layer bill payload. */
export const utilityBillPayloadSchema = z
  .object({
    meter_id: z.string().nullable().optional(),
    property_id: uuid,
    unit_id: z.string().nullable().optional(),
    bill_number: z.string().max(64).nullable(),
    billing_period_start: isoDate.nullable(),
    billing_period_end: isoDate.nullable(),
    previous_reading: z.number().nonnegative().nullable(),
    current_reading: z.number().nonnegative().nullable(),
    consumption_units: z.number().nonnegative().nullable(),
    amount: z.number().positive(),
    paid_amount: z.number().nonnegative().nullable(),
    due_date: isoDate,
    responsible_party: z.enum(RESPONSIBLE_PARTY_VALUES),
    attachment_url: z.string().max(500).nullable(),
    notes: z.string().max(2000).nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.billing_period_start && data.billing_period_end
      && data.billing_period_start > data.billing_period_end) {
      ctx.addIssue({
        code: 'custom',
        path: ['billing_period_end'],
        message: 'نهاية فترة الاستهلاك يجب أن تكون بعد بدايتها',
      });
    }
    if (data.previous_reading != null && data.current_reading != null
      && data.current_reading < data.previous_reading) {
      ctx.addIssue({
        code: 'custom',
        path: ['current_reading'],
        message: 'القراءة الحالية لا تقل عن القراءة السابقة',
      });
    }
  });

export type UtilityBillPayload = z.output<typeof utilityBillPayloadSchema>;

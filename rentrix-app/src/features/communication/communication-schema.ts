// Communication validation schema.
//
// Two layers:
//   - Form-level schema: what the form sends (strings, optional
//     fields allowed as '' or null).
//   - Service-level schema: what reaches Supabase (typed values, no
//     optional company_id, server-managed fields stripped).
//
// The communication_records table has no financial impact, so we do
// not introduce an atomic RPC; the service layer re-validates the
// form before any write so a hand-crafted call cannot bypass.

import { z } from 'zod';

export const COMMUNICATION_CHANNEL_VALUES = ['phone', 'email', 'whatsapp', 'sms', 'meeting', 'other'] as const;
export const COMMUNICATION_DIRECTION_VALUES = ['inbound', 'outbound'] as const;
export const COMMUNICATION_STATUS_VALUES = ['open', 'pending', 'closed', 'follow_up'] as const;

export type CommunicationChannel = (typeof COMMUNICATION_CHANNEL_VALUES)[number];
export type CommunicationDirection = (typeof COMMUNICATION_DIRECTION_VALUES)[number];
export type CommunicationStatus = (typeof COMMUNICATION_STATUS_VALUES)[number];

export const COMMUNICATION_CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  phone: 'هاتف',
  email: 'بريد إلكتروني',
  whatsapp: 'واتساب',
  sms: 'رسالة قصيرة',
  meeting: 'اجتماع',
  other: 'أخرى',
};

export const COMMUNICATION_DIRECTION_LABELS: Record<CommunicationDirection, string> = {
  inbound: 'وارد',
  outbound: 'صادر',
};

export const COMMUNICATION_STATUS_LABELS: Record<CommunicationStatus, string> = {
  open: 'مفتوح',
  pending: 'قيد المتابعة',
  closed: 'مغلق',
  follow_up: 'يحتاج متابعة',
};

const trimmedShort = (max: number) =>
  z
    .string()
    .max(max, `القيمة طويلة جداً (الحد الأقصى ${max} حرفاً)`)
    .transform((value) => value.trim());

const optionalTrimmedShort = (max: number) =>
  trimmedShort(max).transform((value) => (value === '' ? null : value));

/** Reasonable phone pattern: digits, spaces, dashes, leading +. */
const phonePattern = /^[+\d][\d\s-]{6,19}$/;

/** UUID validator for entity references. */
const optionalUuid = z
  .string()
  .nullable()
  .optional()
  .refine((value) => value === null || value === undefined || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value), {
    message: 'المعرف يجب أن يكون UUID صحيحاً',
  })
  .transform((value) => (value === '' ? null : value));

/**
 * Form-level schema. Every value is a string (or null for optional
 * references). Subject and body have length caps so the database
 * never receives a payload of 1 MB by accident.
 */
export const communicationFormSchema = z.object({
  contact_name: trimmedShort(120).refine((value) => value.length > 0, {
    message: 'اسم جهة التواصل مطلوب',
  }),
  contact_phone: z
    .string()
    .trim()
    .max(32)
    .refine((value) => value === '' || phonePattern.test(value), {
      message: 'رقم الهاتف غير صحيح',
    })
    .transform((value) => (value === '' ? null : value)),
  contact_email: z
    .string()
    .trim()
    .max(254)
    .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: 'البريد الإلكتروني غير صحيح',
    })
    .transform((value) => (value === '' ? null : value)),
  channel: z.enum(COMMUNICATION_CHANNEL_VALUES, { required_error: 'قناة التواصل مطلوبة' }),
  direction: z.enum(COMMUNICATION_DIRECTION_VALUES, { required_error: 'اتجاه التواصل مطلوب' }),
  status: z.enum(COMMUNICATION_STATUS_VALUES, { required_error: 'حالة التواصل مطلوبة' }),
  subject: optionalTrimmedShort(200),
  body: trimmedShort(8000).refine((value) => value.length > 0, {
    message: 'محتوى التواصل مطلوب',
  }),
  related_entity_type: optionalTrimmedShort(64),
  related_entity_id: optionalUuid,
});

export type CommunicationFormInput = z.input<typeof communicationFormSchema>;
export type CommunicationFormValues = z.output<typeof communicationFormSchema>;

/**
 * Service-layer payload. Locks the typed shape and the enums.
 * `related_entity_id` is validated as a UUID so a stray string can
 * never reach the database.
 */
export const communicationPayloadSchema = z.object({
  contact_name: z.string().min(1).max(120),
  contact_phone: z.string().regex(phonePattern).nullable(),
  contact_email: z.string().email().nullable(),
  channel: z.enum(COMMUNICATION_CHANNEL_VALUES),
  direction: z.enum(COMMUNICATION_DIRECTION_VALUES),
  status: z.enum(COMMUNICATION_STATUS_VALUES),
  subject: z.string().max(200).nullable(),
  body: z.string().min(1).max(8000),
  related_entity_type: z.string().max(64).nullable(),
  related_entity_id: z.string().uuid().nullable(),
});

export type CommunicationPayload = z.output<typeof communicationPayloadSchema>;

/**
 * Coerce a form submission into a service payload. Combines the
 * form schema (for text fields) with explicit string cleanup so the
 * service layer receives a fully-typed CommunicationPayload.
 */
export function coerceCommunicationFormToPayload(values: CommunicationFormValues): CommunicationPayload {
  return {
    contact_name: values.contact_name.trim(),
    contact_phone: values.contact_phone?.trim() || null,
    contact_email: values.contact_email?.trim() || null,
    channel: values.channel,
    direction: values.direction,
    status: values.status,
    subject: values.subject?.trim() || null,
    body: values.body.trim(),
    related_entity_type: values.related_entity_type?.trim() || null,
    related_entity_id: values.related_entity_id || null,
  };
}

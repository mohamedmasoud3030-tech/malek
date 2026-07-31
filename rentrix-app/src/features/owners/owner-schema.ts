// Owner validation schema.
//
// Two layers:
//   - Form-level schema (ownerFormSchema) — what the form sends
//     (strings, optional fields allowed as '' or null).
//   - Service-level schema (ownerPayloadSchema) — what reaches
//     Supabase (typed values, no company_id, server-managed fields
//     stripped).
//
// The schema is the single source of truth: the form uses
// ownerFormSchema via zodResolver, and the service layer
// re-parses with ownerPayloadSchema before any write so a
// hand-crafted call (future import scripts, tests) cannot bypass
// the same rules the form enforces.

import { z } from 'zod';

const trimmedShort = (max: number) =>
  z
    .string()
    .max(max, `القيمة طويلة جداً (الحد الأقصى ${max} حرفاً)`)
    .transform((value) => value.trim());

const optionalTrimmedShort = (max: number) =>
  trimmedShort(max).transform((value) => (value === '' ? null : value));

/** Reasonable phone pattern: digits, spaces, dashes, leading +. */
const phonePattern = /^[+\d][\d\s-]{6,19}$/;

/** Form-level owner schema. */
export const ownerFormSchema = z.object({
  full_name: trimmedShort(120).refine((value) => value.length > 0, {
    message: 'اسم المالك مطلوب',
  }),
  display_name: optionalTrimmedShort(120),
  phone: z
    .string()
    .trim()
    .max(32)
    .refine((value) => value === '' || phonePattern.test(value), {
      message: 'رقم الهاتف غير صحيح',
    })
    .transform((value) => (value === '' ? null : value)),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: 'البريد الإلكتروني غير صحيح',
    })
    .transform((value) => (value === '' ? null : value)),
  national_id: z
    .string()
    .trim()
    .max(32)
    .refine((value) => value === '' || /^[A-Za-z0-9\-\/]{4,32}$/.test(value), {
      message: 'رقم الهوية غير صحيح',
    })
    .transform((value) => (value === '' ? null : value)),
  tax_number: optionalTrimmedShort(64),
  address: optionalTrimmedShort(500),
  notes: optionalTrimmedShort(2000),
  is_active: z.boolean().default(true),
});

export type OwnerFormInput = z.input<typeof ownerFormSchema>;
export type OwnerFormValues = z.output<typeof ownerFormSchema>;

/** Service-level payload schema. Locks the typed shape. */
export const ownerPayloadSchema = z.object({
  full_name: z.string().min(1).max(120),
  display_name: z.string().max(120).nullable(),
  phone: z.string().regex(phonePattern).nullable(),
  email: z.string().email().nullable(),
  national_id: z.string().regex(/^[A-Za-z0-9\-\/]{4,32}$/).nullable(),
  tax_number: z.string().max(64).nullable(),
  address: z.string().max(500).nullable(),
  notes: z.string().max(2000).nullable(),
  is_active: z.boolean(),
});

export type OwnerPayload = z.output<typeof ownerPayloadSchema>;

/** Update-only schema (all fields optional except the id). */
export const ownerUpdateSchema = z.object({
  full_name: trimmedShort(120).optional(),
  display_name: optionalTrimmedShort(120),
  phone: z
    .string()
    .trim()
    .max(32)
    .refine((value) => value === '' || phonePattern.test(value), {
      message: 'رقم الهاتف غير صحيح',
    })
    .optional(),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: 'البريد الإلكتروني غير صحيح',
    })
    .optional(),
  national_id: z
    .string()
    .trim()
    .max(32)
    .refine((value) => value === '' || /^[A-Za-z0-9\-\/]{4,32}$/.test(value), {
      message: 'رقم الهوية غير صحيح',
    })
    .optional(),
  tax_number: optionalTrimmedShort(64),
  address: optionalTrimmedShort(500),
  notes: optionalTrimmedShort(2000),
  is_active: z.boolean().optional(),
});

export type OwnerUpdateInput = z.input<typeof ownerUpdateSchema>;
export type OwnerUpdateValues = z.output<typeof ownerUpdateSchema>;

/** Coerce a form submission into a service payload. */
export function coerceOwnerFormToPayload(values: OwnerFormValues): OwnerPayload {
  return {
    full_name: values.full_name.trim(),
    display_name: values.display_name?.trim() || null,
    phone: values.phone?.trim() || null,
    email: values.email?.trim() || null,
    national_id: values.national_id?.trim() || null,
    tax_number: values.tax_number?.trim() || null,
    address: values.address?.trim() || null,
    notes: values.notes?.trim() || null,
    is_active: values.is_active ?? true,
  };
}

/** Coerce an update submission into a typed partial. */
export function coerceOwnerUpdateToPayload(values: OwnerUpdateValues): Partial<OwnerPayload> {
  const out: Partial<OwnerPayload> = {};
  if (values.full_name !== undefined) out.full_name = values.full_name.trim();
  if (values.display_name !== undefined) out.display_name = values.display_name?.trim() || null;
  if (values.phone !== undefined) out.phone = values.phone?.trim() || null;
  if (values.email !== undefined) out.email = values.email?.trim() || null;
  if (values.national_id !== undefined) out.national_id = values.national_id?.trim() || null;
  if (values.tax_number !== undefined) out.tax_number = values.tax_number?.trim() || null;
  if (values.address !== undefined) out.address = values.address?.trim() || null;
  if (values.notes !== undefined) out.notes = values.notes?.trim() || null;
  if (values.is_active !== undefined) out.is_active = values.is_active;
  return out;
}

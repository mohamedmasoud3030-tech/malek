import { z } from 'zod';

export const personTypeValues = ['tenant', 'owner', 'contact'] as const;

export const personTypeLabels: Record<(typeof personTypeValues)[number], string> = {
  tenant: 'مستأجر',
  owner: 'مالك',
  contact: 'جهة اتصال',
};

const optionalTrimmedPattern = (pattern: RegExp, message: string) => z
  .string()
  .trim()
  .refine((value) => value.length === 0 || pattern.test(value), message)
  .optional()
  .transform((value) => value || null);

export const personSchema = z.object({
  full_name: z.string().trim().min(2, 'الاسم الكامل مطلوب'),
  phone: optionalTrimmedPattern(/^[+\d][\d\s-]{6,19}$/, 'رقم الهاتف غير صحيح'),
  email: z.string().trim().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')).transform((value) => value || null),
  national_id: optionalTrimmedPattern(/^[A-Za-z0-9\-/]{4,32}$/, 'رقم الهوية غير صحيح'),
  type: z.enum(personTypeValues, { required_error: 'النوع مطلوب' }),
  address: z.string().trim().optional().transform((value) => value || null),
  notes: z.string().trim().optional().transform((value) => value || null),
});

export type PersonFormValues = z.input<typeof personSchema>;
export type PersonPayload = z.output<typeof personSchema>;

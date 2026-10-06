import { z } from 'zod';

const optionalMoney = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
  z.number({ invalid_type_error: 'أدخل رقماً صحيحاً' }).min(0, 'القيمة لا يمكن أن تكون سالبة').nullable(),
);

export const propertyStatusValues = ['active', 'inactive', 'maintenance', 'sold'] as const;

export const propertyStatusLabels: Record<(typeof propertyStatusValues)[number], string> = {
  active: 'نشط',
  inactive: 'غير نشط',
  maintenance: 'صيانة',
  sold: 'مباع',
};

export const propertySchema = z.object({
  title: z.string().trim().min(2, 'اسم العقار مطلوب'),
  type: z.string().trim().min(2, 'نوع العقار مطلوب'),
  address: z.string().trim().min(3, 'العنوان مطلوب'),
  purchase_value: optionalMoney,
  current_value: optionalMoney,
  status: z.enum(propertyStatusValues, { required_error: 'الحالة مطلوبة' }),
  notes: z.string().trim().optional().transform((value) => value || null),
});

export type PropertyFormValues = z.input<typeof propertySchema>;
export type PropertyPayload = z.output<typeof propertySchema>;

import { z } from 'zod';

const optionalRent = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
  z.number({ invalid_type_error: 'أدخل رقماً صحيحاً' }).min(0, 'الإيجار لا يمكن أن يكون سالباً').nullable(),
);

export const unitStatusValues = ['available', 'occupied', 'maintenance', 'reserved'] as const;
export const unitManualStatusValues = ['available', 'reserved'] as const;
export type UnitStatus = (typeof unitStatusValues)[number];
export type UnitManualStatus = (typeof unitManualStatusValues)[number];

export const unitStatusLabels: Record<UnitStatus, string> = {
  available: 'متاحة',
  occupied: 'مشغولة',
  maintenance: 'صيانة',
  reserved: 'محجوزة',
};

export function isUnitOperationallyManagedStatus(status: UnitStatus): boolean {
  return status === 'occupied' || status === 'maintenance';
}

export function normalizeUnitStatus(status: string): UnitStatus {
  const normalized = status.trim().toLowerCase();

  if (unitStatusValues.includes(normalized as UnitStatus)) {
    return normalized as UnitStatus;
  }

  throw new Error(`Unsupported unit status: ${status}`);
}

export const unitSchema = z.object({
  unit_number: z.string().trim().min(1, 'رقم الوحدة مطلوب'),
  floor: z.string().trim().optional().transform((value) => value || null),
  status: z.enum(unitStatusValues, { required_error: 'الحالة مطلوبة' }),
  rent_amount: optionalRent,
  notes: z.string().trim().optional().transform((value) => value || null),
});

export type UnitFormValues = z.input<typeof unitSchema>;
export type UnitPayload = z.output<typeof unitSchema>;

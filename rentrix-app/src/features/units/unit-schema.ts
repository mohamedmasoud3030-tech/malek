import { z } from 'zod';

const optionalRent = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
  z.number({ invalid_type_error: 'أدخل رقماً صحيحاً' }).min(0, 'الإيجار لا يمكن أن يكون سالباً').nullable(),
);

const optionalDailyReferenceRate = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
  z
    .number({ invalid_type_error: 'أدخل سعراً يومياً صحيحاً' })
    .min(0, 'السعر اليومي المرجعي لا يمكن أن يكون سالباً')
    .refine((value) => Math.round(value * 1000) === value * 1000, 'السعر اليومي المرجعي يقبل حتى 3 خانات عشرية')
    .nullable(),
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

/**
 * Canonical status→tone semantics shared by every unit surface (portfolio
 * register, property units register, unit detail, unit preview).
 *
 * `available` is the only rentable-vacancy status (success = actionable
 * inventory); `occupied` is healthy operation (info); `maintenance` and
 * `reserved` are NOT rentable vacancy — maintenance demands attention
 * (warning) and reserved is intentionally parked (neutral). This mirrors the
 * vacancy semantics in features/units/vacancy-analytics.ts, where vacancy
 * means `available` only.
 */
export const unitStatusTones = {
  available: 'success',
  occupied: 'info',
  maintenance: 'warning',
  reserved: 'neutral',
} as const satisfies Record<UnitStatus, string>;

export type UnitStatusTone = (typeof unitStatusTones)[UnitStatus];

/** Tolerant tone lookup for raw DB status strings (legacy `rented` included). */
export function unitStatusToneFor(status: string): UnitStatusTone {
  try {
    return unitStatusTones[normalizeUnitStatus(status)];
  } catch {
    return 'neutral';
  }
}

export function isUnitOperationallyManagedStatus(status: UnitStatus): boolean {
  return status === 'occupied' || status === 'maintenance';
}

export function normalizeUnitStatus(status: string): UnitStatus {
  const normalized = status.trim().toLowerCase();

  // `rented` was accepted by the live compatibility trigger before the
  // canonical value became `occupied`; preserve visibility of those rows.
  if (normalized === 'rented') return 'occupied';
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
  daily_reference_rate: optionalDailyReferenceRate,
  notes: z.string().trim().optional().transform((value) => value || null),
});

export type UnitFormValues = z.input<typeof unitSchema>;
export type UnitPayload = z.output<typeof unitSchema>;

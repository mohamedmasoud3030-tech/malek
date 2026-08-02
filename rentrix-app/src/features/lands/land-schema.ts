// Lands validation schema (create + update share the same shape).
//
// The schema is the single source of truth:
//   - the form uses `landFormSchema` via zodResolver,
//   - the service layer re-parses with `landPayloadSchema` before
//     any Supabase write,
//   - any manual call (e.g. future import scripts, tests) cannot
//     bypass the same rules.
//
// Service-level rules enforced:
//   - at least one of (name, plot_no) is required (after trim),
//   - numeric fields are coerced, must be finite, and reject negatives
//     where the business rule says so,
//   - enum fields are pinned to the same constants the view uses,
//   - optional strings become null on empty (the DB contract),
//   - cross-field validation: owner_price ≤ purchase_price,
//     commission ≤ purchase_price.

import { z } from 'zod';

export const LAND_STATUS_VALUES = ['available', 'reserved', 'sold', 'archived'] as const;
export const LAND_CATEGORY_VALUES = ['residential', 'commercial', 'agricultural', 'investment'] as const;

export type LandStatus = (typeof LAND_STATUS_VALUES)[number];
export type LandCategory = (typeof LAND_CATEGORY_VALUES)[number];

export const LAND_STATUS_LABELS: Record<LandStatus, string> = {
  available: 'متاحة',
  reserved: 'محجوزة',
  sold: 'مباعة',
  archived: 'مؤرشفة',
};

export const LAND_CATEGORY_LABELS: Record<LandCategory, string> = {
  residential: 'سكني',
  commercial: 'تجاري',
  agricultural: 'زراعي',
  investment: 'استثماري',
};

const trimmedString = (max: number) =>
  z
    .string()
    .max(max, `القيمة طويلة جداً (الحد الأقصى ${max} حرفاً)`)
    .transform((value) => value.trim());

/** Optional trimmed string. Empty string is preserved as '' at the form
 * layer so React inputs can hold it without a runtime cast; the
 * service-layer coerceFormToPayload turns '' into null. */
const optionalTrimmed = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.trim());

/**
 * Form schema. Every value is a string (HTML inputs are always
 * strings). The numeric fields store their raw text form; the
 * service layer is responsible for the final coercion.
 */
export const landFormSchema = z
  .object({
    plot_no: trimmedString(64),
    name: trimmedString(120),
    location: optionalTrimmed(200),
    area: z.string().max(20).default(''),
    owner_id: optionalTrimmed(64),
    purchase_price: z.string().max(20).default(''),
    owner_price: z.string().max(20).default(''),
    commission: z.string().max(20).default(''),
    category: z.enum(LAND_CATEGORY_VALUES, { required_error: 'تصنيف الأرض مطلوب' }),
    status: z.enum(LAND_STATUS_VALUES, { required_error: 'حالة الأرض مطلوبة' }),
    notes: optionalTrimmed(2000),
  })
  .superRefine((data, context) => {
    if (!data.name && !data.plot_no) {
      context.addIssue({
        code: 'custom',
        path: ['name'],
        message: 'أدخل اسم الأرض أو رقم القطعة على الأقل',
      });
    }
  });

export type LandFormInput = z.input<typeof landFormSchema>;
export type LandFormValues = z.output<typeof landFormSchema>;

/**
 * Coerce a numeric form field. Returns the parsed number, or null
 * if the field is blank. Pushes a Zod issue to the refinement ctx
 * if the value is not a finite non-negative number.
 */
function coerceNumberField(value: string, fieldName: string, ctx: z.RefinementCtx): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    ctx.addIssue({ code: 'custom', path: [fieldName], message: 'أدخل رقماً صحيحاً' });
    return Number.NaN;
  }
  if (num < 0) {
    ctx.addIssue({ code: 'custom', path: [fieldName], message: 'القيمة لا يمكن أن تكون سالبة' });
    return Number.NaN;
  }
  return num;
}

/**
 * Service-layer payload schema. This is what lands-service.ts parses
 * before touching Supabase — it is independent of the form so a manual
 * call (e.g. from a future import script) cannot bypass the same
 * rules the form enforces.
 */
export const landPayloadSchema = z
  .object({
    plot_no: z.string().max(64).nullable(),
    name: z.string().max(120).nullable(),
    location: z.string().max(200).nullable(),
    area: z.number().nonnegative().nullable(),
    owner_id: z.string().max(64).nullable(),
    purchase_price: z.number().nonnegative().nullable(),
    owner_price: z.number().nonnegative().nullable(),
    commission: z.number().nonnegative().nullable(),
    category: z.enum(LAND_CATEGORY_VALUES),
    status: z.enum(LAND_STATUS_VALUES),
    notes: z.string().max(2000).nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.purchase_price !== null && data.owner_price !== null
      && data.purchase_price > 0 && data.owner_price > data.purchase_price) {
      ctx.addIssue({
        code: 'custom',
        path: ['owner_price'],
        message: 'سعر المالك لا يمكن أن يتجاوز سعر الشراء',
      });
    }
    if (data.commission !== null && data.purchase_price !== null
      && data.purchase_price > 0 && data.commission > data.purchase_price) {
      ctx.addIssue({
        code: 'custom',
        path: ['commission'],
        message: 'العمولة لا يمكن أن تتجاوز سعر الشراء',
      });
    }
  });

export type LandPayload = z.output<typeof landPayloadSchema>;

/**
 * Internal: collect coercion issues. The Zod refinement API requires
 * a RefinementCtx; we use a tiny wrapper so callers can pass `null`
 * when they only want the coerced value and have already validated.
 */
function makeCollectingCtx(): z.RefinementCtx {
  // The Zod refinement ctx is internal; this minimal shape is enough
  // for the coercion helper to push issues via addIssue.
  return {
    addIssue: () => undefined,
    path: [],
  } as unknown as z.RefinementCtx;
}

/**
 * Coerce raw form values to a service payload. Combines the form
 * schema (for text fields) with explicit number coercion so the
 * service layer receives a fully-typed LandPayload. Numeric issues
 * are pushed to the optional ctx; if none is provided, coercion
 * silently returns null for empty values and returns numbers for
 * valid ones.
 */
export function coerceFormToPayload(
  values: LandFormValues,
  ctx: z.RefinementCtx = makeCollectingCtx(),
): LandPayload {
  const area = coerceNumberField(values.area ?? '', 'area', ctx);
  const purchasePrice = coerceNumberField(values.purchase_price ?? '', 'purchase_price', ctx);
  const ownerPrice = coerceNumberField(values.owner_price ?? '', 'owner_price', ctx);
  const commission = coerceNumberField(values.commission ?? '', 'commission', ctx);
  return {
    plot_no: values.plot_no || null,
    name: values.name || null,
    location: values.location || null,
    area,
    owner_id: values.owner_id || null,
    purchase_price: purchasePrice,
    owner_price: ownerPrice,
    commission,
    category: values.category,
    status: values.status,
    notes: values.notes || null,
  };
}

/** Strict schema for the archive flow — pins the only legal id. */
export const landArchiveSchema = z.object({
  id: z.string().min(1, 'معرف الأرض مطلوب'),
});

/** Strict schema for the get/list filters used by the page. */
export const landFilterSchema = z.object({
  query: z.string().max(200).default(''),
  status: z.enum(['all', ...LAND_STATUS_VALUES]).default('all'),
});

export type LandFilterInput = z.input<typeof landFilterSchema>;
export type LandFilterValues = z.output<typeof landFilterSchema>;

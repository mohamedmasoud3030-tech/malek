import { z } from 'zod';

export const leadSourceSchema = z.enum(['walk_in', 'phone', 'referral', 'social', 'website']);
export const leadStatusSchema = z.enum(['new', 'contacted', 'qualified', 'converted', 'lost', 'archived']);
const optionalText = (max: number) => z.string().trim().max(max).transform(value => value || null);
const budget = z.string().trim().transform(value => value === '' ? null : Number(value)).refine(value => value === null || (Number.isFinite(value) && value >= 0), 'الميزانية غير صالحة');

/** Form boundary: strings from controlled inputs become an explicit safe payload. */
export const leadFormSchema = z.object({
  name: z.string().trim().min(1, 'اسم العميل المحتمل مطلوب.').max(160),
  phone: optionalText(32),
  email: z.string().trim().max(254).transform(value => value || null).refine(value => value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'البريد الإلكتروني غير صالح'),
  source: leadSourceSchema,
  status: leadStatusSchema,
  desired_unit_type: optionalText(100),
  min_budget: budget,
  max_budget: budget,
  notes: optionalText(2_000),
}).strict().superRefine((value, ctx) => {
  if (value.min_budget !== null && value.max_budget !== null && value.min_budget > value.max_budget) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['max_budget'], message: 'الحد الأقصى للميزانية يجب أن لا يقل عن الحد الأدنى' });
});

export const leadPayloadSchema = leadFormSchema;
export type LeadPayload = z.output<typeof leadPayloadSchema>;

const allowedTransitions: Record<z.output<typeof leadStatusSchema>, readonly z.output<typeof leadStatusSchema>[]> = {
  new: ['new', 'contacted', 'lost', 'archived'], contacted: ['contacted', 'qualified', 'lost', 'archived'],
  qualified: ['qualified', 'converted', 'lost', 'archived'], converted: ['converted', 'archived'],
  lost: ['lost', 'archived'], archived: ['archived'],
};
export function assertLeadStatusTransition(from: z.output<typeof leadStatusSchema>, to: z.output<typeof leadStatusSchema>) {
  if (!allowedTransitions[from].includes(to)) throw new Error(`انتقال حالة العميل المحتمل غير مسموح: ${from} → ${to}`);
}

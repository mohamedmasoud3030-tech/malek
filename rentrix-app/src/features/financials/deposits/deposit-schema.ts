import { z } from 'zod';

// Form schemas accept the values produced by inputs. Payload schemas are the
// service boundary: they are strict allowlists and deliberately exclude server
// managed fields such as company_id, balances and timestamps.
const uuid = z.string().uuid('المعرف غير صالح');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'التاريخ غير صالح');
const positiveAmount = z.coerce.number().finite().positive('المبلغ يجب أن يكون أكبر من صفر');

export const depositFormSchema = z.object({
  contract_id: uuid,
  tenant_id: uuid.nullish(),
  property_id: uuid.nullish(),
  unit_id: uuid.nullish(),
  amount: positiveAmount,
  received_date: isoDate.nullish(),
  notes: z.string().trim().max(2_000).nullish(),
});

export const depositPayloadSchema = depositFormSchema.extend({
  request_id: uuid.optional(),
}).strict();

export const depositDeductionFormSchema = z.object({
  deposit_id: uuid,
  deduction_amount: positiveAmount,
  reason: z.enum(['maintenance_damage', 'unpaid_arrears', 'cleaning_fee', 'other']),
  description: z.string().trim().min(1, 'وصف الخصم مطلوب').max(2_000),
  charged_date: isoDate,
  property_id: uuid.nullish(),
});

export const depositDeductionPayloadSchema = depositDeductionFormSchema.extend({
  request_id: uuid.optional(),
}).strict();

/** Runtime-only guard after the authoritative deposit has been read. */
export const depositDeductionBalanceSchema = depositDeductionPayloadSchema.extend({
  remaining_amount: z.number().finite().nonnegative(),
  archived: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.archived) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'لا يمكن خصم وديعة مؤرشفة', path: ['deposit_id'] });
  if (value.deduction_amount > value.remaining_amount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'مبلغ الخصم يتجاوز الرصيد المتبقي', path: ['deduction_amount'] });
  }
});

export type DepositPayload = z.output<typeof depositPayloadSchema>;
export type DepositDeductionPayloadInput = z.output<typeof depositDeductionPayloadSchema>;

import { z } from 'zod';
import { isValidDateInput } from '../financials-date-utils';

// Form schemas accept the values produced by inputs. Payload schemas are the
// service boundary: they are strict allowlists and deliberately exclude server
// managed fields such as company_id, balances and timestamps.
const uuid = z.string().uuid('المعرف غير صالح');
const isoDate = z.string().refine(isValidDateInput, 'التاريخ غير صالح');
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
  request_id: uuid,
}).strict();

/** Governed claim/refund inputs, not the removed direct-deduction workflow. */
export const depositClaimPayloadSchema = z.object({
  deposit_id: uuid,
  claim_kind: z.enum(['INVOICE_ARREARS', 'DAMAGE']),
  invoice_id: uuid.nullish(),
  allocation_amount: positiveAmount,
  evidence_uri: z.string().trim().min(3, 'دليل الإثبات مطلوب'),
  claim_note: z.string().trim().max(2_000).nullish(),
  inspection_id: uuid.nullish(),
  request_id: uuid,
}).strict().superRefine((value, ctx) => {
  if (value.claim_kind === 'INVOICE_ARREARS' && !value.invoice_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['invoice_id'], message: 'فاتورة المتأخرات مطلوبة' });
  }
  if (value.claim_kind === 'DAMAGE' && !value.inspection_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['inspection_id'], message: 'فحص إخلاء مراجع مطلوب' });
  }
});

export const depositRefundPayloadSchema = z.object({
  deposit_id: uuid,
  refund_amount: positiveAmount,
  payment_method: z.enum(['cash', 'bank_transfer', 'check']),
  refund_date: isoDate,
  notes: z.string().trim().max(2_000).nullish(),
  request_id: uuid,
}).strict();

export type DepositCreatePayload = z.infer<typeof depositPayloadSchema>;
export type DepositClaimCreatePayload = z.infer<typeof depositClaimPayloadSchema>;
export type DepositRefundPayload = z.infer<typeof depositRefundPayloadSchema>;

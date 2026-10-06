import { expect, it } from 'vitest';
import { depositClaimPayloadSchema, depositPayloadSchema, depositRefundPayloadSchema } from './deposit-schema';
const id = '00000000-0000-4000-8000-000000000001';
it('validates the actual receipt input and requires a retry identity', () => {
  expect(() => depositPayloadSchema.parse({ contract_id: id, amount: 0, request_id: id })).toThrow();
  expect(() => depositPayloadSchema.parse({ contract_id: id, amount: 10 })).toThrow();
  expect(() => depositPayloadSchema.parse({ contract_id: id, amount: 10, request_id: id, company_id: id })).toThrow();
});
it('requires the governed claim evidence and kind-specific source', () => {
  const claim = { deposit_id: id, claim_kind: 'DAMAGE', allocation_amount: 25, evidence_uri: 'file://evidence', request_id: id };
  expect(() => depositClaimPayloadSchema.parse(claim)).toThrow();
  expect(depositClaimPayloadSchema.parse({ ...claim, inspection_id: id }).inspection_id).toBe(id);
  expect(() => depositClaimPayloadSchema.parse({ ...claim, claim_kind: 'INVOICE_ARREARS' })).toThrow();
});
it.each(['2026-02-31', 'invalid'])('rejects impossible receipt/refund dates: %s', (date) => {
  expect(() => depositPayloadSchema.parse({ contract_id: id, amount: 10, received_date: date, request_id: id })).toThrow();
  expect(() => depositRefundPayloadSchema.parse({ deposit_id: id, refund_amount: 10, payment_method: 'cash', refund_date: date, request_id: id })).toThrow();
});

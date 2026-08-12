import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity } from '../p1/replay-bootstrap';
import { rpcJsonb } from './phase3a1b-fixture';

export type GovernedReceiptVoidPayload = {
  receipt_id: string;
  reason: string;
  request_id: string;
};

export async function requestAndApproveReceiptVoid(
  db: PGlite,
  makerUserId: string,
  checkerUserId: string,
  companyId: string,
  payload: GovernedReceiptVoidPayload,
) {
  await assumeIdentity(db, makerUserId, companyId);
  const request = await rpcJsonb(db, 'request_receipt_void_atomic', payload);

  await assumeIdentity(db, checkerUserId, companyId);
  return rpcJsonb(db, 'approve_receipt_void_atomic', {
    void_request_id: String(request.void_request_id),
    request_id: `approve:${payload.request_id}`,
  });
}

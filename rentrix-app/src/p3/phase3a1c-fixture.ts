import type { PGlite } from '@electric-sql/pglite';
import {
  COMPANY_A,
  COMPANY_B,
  CONTRACT_A,
  CONTRACT_B,
  INVOICE_A1,
  INVOICE_B1,
  seedPhase3a1bFixture,
} from './phase3a1b-fixture';

export * from './phase3a1b-fixture';

export const RECEIPT_A = 'a31c0000-0000-4000-8000-000000000001';
export const RECEIPT_B = 'b31c0000-0000-4000-8000-000000000001';
export const RECEIPT_A_JUNE = 'a31c0000-0000-4000-8000-000000000003';
export const PAYMENT_A = 'a31c0000-0000-4000-8000-000000000002';
export const PAYMENT_B = 'b31c0000-0000-4000-8000-000000000002';
export const PAYMENT_A_JUNE = 'a31c0000-0000-4000-8000-000000000004';

/** Settlement-specific extension of the two-company Phase 3A fixture. */
export async function seedPhase3a1cFixture(db: PGlite) {
  await seedPhase3a1bFixture(db);
  await db.exec(`
    update public.accounts
       set company_id = '${COMPANY_A}'
     where no = '2000';

    insert into public.receipts (id, amount, status, company_id) values
      ('${RECEIPT_A}', 1000, 'POSTED', '${COMPANY_A}'),
      ('${RECEIPT_A_JUNE}', 300, 'POSTED', '${COMPANY_A}'),
      ('${RECEIPT_B}', 700, 'POSTED', '${COMPANY_B}');

    insert into public.payments
      (id, invoice_id, contract_id, amount, payment_method, payment_date, status, receipt_id, company_id)
    values
      ('${PAYMENT_A}', '${INVOICE_A1}', '${CONTRACT_A}', 1000, 'cash', date '2026-07-05', 'POSTED', '${RECEIPT_A}', '${COMPANY_A}'),
      ('${PAYMENT_A_JUNE}', '${INVOICE_A1}', '${CONTRACT_A}', 300, 'cash', date '2026-06-05', 'POSTED', '${RECEIPT_A_JUNE}', '${COMPANY_A}'),
      ('${PAYMENT_B}', '${INVOICE_B1}', '${CONTRACT_B}', 700, 'cash', date '2026-07-05', 'POSTED', '${RECEIPT_B}', '${COMPANY_B}');

    update public.receipts set payment_id = id where id in ('${RECEIPT_A}', '${RECEIPT_A_JUNE}', '${RECEIPT_B}');
  `);
}

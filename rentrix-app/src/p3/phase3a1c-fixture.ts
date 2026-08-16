import type { PGlite } from '@electric-sql/pglite';
import {
  COMPANY_A,
  COMPANY_B,
  CONTRACT_A,
  CONTRACT_B,
  INVOICE_A1,
  INVOICE_B1,
  OWNER_A,
  seedPhase3a1bFixture,
} from './phase3a1b-fixture';

export * from './phase3a1b-fixture';

export const RECEIPT_A = 'a31c0000-0000-4000-8000-000000000001';
export const RECEIPT_B = 'b31c0000-0000-4000-8000-000000000001';
export const RECEIPT_A_JUNE = 'a31c0000-0000-4000-8000-000000000003';
export const RECEIPT_A_MAY = 'a31c0000-0000-4000-8000-000000000006';
export const PAYMENT_A = 'a31c0000-0000-4000-8000-000000000002';
export const PAYMENT_B = 'b31c0000-0000-4000-8000-000000000002';
export const PAYMENT_A_JUNE = 'a31c0000-0000-4000-8000-000000000004';
export const PAYMENT_A_MAY = 'a31c0000-0000-4000-8000-000000000005';

/** Settlement-specific extension of the two-company Phase 3A fixture. */
export async function seedPhase3a1cFixture(db: PGlite) {
  await seedPhase3a1bFixture(db);
  await db.exec(`
    insert into public.receipts (id, amount, status, company_id) values
      ('${RECEIPT_A}', 1000, 'POSTED', '${COMPANY_A}'),
      ('${RECEIPT_A_JUNE}', 300, 'POSTED', '${COMPANY_A}'),
      ('${RECEIPT_A_MAY}', 250, 'POSTED', '${COMPANY_A}'),
      ('${RECEIPT_B}', 700, 'POSTED', '${COMPANY_B}');

    insert into public.payments
      (id, invoice_id, contract_id, amount, payment_method, payment_date, status, receipt_id, company_id)
    values
      ('${PAYMENT_A}', '${INVOICE_A1}', '${CONTRACT_A}', 1000, 'cash', date '2026-07-05', 'POSTED', '${RECEIPT_A}', '${COMPANY_A}'),
      ('${PAYMENT_A_JUNE}', '${INVOICE_A1}', '${CONTRACT_A}', 300, 'cash', date '2026-06-05', 'POSTED', '${RECEIPT_A_JUNE}', '${COMPANY_A}'),
      ('${PAYMENT_A_MAY}', '${INVOICE_A1}', '${CONTRACT_A}', 250, 'cash', date '2026-05-05', 'POSTED', '${RECEIPT_A_MAY}', '${COMPANY_A}'),
      ('${PAYMENT_B}', '${INVOICE_B1}', '${CONTRACT_B}', 700, 'cash', date '2026-07-05', 'POSTED', '${RECEIPT_B}', '${COMPANY_B}');

    update public.receipts set payment_id = id where id in ('${RECEIPT_A}', '${RECEIPT_A_JUNE}', '${RECEIPT_A_MAY}', '${RECEIPT_B}');
  `);
  await seedOwnerFundsPayable(db);
}

/**
 * The legacy Phase 3A-1C fixture inserts receipts/payments directly, which
 * predates the RC1 owner-funds subledger. Under the RC1 2000 control the
 * settlement payouts below debit 2000 (Owner Funds Payable) and would drive it
 * negative with no prior credit. Seed the economically valid prior owner-funds
 * obligation the office holds for collected rent (gross collections from
 * Company A's posted receipts) as a GL credit to 2000 with a linked
 * owner_funds_events row, so later OFFICE_IS_CREDITOR settlement payouts stay
 * within a non-debit 2000 control.
 */
async function seedOwnerFundsPayable(db: PGlite) {
  // This seed models the RC1 owner-funds subledger. It only applies on a full
  // RC1 replay where public.owner_funds_events exists; historical checkpoint
  // replays that intentionally stop before RC1 skip it (they have no 2000
  // control guard and no RC1 schema surface to seed).
  const { rows: hasSchema } = await db.query<{ ok: boolean }>(
    `select to_regclass('public.owner_funds_events') is not null as ok`,
  );
  if (!hasSchema[0]?.ok) return;

  const totalGross = 1550; // 1000 (Jul) + 300 (Jun) + 250 (May) Company A receipts
  // The legacy fixture has no accounting period. The owner-funds seed and the
  // settlement payouts below need OPEN periods (May for the seed, and the
  // current date for the payouts). Open one wide range up front.
  await db.query(`
    insert into public.accounting_periods (company_id, name, start_date, end_date, status)
    values ('${COMPANY_A}', 'Phase3A1C Replay', date '2026-05-01', date '2026-12-31', 'OPEN')
    on conflict do nothing;
  `);
  const { rows } = await db.query<{ r2000: string; c1111: string }>(`
    select (select id::text from public.accounts where company_id = $1::uuid and no = '2000') as r2000,
           (select id::text from public.accounts where company_id = $1::uuid and no = '1111') as c1111`,
    [COMPANY_A],
  );
  if (!rows[0]?.r2000 || !rows[0]?.c1111) {
    throw new Error('phase3a1c fixture: Company A 2000/1111 accounts are required to seed owner funds');
  }
  const { rows: batchRows } = await db.query<{ batch_id: string }>(
    `select public.post_journal_event($1::jsonb)::jsonb ->> 'batch_id' as batch_id`,
    [
      JSON.stringify({
        company_id: COMPANY_A,
        source_type: 'owner_funds_seed',
        source_id: 'phase3a1c-owner-funds-seed',
        event_id: 'opening',
        effective_date: '2026-05-01',
        description: 'Phase 3A-1C owner-funds opening payable for collected rent',
        lines: [
          { account_id: rows[0].c1111, debit: totalGross, credit: 0 },
          { account_id: rows[0].r2000, debit: 0, credit: totalGross },
        ],
      }),
    ],
  );
  const batchId = batchRows[0]?.batch_id;
  if (!batchId) throw new Error('phase3a1c fixture: owner-funds seed journal batch was not posted');
  await db.query(
    `insert into public.owner_funds_events (
       company_id, owner_id, contract_id, invoice_id, source_type, source_id, event_id,
       amount_delta, effective_date, journal_batch_id
     ) values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'OFFICE_INVOICE', 'phase3a1c-owner-funds-seed',
       'opening', $5, date '2026-05-01', $6::uuid)`,
    [COMPANY_A, OWNER_A, CONTRACT_A, INVOICE_A1, totalGross, batchId],
  );
}

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase } from '../../../p1/replay-bootstrap';

const COMPANY = 'f6100000-0000-4000-8000-000000000001';
const BANK = 'f6100000-0000-4000-8000-000000000002';
const LINE_1 = 'f6100000-0000-4000-8000-000000000011';
const LINE_2 = 'f6100000-0000-4000-8000-000000000012';
const LINE_3 = 'f6100000-0000-4000-8000-000000000013';
const COLLECTION = 'f6100000-0000-4000-8000-000000000021';

let db: PGlite;

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug)
    values ('${COMPANY}', 'Economic Identity Co', 'economic-identity-co');

    insert into public.bank_accounts (id, company_id, account_name, account_code)
    values ('${BANK}', '${COMPANY}', 'Main Bank', 'BANK-EI');

    insert into public.bank_statement_lines
      (id, company_id, bank_account_id, transaction_date, description, amount, status)
    values
      ('${LINE_1}', '${COMPANY}', '${BANK}', '2026-08-20', 'collection one', 100.000, 'unmatched'),
      ('${LINE_2}', '${COMPANY}', '${BANK}', '2026-08-20', 'collection two', 100.000, 'unmatched'),
      ('${LINE_3}', '${COMPANY}', '${BANK}', '2026-08-20', 'other source', -50.000, 'unmatched');

    insert into public.receipts (id, company_id, amount, date_time, status, deleted_at)
    values ('${COLLECTION}', '${COMPANY}', 100.000, '2026-08-20T10:00:00Z', 'POSTED', null);
  `);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('bank reconciliation economic-source integrity', () => {
  it('allows the first collection match', async () => {
    await expect(
      db.exec(`
        insert into public.bank_reconciliation_matches
          (id, company_id, statement_line_id, matched_entity_type, matched_entity_id, matched_amount)
        values
          (gen_random_uuid(), '${COMPANY}', '${LINE_1}', 'payment', '${COLLECTION}', 100.000);
      `),
    ).resolves.not.toThrow();
  });

  it('rejects matching the same collection again through receipt identity', async () => {
    await expect(
      db.exec(`
        insert into public.bank_reconciliation_matches
          (id, company_id, statement_line_id, matched_entity_type, matched_entity_id, matched_amount)
        values
          (gen_random_uuid(), '${COMPANY}', '${LINE_2}', 'receipt', '${COLLECTION}', 100.000);
      `),
    ).rejects.toThrow(/ux_bank_reconciliation_matches_economic_source|duplicate key/i);
  });

  it('rejects reusing the same non-collection source on a second bank line', async () => {
    const sourceId = 'f6100000-0000-4000-8000-000000000031';
    await db.exec(`
      insert into public.bank_reconciliation_matches
        (id, company_id, statement_line_id, matched_entity_type, matched_entity_id, matched_amount)
      values
        (gen_random_uuid(), '${COMPANY}', '${LINE_2}', 'owner_expense', '${sourceId}', -50.000);
    `);

    await expect(
      db.exec(`
        insert into public.bank_reconciliation_matches
          (id, company_id, statement_line_id, matched_entity_type, matched_entity_id, matched_amount)
        values
          (gen_random_uuid(), '${COMPANY}', '${LINE_3}', 'owner_expense', '${sourceId}', -50.000);
      `),
    ).rejects.toThrow(/ux_bank_reconciliation_matches_economic_source|duplicate key/i);
  });

  it('fails closed for a receipt that is not POSTED', async () => {
    const draftReceipt = 'f6100000-0000-4000-8000-000000000041';
    await db.exec(`
      insert into public.receipts (id, company_id, amount, date_time, status, deleted_at)
      values ('${draftReceipt}', '${COMPANY}', 25.000, '2026-08-20T11:00:00Z', 'DRAFT', null);
    `);

    await expect(
      db.exec(`
        insert into public.bank_reconciliation_matches
          (id, company_id, statement_line_id, matched_entity_type, matched_entity_id, matched_amount)
        values
          (gen_random_uuid(), '${COMPANY}', '${LINE_3}', 'receipt', '${draftReceipt}', 25.000);
      `),
    ).rejects.toThrow(/Receipt must be POSTED/i);
  });

  it('rejects a synthetic/nonexistent manual adjustment authority', async () => {
    await expect(
      db.exec(`
        insert into public.bank_reconciliation_matches
          (id, company_id, statement_line_id, matched_entity_type, matched_entity_id, matched_amount)
        values
          (gen_random_uuid(), '${COMPANY}', '${LINE_3}', 'manual_adjustment', 'manual-2026-08-20-50', -50.000);
      `),
    ).rejects.toThrow(/real journal batch/i);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase, assumeIdentity } from '../../../p1/replay-bootstrap';

const COMPANY_A = 'f5000000-0000-4000-8000-000000000001';
const COMPANY_B = 'f5000000-0000-4000-8000-000000000002';
const MAKER = 'f5000000-0000-4000-8000-000000000011';
const BANK_ACCOUNT = 'f5000000-0000-4000-8000-000000000021';
const STATEMENT_LINE = 'f5000000-0000-4000-8000-000000000091';
const RECEIPT_1 = 'f5000000-0000-4000-8000-000000000032';

let db: PGlite;

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug)
    values ('${COMPANY_A}', 'Bank Co A', 'bank-co-a'), ('${COMPANY_B}', 'Bank Co B', 'bank-co-b');
    insert into auth.users (id, email, raw_app_meta_data)
    values ('${MAKER}', 'maker@bank.test', '{"company_id":"${COMPANY_A}"}'::jsonb);
    insert into public.users (id, email, name, role, status, is_active)
    values ('${MAKER}', 'maker@bank.test', 'Maker', 'ADMIN', 'ACTIVE', true);
    insert into public.company_members (company_id, user_id, role)
    values ('${COMPANY_A}', '${MAKER}', 'ADMIN'), ('${COMPANY_B}', '${MAKER}', 'ADMIN');
    insert into public.company_settings (id, singleton_key, company_name, currency, vat_enabled, vat_rate, company_id)
    values (gen_random_uuid(), true, 'Bank Co A', 'OMR', false, 0, '${COMPANY_A}'),
           (gen_random_uuid(), true, 'Bank Co B', 'OMR', false, 0, '${COMPANY_B}');
    insert into public.bank_accounts (id, company_id, account_name, account_code)
    values ('${BANK_ACCOUNT}', '${COMPANY_A}', 'Main Bank', 'BANK-001');
    insert into public.bank_statement_lines (id, company_id, bank_account_id, transaction_date, description, amount, status)
    values ('${STATEMENT_LINE}', '${COMPANY_A}', '${BANK_ACCOUNT}', '2026-08-15', 'Test line', 100.000, 'unmatched');
    insert into public.receipts (id, company_id, amount, date_time, status, deleted_at)
    values ('${RECEIPT_1}', '${COMPANY_A}', 100.000, '2026-08-15T10:00:00Z', 'POSTED', null),
           ('f5000000-0000-4000-8000-000000000098', '${COMPANY_A}', 100.000, '2026-08-15T10:00:00Z', 'VOIDED', null);
  `);

  await assumeIdentity(db, MAKER, COMPANY_A);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('bank reconciliation governed RPC behavior', () => {
  it('rejects an unknown payment id', async () => {
    await expect(
      db.query(`select public.process_bank_reconciliation_match_atomic('{"statement_line_id":"${STATEMENT_LINE}","matched_entity_type":"payment","matched_entity_id":"00000000-0000-0000-0000-000000000000","matched_amount":100}'::jsonb)`),
    ).rejects.toThrow(/Matched payment was not found/);
  });

  it('rejects a cross-company receipt', async () => {
    const crossReceipt = 'f5000000-0000-4000-8000-000000000099';
    await db.exec(`insert into public.receipts (id, company_id, amount, date_time, status) values ('${crossReceipt}', '${COMPANY_B}', 100.000, '2026-08-15T10:00:00Z', 'POSTED')`);
    await expect(
      db.query(`select public.process_bank_reconciliation_match_atomic('{"statement_line_id":"${STATEMENT_LINE}","matched_entity_type":"receipt","matched_entity_id":"${crossReceipt}","matched_amount":100}'::jsonb)`),
    ).rejects.toThrow(/not found in the active company|Cross-company/);
  });

  it('rejects a voided receipt', async () => {
    await expect(
      db.query(`select public.process_bank_reconciliation_match_atomic('{"statement_line_id":"${STATEMENT_LINE}","matched_entity_type":"receipt","matched_entity_id":"f5000000-0000-4000-8000-000000000098","matched_amount":100}'::jsonb)`),
    ).rejects.toThrow(/reversed\/voided|POSTED/i);
  });

  it('accepts an eligible posted receipt exactly once', async () => {
    const line = 'f5000000-0000-4000-8000-000000000092';
    await db.exec(`insert into public.bank_statement_lines (id, company_id, bank_account_id, transaction_date, description, amount, status) values ('${line}', '${COMPANY_A}', '${BANK_ACCOUNT}', '2026-08-16', 'Posted receipt', 100.000, 'unmatched')`);

    const first = await db.query(`select (public.process_bank_reconciliation_match_atomic('{"statement_line_id":"${line}","matched_entity_type":"receipt","matched_entity_id":"${RECEIPT_1}","matched_amount":100}'::jsonb)).id`);
    expect(first.rows).toHaveLength(1);

    await expect(
      db.query(`select public.process_bank_reconciliation_match_atomic('{"statement_line_id":"${line}","matched_entity_type":"receipt","matched_entity_id":"${RECEIPT_1}","matched_amount":100}'::jsonb)`),
    ).rejects.toThrow(/already processed|already has a match/);
  });

  it('rejects a synthetic manual-adjustment id', async () => {
    const line = 'f5000000-0000-4000-8000-000000000095';
    await db.exec(`insert into public.bank_statement_lines (id, company_id, bank_account_id, transaction_date, description, amount, status) values ('${line}', '${COMPANY_A}', '${BANK_ACCOUNT}', '2026-08-17', 'Manual test', 10.000, 'unmatched')`);
    await expect(
      db.query(`select public.process_bank_reconciliation_match_atomic('{"statement_line_id":"${line}","matched_entity_type":"manual_adjustment","matched_entity_id":"manual-2026-08-17-10","matched_amount":10}'::jsonb)`),
    ).rejects.toThrow(/real persisted|real journal batch/i);
  });

  it('keeps reversal and manual candidate coverage explicitly partial', async () => {
    const { BANK_RECONCILIATION_COVERAGE } = await import('./bankReconciliationService');
    // PR 1559 upgraded reversals/refunds to 'supported' with deterministic server-side authority.
    expect(BANK_RECONCILIATION_COVERAGE.find((item) => item.movementClass.includes('reversals'))?.supportStatus).toBe('supported');
    expect(BANK_RECONCILIATION_COVERAGE.find((item) => item.movementClass === 'manual adjustments')?.supportStatus).toBe('partial');
  });
});

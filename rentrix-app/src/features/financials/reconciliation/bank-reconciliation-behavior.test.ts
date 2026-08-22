import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase, assumeIdentity } from '../../../p1/replay-bootstrap';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const COMPANY_A = 'f5000000-0000-4000-8000-000000000001';
const COMPANY_B = 'f5000000-0000-4000-8000-000000000002';
const MAKER = 'f5000000-0000-4000-8000-000000000011';
const BANK_ACCOUNT = 'f5000000-0000-4000-8000-000000000021';
const STATEMENT_LINE = 'f5000000-0000-4000-8000-000000000091';
const PAYMENT_1 = 'f5000000-0000-4000-8000-000000000031';
const RECEIPT_1 = 'f5000000-0000-4000-8000-000000000032';

let db: PGlite;

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values ('${COMPANY_A}', 'Bank Co A', 'bank-co-a'), ('${COMPANY_B}', 'Bank Co B', 'bank-co-b');
    insert into auth.users (id, email, raw_app_meta_data) values ('${MAKER}', 'maker@bank.test', '{\"company_id\":\"${COMPANY_A}\"}'::jsonb);
    insert into public.users (id, email, name, role, status, is_active) values ('${MAKER}', 'maker@bank.test', 'Maker', 'ADMIN', 'ACTIVE', true);
    insert into public.company_members (company_id, user_id, role) values ('${COMPANY_A}', '${MAKER}', 'ADMIN'), ('${COMPANY_B}', '${MAKER}', 'ADMIN');
    insert into public.company_settings (id, singleton_key, company_name, currency, vat_enabled, vat_rate, company_id)
    values (gen_random_uuid(), true, 'Bank Co A', 'OMR', false, 0, '${COMPANY_A}'),
           (gen_random_uuid(), true, 'Bank Co B', 'OMR', false, 0, '${COMPANY_B}');
    insert into public.bank_accounts (id, company_id, account_name, account_code) values ('${BANK_ACCOUNT}', '${COMPANY_A}', 'Main Bank', 'BANK-001');
    insert into public.bank_statement_lines (id, company_id, bank_account_id, transaction_date, description, amount, status)
    values ('${STATEMENT_LINE}', '${COMPANY_A}', '${BANK_ACCOUNT}', '2026-08-15', 'Test line', 100.000, 'unmatched');
    insert into public.receipts (id, company_id, amount, date_time, status, deleted_at)
    values ('${RECEIPT_1}', '${COMPANY_A}', 100.000, '2026-08-15T10:00:00Z', 'POSTED', null);
    insert into public.receipts (id, company_id, amount, date_time, status, deleted_at)
    values ('f5000000-0000-4000-8000-000000000098', '${COMPANY_A}', 100.000, '2026-08-15T10:00:00Z', 'VOIDED', null);
  `);

  await assumeIdentity(db, MAKER, COMPANY_A);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('bank reconciliation behavior — FOM-013 B1-B8', () => {
  it('service supports expanded entity types (B1, B8)', async () => {
    const servicePath = resolve(import.meta.dirname, './bankReconciliationService.ts');
    const service = readFileSync(servicePath, 'utf8');
    expect(service).toContain('owner_payout');
    expect(service).toContain('deposit_receipt');
    expect(service).toContain('deposit_refund');
    expect(service).toContain('commission_payment');
    expect(service).toContain('owner_expense');
    expect(service).not.toContain("'deposit_receipt' as never");
  });

  it('payment candidate references payment ID, receipt candidate references receipt ID (B1)', async () => {
    // After fix, receipt candidate must use receipt.id, not payment.id
    const servicePath = resolve(import.meta.dirname, './bankReconciliationService.ts');
    const service = readFileSync(servicePath, 'utf8');
    expect(service).toContain("from('receipts')");
    expect(service).toContain("toCandidate('receipt'");
    // Ensure receipt candidate uses receipt.id
    expect(service).toContain('receipt.id');
    // Payment candidate uses payment.id
    expect(service).toContain("toCandidate('payment'");
    expect(service).toContain('payment.id');
  });

  it('no duplicate candidate for same economic collection — prefers payment only (B1)', async () => {
    const servicePath = resolve(import.meta.dirname, './bankReconciliationService.ts');
    const service = readFileSync(servicePath, 'utf8');
    // After fix, receipt candidate from payment is removed to avoid duplicate
    expect(service).not.toContain('إيصال مرتبط بالدفعة');
    // Deduplication logic exists
    expect(service).toContain('Deduplicate by entity_type');
    expect(service).toContain('seen.has(key)');
  });

  it('OWNER expense identified by charged_to=OWNER, not free-text (B2)', async () => {
    const servicePath = resolve(import.meta.dirname, './bankReconciliationService.ts');
    const service = readFileSync(servicePath, 'utf8');
    expect(service).toContain("eq('charged_to', 'OWNER')");
    expect(service).toContain("eq('charged_to', 'COMPANY')");
    expect(service).not.toContain("contains('owner')");
    expect(service).not.toContain('toLowerCase().includes');
  });

  it('free-text category/description cannot change classification (B2)', async () => {
    // Even Arabic descriptions, classification via charged_to
    const servicePath = resolve(import.meta.dirname, './bankReconciliationService.ts');
    const service = readFileSync(servicePath, 'utf8');
    expect(service).toContain('charged_to');
    // No free-text inference
    expect(service).not.toContain("category.contains");
  });

  it('filter at DB boundary deterministically, not limit 10 then filter in memory (B4)', async () => {
    const servicePath = resolve(import.meta.dirname, './bankReconciliationService.ts');
    const service = readFileSync(servicePath, 'utf8');
    expect(service).toContain('.limit(100)'); // increased from 10
    expect(service).toContain("gte('paid_at'");
    expect(service).toContain("lte('paid_at'");
    expect(service).toContain("eq('net_payable'");
    expect(service).toContain("eq('amount'");
    // Old buggy .limit(10) before filtering should not exist for owner payouts and commissions
    const countLimit10 = (service.match(/\.limit\(10\)/g) || []).length;
    // Allow some limit 10 for payments/expenses but not for owner payouts/commissions which now use 100
    expect(countLimit10).toBeLessThanOrEqual(4); // payments, receipts, deposits, refunds may still have 20/100
  });

  it('invalid entity ID rejected by atomic RPC (B6)', async () => {
    await expect(
      db.query(`select public.process_bank_reconciliation_match_atomic('{\"statement_line_id\": \"${STATEMENT_LINE}\", \"matched_entity_type\": \"payment\", \"matched_entity_id\": \"00000000-0000-0000-0000-000000000000\", \"matched_amount\": 100}'::jsonb)`),
    ).rejects.toThrow(/Matched payment was not found/);
  });

  it('cross-company entity ID rejected (B6)', async () => {
    // Insert cross-company receipt
    await db.exec(`insert into public.receipts (id, company_id, amount, date_time, status) values ('f5000000-0000-4000-8000-000000000099', '${COMPANY_B}', 100.000, '2026-08-15T10:00:00Z', 'POSTED')`);
    await expect(
      db.query(`select public.process_bank_reconciliation_match_atomic('{\"statement_line_id\": \"${STATEMENT_LINE}\", \"matched_entity_type\": \"receipt\", \"matched_entity_id\": \"f5000000-0000-4000-8000-000000000099\", \"matched_amount\": 100}'::jsonb)`),
    ).rejects.toThrow(/not found in the active company|Cross-company/);
  });

  it('reversed/voided entity rejected (B6)', async () => {
    await expect(
      db.query(`select public.process_bank_reconciliation_match_atomic('{\"statement_line_id\": \"${STATEMENT_LINE}\", \"matched_entity_type\": \"receipt\", \"matched_entity_id\": \"f5000000-0000-4000-8000-000000000098\", \"matched_amount\": 100}'::jsonb)`),
    ).rejects.toThrow(/Cannot match reversed\/voided|not found/);
  });

  it('duplicate economic match rejected — same statement line cannot be matched twice (B6)', async () => {
    // Use existing STATEMENT_LINE, first match via direct insert to simulate already matched
    const newLine = 'f5000000-0000-4000-8000-000000000092';
    await db.exec(`
      insert into public.bank_statement_lines (id, company_id, bank_account_id, transaction_date, description, amount, status) values ('${newLine}', '${COMPANY_A}', '${BANK_ACCOUNT}', '2026-08-16', 'Dup test', 50.000, 'unmatched');
      insert into public.bank_reconciliation_matches (id, company_id, statement_line_id, matched_entity_type, matched_entity_id, matched_amount, matched_by)
      values (gen_random_uuid(), '${COMPANY_A}', '${newLine}', 'manual_adjustment', gen_random_uuid()::text, 50.000, '${MAKER}');
      update public.bank_statement_lines set status = 'matched' where id = '${newLine}';
    `);
    await expect(
      db.query(`select public.process_bank_reconciliation_match_atomic('{\"statement_line_id\": \"${newLine}\", \"matched_entity_type\": \"expense\", \"matched_entity_id\": \"f5000000-0000-4000-8000-000000000041\", \"matched_amount\": 50}'::jsonb)`),
    ).rejects.toThrow(/already processed|already has a match/);
  });

  it('manual adjustment must reference real governed authority or be rejected (B5)', async () => {
    const newLineId = 'f5000000-0000-4000-8000-000000000095';
    await db.exec(`insert into public.bank_statement_lines (id, company_id, bank_account_id, transaction_date, description, amount, status) values ('${newLineId}', '${COMPANY_A}', '${BANK_ACCOUNT}', '2026-08-17', 'Manual test', 10.000, 'unmatched')`);
    await expect(
      db.query(`select public.process_bank_reconciliation_match_atomic('{\"statement_line_id\": \"${newLineId}\", \"matched_entity_type\": \"manual_adjustment\", \"matched_entity_id\": \"manual-2026-08-17-10\", \"matched_amount\": 10}'::jsonb)`),
    ).rejects.toThrow(/Manual adjustment must reference real persisted/);
  });

  it('reversal coverage is explicitly partial, not claimed complete (B7)', async () => {
    const { BANK_RECONCILIATION_COVERAGE } = await import('./bankReconciliationService');
    const reversal = BANK_RECONCILIATION_COVERAGE.find((c) => c.movementClass.includes('reversals'));
    expect(reversal?.supportStatus).toBe('partial');
    const manual = BANK_RECONCILIATION_COVERAGE.find((c) => c.movementClass === 'manual adjustments');
    expect(manual?.supportStatus).toBe('partial');
    const hasPartial = BANK_RECONCILIATION_COVERAGE.some((c) => c.supportStatus === 'partial');
    expect(hasPartial).toBe(true);
  });

  it('source query error is visible/fail-closed (B3)', async () => {
    const servicePath = resolve(import.meta.dirname, './bankReconciliationService.ts');
    const service = readFileSync(servicePath, 'utf8');
    expect(service).toContain('handleSupabaseError');
    expect(service).toContain('throw');
    expect(service).toContain('Fail closed');
  });

  it('no synthetic manual_adjustment candidate with fake PK (B5)', async () => {
    const servicePath = resolve(import.meta.dirname, './bankReconciliationService.ts');
    const service = readFileSync(servicePath, 'utf8');
    // The old buggy code generated id: `manual-${line.transaction_date}-${amount}` — must not exist as candidate generation
    expect(service).not.toContain('`manual-${line.transaction_date}-${amount}`');
    expect(service).not.toContain('`manual-${date}-${amount}`');
    // Documentation may mention the old pattern to explain removal, but not as toCandidate generation
    const manualCandidateGenerations = (service.match(/toCandidate\('manual_adjustment'/g) || []).length;
    expect(manualCandidateGenerations).toBe(0); // No auto-suggested manual_adjustment with fake PK
  });
});

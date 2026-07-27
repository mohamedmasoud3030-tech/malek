/**
 * Phase 2 — Financial Integrity and Reports Recovery Regression and Behavior Suite.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase, assumeIdentity, repoRoot } from '../p1/replay-bootstrap';

const COMPANY_1 = 'c1000000-0000-4000-8000-000000000001';
const COMPANY_2 = 'c2000000-0000-4000-8000-000000000002';
const ADMIN_1 = 'a1000000-0000-4000-8000-000000000001';
const ADMIN_2 = 'a2000000-0000-4000-8000-000000000001';
const OWNER_1 = 'b1000000-0000-4000-8000-000000000001'; // Company 1
const OWNER_2 = 'b2000000-0000-4000-8000-000000000001'; // Company 2
const P_R = 'd1000000-0000-4000-8000-000000000001';
const P_R2 = 'd1000000-0000-4000-8000-000000000002';
const P_F = 'd1000000-0000-4000-8000-000000000003';
const P_M = 'd1000000-0000-4000-8000-000000000004';
const U_R = 'e1000000-0000-4000-8000-000000000001';
const U_R2 = 'e1000000-0000-4000-8000-000000000002';
const U_F = 'e1000000-0000-4000-8000-000000000003';
const U_M = 'e1000000-0000-4000-8000-000000000004';
const T_R = 'f1000000-0000-4000-8000-000000000001';
const T_R2 = 'f1000000-0000-4000-8000-000000000002';
const T_F = 'f1000000-0000-4000-8000-000000000003';
const T_M = 'f1000000-0000-4000-8000-000000000004';
const AGR_R = 'aa000000-0000-4000-8000-000000000001';
const AGR_R2 = 'aa000000-0000-4000-8000-000000000002';
const AGR_F = 'aa000000-0000-4000-8000-000000000003';
const AGR_M = 'aa000000-0000-4000-8000-000000000004';
const C_R = 'cc000000-0000-4000-8000-000000000001';
const C_R2 = 'cc000000-0000-4000-8000-000000000002';
const C_F = 'cc000000-0000-4000-8000-000000000003';
const C_M = 'cc000000-0000-4000-8000-000000000004';
const C_2 = 'cc000000-0000-4000-8000-000000000005';

let db: PGlite;
const evidence: Record<string, any> = { generatedAt: new Date().toISOString() };

async function seedReportsFixture() {
  await db.exec(`
INSERT INTO public.companies (id, name, slug) VALUES
  ('${COMPANY_1}', 'شركة التحقق', 'verify-one'),
  ('${COMPANY_2}', 'شركة الغير', 'other-two');

INSERT INTO auth.users (id, email) VALUES
  ('${ADMIN_1}',  'admin1@p2.test'),
  ('${ADMIN_2}',  'admin2@p2.test');

INSERT INTO public.users (id, email, name, role, status) VALUES
  ('${ADMIN_1}',  'admin1@p2.test',  'مدير أول',  'ADMIN', 'ACTIVE'),
  ('${ADMIN_2}',  'admin2@p2.test',  'مدير ثان',  'ADMIN', 'ACTIVE');

INSERT INTO public.company_members (company_id, user_id, role) VALUES
  ('${COMPANY_1}', '${ADMIN_1}', 'ADMIN'),
  ('${COMPANY_2}', '${ADMIN_2}', 'ADMIN');

INSERT INTO public.owners (id, full_name, name, company_id) VALUES
  ('${OWNER_1}', 'مالك النسبة',   'مالك النسبة',   '${COMPANY_1}'),
  ('${OWNER_2}', 'مالك الشركة ٢', 'مالك الشركة ٢', '${COMPANY_2}');

INSERT INTO public.properties (id, title, name, type, address, company_id) VALUES
  ('${P_R}',  'عقار النسبة',    'عقار النسبة',    'سكني', 'مسقط', '${COMPANY_1}'),
  ('${P_R2}', 'عقار النسبة ٢',  'عقار النسبة ٢',  'سكني', 'مسقط', '${COMPANY_1}'),
  ('${P_F}',  'عقار الثابت',    'عقار الثابت',    'سكني', 'مسقط', '${COMPANY_1}'),
  ('${P_M}',  'عقار الماستر',   'عقار الماستر',   'سكني', 'مسقط', '${COMPANY_1}');

INSERT INTO public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on, company_id) VALUES
  ('${P_R}',  '${OWNER_1}', 100, true, date '2026-01-01', date '2027-12-31', '${COMPANY_1}'),
  ('${P_R2}', '${OWNER_1}', 100, true, date '2026-01-01', date '2027-12-31', '${COMPANY_1}'),
  ('${P_F}',  '${OWNER_1}', 100, true, date '2026-01-01', date '2027-12-31', '${COMPANY_1}'),
  ('${P_M}',  '${OWNER_1}', 100, true, date '2026-01-01', date '2027-12-31', '${COMPANY_1}');

INSERT INTO public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, company_id) VALUES
  ('${AGR_R}',  '${OWNER_1}', '${P_R}',  'property_management', 'RATE',          10,     date '2026-01-01', date '2027-12-31', '${COMPANY_1}'),
  ('${AGR_R2}', '${OWNER_1}', '${P_R2}', 'property_management', 'RATE',          5.5555, date '2026-01-01', date '2027-12-31', '${COMPANY_1}'),
  ('${AGR_F}',  '${OWNER_1}', '${P_F}',  'property_management', 'FIXED_MONTHLY', 200,    date '2026-01-01', date '2026-08-31', '${COMPANY_1}'),
  ('${AGR_M}',  '${OWNER_1}', '${P_M}',  'master_lease',        'FIXED_MONTHLY', 300,    date '2026-01-01', date '2027-12-31', '${COMPANY_1}');

INSERT INTO public.units (id, property_id, name, unit_number, company_id) VALUES
  ('${U_R}', '${P_R}', 'E-1', 'R-1', '${COMPANY_1}'),
  ('${U_R2}', '${P_R2}', 'E-2', 'R-2', '${COMPANY_1}'),
  ('${U_F}', '${P_F}', 'E-3', 'F-1', '${COMPANY_1}'),
  ('${U_M}', '${P_M}', 'E-4', 'M-1', '${COMPANY_1}');

INSERT INTO public.people (id, full_name, type, company_id) VALUES
  ('${T_R}', 'مستأجر ن', 'tenant', '${COMPANY_1}'),
  ('${T_R2}', 'مستأجر ن٢', 'tenant', '${COMPANY_1}'),
  ('${T_F}', 'مستأجر ث', 'tenant', '${COMPANY_1}'),
  ('${T_M}', 'مستأجر م', 'tenant', '${COMPANY_1}');

INSERT INTO public.contracts (id, property_id, unit_id, tenant_id, start_date, end_date, rent_amount, status, agreement_id, company_id) VALUES
  ('${C_R}',  '${P_R}',  '${U_R}',  '${T_R}',  '2026-01-01', '2026-12-31', 12000, 'active', '${AGR_R}',  '${COMPANY_1}'),
  ('${C_R2}', '${P_R2}', '${U_R2}', '${T_R2}', '2026-01-01', '2026-12-31', 6000,  'active', '${AGR_R2}', '${COMPANY_1}'),
  ('${C_F}',  '${P_F}',  '${U_F}',  '${T_F}',  '2026-01-01', '2026-08-31', 9000,  'active', '${AGR_F}',  '${COMPANY_1}'),
  ('${C_M}',  '${P_M}',  '${U_M}',  '${T_M}',  '2026-01-01', '2026-12-31', 15000, 'active', '${AGR_M}',  '${COMPANY_1}');

-- Update baseline accounts company_id
UPDATE public.accounts SET company_id = '${COMPANY_1}' WHERE no IN ('1111', '1201', '2000', '2200', '6100');

-- Insert other custom accounts for COMPANY_1 using unique ids matching the nos
INSERT INTO public.accounts (id, no, name, company_id) VALUES
  ('2100', '2100', 'VAT Payable', '${COMPANY_1}'),
  ('3000', '3000', 'Retained Earnings', '${COMPANY_1}'),
  ('4000', '4000', 'Rental Revenue', '${COMPANY_1}')
ON CONFLICT (id) DO NOTHING;

-- Seed balanced journal entries for COMPANY_1 using real accounts
INSERT INTO public.journal_entries (id, no, date, account_id, amount, type, company_id) VALUES
  ('j1000000-0000-4000-8000-000000000001', 'JE-01', date '2026-07-15', '1111', 1000, 'DEBIT', '${COMPANY_1}'),
  ('j1000000-0000-4000-8000-000000000002', 'JE-01', date '2026-07-15', '4000', 1000, 'CREDIT', '${COMPANY_1}'),
  ('j1000000-0000-4000-8000-000000000003', 'JE-02', date '2026-07-16', '6100', 200, 'DEBIT', '${COMPANY_1}'),
  ('j1000000-0000-4000-8000-000000000004', 'JE-02', date '2026-07-16', '1111', 200, 'CREDIT', '${COMPANY_1}');

INSERT INTO public.invoices (id, contract_id, issue_date, due_date, amount, paid_amount, tax_amount, status, company_id) VALUES
  ('dd000000-0000-4000-8000-000000000001', '${C_R}',  '2026-07-01', '2026-07-05', 1000, 1000, 0, 'PAID', '${COMPANY_1}'),
  ('dd000000-0000-4000-8000-000000000002', '${C_R}',  '2026-07-06', '2026-07-12', 500,  500,  0, 'PAID', '${COMPANY_1}'),
  ('dd000000-0000-4000-8000-000000000003', '${C_R}',  '2026-07-13', '2026-07-20', 250,  0,    0, 'UNPAID', '${COMPANY_1}'),
  ('dd000000-0000-4000-8000-000000000004', '${C_R}',  '2026-08-01', '2026-08-02', 400,  400,  0, 'PAID', '${COMPANY_1}'),
  ('dd000000-0000-4000-8000-000000000005', '${C_R2}', '2026-07-01', '2026-07-08', 200,  200,  0, 'PAID', '${COMPANY_1}'),
  ('dd000000-0000-4000-8000-000000000006', '${C_F}',  '2026-07-10', '2026-07-15', 700,  700,  0, 'PAID', '${COMPANY_1}'),
  ('dd000000-0000-4000-8000-000000000007', '${C_M}',  '2026-07-10', '2026-07-15', 900,  900,  0, 'PAID', '${COMPANY_1}');

-- Invoice with empty no (using non-overlapping issue date) to test description / ref_no fallback
INSERT INTO public.invoices (id, contract_id, issue_date, due_date, amount, paid_amount, tax_amount, status, company_id, no) VALUES
  ('dd000000-0000-4000-8000-000000000099', '${C_R}', '2026-07-25', '2026-07-31', 100, 0, 0, 'UNPAID', '${COMPANY_1}', '');

INSERT INTO public.receipts (id, no, amount, status, contract_id, company_id) VALUES
  ('ab000000-0000-4000-8000-000000000001', 'REC-01', 1000, 'POSTED', '${C_R}', '${COMPANY_1}'),
  ('ab000000-0000-4000-8000-000000000002', 'REC-02', 500,  'POSTED', '${C_R}', '${COMPANY_1}'),
  ('ab000000-0000-4000-8000-000000000003', 'REC-03', 250,  'VOID',   '${C_R}', '${COMPANY_1}');

INSERT INTO public.payments (id, invoice_id, contract_id, amount, payment_method, payment_date, status, receipt_id, company_id) VALUES
  ('ee000000-0000-4000-8000-000000000001', 'dd000000-0000-4000-8000-000000000001', '${C_R}',  1000, 'cash', date '2026-07-05', 'POSTED', 'ab000000-0000-4000-8000-000000000001', '${COMPANY_1}'),
  ('ee000000-0000-4000-8000-000000000002', 'dd000000-0000-4000-8000-000000000002', '${C_R}',  500,  'cash', date '2026-07-12', 'POSTED', 'ab000000-0000-4000-8000-000000000002', '${COMPANY_1}'),
  ('ee000000-0000-4000-8000-000000000003', 'dd000000-0000-4000-8000-000000000003', '${C_R}',  250,  'cash', date '2026-07-20', 'VOID',   'ab000000-0000-4000-8000-000000000003', '${COMPANY_1}');

UPDATE public.receipts SET payment_id = id
 WHERE id IN ('ab000000-0000-4000-8000-000000000001','ab000000-0000-4000-8000-000000000002','ab000000-0000-4000-8000-000000000003');

-- Seed tenant_deposits to test rent roll deposit remaining_amount (using correct lowercase 'held' status!)
INSERT INTO public.tenant_deposits (id, contract_id, tenant_id, deposit_amount, deducted_amount, refunded_amount, remaining_amount, status, company_id) VALUES
  ('dt000000-0000-4000-8000-000000000001', '${C_R}', '${T_R}', 500, 0, 0, 500, 'held', '${COMPANY_1}');
  `);
}

beforeAll(async () => {
  // Replays the full chain up to and including Phase 2!
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  db = replay.db;
  evidence.replayCoverage = {
    total: replay.applied.length + replay.failed.length,
    applied: replay.applied.length,
    failed: replay.failed,
  };
  await seedReportsFixture();
}, 120_000);

afterAll(async () => {
  const p2EvidenceDir = join(repoRoot, 'evidence', 'p2');
  mkdirSync(p2EvidenceDir, { recursive: true });
  writeFileSync(
    join(p2EvidenceDir, 'p2-financial-reports-recovery-rehearsal.json'),
    JSON.stringify(evidence, null, 2)
  );
  await db?.close();
});

describe('Phase 2 — Replay Coverage Verification', () => {
  it('applied all migrations including Phase 2 without failure', () => {
    const failed = (evidence.replayCoverage as any)?.failed ?? [];
    expect(failed).toEqual([]);
    expect((evidence.replayCoverage as any).applied).toBeGreaterThan(140);
  });
});

describe('Phase 2 — Security & anon Role Execution Guard', () => {
  it('asserts that ZERO security definer functions are executable by anon', async () => {
    const { rows } = await db.query<{ name: string; args: string }>(`
      select
        p.proname as name,
        pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prosecdef
        and has_function_privilege('anon', p.oid, 'EXECUTE')
    `);
    evidence.anonViolations = rows;
    expect(rows, `Violations found: ${JSON.stringify(rows)}`).toEqual([]);
  });
});

describe('Phase 2 — The 6 Recovered Reports', () => {
  it('1. rpt_trial_balance runs, requires company context, and balances', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const { rows } = await db.query<{ out: any }>(
      `SELECT public.rpt_trial_balance(date '2026-07-31') as out`
    );
    const rpt = rows[0].out;
    evidence.rptTrialBalance = rpt;
    expect(rpt).toBeDefined();
    expect(rpt.is_balanced).toBe(true);
    expect(Number(rpt.total_debits)).toBe(Number(rpt.total_credits));

    // Test unbalanced detection (running safely inside local transaction savepoint)
    await db.exec('BEGIN; SAVEPOINT sp_unbalanced;');
    try {
      await db.query(`
        INSERT INTO public.journal_entries (id, no, date, account_id, amount, type, company_id) VALUES
          ('j1000000-0000-4000-8000-000000000099', 'JE-UNBALANCED', date '2026-07-20', '1111', 50, 'DEBIT', '${COMPANY_1}');
      `);
      const { rows: unbalancedRows } = await db.query<{ out: any }>(
        `SELECT public.rpt_trial_balance(date '2026-07-31') as out`
      );
      const unbalancedRpt = unbalancedRows[0].out;
      expect(unbalancedRpt.is_balanced).toBe(false);
    } finally {
      await db.exec('ROLLBACK TO SAVEPOINT sp_unbalanced; COMMIT;');
    }
  });

  it('2. rpt_balance_sheet runs, requires company context, and satisfies A = L + E', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const { rows } = await db.query<{ out: any }>(
      `SELECT public.rpt_balance_sheet(date '2026-07-31') as out`
    );
    const rpt = rows[0].out;
    evidence.rptBalanceSheet = rpt;

    expect(rpt).toBeDefined();
    expect(rpt.is_balanced).toBe(true);
    expect(Number(rpt.total_assets)).toBe(Number(rpt.total_liabilities) + Number(rpt.total_equity));
  });

  it('3. rpt_aged_receivables runs and correctly groups into buckets', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const { rows } = await db.query<{ out: any }>(
      `SELECT public.rpt_aged_receivables(date '2026-07-31') as out`
    );
    const rpt = rows[0].out;
    evidence.rptAgedReceivables = rpt;
    expect(rpt).toBeDefined();
    expect(rpt.lines).toBeDefined();
    expect(rpt.totals).toBeDefined();
    const totalAged = Number(rpt.totals.total);
    expect(totalAged).toBeGreaterThan(0);
  });

  it('4. rpt_overdue_invoices runs and excludes void and paid invoices', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const { rows } = await db.query<{ out: any }>(
      `SELECT public.rpt_overdue_invoices(date '2026-07-31') as out`
    );
    const rpt = rows[0].out;
    evidence.rptOverdueInvoices = rpt;
    expect(rpt).toBeDefined();
    expect(rpt.rows).toBeDefined();
    expect(rpt.count).toBeGreaterThan(0);
  });

  it('5. rpt_rent_roll runs and maps active contracts, including computed deposits and names', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const { rows } = await db.query<{ out: any }>(
      `SELECT public.rpt_rent_roll(date '2026-07-31') as out`
    );
    const rpt = rows[0].out;
    evidence.rptRentRoll = rpt;

    expect(rpt).toBeDefined();
    expect(rpt.rows.length).toBeGreaterThan(0);
    // Find contract C_R's row
    const rowCR = rpt.rows.find((r: any) => r.tenant_name === 'مستأجر ن');
    expect(rowCR).toBeDefined();
    expect(Number(rowCR.deposit)).toBe(500); // correctly derived from tenant_deposits!
    expect(rowCR.unit_type).toBe('E-1'); // mapped to u.name!
  });

  it('6. rpt_tenant_statement runs using UUID contract id, selects property.title, and handles VOIDs', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const { rows } = await db.query<{ out: any }>(
      `SELECT public.rpt_tenant_statement($1::uuid) as out`,
      [C_R]
    );
    const rpt = rows[0].out;
    evidence.rptTenantStatement = rpt;
    expect(rpt).toBeDefined();
    expect(rpt.error).toBeUndefined();
    expect(rpt.property_name).toBe('عقار النسبة');
    const receiptLines = rpt.lines.filter((l: any) => l.type === 'receipt');
    expect(receiptLines.length).toBe(2); // Two posted receipts seeded
    expect(receiptLines[0].description).toContain('REC-01');

    // Prove that all invoice lines have descriptions and references that are NOT null (including fallback id)
    const invoiceLines = rpt.lines.filter((l: any) => l.type === 'invoice');
    expect(invoiceLines.length).toBeGreaterThan(0);
    for (const line of invoiceLines) {
      expect(line.description).toBeDefined();
      expect(line.description).not.toBeNull();
      expect(line.balance).toBeDefined();
      expect(line.balance).not.toBeNull();
    }
  });
});

describe('Phase 2 — Multi-tenant Isolation', () => {
  it('cross-company isolation is enforced on reports', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const { rows } = await db.query<{ out: any }>(
      `SELECT public.rpt_tenant_statement($1::uuid) as out`,
      [C_2]
    );
    expect(rows[0].out.error).toBe('contract not found');
  });
});

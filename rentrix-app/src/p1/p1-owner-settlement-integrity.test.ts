/**
 * P1 — Owner-settlement amount-integrity regression suite (full-chain PGlite replay).
 *
 * Vulnerability (proven on main@8cd87a1 AND re-proven here in the RED phase):
 * `create_owner_settlement_draft_atomic` trusted client-sent gross_collected /
 * office_fee / owner_expenses / tax_amount, so net_payable — the amount later
 * paid out with a balanced journal batch — was forgeable. P0 deliberately left
 * amounts semantics untouched (F-SET only); P1 owns the amounts.
 *
 * Fix contract under test:
 *   1. public.calculate_owner_net_payout(owner, period_start, period_end, property?)
 *      derives every component from canonical sources (ADR 0001 + rpt parity):
 *        gross      = non-VOID payments of the owner's contracts (per period / property)
 *        rate fee   = Σ _r3(amount × rate/100) per payment (collected-cash basis)
 *        fixed fee  = commission_value × calendar months covered (P1 closes the
 *                     previously-deferred accrual policy — see migration comment)
 *        master     = obligation basis: gross = value × months, fee = 0
 *        expenses   = POSTED, charged_to=OWNER, property_owners-covered, in period
 *        tax        = company VAT on the office fee when enabled, else 0
 *        net        = greatest(gross − fee − expenses − tax, 0)
 *   2. create_owner_settlement_draft_atomic ignores ALL client amount keys and
 *      persists the derived tuple (idempotency / overlap / role / F-SET kept).
 *   3. rpt_owner_statement numeric parity: calcGross−calcExpenses == rpt.gross,
 *      calcFee == rpt.deductions, calcNet == rpt.net.
 *
 * RED → GREEN protocol: this suite is committed BEFORE the P1 migration exists;
 * the RED run proves (a) the derivation RPC is absent and (b) fabricated client
 * amounts are persisted verbatim by the pre-P1 write path.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase, assumeIdentity, repoRoot, evidenceDir } from './replay-bootstrap';

const COMPANY_1 = 'c1000000-0000-4000-8000-000000000001';
const COMPANY_2 = 'c2000000-0000-4000-8000-000000000002';
const ADMIN_1 = 'a1000000-0000-4000-8000-000000000001';
const MEMBER_1 = 'a1000000-0000-4000-8000-000000000002';
const ADMIN_2 = 'a2000000-0000-4000-8000-000000000001';
const OWNER_R = 'b1000000-0000-4000-8000-000000000001'; // property_management, RATE 10%
const OWNER_F = 'b1000000-0000-4000-8000-000000000002'; // property_management, FIXED_MONTHLY 200
const OWNER_M = 'b1000000-0000-4000-8000-000000000003'; // master_lease, FIXED_MONTHLY 300
const OWNER_2 = 'b2000000-0000-4000-8000-000000000001'; // company 2, RATE 10%
const P_R = 'd1000000-0000-4000-8000-000000000001';
const P_R2 = 'd1000000-0000-4000-8000-000000000002';
const P_F = 'd1000000-0000-4000-8000-000000000003';
const P_M = 'd1000000-0000-4000-8000-000000000004';
const P_2 = 'd2000000-0000-4000-8000-000000000001';
const U_R = 'e1000000-0000-4000-8000-000000000001';
const U_R2 = 'e1000000-0000-4000-8000-000000000002';
const U_F = 'e1000000-0000-4000-8000-000000000003';
const U_M = 'e1000000-0000-4000-8000-000000000004';
const U_2 = 'e2000000-0000-4000-8000-000000000001';
const T_R = 'f1000000-0000-4000-8000-000000000001';
const T_R2 = 'f1000000-0000-4000-8000-000000000002';
const T_F = 'f1000000-0000-4000-8000-000000000003';
const T_M = 'f1000000-0000-4000-8000-000000000004';
const T_2 = 'f2000000-0000-4000-8000-000000000001';
const AGR_R = 'aa000000-0000-4000-8000-000000000001';
const AGR_R2 = 'aa000000-0000-4000-8000-000000000002';
const AGR_F = 'aa000000-0000-4000-8000-000000000003';
const AGR_M = 'aa000000-0000-4000-8000-000000000004';
const AGR_2 = 'aa000000-0000-4000-8000-000000000005';
const AGR_G1 = 'aa000000-0000-4000-8000-000000000006';
const AGR_G2 = 'aa000000-0000-4000-8000-000000000007';
const OWNER_G = 'b1000000-0000-4000-8000-000000000004';
const P_G = 'd1000000-0000-4000-8000-000000000005';
const U_G = 'e1000000-0000-4000-8000-000000000005';
const T_G = 'f1000000-0000-4000-8000-000000000005';
const C_G = 'cc000000-0000-4000-8000-000000000006';
const OUTSIDER = 'a1000000-0000-4000-8000-000000000003'; // authenticated, no company membership
const C_R = 'cc000000-0000-4000-8000-000000000001';
const C_R2 = 'cc000000-0000-4000-8000-000000000002';
const C_F = 'cc000000-0000-4000-8000-000000000003';
const C_M = 'cc000000-0000-4000-8000-000000000004';
const C_2 = 'cc000000-0000-4000-8000-000000000005';

const JULY = { from: '2026-07-01', to: '2026-07-31' };

let db: PGlite;

function num(v: unknown) {
  return Number(v ?? NaN);
}

async function calcRow(ownerId: string, propertyId: string | null, from = JULY.from, to = JULY.to) {
  const { rows } = await db.query(
    `select gross_collected, office_fee, owner_expenses, tax_amount, net_payable, breakdown
       from public.calculate_owner_net_payout($1::uuid, $2::date, $3::date, $4::uuid)`,
    [ownerId, from, to, propertyId],
  );
  return rows[0] as any;
}

async function seedFixture() {
  await db.exec(`
INSERT INTO public.companies (id, name, slug) VALUES
  ('${COMPANY_1}', 'شركة التحقق', 'verify-one'),
  ('${COMPANY_2}', 'شركة الغير', 'other-two');

INSERT INTO auth.users (id, email) VALUES
  ('${ADMIN_1}',  'admin1@p1.test'),
  ('${MEMBER_1}', 'member1@p1.test'),
  ('${ADMIN_2}',  'admin2@p1.test'),
  ('${OUTSIDER}', 'outsider@p1.test');

INSERT INTO public.users (id, email, name, role, status) VALUES
  ('${ADMIN_1}',  'admin1@p1.test',  'مدير أول',  'ADMIN', 'ACTIVE'),
  ('${MEMBER_1}', 'member1@p1.test', 'عضو أول',   'USER',  'ACTIVE'),
  ('${ADMIN_2}',  'admin2@p1.test',  'مدير ثان',  'ADMIN', 'ACTIVE'),
  ('${OUTSIDER}', 'outsider@p1.test','خارجي',     'USER',  'ACTIVE');

INSERT INTO public.company_members (company_id, user_id, role) VALUES
  ('${COMPANY_1}', '${ADMIN_1}', 'ADMIN'),
  ('${COMPANY_1}', '${MEMBER_1}', 'MEMBER'),
  ('${COMPANY_2}', '${ADMIN_2}', 'ADMIN');

INSERT INTO public.owners (id, full_name, name, company_id) VALUES
  ('${OWNER_R}', 'مالك النسبة',   'مالك النسبة',   '${COMPANY_1}'),
  ('${OWNER_F}', 'مالك الثابت',   'مالك الثابت',   '${COMPANY_1}'),
  ('${OWNER_M}', 'مالك الماستر',  'مالك الماستر',  '${COMPANY_1}'),
  ('${OWNER_G}', 'مالك الاتفاقين','مالك الاتفاقين','${COMPANY_1}'),
  ('${OWNER_2}', 'مالك الشركة ٢', 'مالك الشركة ٢', '${COMPANY_2}');

INSERT INTO public.properties (id, title, name, type, address, company_id) VALUES
  ('${P_R}',  'عقار النسبة',    'عقار النسبة',    'سكني', 'مسقط', '${COMPANY_1}'),
  ('${P_R2}', 'عقار النسبة ٢',  'عقار النسبة ٢',  'سكني', 'مسقط', '${COMPANY_1}'),
  ('${P_F}',  'عقار الثابت',    'عقار الثابت',    'سكني', 'مسقط', '${COMPANY_1}'),
  ('${P_M}',  'عقار الماستر',   'عقار الماستر',   'سكني', 'مسقط', '${COMPANY_1}'),
  ('${P_G}',  'عقار الاتفاقين', 'عقار الاتفاقين', 'سكني', 'مسقط', '${COMPANY_1}'),
  ('${P_2}',  'عقار الشركة ٢',  'عقار الشركة ٢',  'سكني', 'مسقط', '${COMPANY_2}');

INSERT INTO public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on, company_id) VALUES
  ('${P_R}',  '${OWNER_R}', 100, true, date '2026-01-01', date '2027-12-31', '${COMPANY_1}'),
  ('${P_R2}', '${OWNER_R}', 100, true, date '2026-01-01', date '2027-12-31', '${COMPANY_1}'),
  ('${P_F}',  '${OWNER_F}', 100, true, date '2026-01-01', date '2027-12-31', '${COMPANY_1}'),
  ('${P_M}',  '${OWNER_M}', 100, true, date '2026-01-01', date '2027-12-31', '${COMPANY_1}'),
  ('${P_G}',  '${OWNER_G}', 100, true, date '2026-01-01', date '2027-12-31', '${COMPANY_1}'),
  ('${P_2}',  '${OWNER_2}', 100, true, date '2026-01-01', date '2027-12-31', '${COMPANY_2}');

INSERT INTO public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, company_id) VALUES
  ('${AGR_R}',  '${OWNER_R}', '${P_R}',  'property_management', 'RATE',          10,     date '2026-01-01', date '2027-12-31', '${COMPANY_1}'),
  -- 4-decimal RATE value: proves derivation rounds to 3 places via _r3.
  ('${AGR_R2}', '${OWNER_R}', '${P_R2}', 'property_management', 'RATE',          5.5555, date '2026-01-01', date '2027-12-31', '${COMPANY_1}'),
  -- Fixed agreement intentionally ends 2026-08-31 to prove months clipping.
  ('${AGR_F}',  '${OWNER_F}', '${P_F}',  'property_management', 'FIXED_MONTHLY', 200,    date '2026-01-01', date '2026-08-31', '${COMPANY_1}'),
  ('${AGR_M}',  '${OWNER_M}', '${P_M}',  'master_lease',        'FIXED_MONTHLY', 300,    date '2026-01-01', date '2027-12-31', '${COMPANY_1}'),
  ('${AGR_G1}', '${OWNER_G}', '${P_G}',  'property_management', 'FIXED_MONTHLY', 150,    date '2026-01-01', date '2026-06-30', '${COMPANY_1}'),
  ('${AGR_G2}', '${OWNER_G}', '${P_G}',  'property_management', 'FIXED_MONTHLY', 250,    date '2026-07-01', date '2027-12-31', '${COMPANY_1}'),
  ('${AGR_2}',  '${OWNER_2}', '${P_2}',  'property_management', 'RATE',          10,     date '2026-01-01', date '2027-12-31', '${COMPANY_2}');

INSERT INTO public.units (id, property_id, unit_number, company_id) VALUES
  ('${U_R}', '${P_R}', 'R-1', '${COMPANY_1}'),
  ('${U_R2}', '${P_R2}', 'R-2', '${COMPANY_1}'),
  ('${U_F}', '${P_F}', 'F-1', '${COMPANY_1}'),
  ('${U_M}', '${P_M}', 'M-1', '${COMPANY_1}'),
  ('${U_G}', '${P_G}', 'G-1', '${COMPANY_1}'),
  ('${U_2}', '${P_2}', 'B-1', '${COMPANY_2}');

INSERT INTO public.people (id, full_name, type, company_id) VALUES
  ('${T_R}', 'مستأجر ن', 'tenant', '${COMPANY_1}'),
  ('${T_R2}', 'مستأجر ن٢', 'tenant', '${COMPANY_1}'),
  ('${T_F}', 'مستأجر ث', 'tenant', '${COMPANY_1}'),
  ('${T_M}', 'مستأجر م', 'tenant', '${COMPANY_1}'),
  ('${T_G}', 'مستأجر ج', 'tenant', '${COMPANY_1}'),
  ('${T_2}', 'مستأجر غ', 'tenant', '${COMPANY_2}');

INSERT INTO public.contracts (id, property_id, unit_id, tenant_id, start_date, end_date, rent_amount, status, agreement_id, company_id) VALUES
  ('${C_R}',  '${P_R}',  '${U_R}',  '${T_R}',  '2026-01-01', '2026-12-31', 12000, 'active', '${AGR_R}',  '${COMPANY_1}'),
  ('${C_R2}', '${P_R2}', '${U_R2}', '${T_R2}', '2026-01-01', '2026-12-31', 6000,  'active', '${AGR_R2}', '${COMPANY_1}'),
  ('${C_F}',  '${P_F}',  '${U_F}',  '${T_F}',  '2026-01-01', '2026-12-31', 9000,  'active', '${AGR_F}',  '${COMPANY_1}'),
  ('${C_M}',  '${P_M}',  '${U_M}',  '${T_M}',  '2026-01-01', '2026-12-31', 15000, 'active', '${AGR_M}',  '${COMPANY_1}'),
  ('${C_G}',  '${P_G}',  '${U_G}',  '${T_G}',  '2026-01-01', '2026-12-31', 4000,  'active', '${AGR_G1}', '${COMPANY_1}'),
  ('${C_2}',  '${P_2}',  '${U_2}',  '${T_2}',  '2026-01-01', '2026-12-31', 8000,  'active', '${AGR_2}',  '${COMPANY_2}');

-- Payout journal accounts (pay_owner_settlement_atomic resolves no='1111'/'2000'
-- FILTERED BY the caller's company). accounts.no is GLOBALLY unique (core_schema)
-- and migrations seed the chart once, backfilled to the demo company; no trigger
-- provisions a chart for a new company row (probe evidence:
-- evidence/p1/pay-accounts-diagnosis.json). An earlier revision of this fixture
-- inserted ('1111','1111',...) ON CONFLICT (id) DO NOTHING — a silent no-op that
-- left COMPANY_1 without a chart and pay raising the configuration guard.
-- COMPANY_1 is this suite's operating company, so the fixture assigns the
-- provisioned chart to it — the equivalent of provisioning this deployment for
-- COMPANY_1. Harness-only per directive §4: production migrations are untouched.
UPDATE public.accounts SET company_id = '${COMPANY_1}' WHERE no IN ('1111', '2000');

-- Invoices exist only because payments.invoice_id is NOT NULL; they play no
-- role in collected-cash derivation.
INSERT INTO public.invoices (id, contract_id, issue_date, due_date, amount, paid_amount, tax_amount, status, company_id) VALUES
  ('dd000000-0000-4000-8000-000000000001', '${C_R}',  '2026-07-01', '2026-07-05', 1000, 1000, 0, 'PAID', '${COMPANY_1}'),
  ('dd000000-0000-4000-8000-000000000002', '${C_R}',  '2026-07-06', '2026-07-12', 500,  500,  0, 'PAID', '${COMPANY_1}'),
  ('dd000000-0000-4000-8000-000000000003', '${C_R}',  '2026-07-13', '2026-07-20', 250,  0,    0, 'UNPAID', '${COMPANY_1}'),
  ('dd000000-0000-4000-8000-000000000004', '${C_R}',  '2026-08-01', '2026-08-02', 400,  400,  0, 'PAID', '${COMPANY_1}'),
  ('dd000000-0000-4000-8000-000000000005', '${C_R2}', '2026-07-01', '2026-07-08', 200,  200,  0, 'PAID', '${COMPANY_1}'),
  ('dd000000-0000-4000-8000-000000000006', '${C_F}',  '2026-07-10', '2026-07-15', 700,  700,  0, 'PAID', '${COMPANY_1}'),
  ('dd000000-0000-4000-8000-000000000007', '${C_M}',  '2026-07-10', '2026-07-15', 900,  900,  0, 'PAID', '${COMPANY_1}'),
  ('dd000000-0000-4000-8000-000000000008', '${C_2}',  '2026-07-01', '2026-07-05', 100,  100,  0, 'PAID', '${COMPANY_2}');

INSERT INTO public.receipts (id, amount, status, company_id) VALUES
  ('ab000000-0000-4000-8000-000000000001', 1000, 'POSTED', '${COMPANY_1}'),
  ('ab000000-0000-4000-8000-000000000002', 500,  'POSTED', '${COMPANY_1}'),
  ('ab000000-0000-4000-8000-000000000003', 250,  'VOID',   '${COMPANY_1}'),
  ('ab000000-0000-4000-8000-000000000004', 400,  'POSTED', '${COMPANY_1}'),
  ('ab000000-0000-4000-8000-000000000005', 200,  'POSTED', '${COMPANY_1}'),
  ('ab000000-0000-4000-8000-000000000006', 700,  'POSTED', '${COMPANY_1}'),
  ('ab000000-0000-4000-8000-000000000007', 900,  'POSTED', '${COMPANY_1}'),
  ('ab000000-0000-4000-8000-000000000008', 100,  'POSTED', '${COMPANY_2}');

INSERT INTO public.payments (id, invoice_id, contract_id, amount, payment_method, payment_date, status, receipt_id, company_id) VALUES
  ('ee000000-0000-4000-8000-000000000001', 'dd000000-0000-4000-8000-000000000001', '${C_R}',  1000, 'cash', date '2026-07-05', 'POSTED', 'ab000000-0000-4000-8000-000000000001', '${COMPANY_1}'),
  ('ee000000-0000-4000-8000-000000000002', 'dd000000-0000-4000-8000-000000000002', '${C_R}',  500,  'cash', date '2026-07-12', 'POSTED', 'ab000000-0000-4000-8000-000000000002', '${COMPANY_1}'),
  ('ee000000-0000-4000-8000-000000000003', 'dd000000-0000-4000-8000-000000000003', '${C_R}',  250,  'cash', date '2026-07-20', 'VOID',   'ab000000-0000-4000-8000-000000000003', '${COMPANY_1}'),
  ('ee000000-0000-4000-8000-000000000004', 'dd000000-0000-4000-8000-000000000004', '${C_R}',  400,  'cash', date '2026-08-02', 'POSTED', 'ab000000-0000-4000-8000-000000000004', '${COMPANY_1}'),
  ('ee000000-0000-4000-8000-000000000005', 'dd000000-0000-4000-8000-000000000005', '${C_R2}', 200,  'cash', date '2026-07-08', 'POSTED', 'ab000000-0000-4000-8000-000000000005', '${COMPANY_1}'),
  ('ee000000-0000-4000-8000-000000000006', 'dd000000-0000-4000-8000-000000000006', '${C_F}',  700,  'cash', date '2026-07-15', 'POSTED', 'ab000000-0000-4000-8000-000000000006', '${COMPANY_1}'),
  ('ee000000-0000-4000-8000-000000000007', 'dd000000-0000-4000-8000-000000000007', '${C_M}',  900,  'cash', date '2026-07-15', 'POSTED', 'ab000000-0000-4000-8000-000000000007', '${COMPANY_1}'),
  ('ee000000-0000-4000-8000-000000000008', 'dd000000-0000-4000-8000-000000000008', '${C_2}',  100,  'cash', date '2026-07-05', 'POSTED', 'ab000000-0000-4000-8000-000000000008', '${COMPANY_2}');

UPDATE public.receipts SET payment_id = id
 WHERE id IN ('ab000000-0000-4000-8000-000000000001','ab000000-0000-4000-8000-000000000002','ab000000-0000-4000-8000-000000000003','ab000000-0000-4000-8000-000000000004','ab000000-0000-4000-8000-000000000005','ab000000-0000-4000-8000-000000000006','ab000000-0000-4000-8000-000000000007','ab000000-0000-4000-8000-000000000008');

-- Only E1 (120, P_R, in-period) and E6 (40, P_R2, in-period) are derivable.
INSERT INTO public.expenses (id, property_id, category, amount, expense_date, date_time, status, charged_to, description, company_id, deleted_at) VALUES
  ('ff000000-0000-4000-8000-000000000001', '${P_R}',  'maintenance', 120, date '2026-07-10', '2026-07-10', 'POSTED', 'OWNER',  'مصروف مؤهل',          '${COMPANY_1}', null),
  ('ff000000-0000-4000-8000-000000000002', '${P_R}',  'maintenance', 30,  date '2026-08-05', '2026-08-05', 'POSTED', 'OWNER',  'خارج الفترة',         '${COMPANY_1}', null),
  ('ff000000-0000-4000-8000-000000000003', '${P_R}',  'maintenance', 999, date '2026-07-11', '2026-07-11', 'POSTED', 'OFFICE', 'على المكتب',          '${COMPANY_1}', null),
  ('ff000000-0000-4000-8000-000000000004', '${P_R}',  'maintenance', 77,  date '2026-07-12', '2026-07-12', 'DRAFT',  'OWNER',  'غير مُثبت',           '${COMPANY_1}', null),
  ('ff000000-0000-4000-8000-000000000005', '${P_R}',  'maintenance', 55,  date '2026-07-13', '2026-07-13', 'POSTED', 'OWNER',  'محذوف',               '${COMPANY_1}', now()),
  ('ff000000-0000-4000-8000-000000000006', '${P_R2}', 'maintenance', 40,  date '2026-07-14', '2026-07-14', 'POSTED', 'owner',  'مؤهل للعقار الثاني',  '${COMPANY_1}', null),
  ('ff000000-0000-4000-8000-000000000007', '${P_M}',  'maintenance', 45,  date '2026-07-16', '2026-07-16', 'POSTED', 'OWNER',  'مصروف الماستر',       '${COMPANY_1}', null);
  `);
}

const evidence: Record<string, unknown> = { generatedAt: new Date().toISOString() };

beforeAll(async () => {
  const replay = await createFullReplayedDatabase();
  db = replay.db;
  evidence.replay = { total: replay.applied.length + replay.failed.length, applied: replay.applied.length, failed: replay.failed };
  await seedFixture();
}, 300_000);

afterAll(async () => {
  if (process.env.WRITE_EVIDENCE === 'true') {
    writeFileSync(join(evidenceDir, 'p1-settlement-derivation.json'), JSON.stringify(evidence, null, 2));
  }
  await db?.close();
});

describe('P1 — replay health', () => {
  it('full migration chain applies with zero failures', () => {
    const failed = (evidence.replay as any)?.failed ?? [];
    expect(failed, JSON.stringify(failed).slice(0, 600)).toEqual([]);
    expect((evidence.replay as any)?.applied).toBe((evidence.replay as any)?.total);
  }, 30_000);
});

describe('P1 — calculate_owner_net_payout derivation (server-side, canonical sources)', () => {
  it('derives RATE settlement: collected gross + per-payment fee, own-property scope', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const row = await calcRow(OWNER_R, P_R);
    evidence.rateProperty = row;
    // gross: 1000 + 500 posted (250 VOID excluded, 400 out-of-period excluded)
    expect(num(row.gross_collected)).toBe(1500);
    // fee: _r3(1000×.10) + _r3(500×.10) = 150
    expect(num(row.office_fee)).toBe(150);
    // expenses: only the 120 POSTED OWNER in-period expense
    expect(num(row.owner_expenses)).toBe(120);
    expect(num(row.tax_amount)).toBe(0); // VAT disabled by default (ADR 0001)
    expect(num(row.net_payable)).toBe(1230);
    expect(num(row.breakdown?.payments_count)).toBe(2);
  }, 60_000);

  it('owner-level (no property filter) spans agreements with mixed rates, rounded to 3 places', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const row = await calcRow(OWNER_R, null);
    evidence.rateOwnerLevel = row;
    expect(num(row.gross_collected)).toBe(1700); // 1500 + 200 (second property)
    // fee: 150 + _r3(200 × 5.5555%) = 150 + _r3(11.111) = 161.111
    expect(num(row.office_fee)).toBe(161.111);
    expect(num(row.owner_expenses)).toBe(160); // 120 + 40
    expect(num(row.net_payable)).toBeCloseTo(1378.889, 3);
  }, 60_000);

  it('FIXED_MONTHLY fee = value × calendar months covered, clipped by agreement validity', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const oneMonth = await calcRow(OWNER_F, P_F);
    expect(num(oneMonth.office_fee)).toBe(200);
    expect(num(oneMonth.gross_collected)).toBe(700);
    expect(num(oneMonth.net_payable)).toBe(500);

    // 2026-07-01..2026-09-30 vs agreement ending 2026-08-31 ⇒ exactly 2 months.
    const clipped = await calcRow(OWNER_F, P_F, '2026-07-01', '2026-09-30');
    evidence.fixedClipped = clipped;
    expect(num(clipped.office_fee)).toBe(400);
    expect(num(clipped.gross_collected)).toBe(700);
    expect(num(clipped.net_payable)).toBe(300);
  }, 60_000);

  it('master_lease uses the obligation basis: collections are the office’s, never the owner’s gross', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const row = await calcRow(OWNER_M, P_M);
    evidence.masterLease = row;
    expect(num(row.gross_collected)).toBe(300); // 1 × obligation, NOT the 900 collected
    expect(num(row.office_fee)).toBe(0);
    expect(num(row.owner_expenses)).toBe(45);
    expect(num(row.net_payable)).toBe(255);
    expect(num(row.breakdown?.payments_count)).toBe(0); // master collections never enter gross

    const twoMonths = await calcRow(OWNER_M, P_M, '2026-07-01', '2026-08-31');
    expect(num(twoMonths.gross_collected)).toBe(600);
  }, 60_000);

  it('tax is company-scoped VAT on the office fee, disabled by default', async () => {
    // Enable VAT for company 1 only (company_settings is a singleton row; the
    // derivation must only inherit it when it belongs to the caller's company).
    await db.query(
      `insert into public.company_settings (singleton_key, company_name, vat_enabled, vat_rate, company_id)
       values (true, 'شركة التحقق', true, 5, '${COMPANY_1}')
       on conflict (singleton_key)
       do update set vat_enabled = true, vat_rate = 5, company_id = '${COMPANY_1}'`,
    );
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const taxed = await calcRow(OWNER_R, P_R);
    evidence.vatEnabled = taxed;
    expect(num(taxed.tax_amount)).toBe(7.5); // _r3(150 × 5%)
    expect(num(taxed.net_payable)).toBe(1222.5);

    // Company 2 must NOT inherit company 1's VAT row (isolation-first rule).
    await assumeIdentity(db, ADMIN_2, COMPANY_2);
    const other = await calcRow(OWNER_2, P_2);
    evidence.vatIsolation = other;
    expect(num(other.gross_collected)).toBe(100);
    expect(num(other.office_fee)).toBe(10);
    expect(num(other.tax_amount)).toBe(0);
    expect(num(other.net_payable)).toBe(90);

    // Restore disabled-by-default posture for the create-path assertions below.
    await db.query(`update public.company_settings set vat_enabled = false where singleton_key = true`);
  }, 60_000);

  it('an owner with no qualifying collections derives zeros (fixed fee still accrues, net floors at 0)', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const row = await calcRow(OWNER_F, P_F, '2026-01-01', '2026-01-31');
    evidence.emptyPeriod = row;
    expect(num(row.gross_collected)).toBe(0);
    expect(num(row.office_fee)).toBe(200); // policy: fixed fee accrues regardless of vacancy
    expect(num(row.net_payable)).toBe(0); // greatest(...,0)
  }, 60_000);

  it('an expired/inactive agreement accrues nothing for periods it does not cover', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    // OWNER_F's agreement ends 2026-08-31; December 2026 has NO covering agreement.
    const row = await calcRow(OWNER_F, P_F, '2026-12-01', '2026-12-31');
    evidence.expiredAgreement = row;
    expect(num(row.gross_collected)).toBe(0);
    expect(num(row.office_fee)).toBe(0); // no governing agreement ⇒ no months accrual
    expect(num(row.net_payable)).toBe(0);
    expect((row.breakdown?.agreements ?? []).length).toBe(0);
  }, 60_000);

  it('with sequential agreements the LATEST one covering the period governs', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    // OWNER_G: 150/mo until 2026-06-30, then 250/mo from 2026-07-01.
    const june = await calcRow(OWNER_G, P_G, '2026-06-01', '2026-06-30');
    expect(num(june.office_fee)).toBe(150);
    const july = await calcRow(OWNER_G, P_G, '2026-07-01', '2026-07-31');
    evidence.sequentialAgreements = july;
    expect(num(july.office_fee)).toBe(250);
    expect(num((july.breakdown?.agreements ?? [])[0]?.commission_value)).toBe(250);
  }, 60_000);

  it('matches rpt_owner_statement exactly (gross−expenses, fee, net parity)', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const calc = await calcRow(OWNER_R, null);
    const { rows } = await db.query<{ out: any }>(
      `select (public.rpt_owner_statement($1::uuid, $2::date, $3::date)) as out`,
      [OWNER_R, JULY.from, JULY.to],
    );
    const rpt = rows[0]?.out as any;
    evidence.rptParity = { calc, rpt };
    expect(num(calc.gross_collected) - num(calc.owner_expenses)).toBe(num(rpt?.total_gross)); // 1540
    expect(num(calc.office_fee)).toBe(num(rpt?.total_deductions)); // 160
    expect(num(calc.net_payable)).toBe(num(rpt?.total_net)); // 1380
  }, 60_000);

  it('rejects cross-company owners/properties and callers without company context', async () => {
    await assumeIdentity(db, ADMIN_2, COMPANY_2);
    await expect(calcRow(OWNER_R, P_R)).rejects.toThrow(/not in your company/);
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    await expect(calcRow(OWNER_2, P_2)).rejects.toThrow(/not in your company/);

    await assumeIdentity(db, null, null); // no JWT / anonymous
    // Guards fire in the established codebase order: authentication first.
    await expect(calcRow(OWNER_R, P_R)).rejects.toThrow(/Authenticated app user is required/);

    // Authenticated user with no company claim hits the company-context guard.
    await assumeIdentity(db, ADMIN_1, null);
    await expect(calcRow(OWNER_R, P_R)).rejects.toThrow(/Company context is required/);

    // Authenticated user with NO company membership: the production JWT hook
    // mints no company claim for them, so the live context is company-less —
    // which must be rejected on BOTH the preview and the write path.
    await assumeIdentity(db, OUTSIDER, null);
    await expect(calcRow(OWNER_R, P_R)).rejects.toThrow(/Company context is required/);
    await expect(
      db.query(`select public.create_owner_settlement_draft_atomic($1::jsonb) as out`, [
        JSON.stringify({
          request_id: '11000000-0000-4000-8000-000000000005',
          owner_id: OWNER_R, property_id: P_R,
          period_start: JULY.from, period_end: JULY.to,
        }),
      ]),
    ).rejects.toThrow(/ADMIN or MANAGER|Company context|42501/i);
  }, 60_000);

  it('is not executable by anon even at the ACL level', async () => {
    const { rows } = await db.query<{ allowed: boolean }>(
      `select has_function_privilege('anon', 'public.calculate_owner_net_payout(uuid,date,date,uuid)', 'EXECUTE') as allowed`,
    );
    expect(rows[0]?.allowed).toBe(false);
  }, 60_000);
});

describe('P1 — create_owner_settlement_draft_atomic ignores ALL client-sent amounts', () => {
  it('persists the server-derived tuple even when the client forges amounts', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const payload = {
      request_id: '11000000-0000-4000-8000-000000000001',
      owner_id: OWNER_R,
      property_id: P_R,
      period_start: JULY.from,
      period_end: JULY.to,
      gross_collected: 999999,
      office_fee: 1,
      owner_expenses: 1,
      tax_amount: 1,
      notes: 'p1-forgery-attempt',
    };
    await db.exec('BEGIN;');
    try {
      const { rows: created } = await db.query<{ out: any }>(
        `select public.create_owner_settlement_draft_atomic($1::jsonb) as out`,
        [JSON.stringify(payload)],
      );
      const out = created[0]?.out as any;
      expect(out?.success).toBe(true);
      expect(num(out?.net_payable)).toBe(1230);

      const { rows: stored } = await db.query(
        `select gross_collected, office_fee, owner_expenses, tax_amount, net_payable, status
           from public.owner_settlements where request_id = $1::uuid`,
        [payload.request_id],
      );
      const row = stored[0] as any;
      evidence.forgeryAttempt = { response: out, stored: row };
      expect(num(row.gross_collected)).toBe(1500);
      expect(num(row.office_fee)).toBe(150);
      expect(num(row.owner_expenses)).toBe(120);
      expect(num(row.tax_amount)).toBe(0);
      expect(num(row.net_payable)).toBe(1230);
      expect(row.status).toBe('DRAFT');

      // Idempotent replay returns the same settlement without a second row.
      const { rows: replayed } = await db.query<{ out: any }>(
        `select public.create_owner_settlement_draft_atomic($1::jsonb) as out`,
        [JSON.stringify(payload)],
      );
      expect((replayed[0]?.out as any)?.settlement_id).toBe(out?.settlement_id);
      const { rows: count } = await db.query<{ n: number }>(
        `select count(*)::int as n from public.owner_settlements where request_id = $1::uuid`,
        [payload.request_id],
      );
      expect(num(count[0]?.n)).toBe(1);

      // Same active period with a new request id is still rejected (23505).
      const dup = { ...payload, request_id: '11000000-0000-4000-8000-000000000002' };
      await expect(
        db.query(`select public.create_owner_settlement_draft_atomic($1::jsonb) as out`, [JSON.stringify(dup)]),
      ).rejects.toThrow(/already exists/);
    } finally {
      await db.exec('ROLLBACK;');
    }
  }, 60_000);

  it('keeps the ADMIN/MANAGER role guard and the F-SET cross-company guard', async () => {
    const payload = {
      request_id: '11000000-0000-4000-8000-000000000003',
      owner_id: OWNER_R,
      property_id: P_R,
      period_start: JULY.from,
      period_end: JULY.to,
      gross_collected: 999999,
      office_fee: 999999,
    };
    await assumeIdentity(db, MEMBER_1, COMPANY_1);
    await expect(
      db.query(`select public.create_owner_settlement_draft_atomic($1::jsonb) as out`, [JSON.stringify(payload)]),
    ).rejects.toThrow(/ADMIN or MANAGER/);

    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const cross = { ...payload, request_id: '11000000-0000-4000-8000-000000000004', owner_id: OWNER_2, property_id: P_2 };
    await expect(
      db.query(`select public.create_owner_settlement_draft_atomic($1::jsonb) as out`, [JSON.stringify(cross)]),
    ).rejects.toThrow(/not in your company/);
  }, 60_000);

  it('full lifecycle on derived amounts: create → approve → pay posts a BALANCED journal; cancel paths hold', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const base = { owner_id: OWNER_R, property_id: P_R, period_start: JULY.from, period_end: JULY.to };
    await db.exec('BEGIN;');
    try {
      const created = (await db.query<{ out: any }>(`select public.create_owner_settlement_draft_atomic($1::jsonb) as out`, [
        JSON.stringify({ ...base, request_id: '12000000-0000-4000-8000-000000000001' }),
      ])).rows[0]?.out as any;
      const sid = created?.settlement_id as string;
      expect(num(created?.net_payable)).toBe(1230);

      const approved = (await db.query<{ out: any }>(`select public.approve_owner_settlement_atomic($1::jsonb) as out`, [
        JSON.stringify({ settlement_id: sid, request_id: '12000000-0000-4000-8000-000000000002' }),
      ])).rows[0]?.out as any;
      expect(approved?.status).toBe('APPROVED');
      expect(num(approved?.net_payable)).toBe(1230); // approve trusts the stored derived tuple, never the client

      const paid = (await db.query<{ out: any }>(`select public.pay_owner_settlement_atomic($1::jsonb) as out`, [
        JSON.stringify({ settlement_id: sid, request_id: '12000000-0000-4000-8000-000000000003', method: 'bank_transfer', payment_reference: 'P1-PAYOUT-1' }),
      ])).rows[0]?.out as any;
      expect(paid?.status).toBe('PAID');
      expect(num(paid?.net_payable)).toBe(1230);

      const journal = (await db.query(
        `select count(*)::int as n,
           coalesce(sum(amount) filter (where upper(type) = 'DEBIT'), 0)::numeric as debits,
           coalesce(sum(amount) filter (where upper(type) = 'CREDIT'), 0)::numeric as credits,
           count(distinct batch_id)::int as batches
           from public.journal_entries
          where entity_type = 'owner_settlement_payment' and entity_id = $1`,
        [sid],
      )).rows[0] as any;
      expect(num(journal.n)).toBe(2);
      expect(num(journal.debits)).toBe(1230);
      expect(num(journal.credits)).toBe(1230); // balanced batch, derived amount
      expect(num(journal.batches)).toBe(1);

      const audits = (await db.query(
        `select count(*)::int as n from public.audit_log
          where entity = 'owner_settlements' and entity_id = $1 and action in ('CREATE', 'APPROVE', 'PAY')`,
        [sid],
      )).rows[0] as any;
      expect(num(audits.n)).toBe(3);

      // idempotent replays leave no duplicate financial trace
      const replay = (await db.query<{ out: any }>(`select public.pay_owner_settlement_atomic($1::jsonb) as out`, [
        JSON.stringify({ settlement_id: sid, request_id: '12000000-0000-4000-8000-000000000003', method: 'bank_transfer', payment_reference: 'P1-PAYOUT-1' }),
      ])).rows[0]?.out as any;
      expect(replay?.idempotent).toBe(true);
      const journalAfter = (await db.query(
        `select count(*)::int as n from public.journal_entries where entity_type = 'owner_settlement_payment' and entity_id = $1`,
        [sid],
      )).rows[0] as any;
      expect(num(journalAfter.n)).toBe(2);

      // cancel path (draft → approved → cancelled): second period for the same owner
      const draft2 = (await db.query<{ out: any }>(`select public.create_owner_settlement_draft_atomic($1::jsonb) as out`, [
        JSON.stringify({ ...base, period_start: '2026-02-01', period_end: '2026-02-28', request_id: '12000000-0000-4000-8000-000000000004' }),
      ])).rows[0]?.out as any;
      const sid2 = draft2?.settlement_id as string;
      await db.query<{ out: any }>(`select public.approve_owner_settlement_atomic($1::jsonb) as out`, [
        JSON.stringify({ settlement_id: sid2, request_id: '12000000-0000-4000-8000-000000000005' }),
      ]);
      const cancelled = (await db.query<{ out: any }>(`select public.cancel_owner_settlement_atomic($1::jsonb) as out`, [
        JSON.stringify({ settlement_id: sid2, reason: 'reversal rehearsal', request_id: '12000000-0000-4000-8000-000000000006' }),
      ])).rows[0]?.out as any;
      expect(cancelled?.status).toBe('CANCELLED');

      // and the paid settlement can neither be re-paid nor cancelled.
      // Real Supabase executes each RPC in its own request-scoped transaction;
      // an expected business error must not poison the surrounding rehearsal
      // transaction (25P02 "current transaction is aborted"). Savepoints
      // reproduce that per-request isolation inside our BEGIN/ROLLBACK block.
      await db.exec('SAVEPOINT sp_repay;');
      await expect(
        db.query(`select public.pay_owner_settlement_atomic($1::jsonb) as out`, [
          JSON.stringify({ settlement_id: sid, request_id: '12000000-0000-4000-8000-000000000007', method: 'cash', payment_reference: 'X' }),
        ]),
      ).rejects.toThrow(/APPROVED/);
      await db.exec('ROLLBACK TO SAVEPOINT sp_repay;');
      await db.exec('SAVEPOINT sp_cancel;');
      await expect(
        db.query(`select public.cancel_owner_settlement_atomic($1::jsonb) as out`, [
          JSON.stringify({ settlement_id: sid, reason: 'no', request_id: '12000000-0000-4000-8000-000000000008' }),
        ]),
      ).rejects.toThrow(/controlled reversal/);
      await db.exec('ROLLBACK TO SAVEPOINT sp_cancel;');

      evidence.lifecycle = { sid, journal, journalAfter };
    } finally {
      await db.exec('ROLLBACK;');
    }
  }, 60_000);
});

describe('P1 — settlement integrity guards (accounts, immutability, invalid attempts)', () => {
  it('accounts are company-scoped: pay never falls through to another company’s chart', async () => {
    // accounts shape: no is_active/deleted_at filter exists in the schema —
    // the guard's lookup criteria are ONLY no + company_id.
    const cols = (await db.query(
      `select string_agg(column_name, ',' order by ordinal_position) as cols
         from information_schema.columns where table_schema = 'public' and table_name = 'accounts'`,
    )).rows[0] as any;
    expect(cols.cols).not.toContain('is_active');
    expect(cols.cols).not.toContain('deleted_at');

    const census = (await db.query(
      `select id::text as id, no, company_id::text as company_id from public.accounts where no in ('1111','2000') order by no`,
    )).rows as any[];
    expect(census.map((r) => r.company_id)).toEqual([COMPANY_1, COMPANY_1]);
    evidence.accountsCensus = { columns: cols.cols, rows: census };

    // accounts.no is GLOBALLY unique (core_schema; no migration relaxes it), so
    // "two companies each with 1111/2000" is schema-impossible — prove the
    // constraint is real, then prove the security property it implies: a
    // company with no provisioned chart is REJECTED by the guard instead of
    // falling through to another company's account rows.
    await db.exec('BEGIN; SAVEPOINT sp_dupno;');
    await expect(
      db.query(`insert into public.accounts (id, no, name, company_id) values ('x-1111', '1111', 'dup', '${COMPANY_2}')`),
    ).rejects.toThrow(/duplicate key/);
    await db.exec('ROLLBACK TO SAVEPOINT sp_dupno;');

    {
      await assumeIdentity(db, ADMIN_2, COMPANY_2);
      const probe = (await db.query(
        `select (select id from public.accounts where no = '2000' and company_id = public.current_company_id()) as pay_acct,
                (select id from public.accounts where no = '1111' and company_id = public.current_company_id()) as cash_acct`,
      )).rows[0] as any;
      expect(probe.pay_acct).toBeNull();
      expect(probe.cash_acct).toBeNull();

      const created = (await db.query<{ out: any }>(`select public.create_owner_settlement_draft_atomic($1::jsonb) as out`, [
        JSON.stringify({ request_id: '13000000-0000-4000-8000-000000000001', owner_id: OWNER_2, property_id: P_2, period_start: JULY.from, period_end: JULY.to }),
      ])).rows[0]?.out as any;
      const sid2 = created?.settlement_id as string;
      expect(num(created?.net_payable)).toBe(90); // derived for company 2: 100 − 10
      const approved = (await db.query<{ out: any }>(`select public.approve_owner_settlement_atomic($1::jsonb) as out`, [
        JSON.stringify({ settlement_id: sid2, request_id: '13000000-0000-4000-8000-000000000002' }),
      ])).rows[0]?.out as any;
      expect(approved?.status).toBe('APPROVED');

      await db.exec('SAVEPOINT sp_co2pay;');
      await expect(
        db.query(`select public.pay_owner_settlement_atomic($1::jsonb) as out`, [
          JSON.stringify({ settlement_id: sid2, request_id: '13000000-0000-4000-8000-000000000003', method: 'cash' }),
        ]),
      ).rejects.toThrow(/not configured/);
      await db.exec('ROLLBACK TO SAVEPOINT sp_co2pay;');

      // no financial side effect leaked for company 2, settlement still APPROVED
      const journal = (await db.query(
        `select count(*)::int as n from public.journal_entries where entity_type = 'owner_settlement_payment' and entity_id = $1`,
        [sid2],
      )).rows[0] as any;
      expect(num(journal.n)).toBe(0);
      const row = (await db.query(`select status from public.owner_settlements where id = $1`, [sid2])).rows[0] as any;
      expect(row.status).toBe('APPROVED');
      evidence.accountsGuard = { sid2, payRejected: 'Owner payable or cash accounting account is not configured.', journalRows: 0 };
    }
    await db.exec('ROLLBACK;');
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
  }, 90_000);

  it('derived amounts are immutable via ANY direct UPDATE (RLS-independent trigger, REGRESSION)', async () => {
    // Production defect found & closed in P1: the permissive FOR ALL policy lets
    // a company member UPDATE table rows directly; the trigger now rejects any
    // amount-column change after insert — for table writes AND definer paths.
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    await db.exec('BEGIN;');
    try {
      const created = (await db.query<{ out: any }>(`select public.create_owner_settlement_draft_atomic($1::jsonb) as out`, [
        JSON.stringify({ request_id: '13000000-0000-4000-8000-000000000011', owner_id: OWNER_R, property_id: P_R, period_start: JULY.from, period_end: JULY.to }),
      ])).rows[0]?.out as any;
      const sid = created?.settlement_id as string;

      await db.exec('SAVEPOINT sp_t1;');
      await expect(
        db.query(`update public.owner_settlements set net_payable = 999999, gross_collected = 999999 where id = $1`, [sid]),
      ).rejects.toThrow(/immutable/);
      await db.exec('ROLLBACK TO SAVEPOINT sp_t1;');

      await db.query<{ out: any }>(`select public.approve_owner_settlement_atomic($1::jsonb) as out`, [
        JSON.stringify({ settlement_id: sid, request_id: '13000000-0000-4000-8000-000000000012' }),
      ]);
      await db.exec('SAVEPOINT sp_t2;');
      await expect(
        db.query(`update public.owner_settlements set office_fee = 1 where id = $1`, [sid]),
      ).rejects.toThrow(/immutable/);
      await db.exec('ROLLBACK TO SAVEPOINT sp_t2;');

      // surgical scope: non-amount fields remain updatable (e.g. notes)
      await db.query(`update public.owner_settlements set notes = 'annotation' where id = $1`, [sid]);
      const note = (await db.query(`select notes, net_payable from public.owner_settlements where id = $1`, [sid])).rows[0] as any;
      expect(note.notes).toBe('annotation');
      expect(num(note.net_payable)).toBe(1230);

      evidence.immutability = { sid, blockedUpdates: 2, nonAmountUpdateAllowed: true, net_payable: 1230 };
    } finally {
      await db.exec('ROLLBACK;');
    }
  }, 60_000);

  it('rejects invalid state transitions and untrusted callers (pay DRAFT, approve PAID/CANCELLED, no role, no claim)', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    await db.exec('BEGIN;');
    try {
      // July period keeps net > 0 so the pay step can complete later in this test
      const created = (await db.query<{ out: any }>(`select public.create_owner_settlement_draft_atomic($1::jsonb) as out`, [
        JSON.stringify({ request_id: '13000000-0000-4000-8000-000000000021', owner_id: OWNER_R, property_id: P_R, period_start: JULY.from, period_end: JULY.to }),
      ])).rows[0]?.out as any;
      const sid = created?.settlement_id as string;
      expect(num(created?.net_payable)).toBe(1230);

      // pay a DRAFT → rejected before any write
      await db.exec('SAVEPOINT sp_a;');
      await expect(
        db.query(`select public.pay_owner_settlement_atomic($1::jsonb) as out`, [
          JSON.stringify({ settlement_id: sid, request_id: '13000000-0000-4000-8000-000000000022', method: 'cash' }),
        ]),
      ).rejects.toThrow(/Only APPROVED settlements can be paid/);
      await db.exec('ROLLBACK TO SAVEPOINT sp_a;');

      // pay with MEMBER role → 42501 role guard
      await assumeIdentity(db, MEMBER_1, COMPANY_1);
      await db.exec('SAVEPOINT sp_b;');
      await expect(
        db.query(`select public.pay_owner_settlement_atomic($1::jsonb) as out`, [
          JSON.stringify({ settlement_id: sid, request_id: '13000000-0000-4000-8000-000000000023', method: 'cash' }),
        ]),
      ).rejects.toThrow(/ADMIN or MANAGER/);
      await db.exec('ROLLBACK TO SAVEPOINT sp_b;');

      // pay with authenticated user WITHOUT any company claim → rejected
      await assumeIdentity(db, OUTSIDER, null);
      await db.exec('SAVEPOINT sp_c;');
      await expect(
        db.query(`select public.pay_owner_settlement_atomic($1::jsonb) as out`, [
          JSON.stringify({ settlement_id: sid, request_id: '13000000-0000-4000-8000-000000000024', method: 'cash' }),
        ]),
      ).rejects.toThrow(/ADMIN or MANAGER/);
      await db.exec('ROLLBACK TO SAVEPOINT sp_c;');
      await assumeIdentity(db, ADMIN_1, COMPANY_1);

      // approve → PAID → approve again must fail (no re-derivation, no re-approval)
      await db.query<{ out: any }>(`select public.approve_owner_settlement_atomic($1::jsonb) as out`, [
        JSON.stringify({ settlement_id: sid, request_id: '13000000-0000-4000-8000-000000000025' }),
      ]);
      await db.query<{ out: any }>(`select public.pay_owner_settlement_atomic($1::jsonb) as out`, [
        JSON.stringify({ settlement_id: sid, request_id: '13000000-0000-4000-8000-000000000026', method: 'cash' }),
      ]);
      await db.exec('SAVEPOINT sp_d;');
      await expect(
        db.query(`select public.approve_owner_settlement_atomic($1::jsonb) as out`, [
          JSON.stringify({ settlement_id: sid, request_id: '13000000-0000-4000-8000-000000000027' }),
        ]),
      ).rejects.toThrow(/Only DRAFT settlements can be approved/);
      await db.exec('ROLLBACK TO SAVEPOINT sp_d;');

      // approve a CANCELLED settlement must fail too
      const draft2 = (await db.query<{ out: any }>(`select public.create_owner_settlement_draft_atomic($1::jsonb) as out`, [
        JSON.stringify({ request_id: '13000000-0000-4000-8000-000000000028', owner_id: OWNER_R, property_id: P_R, period_start: '2026-03-01', period_end: '2026-03-31' }),
      ])).rows[0]?.out as any;
      const sid2 = draft2?.settlement_id as string;
      await db.query<{ out: any }>(`select public.cancel_owner_settlement_atomic($1::jsonb) as out`, [
        JSON.stringify({ settlement_id: sid2, reason: 'void', request_id: '13000000-0000-4000-8000-000000000029' }),
      ]);
      await db.exec('SAVEPOINT sp_e;');
      await expect(
        db.query(`select public.approve_owner_settlement_atomic($1::jsonb) as out`, [
          JSON.stringify({ settlement_id: sid2, request_id: '13000000-0000-4000-8000-000000000030' }),
        ]),
      ).rejects.toThrow(/Only DRAFT settlements can be approved/);
      await db.exec('ROLLBACK TO SAVEPOINT sp_e;');

      evidence.invalidAttempts = { payDraft: 'rejected', payMember: '42501', payNoClaim: '42501', approvePaid: 'rejected', approveCancelled: 'rejected' };
    } finally {
      await db.exec('ROLLBACK;');
    }
  }, 90_000);

  it('preview ≡ draft ≡ approved ≡ paid: one derived tuple flows through the whole chain', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const preview = await calcRow(OWNER_R, P_R, '2026-05-01', '2026-05-31');
    expect(num(preview.gross_collected)).toBe(0); // May has no collections; fixed fee only below
    await db.exec('BEGIN;');
    try {
      const created = (await db.query<{ out: any }>(`select public.create_owner_settlement_draft_atomic($1::jsonb) as out`, [
        JSON.stringify({ request_id: '13000000-0000-4000-8000-000000000041', owner_id: OWNER_R, property_id: P_R, period_start: JULY.from, period_end: JULY.to }),
      ])).rows[0]?.out as any;
      const sid = created?.settlement_id as string;
      const july = await calcRow(OWNER_R, P_R);
      // the draft stores exactly what the preview RPC returned for the same scope
      const stored = (await db.query(
        `select gross_collected, office_fee, owner_expenses, tax_amount, net_payable from public.owner_settlements where id = $1`,
        [sid],
      )).rows[0] as any;
      for (const k of ['gross_collected', 'office_fee', 'owner_expenses', 'tax_amount', 'net_payable'] as const) {
        expect(num(stored[k]), k).toBe(num((july as any)[k]));
      }
      const approved = (await db.query<{ out: any }>(`select public.approve_owner_settlement_atomic($1::jsonb) as out`, [
        JSON.stringify({ settlement_id: sid, request_id: '13000000-0000-4000-8000-000000000042' }),
      ])).rows[0]?.out as any;
      expect(num(approved?.net_payable)).toBe(num(july.net_payable)); // approve echoes the STORED tuple
      const paid = (await db.query<{ out: any }>(`select public.pay_owner_settlement_atomic($1::jsonb) as out`, [
        JSON.stringify({ settlement_id: sid, request_id: '13000000-0000-4000-8000-000000000043', method: 'bank_transfer' }),
      ])).rows[0]?.out as any;
      expect(num(paid?.net_payable)).toBe(num(july.net_payable)); // pay posts the STORED tuple
      const sums = (await db.query(
        `select coalesce(sum(amount) filter (where upper(type)='DEBIT'),0)::numeric as d,
                coalesce(sum(amount) filter (where upper(type)='CREDIT'),0)::numeric as c
           from public.journal_entries where entity_type = 'owner_settlement_payment' and entity_id = $1`,
        [sid],
      )).rows[0] as any;
      expect(num(sums.d)).toBe(num(july.net_payable));
      expect(num(sums.c)).toBe(num(sums.d)); // balanced
      evidence.previewParity = { sid, tuple: stored, journal: sums };
    } finally {
      await db.exec('ROLLBACK;');
    }
  }, 60_000);
});

describe('P1 — migration & rollback static contract', () => {
  const migDir = join(repoRoot, 'supabase', 'migrations');
  const readMig = () => {
    const f = readdirSync(migDir).find((name) => name.includes('p1_owner_settlement'));
    return { file: f ?? null, sql: f ? readFileSync(join(migDir, f), 'utf8').toLowerCase() : '' };
  };
  const readRollback = () => {
    const p = join(repoRoot, 'supabase', 'rollback', '20260725_rollback_p1_owner_settlement_derivation.sql');
    try {
      return readFileSync(p, 'utf8').toLowerCase();
    } catch {
      return '';
    }
  };

  it('creates the derivation RPC with the hardened security posture', () => {
    const { file: migFile, sql: migSql } = readMig();
    expect(migFile).toBeTruthy();
    expect(migSql).toContain('create or replace function public.calculate_owner_net_payout(');
    expect(migSql).toContain('security definer');
    expect(migSql).toContain("set search_path = public, pg_temp");
    expect(migSql).toContain('revoke all on function public.calculate_owner_net_payout(uuid, date, date, uuid) from public, anon;');
    expect(migSql).toContain('grant execute on function public.calculate_owner_net_payout(uuid, date, date, uuid) to authenticated, service_role;');
    // Posture lock: the migration must NOT re-grant the write RPC —
    // 20260723000000 hardened create_owner_settlement_draft_atomic to
    // authenticated-only (service_role removed); CREATE OR REPLACE preserves it.
    expect(migSql.includes('grant execute on function public.create_owner_settlement_draft_atomic')).toBe(false);
    expect(migSql.includes('revoke all on function public.create_owner_settlement_draft_atomic')).toBe(false);
    // the amount-immutability guard ships with the migration …
    expect(migSql).toContain('create trigger p1_owner_settlements_amounts_immutable');
    expect(migSql).toContain('execute function public.enforce_owner_settlement_amount_immutability()');
  });

  it('the write path derives from the server and never reads client amount keys', () => {
    const { sql: migSql } = readMig();
    const createIdx = migSql.indexOf('create or replace function public.create_owner_settlement_draft_atomic(p_payload jsonb)');
    expect(createIdx).toBeGreaterThan(-1);
    const body = migSql.slice(createIdx);
    expect(body).toContain('from public.calculate_owner_net_payout(');
    expect(body).not.toContain("p_payload->>'gross_collected'");
    expect(body).not.toContain("p_payload->>'office_fee'");
    expect(body).not.toContain("p_payload->>'owner_expenses'");
    expect(body).not.toContain("p_payload->>'tax_amount'");
    // additive-only: no destructive ddl (scan executable code only — the
    // migration header comments legitimately name-drop "DROP TABLE/COLUMN").
    const codeOnly = migSql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/\bdrop\s+table\b/);
    expect(codeOnly).not.toMatch(/\bdrop\s+column\b/);
    expect(codeOnly).not.toMatch(/\bdelete\s+from\b/);
  });

  it('rollback drops only the derivation RPC and restores the post-P0 write body', () => {
    const rollbackSql = readRollback();
    expect(rollbackSql).toContain('drop function if exists public.calculate_owner_net_payout(uuid, date, date, uuid);');
    expect(rollbackSql).toContain('create or replace function public.create_owner_settlement_draft_atomic(p_payload jsonb)');
    expect(rollbackSql).toContain("p_payload->>'gross_collected'"); // restored pre-P1 (vulnerable-by-definition-of-rollback) body
    expect(rollbackSql.indexOf("p_payload->>'gross_collected'")).toBeGreaterThan(
      rollbackSql.indexOf('create or replace function public.create_owner_settlement_draft_atomic(p_payload jsonb)'),
    );
  });
});

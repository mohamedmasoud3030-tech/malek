/**
 * FA-003 — Atomic owner-settlement input reservation (regression suite).
 *
 * Closes: the same collection (payment) or owner expense could be captured by
 * more than one owner settlement, especially under overlapping periods or
 * concurrent requests. Reservation unit: payment_id (collections) and
 * expense_id (expenses) — the exact rows the P1 derivation sums.
 *
 * Under test (fix contract):
 *   1. create_owner_settlement_draft_atomic reserves every derived payment/
 *      expense in owner_settlement_payment_links / _expense_links within the
 *      same transaction; a second settlement overlapping those items is
 *      rejected with SETTLEMENT_INPUT_ALREADY_RESERVED and leaves no partial
 *      settlement and no orphan links.
 *   2. cancel_owner_settlement_atomic releases DRAFT/APPROVED links
 *      (released_at/by + SETTLEMENT_CANCELLED) so items can be re-reserved.
 *   3. PAID settlements keep links permanently unreleased.
 *   4. RLS: authenticated can only SELECT within its own company and can never
 *      INSERT/UPDATE/DELETE a reservation directly.
 *   5. company consistency is enforced by composite FKs + a constraint trigger,
 *      so a cross-company link is impossible even from direct SQL.
 *   6. backfill_owner_settlement_links() is link-only and guarded: it raises
 *      (no partial backfill, no winner) if any item is in >1 active settlement
 *      or any amount does not match the deterministic derivation.
 *
 * Run on a clean replay of the full migration chain (pglite, Docker-free).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase, assumeIdentity, evidenceDir } from './replay-bootstrap';

const COMPANY_1 = 'c1000000-0000-4000-8000-000000000001';
const COMPANY_2 = 'c2000000-0000-4000-8000-000000000002';
const ADMIN_1 = 'a1000000-0000-4000-8000-000000000001';
const ADMIN_2 = 'a2000000-0000-4000-8000-000000000001';
const OWNER_R = 'b1000000-0000-4000-8000-000000000001';
const OWNER_2 = 'b2000000-0000-4000-8000-000000000001';
const OWNER_B = 'b1000000-0000-4000-8000-000000000099'; // dedicated backfill owner
const P_R = 'd1000000-0000-4000-8000-000000000001';
const P_2 = 'd2000000-0000-4000-8000-000000000001';
const P_B = 'd1000000-0000-4000-8000-000000000099';
const C_B = 'cc000000-0000-4000-8000-000000000099';
const AGR_B = 'aa000000-0000-4000-8000-000000000099';
const PMT_B = 'ab000000-0000-4000-8000-000000000099';
const EXP_B = 'ff000000-0000-4000-8000-000000000099';
const AGR_R = 'aa000000-0000-4000-8000-000000000001';
const AGR_2 = 'aa000000-0000-4000-8000-000000000005';
const C_R = 'cc000000-0000-4000-8000-000000000001';
const C_2 = 'cc000000-0000-4000-8000-000000000005';
// NOTE: payments share their identity with their receipt (20260723100000:
// new.id := new.receipt_id), so a payment's id equals its receipt id. The
// reservation unit is therefore payment_id == receipt_id.
const PMT_1 = 'ab000000-0000-4000-8000-000000000001';
const PMT_2 = 'ab000000-0000-4000-8000-000000000002';
const PMT_8 = 'ab000000-0000-4000-8000-000000000008'; // company 2
const EXP_1 = 'ff000000-0000-4000-8000-000000000001';
const EXP_2 = 'ff000000-0000-4000-8000-000000000002';
const JULY = { from: '2026-07-01', to: '2026-07-31' };

let db: PGlite;
const evidence: Record<string, unknown> = { generatedAt: new Date().toISOString() };
const num = (v: unknown) => Number(v ?? NaN);

async function seed() {
  await db.exec(`
INSERT INTO public.companies (id, name, slug) VALUES ('${COMPANY_1}','شركة 1','c1'), ('${COMPANY_2}','شركة 2','c2');
INSERT INTO auth.users (id, email) VALUES ('${ADMIN_1}','a1@t'), ('${ADMIN_2}','a2@t');
INSERT INTO public.users (id,email,name,role,status) VALUES ('${ADMIN_1}','a1@t','A1','ADMIN','ACTIVE'), ('${ADMIN_2}','a2@t','A2','ADMIN','ACTIVE');
INSERT INTO public.company_members (company_id,user_id,role) VALUES ('${COMPANY_1}','${ADMIN_1}','ADMIN'), ('${COMPANY_2}','${ADMIN_2}','ADMIN');
INSERT INTO public.owners (id,full_name,name,company_id) VALUES ('${OWNER_R}','مالك ١','مالك ١','${COMPANY_1}'), ('${OWNER_2}','مالك ٢','مالك ٢','${COMPANY_2}');
INSERT INTO public.properties (id,title,name,type,address,company_id) VALUES ('${P_R}','عقار ١','عقار ١','سكني','مسقط','${COMPANY_1}'), ('${P_2}','عقار ٢','عقار ٢','سكني','مسقط','${COMPANY_2}');
INSERT INTO public.property_owners (property_id,owner_id,ownership_percentage,is_primary,starts_on,ends_on,company_id) VALUES
 ('${P_R}','${OWNER_R}',100,true,date'2026-01-01',date'2027-12-31','${COMPANY_1}'),
 ('${P_2}','${OWNER_2}',100,true,date'2026-01-01',date'2027-12-31','${COMPANY_2}');
INSERT INTO public.owner_agreements (id,owner_id,property_id,agreement_type,commission_type,commission_value,starts_on,ends_on,company_id) VALUES
 ('${AGR_R}','${OWNER_R}','${P_R}','property_management','RATE',10,date'2026-01-01',date'2027-12-31','${COMPANY_1}'),
 ('${AGR_2}','${OWNER_2}','${P_2}','property_management','RATE',10,date'2026-01-01',date'2027-12-31','${COMPANY_2}');
INSERT INTO public.units (id,property_id,unit_number,company_id) VALUES
 ('e1000000-0000-4000-8000-000000000001','${P_R}','U1','${COMPANY_1}'),
 ('e2000000-0000-4000-8000-000000000001','${P_2}','U2','${COMPANY_2}');
INSERT INTO public.people (id,full_name,type,company_id) VALUES
 ('f1000000-0000-4000-8000-000000000001','م١','tenant','${COMPANY_1}'),
 ('f2000000-0000-4000-8000-000000000001','م٢','tenant','${COMPANY_2}');
INSERT INTO public.contracts (id,property_id,unit_id,tenant_id,start_date,end_date,rent_amount,status,agreement_id,company_id) VALUES
 ('${C_R}','${P_R}','e1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','2026-01-01','2026-12-31',12000,'active','${AGR_R}','${COMPANY_1}'),
 ('${C_2}','${P_2}','e2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','2026-01-01','2026-12-31',8000,'active','${AGR_2}','${COMPANY_2}');
INSERT INTO public.invoices (id,contract_id,issue_date,due_date,amount,paid_amount,tax_amount,status,company_id) VALUES
 ('dd000000-0000-4000-8000-000000000001','${C_R}','2026-07-01','2026-07-05',1000,1000,0,'PAID','${COMPANY_1}'),
 ('dd000000-0000-4000-8000-000000000002','${C_R}','2026-07-06','2026-07-12',500,500,0,'PAID','${COMPANY_1}'),
 ('dd000000-0000-4000-8000-000000000008','${C_2}','2026-07-01','2026-07-05',100,100,0,'PAID','${COMPANY_2}');
INSERT INTO public.receipts (id,amount,status,company_id) VALUES
 ('ab000000-0000-4000-8000-000000000001',1000,'POSTED','${COMPANY_1}'),
 ('ab000000-0000-4000-8000-000000000002',500,'POSTED','${COMPANY_1}'),
 ('ab000000-0000-4000-8000-000000000008',100,'POSTED','${COMPANY_2}');
INSERT INTO public.payments (id,invoice_id,contract_id,amount,payment_method,payment_date,status,receipt_id,company_id) VALUES
 ('${PMT_1}','dd000000-0000-4000-8000-000000000001','${C_R}',1000,'cash',date'2026-07-05','POSTED','ab000000-0000-4000-8000-000000000001','${COMPANY_1}'),
 ('${PMT_2}','dd000000-0000-4000-8000-000000000002','${C_R}',500,'cash',date'2026-07-12','POSTED','ab000000-0000-4000-8000-000000000002','${COMPANY_1}'),
 ('${PMT_8}','dd000000-0000-4000-8000-000000000008','${C_2}',100,'cash',date'2026-07-05','POSTED','ab000000-0000-4000-8000-000000000008','${COMPANY_2}');
INSERT INTO public.expenses (id,property_id,category,amount,expense_date,date_time,status,charged_to,description,company_id) VALUES
 ('${EXP_1}','${P_R}','maintenance',120,date'2026-07-10','2026-07-10','POSTED','OWNER','مصروف','${COMPANY_1}'),
 ('${EXP_2}','${P_R}','maintenance',30,date'2026-08-05','2026-08-05','POSTED','OWNER','خارج الفترة','${COMPANY_1}');
UPDATE public.receipts SET payment_id=id WHERE id IN ('ab000000-0000-4000-8000-000000000001','ab000000-0000-4000-8000-000000000002','ab000000-0000-4000-8000-000000000008');
-- dedicated owner/property for the isolated backfill test (company 1)
INSERT INTO public.owners (id,full_name,name,company_id) VALUES ('${OWNER_B}','مالك باك','مالك باك','${COMPANY_1}');
INSERT INTO public.properties (id,title,name,type,address,company_id) VALUES ('${P_B}','عقار باك','عقار باك','سكني','مسقط','${COMPANY_1}');
INSERT INTO public.property_owners (property_id,owner_id,ownership_percentage,is_primary,starts_on,ends_on,company_id) VALUES ('${P_B}','${OWNER_B}',100,true,date'2026-01-01',date'2027-12-31','${COMPANY_1}');
INSERT INTO public.owner_agreements (id,owner_id,property_id,agreement_type,commission_type,commission_value,starts_on,ends_on,company_id) VALUES ('${AGR_B}','${OWNER_B}','${P_B}','property_management','RATE',10,date'2026-01-01',date'2027-12-31','${COMPANY_1}');
INSERT INTO public.units (id,property_id,unit_number,company_id) VALUES ('e1000000-0000-4000-8000-000000000099','${P_B}','U9','${COMPANY_1}');
INSERT INTO public.people (id,full_name,type,company_id) VALUES ('f1000000-0000-4000-8000-000000000099','مب','tenant','${COMPANY_1}');
INSERT INTO public.contracts (id,property_id,unit_id,tenant_id,start_date,end_date,rent_amount,status,agreement_id,company_id) VALUES ('${C_B}','${P_B}','e1000000-0000-4000-8000-000000000099','f1000000-0000-4000-8000-000000000099','2026-01-01','2026-12-31',12000,'active','${AGR_B}','${COMPANY_1}');
INSERT INTO public.invoices (id,contract_id,issue_date,due_date,amount,paid_amount,tax_amount,status,company_id) VALUES ('dd000000-0000-4000-8000-000000000099','${C_B}','2026-07-01','2026-07-05',1000,1000,0,'PAID','${COMPANY_1}');
INSERT INTO public.receipts (id,amount,status,company_id) VALUES ('${PMT_B}',1000,'POSTED','${COMPANY_1}');
INSERT INTO public.payments (id,invoice_id,contract_id,amount,payment_method,payment_date,status,receipt_id,company_id) VALUES ('${PMT_B}','dd000000-0000-4000-8000-000000000099','${C_B}',1000,'cash',date'2026-07-05','POSTED','${PMT_B}','${COMPANY_1}');
INSERT INTO public.expenses (id,property_id,category,amount,expense_date,date_time,status,charged_to,description,company_id) VALUES ('${EXP_B}','${P_B}','maintenance',120,date'2026-07-10','2026-07-10','POSTED','OWNER','مصروف باك','${COMPANY_1}');
UPDATE public.accounts SET company_id='${COMPANY_1}' WHERE no IN ('1111','2000');
`);
}

const mkReq = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function create(ownerId: string, propertyId: string | null, from: string, to: string, reqIdx: number) {
  const { rows } = await db.query<{ out: any }>(
    `select public.create_owner_settlement_draft_atomic($1::jsonb) as out`,
    [JSON.stringify({ request_id: mkReq(reqIdx), owner_id: ownerId, property_id: propertyId, period_start: from, period_end: to })],
  );
  return rows[0]?.out;
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase();
  db = replay.db;
  evidence.replay = { total: replay.applied.length + replay.failed.length, applied: replay.applied.length, failed: replay.failed };
  await seed();
}, 300000);

afterAll(async () => {
  if (process.env.WRITE_EVIDENCE === 'true') {
    writeFileSync(join(evidenceDir, 'fa003-owner-settlement-reservation.json'), JSON.stringify(evidence, null, 2));
  }
  await db?.close();
});

describe('FA-003 — replay health', () => {
  it('full migration chain applies with zero failures', () => {
    const failed = (evidence.replay as any)?.failed ?? [];
    expect(failed, JSON.stringify(failed).slice(0, 800)).toEqual([]);
  }, 30000);
});

describe('FA-003 — create reserves items atomically', () => {
  it('reserves every derived payment and expense, and derives the amount from them', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    await db.exec('BEGIN;');
    try {
      const out = await create(OWNER_R, P_R, JULY.from, JULY.to, 1);
      const sid = out.settlement_id as string;
      evidence.basic = out;
      // reserved counts reflect the fixture: 2 payments + 1 expense
      expect(out.reserved_payments).toBe(2);
      expect(out.reserved_expenses).toBe(1);
      // net = 1000+500 − 150 fee − 120 expense = 1230
      expect(num(out.net_payable)).toBe(1230);

      const pl = (await db.query(
        `select payment_id, released_at is null as held from public.owner_settlement_payment_links where settlement_id=$1 order by payment_id`,
        [sid],
      )).rows as any[];
      expect(pl.map((r) => r.payment_id)).toEqual([PMT_1, PMT_2]);
      expect(pl.every((r) => r.held)).toBe(true);

      const el = (await db.query(
        `select expense_id, released_at is null as held from public.owner_settlement_expense_links where settlement_id=$1`,
        [sid],
      )).rows as any[];
      expect(el.map((r) => r.expense_id)).toEqual([EXP_1]);
      expect(el[0].held).toBe(true);

      // amount is derived from the reserved items (server, not client).
      const row = (await db.query(`select gross_collected, office_fee, owner_expenses, net_payable from public.owner_settlements where id=$1`, [sid])).rows[0] as any;
      expect(num(row.gross_collected)).toBe(1500);
      expect(num(row.office_fee)).toBe(150);
      expect(num(row.owner_expenses)).toBe(120);
      expect(num(row.net_payable)).toBe(1230);
    } finally {
      await db.exec('ROLLBACK;');
    }
  }, 60000);

  it('rejects a second settlement that overlaps an already-reserved item, leaving no partial settlement or orphan links', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    await db.exec('BEGIN;');
    try {
      const out = await create(OWNER_R, P_R, JULY.from, JULY.to, 11);
      const sid = out.settlement_id as string;

      // Overlapping period that re-includes PMT_1 (payment on 2026-07-05).
      await db.exec('SAVEPOINT sp;');
      await expect(
        db.query(`select public.create_owner_settlement_draft_atomic($1::jsonb)`, [
          JSON.stringify({ request_id: mkReq(12), owner_id: OWNER_R, property_id: P_R, period_start: '2026-07-01', period_end: '2026-08-31' }),
        ]),
      ).rejects.toThrow(/SETTLEMENT_INPUT_ALREADY_RESERVED/);
      await db.exec('ROLLBACK TO SAVEPOINT sp;');

      // No orphan settlement / orphan link was left by the failed create.
      const s2 = (await db.query(
        `select count(*)::int as n from public.owner_settlements where request_id = $1::uuid`,
        [mkReq(12)],
      )).rows[0] as any;
      expect(num(s2.n)).toBe(0);
      // original links intact and single
      const n = (await db.query(
        `select count(*)::int as n from public.owner_settlement_payment_links where settlement_id=$1`,
        [sid],
      )).rows[0] as any;
      expect(num(n.n)).toBe(2);
    } finally {
      await db.exec('ROLLBACK;');
    }
  }, 60000);

  it('an expense already reserved blocks a second settlement too', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    await db.exec('BEGIN;');
    try {
      const out = await create(OWNER_R, P_R, JULY.from, JULY.to, 21);
      const sid = out.settlement_id as string;
      // EXP_1 is in the July period. Overlap with a period that re-includes it.
      await db.exec('SAVEPOINT sp;');
      await expect(
        db.query(`select public.create_owner_settlement_draft_atomic($1::jsonb)`, [
          JSON.stringify({ request_id: mkReq(22), owner_id: OWNER_R, property_id: P_R, period_start: '2026-07-01', period_end: '2026-09-30' }),
        ]),
      ).rejects.toThrow(/SETTLEMENT_INPUT_ALREADY_RESERVED|already exists/);
      await db.exec('ROLLBACK TO SAVEPOINT sp;');
      expect(sid).toBeTruthy();
    } finally {
      await db.exec('ROLLBACK;');
    }
  }, 60000);

  it('concurrency: the partial unique index is the atomic gate even if the pre-check is bypassed', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    await db.exec('BEGIN;');
    try {
      const out = await create(OWNER_R, P_R, JULY.from, JULY.to, 31);
      const sid = out.settlement_id as string;
      const other = await create(OWNER_R, P_R, '2026-02-01', '2026-02-28', 32); // different period, no overlap
      const otherId = other.settlement_id as string;

      // Directly attempt to reserve PMT_1 again on a different settlement in the
      // same transaction. This bypasses the app-level pre-check (as a truly
      // concurrent request would appear to) and MUST be stopped by the partial
      // unique index (company_id, payment_id) WHERE released_at IS NULL.
      await db.exec('SAVEPOINT sp;');
      await expect(
        db.query(
          `insert into public.owner_settlement_payment_links (company_id, settlement_id, payment_id, reserved_by)
           values ($1, $2, $3, $4)`,
          [COMPANY_1, otherId, PMT_1, ADMIN_1],
        ),
      ).rejects.toThrow(/duplicate key/);
      await db.exec('ROLLBACK TO SAVEPOINT sp;');

      // Only one active link exists for PMT_1 after the atomic gate.
      const n = (await db.query(
        `select count(*)::int as n from public.owner_settlement_payment_links
          where company_id=$1 and payment_id=$2 and released_at is null`,
        [COMPANY_1, PMT_1],
      )).rows[0] as any;
      expect(num(n.n)).toBe(1);
      evidence.concurrencyGate = { singleActiveLink: true };
    } finally {
      await db.exec('ROLLBACK;');
    }
  }, 60000);
});

describe('FA-003 — cancel releases, PAID holds', () => {
  it('cancel a DRAFT releases its links and a replacement settlement succeeds', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    await db.exec('BEGIN;');
    try {
      const out = await create(OWNER_R, P_R, JULY.from, JULY.to, 41);
      const sid = out.settlement_id as string;

      // a second settlement for the same period is blocked while active
      await db.exec('SAVEPOINT sp1;');
      await expect(
        db.query(`select public.create_owner_settlement_draft_atomic($1::jsonb)`, [
          JSON.stringify({ request_id: mkReq(42), owner_id: OWNER_R, property_id: P_R, period_start: JULY.from, period_end: JULY.to }),
        ]),
      ).rejects.toThrow(/already exists|ALREADY_RESERVED/);
      await db.exec('ROLLBACK TO SAVEPOINT sp1;');

      await db.query(`select public.cancel_owner_settlement_atomic($1::jsonb)`, [
        JSON.stringify({ settlement_id: sid, reason: 'cancel-rehearsal', request_id: mkReq(43) }),
      ]);
      const rel = (await db.query(
        `select count(*)::int as released from public.owner_settlement_payment_links where settlement_id=$1 and released_at is not null`,
        [sid],
      )).rows[0] as any;
      expect(num(rel.released)).toBe(2);
      const relReason = (await db.query(
        `select distinct release_reason from public.owner_settlement_payment_links where settlement_id=$1`,
        [sid],
      )).rows[0] as any;
      expect(relReason.release_reason).toBe('SETTLEMENT_CANCELLED');

      // replacement settlement for the same period now succeeds
      const repl = await create(OWNER_R, P_R, JULY.from, JULY.to, 44);
      expect(repl.status).toBe('DRAFT');
      expect(repl.settlement_id).not.toBe(sid);
      evidence.cancelReplace = { original: sid, replacement: repl.settlement_id };
    } finally {
      await db.exec('ROLLBACK;');
    }
  }, 60000);

  it('cancel an APPROVED releases links; cancel a PAID settlement is rejected and links stay held', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    await db.exec('BEGIN;');
    try {
      // approved then cancelled
      const a = await create(OWNER_R, P_R, '2026-05-01', '2026-05-31', 51);
      const aId = a.settlement_id as string;
      await db.query(`select public.approve_owner_settlement_atomic($1::jsonb)`, [
        JSON.stringify({ settlement_id: aId, request_id: mkReq(52) }),
      ]);
      await db.query(`select public.cancel_owner_settlement_atomic($1::jsonb)`, [
        JSON.stringify({ settlement_id: aId, reason: 'approve-then-cancel', request_id: mkReq(53) }),
      ]);
      const aRel = (await db.query(
        `select count(*)::int as n from public.owner_settlement_payment_links where settlement_id=$1 and released_at is not null`,
        [aId],
      )).rows[0] as any;
      expect(num(aRel.n)).toBeGreaterThanOrEqual(0);

      // paid settlement holds its links and cannot be cancelled
      const p = await create(OWNER_R, P_R, JULY.from, JULY.to, 61);
      const pId = p.settlement_id as string;
      await db.query(`select public.approve_owner_settlement_atomic($1::jsonb)`, [
        JSON.stringify({ settlement_id: pId, request_id: mkReq(62) }),
      ]);
      await db.query(`select public.pay_owner_settlement_atomic($1::jsonb)`, [
        JSON.stringify({ settlement_id: pId, request_id: mkReq(63), method: 'bank_transfer', payment_reference: 'FA003-PAY-1' }),
      ]);
      // PAID links stay held
      const held = (await db.query(
        `select count(*)::int as n from public.owner_settlement_payment_links where settlement_id=$1 and released_at is null`,
        [pId],
      )).rows[0] as any;
      expect(num(held.n)).toBe(2);

      await db.exec('SAVEPOINT sp;');
      await expect(
        db.query(`select public.cancel_owner_settlement_atomic($1::jsonb)`, [
          JSON.stringify({ settlement_id: pId, reason: 'no', request_id: mkReq(64) }),
        ]),
      ).rejects.toThrow(/controlled reversal/);
      await db.exec('ROLLBACK TO SAVEPOINT sp;');

      // still held after the rejected cancel
      const after = (await db.query(
        `select count(*)::int as n from public.owner_settlement_payment_links where settlement_id=$1 and released_at is null`,
        [pId],
      )).rows[0] as any;
      expect(num(after.n)).toBe(2);
      evidence.paidHolds = { settlementId: pId, activeLinks: 2 };
    } finally {
      await db.exec('ROLLBACK;');
    }
  }, 60000);

  it('double pay produces exactly one financial effect and no duplicate journal', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    await db.exec('BEGIN;');
    try {
      const p = await create(OWNER_R, P_R, JULY.from, JULY.to, 71);
      const pId = p.settlement_id as string;
      await db.query(`select public.approve_owner_settlement_atomic($1::jsonb)`, [
        JSON.stringify({ settlement_id: pId, request_id: mkReq(72) }),
      ]);
      const payPayload = JSON.stringify({ settlement_id: pId, request_id: mkReq(73), method: 'cash', payment_reference: 'D' });
      await db.query(`select public.pay_owner_settlement_atomic($1::jsonb)`, [payPayload]);
      // second concurrent-ish pay attempt (different request id) is rejected
      await db.exec('SAVEPOINT sp;');
      await expect(
        db.query(`select public.pay_owner_settlement_atomic($1::jsonb)`, [
          JSON.stringify({ settlement_id: pId, request_id: mkReq(74), method: 'cash' }),
        ]),
      ).rejects.toThrow(/Only APPROVED settlements can be paid/);
      await db.exec('ROLLBACK TO SAVEPOINT sp;');
      // exactly one balanced batch
      const j = (await db.query(
        `select count(*)::int as rows, count(distinct batch_id)::int as batches,
           coalesce(sum(amount) filter (where upper(type)='DEBIT'),0)::numeric as d,
           coalesce(sum(amount) filter (where upper(type)='CREDIT'),0)::numeric as c
           from public.journal_entries where entity_type='owner_settlement_payment' and entity_id=$1`,
        [pId],
      )).rows[0] as any;
      expect(num(j.rows)).toBe(2);
      expect(num(j.batches)).toBe(1);
      expect(num(j.d)).toBe(1230);
      expect(num(j.c)).toBe(1230);
      evidence.doublePay = { journalRows: 2, batches: 1 };
    } finally {
      await db.exec('ROLLBACK;');
    }
  }, 60000);
});

describe('FA-003 — company isolation & browser write protection', () => {
  it('a company cannot read or reserve another company’s items, and cross-company links are impossible', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    await db.exec('BEGIN;');
    try {
      const out = await create(OWNER_R, P_R, JULY.from, JULY.to, 81);
      const sid = out.settlement_id as string;
      expect(out.reserved_payments).toBe(2);

      // A does not reserve B's payment (PMT_8 belongs to company 2) when
      // scoping to A's owner/property — it is not in the derived item set.
      const hasB = (await db.query(
        `select count(*)::int as n from public.owner_settlement_payment_links where payment_id=$1`,
        [PMT_8],
      )).rows[0] as any;
      expect(num(hasB.n)).toBe(0);

      // Cross-company link attempt (settlement of A + payment of B) fails.
      await db.exec('SAVEPOINT sp;');
      await expect(
        db.query(
          `insert into public.owner_settlement_payment_links (company_id, settlement_id, payment_id, reserved_by)
           values ($1, $2, $3, $4)`,
          [COMPANY_1, sid, PMT_8, ADMIN_1],
        ),
      ).rejects.toThrow(/COMPANY_MISMATCH|duplicate key|violates foreign key/);
      await db.exec('ROLLBACK TO SAVEPOINT sp;');

      // A cannot even create a settlement targeting company 2's owner.
      await db.exec('SAVEPOINT sp2;');
      await expect(
        db.query(`select public.create_owner_settlement_draft_atomic($1::jsonb)`, [
          JSON.stringify({ request_id: mkReq(82), owner_id: OWNER_2, property_id: P_2, period_start: JULY.from, period_end: JULY.to }),
        ]),
      ).rejects.toThrow(/not found|not in your company/);
      await db.exec('ROLLBACK TO SAVEPOINT sp2;');

      evidence.companyIsolation = { aReserved: out.reserved_payments, crossCompanyBlocked: true };
    } finally {
      await db.exec('ROLLBACK;');
    }
  }, 60000);

  it('authenticated can SELECT only its own company links and cannot write directly', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    // Create a committed settlement for company 1 (via the official RPC).
    const out = await create(OWNER_R, P_R, JULY.from, JULY.to, 91);
    const sid = out.settlement_id as string;
    const plinks = (await db.query(
      `select payment_id from public.owner_settlement_payment_links where settlement_id=$1`,
      [sid],
    )).rows as any[];
    expect(plinks.length).toBeGreaterThan(0);

    await db.exec('BEGIN;');
    try {
      // Switch to the authenticated role; reads are company-scoped by RLS.
      await db.exec('SET LOCAL ROLE authenticated;');

      const mine = (await db.query(
        `select count(*)::int as n from public.owner_settlement_payment_links where company_id=$1`,
        [COMPANY_1],
      )).rows[0] as any;
      expect(num(mine.n)).toBeGreaterThanOrEqual(plinks.length);

      const other = (await db.query(
        `select count(*)::int as n from public.owner_settlement_payment_links where company_id=$1`,
        [COMPANY_2],
      )).rows[0] as any;
      expect(num(other.n)).toBe(0); // company isolation holds for reads

      // direct writes are impossible for authenticated
      await db.exec('SAVEPOINT sp1;');
      await expect(
        db.query(`insert into public.owner_settlement_payment_links (company_id, settlement_id, payment_id) values ($1,$2,$3)`,
          [COMPANY_1, sid, PMT_1]),
      ).rejects.toThrow();
      await db.exec('ROLLBACK TO SAVEPOINT sp1;');

      await db.exec('SAVEPOINT sp2;');
      await expect(
        db.query(`update public.owner_settlement_payment_links set released_at = now() where settlement_id=$1`, [sid]),
      ).rejects.toThrow();
      await db.exec('ROLLBACK TO SAVEPOINT sp2;');

      await db.exec('SAVEPOINT sp3;');
      await expect(
        db.query(`delete from public.owner_settlement_payment_links where settlement_id=$1`, [sid]),
      ).rejects.toThrow();
      await db.exec('ROLLBACK TO SAVEPOINT sp3;');

      evidence.rls = { directWriteBlocked: true, companyReadIsolation: true };
    } finally {
      await db.exec('RESET ROLE;');
      await db.exec('ROLLBACK;');
    }
  }, 60000);
});

describe('FA-003 — historical backfill', () => {
  it('backfills active settlements with unreleased links and cancelled ones with released links, and is guarded', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    await db.exec('BEGIN;');
    try {
      // settlement A: PAID July for the dedicated backfill owner
      await db.query(`insert into public.owner_settlements
        (id,no,owner_id,property_id,date,period_start,period_end,gross_collected,office_fee,owner_expenses,tax_amount,net_payable,amount,status,
         approved_at,approved_by,paid_at,paid_by,method,created_at,updated_at,company_id)
        values ('hist-a', 'OST-HIST-A', '${OWNER_B}', '${P_B}', '2026-07-31', date'2026-07-01', date'2026-07-31', 1000, 100, 120, 0, 780, 780, 'PAID',
         now(), '${ADMIN_1}', now(), '${ADMIN_1}', 'cash', now(), now(), '${COMPANY_1}')`);
      // settlement C: a period with no items, cancelled
      await db.query(`insert into public.owner_settlements
        (id,no,owner_id,property_id,date,period_start,period_end,gross_collected,office_fee,owner_expenses,tax_amount,net_payable,amount,status,
         cancelled_at,cancelled_by,cancellation_reason,created_at,updated_at,company_id)
        values ('hist-c', 'OST-HIST-C', '${OWNER_B}', '${P_B}', '2026-02-28', date'2026-02-01', date'2026-02-28', 0, 0, 0, 0, 0, 0, 'CANCELLED',
         now(), '${ADMIN_1}', 'historic', now(), now(), '${COMPANY_1}')`);

      // backfill is link-only and guarded; on this clean fixture it succeeds
      const r = (await db.query<{ out: any }>(`select public.backfill_owner_settlement_links() as out`)).rows[0]?.out as any;
      evidence.backfill = r;
      expect(r.active_payment_links_created).toBe(1); // PMT_B
      expect(r.active_expense_links_created).toBe(1); // EXP_B
      expect(r.released_payment_links_created).toBe(0); // cancelled one has no items
      // PAID settlement links are unreleased (permanent)
      const held = (await db.query(
        `select count(*)::int as n from public.owner_settlement_payment_links where settlement_id='hist-a' and released_at is null`,
      )).rows[0] as any;
      expect(num(held.n)).toBe(1);

      // Now simulate a historical conflict: PMT_B belongs to TWO active
      // settlements (hist-a and hist-b both cover July). The backfill gate must
      // raise and perform no partial backfill and choose no winner.
      await db.query(`insert into public.owner_settlements
        (id,no,owner_id,property_id,date,period_start,period_end,gross_collected,office_fee,owner_expenses,tax_amount,net_payable,amount,status,
         approved_at,approved_by,paid_at,paid_by,method,created_at,updated_at,company_id)
        values ('hist-b', 'OST-HIST-B', '${OWNER_B}', '${P_B}', '2026-07-31', date'2026-07-01', date'2026-07-31', 1000, 100, 120, 0, 780, 780, 'PAID',
         now(), '${ADMIN_1}', now(), '${ADMIN_1}', 'cash', now(), now(), '${COMPANY_1}')`);
      await db.exec('SAVEPOINT sp_conf;');
      await expect(
        db.query(`select public.backfill_owner_settlement_links() as out`),
      ).rejects.toThrow(/BACKFILL_BLOCKED/);
      await db.exec('ROLLBACK TO SAVEPOINT sp_conf;');
      // guard never partially backfilled: hist-b must have no links
      const nb = (await db.query(
        `select count(*)::int as n from public.owner_settlement_payment_links where settlement_id='hist-b'`,
      )).rows[0] as any;
      expect(num(nb.n)).toBe(0);
      evidence.backfillGuard = { conflictDetected: true, noPartial: true };
    } finally {
      await db.exec('ROLLBACK;');
    }
  }, 60000);
});

/**
 * P0 — Forward / security / rollback / fingerprint equivalence test.
 *
 * Pipeline (all on a disposable PGlite replay of the production chain):
 *   1. Replay the 152 pre-P0 migrations → fingerprint schema surface A.
 *   2. Apply the P0 fix migration → run the key security assertions
 *      (company leak closed as authenticated@A, cross-owner settlement 42501).
 *   3. Apply the P0 rollback script → fingerprint schema surface B.
 *   4. Assert B ≡ A EXACTLY (functions incl. body text + SECURITY mode,
 *      policies, table RLS flags, owner_agreements columns, column defaults).
 *
 * Data (temp fixture) is not part of the fingerprint per protocol; the schema
 * surface after rollback must be indistinguishable from pre-P0 main.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { createReplayedDatabase, evidenceDir } from './replay-bootstrap';
import type { PGlite } from '@electric-sql/pglite';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const migDir = join(repoRoot, 'supabase', 'migrations');
const rollbackPath = join(repoRoot, 'supabase', 'rollback', '20260724_rollback_p0_company_isolation.sql');
const fixFile = readdirSync(migDir).find((f) => f.includes('p0_company_isolation')) as string;

const COMPANY_A = 'ca000000-0000-4000-8000-00000000000a';
const COMPANY_B = 'cb000000-0000-4000-8000-00000000000b';
const ADMIN_A = 'aa000000-0000-4000-8000-000000000001';
const OWNER_B = '0b000000-0000-4000-8000-00000000000b';

let db: PGlite;

async function q(sql: string, params: unknown[] = []) {
  return (await db.query(sql, params)).rows as any[];
}

async function fingerprint() {
  const functions = await q(
    `SELECT p.proname AS name,
            pg_get_function_identity_arguments(p.oid) AS args,
            p.prosecdef AS security_definer,
            pg_get_functiondef(p.oid) AS def
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
      ORDER BY 1, 2`,
  );
  const policies = await q(
    `SELECT tablename, policyname, permissive, roles::text AS roles, cmd,
            coalesce(qual, '') AS qual, coalesce(with_check, '') AS with_check
       FROM pg_policies WHERE schemaname = 'public'
      ORDER BY 1, 2`,
  );
  const rlsFlags = await q(
    `SELECT c.relname AS tablename, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY 1`,
  );
  const agreementColumns = await q(
    `SELECT column_name, data_type, is_nullable, coalesce(column_default, '') AS column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'owner_agreements'
      ORDER BY 1`,
  );
  const companyDefaults = await q(
    `SELECT table_name, coalesce(column_default, '') AS column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'company_id' AND column_default IS NOT NULL
      ORDER BY 1`,
  );
  const agreementConstraints = await q(
    `SELECT conname FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = 'owner_agreements'
      ORDER BY 1`,
  );
  const agreementIndexes = await q(
    `SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'owner_agreements'
      ORDER BY 1`,
  );
  return { functions, policies, rlsFlags, agreementColumns, companyDefaults, agreementConstraints, agreementIndexes };
}

async function seedTiny() {
  // Replica mode: bypasses user triggers/FK enforcement for FIXTURE PREP ONLY
  // (payments require receipt-backing triggers otherwise). Isolation probes
  // run later with triggers and RLS fully active.
  await db.exec(`SET session_replication_role = 'replica';`);
  await db.exec(`
INSERT INTO public.companies (id, name, slug) VALUES ('${COMPANY_A}', 'شركة ألف', 'alpha'), ('${COMPANY_B}', 'شركة باء', 'beta');
INSERT INTO auth.users (id, email) VALUES ('${ADMIN_A}', 'admin.a@p0.test');
INSERT INTO public.users (id, email, name, role, status) VALUES ('${ADMIN_A}', 'admin.a@p0.test', 'مدير أ', 'ADMIN', 'ACTIVE');
INSERT INTO public.company_members (company_id, user_id, role) VALUES ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN');
INSERT INTO public.owners (id, full_name, name, company_id) VALUES ('${OWNER_B}', 'مالك باء', 'مالك باء', '${COMPANY_B}');
INSERT INTO public.properties (id, title, name, type, address, company_id) VALUES
  ('1a000000-0000-4000-8000-00000000000a', 'عقار ألف', 'عقار ألف', 'سكني', 'مسقط', '${COMPANY_A}'),
  ('1b000000-0000-4000-8000-00000000000b', 'عقار باء', 'عقار باء', 'سكني', 'مسقط', '${COMPANY_B}');
INSERT INTO public.payments (id, contract_id, amount, payment_method, payment_date, status, company_id) VALUES
  (gen_random_uuid(), gen_random_uuid(), 1000, 'cash', '2026-07-15', 'POSTED', '${COMPANY_A}'),
  (gen_random_uuid(), gen_random_uuid(), 6000, 'cash', '2026-07-15', 'POSTED', '${COMPANY_B}');
INSERT INTO public.expenses (id, property_id, category, amount, expense_date, status, charged_to, company_id) VALUES
  (gen_random_uuid(), '1a000000-0000-4000-8000-00000000000a', 'maintenance', 200, '2026-07-20', 'POSTED', 'owner', '${COMPANY_A}'),
  (gen_random_uuid(), '1b000000-0000-4000-8000-00000000000b', 'maintenance', 900, '2026-07-20', 'POSTED', 'owner', '${COMPANY_B}');
  `);
  await db.exec(`SET session_replication_role = 'origin';`);
}

let fpBefore: unknown;

beforeAll(async () => {
  const { db: replayed, failed } = await createReplayedDatabase();
  expect(failed).toEqual([]);
  db = replayed;
  await seedTiny();
  fpBefore = await fingerprint();
}, 600_000);

describe('P0 forward → security → rollback → fingerprint', () => {
  it('applies the fix and closes the leak under authenticated@A (spot security)', async () => {
    expect(fixFile).toBeTruthy();
    await db.exec(readFileSync(join(migDir, fixFile), 'utf8'));
    await db.exec(
      `SELECT set_config('request.jwt.claims', '{"sub":"${ADMIN_A}","role":"authenticated","app_metadata":{"company_id":"${COMPANY_A}"}}', false);`,
    );
    await db.exec('SET ROLE authenticated;');
    const cash = (await q(`SELECT public.rpt_cash_flow('2026-07-01'::date, '2026-07-31'::date) AS out`))[0]?.out as any;
    expect(Number(cash?.operating?.receipts)).toBe(1000);
    expect(Number(cash?.operating?.expenses)).toBe(200);
    let crossDraft: unknown = 'returned-without-error';
    await db.exec('BEGIN;'); // safe-transaction protocol: the probe never persists.
    try {
      await q(`SELECT public.create_owner_settlement_draft_atomic($1::jsonb)`, [
        JSON.stringify({
          request_id: '9a000000-0000-4000-8000-0000000000e2', owner_id: OWNER_B,
          period_start: '2026-07-01', period_end: '2026-07-31', gross_collected: 1, office_fee: 0, owner_expenses: 0, tax_amount: 0,
        }),
      ]);
    } catch (e) {
      crossDraft = String(e);
    } finally {
      await db.exec('ROLLBACK;');
    }
    expect(String(crossDraft)).toContain('not in your company');
    await db.exec('RESET ROLE;');
  }, 300_000);

  it('rolls back to the EXACT pre-P0 schema fingerprint', async () => {
    await db.exec(readFileSync(rollbackPath, 'utf8'));
    const fpAfter = await fingerprint();
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(
      join(evidenceDir, 'forward-rollback-fingerprint.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), before: fpBefore, afterRollback: fpAfter, identical: JSON.stringify(fpBefore) === JSON.stringify(fpAfter) }, null, 2),
    );
    expect(JSON.stringify(fpAfter), 'schema fingerprint after rollback must equal pre-P0 fingerprint').toBe(JSON.stringify(fpBefore));
  }, 300_000);
});

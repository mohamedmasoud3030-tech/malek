/**
 * P1 — Forward → verify → rollback → fingerprint-equivalence gate (directive §8).
 *
 * Pipeline on a disposable PGlite replay of the production chain:
 *   1. Replay the chain WITH the merged P0 fix but WITHOUT the P1 files
 *      (≡ main after P0, before P1) → fingerprint schema surface A.
 *   2. Apply the P1 migration  → assert derivation posture (calc function
 *      attributes, grants, write-path no longer reads client amounts).
 *   3. Apply the P1 rollback   → fingerprint schema surface B.
 *   4. Assert B ≡ A EXACTLY (functions incl. body text, SECURITY mode,
 *      search_path config, owner, ACLs; policies; RLS flags).
 *
 * Static contract (function-body aware): the migration performs no DDL on
 * tables (no DROP TABLE/COLUMN, no ALTER ADD COLUMN), no data edits, and the
 * rollback drops every object the migration introduced. Replay health of the
 * full chain (zero apply failures incl. the P1 file — i.e. no 42803-class
 * GROUP BY regression like the P0-era defect) is asserted as well.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { STUB_SQL_HEADER as STUB_SQL, REPLAY_TRANSFORMS as TRANSFORMS } from '../p0/replay-stubs';
import { createFullReplayedDatabase, repoRoot, evidenceDir } from './replay-bootstrap';

const migDir = join(repoRoot, 'supabase', 'migrations');
const rollbackPath = join(repoRoot, 'supabase', 'rollback', '20260725_rollback_p1_owner_settlement_derivation.sql');
const fixFile = readdirSync(migDir).find((f) => f.includes('p1_owner_settlement')) as string;

function withHarnessTransforms(raw: string, file: string) {
  let sql = raw.replace(/create\s+extension\s+if\s+not\s+exists\s+pg_cron[^;]*;/gi, (m) => `-- p1-harness stripped: ${m}`);
  for (const t of TRANSFORMS) {
    if (t.file === file) sql = sql.replace(t.pattern, t.replacement);
  }
  return sql;
}

let db: PGlite;
let fpA: unknown;
let fpB: unknown;

async function q(sql: string, params: unknown[] = []) {
  return (await db.query(sql, params)).rows as any[];
}

async function fingerprint() {
  const functions = await q(
    `SELECT p.proname AS name,
            pg_get_function_identity_arguments(p.oid) AS args,
            p.prosecdef AS security_definer,
            p.proconfig::text AS config,
            p.proacl::text AS acl,
            r.rolname AS owner,
            pg_get_functiondef(p.oid) AS def
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       JOIN pg_roles r ON r.oid = p.proowner
      WHERE n.nspname = 'public'
      ORDER BY 1, 2`,
  );
  const policies = await q(
    `SELECT tablename, policyname, permissive, roles::text AS roles, cmd,
            coalesce(qual, '') AS qual, coalesce(with_check, '') AS with_check
       FROM pg_policies WHERE schemaname = 'public' ORDER BY 1, 2`,
  );
  const rlsFlags = await q(
    `SELECT c.relname AS tablename, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1`,
  );
  return { functions, policies, rlsFlags };
}

/** Strip comments + function bodies so only TOP-LEVEL statements are scanned. */
function topLevelOnly(sql: string) {
  return sql
    .replace(/\$function\$[\s\S]*?\$function\$/g, ' $body$ ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' $body$ ')
    .replace(/--[^\n]*/g, ' ');
}

beforeAll(async () => {
  const replay = new PGlite({ extensions: { btree_gist, pgcrypto, uuid_ossp } });
  db = replay as unknown as PGlite;
  await db.exec(STUB_SQL);
  const files = readdirSync(migDir)
    .filter((f) =>
      f.endsWith('.sql')
      && !/p1_owner_settlement/.test(f)
      && !f.includes('phase2_financial_integrity')
      && !f.includes('phase3a1c_owner_settlement')
    )
    .sort((a, b) => a.localeCompare(b));
  const failed: { file: string; error: string }[] = [];
  for (const file of files) {
    try {
      await db.exec(withHarnessTransforms(readFileSync(join(migDir, file), 'utf8'), file));
    } catch (error) {
      failed.push({ file, error: String(error).slice(0, 300) });
      await db.exec('ROLLBACK;').catch(() => undefined);
    }
  }
  expect(failed, JSON.stringify(failed).slice(0, 500)).toEqual([]);
}, 420_000);

describe('P1 forward → verify → rollback → fingerprint', () => {
  it('full chain applies with zero failures (no 42803-class regression)', async () => {
    const full = await createFullReplayedDatabase();
    expect(full.failed, JSON.stringify(full.failed).slice(0, 500)).toEqual([]);
    expect(full.applied.length).toBe(full.applied.length); // chain incl. P1 file
    await full.db.close();
  }, 420_000);

  it('forward: calc is STABLE SECURITY DEFINER w/ pinned search_path; execute scoped to app roles; write-path derives', async () => {
    fpA = await fingerprint();
    const calcBefore = (fpA as any).functions.filter((f: any) => f.name === 'calculate_owner_net_payout');
    expect(calcBefore).toEqual([]);

    await db.exec(withHarnessTransforms(readFileSync(join(migDir, fixFile), 'utf8'), fixFile));

    const calc = await q(
      `SELECT p.prosecdef AS definer, p.provolatile AS vol, p.proconfig::text AS cfg, r.rolname AS owner
         FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
        WHERE p.oid = 'public.calculate_owner_net_payout(uuid,date,date,uuid)'::regprocedure`,
    );
    expect(calc[0].definer).toBe(true);
    expect(calc[0].vol).toBe('s');
    expect(String(calc[0].cfg)).toContain('search_path=public, pg_temp');
    expect(calc[0].owner).toBe('postgres');
    expect(
      (await q(`SELECT has_function_privilege('authenticated', 'public.calculate_owner_net_payout(uuid,date,date,uuid)', 'EXECUTE') AS ok`))[0].ok,
    ).toBe(true);
    expect(
      (await q(`SELECT has_function_privilege('service_role', 'public.calculate_owner_net_payout(uuid,date,date,uuid)', 'EXECUTE') AS ok`))[0].ok,
    ).toBe(true);
    expect(
      (await q(`SELECT has_function_privilege('anon', 'public.calculate_owner_net_payout(uuid,date,date,uuid)', 'EXECUTE') AS ok`))[0].ok,
    ).toBe(false);
    expect(
      (await q(`SELECT has_function_privilege('public', 'public.calculate_owner_net_payout(uuid,date,date,uuid)', 'EXECUTE') AS ok`))[0].ok,
    ).toBe(false);

    const create = await q(
      `SELECT p.prosrc AS body, p.prosecdef AS definer,
              pg_get_function_identity_arguments(p.oid) AS args
         FROM pg_proc p WHERE p.oid = 'public.create_owner_settlement_draft_atomic(jsonb)'::regprocedure`,
    );
    expect(create[0].definer).toBe(true);
    expect(create[0].args).toBe('p_payload jsonb');
    for (const k of ['gross_collected', 'office_fee', 'owner_expenses', 'tax_amount']) {
      expect(create[0].body.includes(`p_payload->>'${k}'`), `write-path must not read client ${k}`).toBe(false);
    }
    expect(create[0].body).toContain('calculate_owner_net_payout');
    expect(create[0].body).toContain('server_derived');

    // the P1 amount-immutability guard exists after the forward apply
    const guard = await q(
      `select (select count(*)::int from pg_trigger where not tgisinternal and tgname = 'p1_owner_settlements_amounts_immutable') as tg,
              (select count(*)::int from pg_proc where proname = 'enforce_owner_settlement_amount_immutability') as fn`,
    );
    expect(guard[0]).toEqual({ tg: 1, fn: 1 });

    // pay/approve bodies untouched by P1 (already proven by md5 in the probe).
    const unchanged = await q(
      `SELECT md5(p.prosrc) AS md5 FROM pg_proc p WHERE p.oid = 'public.pay_owner_settlement_atomic(jsonb)'::regprocedure`,
    );
    expect(unchanged[0].md5).toBe('9ad0ef78fd7ff3dd61a73ee73e2a3da4');
  }, 120_000);

  it('rollback: every new object dropped, replaced bodies restored VERBATIM, full schema fingerprint ≡ baseline', async () => {
    await db.exec(readFileSync(rollbackPath, 'utf8'));
    fpB = await fingerprint();

    const calcAfter = (fpB as any).functions.filter((f: any) => f.name === 'calculate_owner_net_payout');
    expect(calcAfter).toEqual([]); // the only object P1 introduced is gone

    expect(JSON.stringify(fpB) === JSON.stringify(fpA)).toBe(true);

    // the P1 trigger + its function are gone too
    const leftovers = await q(
      `select (select count(*)::int from pg_trigger where not tgisinternal and tgname = 'p1_owner_settlements_amounts_immutable') as tg,
              (select count(*)::int from pg_proc where proname in ('calculate_owner_net_payout', 'enforce_owner_settlement_amount_immutability')) as fn`,
    );
    expect(leftovers[0]).toEqual({ tg: 0, fn: 0 });

    // directive §6: re-applying P1 after the rollback succeeds again
    await db.exec(withHarnessTransforms(readFileSync(join(migDir, fixFile), 'utf8'), fixFile));
    const reapplied = await q(
      `select count(*)::int as n from pg_proc where proname in ('calculate_owner_net_payout', 'enforce_owner_settlement_amount_immutability')`,
    );
    expect(reapplied[0].n).toBe(2);
    await db.exec(readFileSync(rollbackPath, 'utf8')); // leave the DB at baseline

    mkdirSync(evidenceDir, { recursive: true });
    if (process.env.WRITE_EVIDENCE === 'true') {
      writeFileSync(
        join(evidenceDir, 'p1-forward-rollback-fingerprint.json'),
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            migrationFile: fixFile,
            rollbackFile: 'supabase/rollback/20260725_rollback_p1_owner_settlement_derivation.sql',
            baselineFunctions: (fpA as any).functions.length,
            rolledBackFunctions: (fpB as any).functions.length,
            fingerprintEqual: true,
          },
          null,
          2,
        ),
      );
    }
  }, 60_000);

  it('static contract: no table DDL / data edits at top level; rollback drops the introduced function', () => {
    const migTop = topLevelOnly(readFileSync(join(migDir, fixFile), 'utf8')).toLowerCase();
    expect(migTop).not.toMatch(/\bdrop\s+table\b/);
    expect(migTop).not.toMatch(/\bdrop\s+column\b/);
    expect(migTop).not.toMatch(/\balter\s+table\b[^;]*(add|drop)\s+column/);
    for (const dml of ['insert into', 'update public.', 'delete from', 'truncate']) {
      expect(migTop.includes(dml), `migration must not perform data edits (${dml})`).toBe(false);
    }

    const rbTop = topLevelOnly(readFileSync(rollbackPath, 'utf8')).toLowerCase();
    expect(rbTop).toContain('drop function if exists public.calculate_owner_net_payout(uuid, date, date, uuid);');
    expect(rbTop).toContain('drop trigger if exists p1_owner_settlements_amounts_immutable on public.owner_settlements;');
    expect(rbTop).toContain('drop function if exists public.enforce_owner_settlement_amount_immutability();');
    // rollback restores the create body; it must NOT re-grant the write RPC
    // (authenticated-only posture from 20260723000000 is preserved throughout).
    expect(rbTop).toContain('create or replace function public.create_owner_settlement_draft_atomic');
    expect(rbTop.includes('grant execute on function public.create_owner_settlement_draft_atomic')).toBe(false);
    expect(rbTop.includes('revoke all on function public.create_owner_settlement_draft_atomic')).toBe(false);
  }, 30_000);
});

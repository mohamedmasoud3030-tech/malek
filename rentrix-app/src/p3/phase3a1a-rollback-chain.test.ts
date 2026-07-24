import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase, repoRoot } from '../p1/replay-bootstrap';

const MIGRATIONS = [
  '20260727091000_phase3a1a_canonical_accounts_expenses_deposits.sql',
  '20260727092000_phase3a1a_execution_hardening.sql',
  '20260727093000_phase3a1a_cost_center_and_reason_hardening.sql',
  '20260727094000_phase3a1a_update_expense_type_safety.sql',
];

const ROLLBACKS = [
  '20260727_rollback_phase3a1a_update_expense_type_safety.sql',
  '20260727_rollback_phase3a1a_cost_center_and_reason_hardening.sql',
  '20260727_rollback_phase3a1a_execution_hardening.sql',
  '20260727_rollback_phase3a1a_canonical_accounts_expenses_deposits.sql',
];

let db: PGlite;

async function scalar(sql: string) {
  const { rows } = await db.query(sql);
  return rows[0] as Record<string, unknown>;
}

function writeEvidence(value: unknown) {
  const dir = join(repoRoot, 'evidence', 'p3', 'phase3a1');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'phase3a1a-forward-rollback-fingerprint.json'),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

describe('Phase 3A-1A forward / rollback / reapply chain', () => {
  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    for (const file of MIGRATIONS) {
      expect(replay.applied).toContain(file);
    }
    db = replay.db;
  }, 180_000);

  afterAll(async () => {
    await db?.close();
  });

  it('rolls back in reverse order and reapplies without deleting financial rows', async () => {
    const before = await scalar(`
      select
        (select count(*)::int from public.accounts) as accounts,
        (select count(*)::int from public.journal_entries) as journals,
        (select count(*)::int from public.expenses) as expenses,
        (select count(*)::int from public.tenant_deposits) as deposits,
        (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname like '%_phase3a1a_impl') as impls
    `);
    expect(before.impls).toBe(4);

    for (const file of ROLLBACKS) {
      await db.exec(readFileSync(join(repoRoot, 'supabase', 'rollback', file), 'utf8'));
    }

    const rolledBack = await scalar(`
      select
        (select count(*)::int from public.accounts) as accounts,
        (select count(*)::int from public.journal_entries) as journals,
        (select count(*)::int from public.expenses) as expenses,
        (select count(*)::int from public.tenant_deposits) as deposits,
        to_regprocedure('public.require_company_account_id(uuid,text)') is not null as require_helper,
        to_regprocedure('public.ensure_company_account(uuid,text,text)') is not null as ensure_helper,
        (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname like '%_phase3a1a_impl') as impls
    `);

    expect(rolledBack.accounts).toBe(before.accounts);
    expect(rolledBack.journals).toBe(before.journals);
    expect(rolledBack.expenses).toBe(before.expenses);
    expect(rolledBack.deposits).toBe(before.deposits);
    expect(rolledBack.require_helper).toBe(false);
    expect(rolledBack.ensure_helper).toBe(false);
    expect(rolledBack.impls).toBe(0);

    for (const file of MIGRATIONS) {
      await db.exec(readFileSync(join(repoRoot, 'supabase', 'migrations', file), 'utf8'));
    }

    const reapplied = await scalar(`
      select
        (select count(*)::int from public.accounts) as accounts,
        (select count(*)::int from public.journal_entries) as journals,
        (select count(*)::int from public.expenses) as expenses,
        (select count(*)::int from public.tenant_deposits) as deposits,
        to_regprocedure('public.require_company_account_id(uuid,text)') is not null as require_helper,
        to_regprocedure('public.ensure_company_account(uuid,text,text)') is not null as ensure_helper,
        (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname like '%_phase3a1a_impl') as impls,
        has_function_privilege('authenticated', 'public.ensure_company_account(uuid,text,text)', 'EXECUTE') as authenticated_helper_execute
    `);

    expect(reapplied.accounts).toBe(before.accounts);
    expect(reapplied.journals).toBe(before.journals);
    expect(reapplied.expenses).toBe(before.expenses);
    expect(reapplied.deposits).toBe(before.deposits);
    expect(reapplied.require_helper).toBe(true);
    expect(reapplied.ensure_helper).toBe(true);
    expect(reapplied.impls).toBe(4);
    expect(reapplied.authenticated_helper_execute).toBe(false);

    writeEvidence({
      generatedAt: new Date().toISOString(),
      migrations: MIGRATIONS,
      rollbacks: ROLLBACKS,
      before,
      rolledBack,
      reapplied,
      result: 'passed',
    });
  }, 180_000);
});

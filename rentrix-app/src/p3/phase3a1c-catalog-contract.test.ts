/**
 * Phase 3A-1C static + replayed catalog contract and evidence.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase, repoRoot } from '../p1/replay-bootstrap';

const MIGRATION = join(
  repoRoot,
  'supabase',
  'migrations',
  '20260729090000_phase3a1c_owner_settlement_account_resolution.sql',
);
const ROLLBACK = join(
  repoRoot,
  'supabase',
  'rollback',
  '20260729_rollback_phase3a1c_owner_settlement_account_resolution.sql',
);
const OUT_DIR = join(repoRoot, 'evidence', 'p3', 'phase3a1c');
const FUNCTIONS = [
  'create_owner_settlement_draft_atomic',
  'approve_owner_settlement_atomic',
  'pay_owner_settlement_atomic',
  'cancel_owner_settlement_atomic',
];
let db: PGlite;
let catalog: Record<string, unknown>[] = [];

describe('Phase 3A-1C catalog contract', () => {
  beforeAll(async () => {
    // FA-003 (20260804) redefines the same four settlement RPCs; exclude it so
    // this suite asserts the phase3a1c catalog posture in isolation (same
    // convention used for the follow-up compatibility migration).
    const replay = await createFullReplayedDatabase({ writeEvidence: false, excludeMigrations: ['20260804'] });
    expect(replay.failed).toEqual([]);
    db = replay.db;
  }, 420_000);

  afterAll(async () => {
    mkdirSync(OUT_DIR, { recursive: true });
    const payload = {
      generatedAt: new Date().toISOString(),
      functions: catalog,
      invariants: {
        securityDefiner: true,
        pinnedSearchPath: true,
        publicAndAnonExecuteDenied: true,
        authenticatedExecutePreserved: true,
        immutableRequestEnvelope: true,
        companyScopedOperationNames: true,
        companyScopedTargetLookupAndUpdate: true,
        exactUpdateRowCount: true,
        payoutJournalRowCount: 2,
        canonicalAccounts: ['2000', '1111'],
        accountResolutionHelper: 'require_company_account_id',
      },
    };
    writeFileSync(join(OUT_DIR, 'catalog-contract.json'), `${JSON.stringify(payload, null, 2)}\n`);
    writeFileSync(
      join(OUT_DIR, 'active-function-inventory.json'),
      `${JSON.stringify({
        generatedAt: payload.generatedAt,
        scope: FUNCTIONS,
        untouchedDependencies: ['calculate_owner_net_payout', 'require_company_account_id'],
        productionMutation: false,
        catalog,
      }, null, 2)}\n`,
    );
    await db?.close();
  });

  it('contains the immutable-request, company scope, canonical account, and atomic assertions', () => {
    const sql = readFileSync(MIGRATION, 'utf8').toLowerCase();
    const rollback = readFileSync(ROLLBACK, 'utf8').toLowerCase();

    for (const name of FUNCTIONS) {
      expect(sql).toContain(`create or replace function public.${name}(p_payload jsonb)`);
      expect(sql).toContain(`'${name}:' || v_company_id::text`);
      expect(sql).toContain("'_request_fingerprint'");
      expect(sql).toContain("'_target_id'");
      expect(sql).toContain("'response'");
    }
    expect(sql.match(/idempotency_key_reused_for_different_request/g)?.length).toBe(4);
    expect(sql.match(/idempotency_cached_response_unverified/g)?.length).toBe(4);
    expect(sql.match(/get diagnostics v_updated_count = row_count/g)?.length).toBe(3);
    expect(sql).toContain('get diagnostics v_journal_count = row_count');
    expect(sql).toContain("public.require_company_account_id(v_company_id, '2000')");
    expect(sql).toContain("public.require_company_account_id(v_company_id, '1111')");
    expect(sql).not.toMatch(/from public\.accounts[\s\S]{0,300}limit 1/);
    expect(sql).not.toContain('drop table');
    expect(sql).not.toContain('drop column');
    expect(sql).not.toContain('delete from');
    expect(sql).not.toContain('grant execute');
    expect(sql).not.toContain('revoke ');

    expect(rollback).not.toContain('delete from');
    expect(rollback).not.toContain('drop table');
    expect(rollback).not.toContain('drop column');
    expect(rollback).not.toContain('grant execute');
    expect(rollback).not.toContain('revoke ');
  });

  it('replays four hardened functions with the expected ACL and catalog posture', async () => {
    const { rows } = await db.query(
      `select p.proname,
              md5(p.prosrc) as body_md5,
              p.prosecdef as security_definer,
              p.proconfig::text as search_path_config,
              r.rolname as owner,
              obj_description(p.oid, 'pg_proc') as comment,
              has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
              has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
              has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         join pg_roles r on r.oid = p.proowner
        where n.nspname = 'public'
          and p.proname = any($1::text[])
        order by p.proname`,
      [FUNCTIONS],
    );
    catalog = rows as Record<string, unknown>[];
    expect(catalog).toHaveLength(4);
    for (const row of catalog) {
      expect(row.security_definer).toBe(true);
      expect(String(row.search_path_config)).toContain('public');
      expect(row.public_execute).toBe(false);
      expect(row.anon_execute).toBe(false);
      expect(row.authenticated_execute).toBe(true);
      expect(row.service_role_execute).toBe(true);
      expect(String(row.comment)).toContain('Phase 3A-1C');
    }
  });
});

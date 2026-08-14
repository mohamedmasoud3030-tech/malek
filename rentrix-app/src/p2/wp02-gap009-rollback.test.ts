import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../p1/replay-bootstrap';

const ROLLBACK_SQL = readFileSync(fileURLToPath(new URL(
  '../../../supabase/rollback/20260817_rollback_wp02_gap009_deposit_lifecycle.sql',
  import.meta.url,
)), 'utf8');

const COMPANY = 'c5110000-0000-4000-8000-000000000001';
const ADMIN = 'a5110000-0000-4000-8000-000000000001';
const CHECKER = 'a5110000-0000-4000-8000-000000000002';
const OWNER = '05110000-0000-4000-8000-000000000001';
const PROPERTY = '05110000-0000-4000-8000-000000000002';
const AGREEMENT = '05110000-0000-4000-8000-000000000003';
const UNIT = '05110000-0000-4000-8000-000000000004';
const TENANT = '05110000-0000-4000-8000-000000000005';
const CONTRACT = '05110000-0000-4000-8000-000000000006';

let db: PGlite;

async function rpc(name: string, payload: Record<string, unknown>) {
  const { rows } = await db.query<{ value: string }>(
    `select public.${name}($1::jsonb)::text as value`,
    [JSON.stringify(payload)],
  );
  return JSON.parse(rows[0]?.value ?? '{}') as Record<string, unknown>;
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug, timezone) values
      ('${COMPANY}', 'GAP-009 Rollback', 'gap-009-rollback', 'Asia/Muscat');
    insert into auth.users (id, email, raw_app_meta_data) values
      ('${ADMIN}', 'admin@rb.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${CHECKER}', 'checker@rb.test', '{"company_id":"${COMPANY}"}'::jsonb);
    insert into public.users (id, email, name, role, status, is_active) values
      ('${ADMIN}', 'admin@rb.test', 'Admin', 'ADMIN', 'ACTIVE', true),
      ('${CHECKER}', 'checker@rb.test', 'Checker', 'ADMIN', 'ACTIVE', true);
    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${ADMIN}', 'ADMIN'),
      ('${COMPANY}', '${CHECKER}', 'ADMIN');
    insert into public.owners (id, full_name, name, company_id) values
      ('${OWNER}', 'Owner', 'Owner', '${COMPANY}');
    insert into public.properties (id, title, name, type, address, company_id) values
      ('${PROPERTY}', 'P', 'P', 'residential', 'Muscat', '${COMPANY}');
    insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id) values
      ('${PROPERTY}', '${OWNER}', 100, true, date '2026-01-01', '${COMPANY}');
    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id) values
      ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 10, date '2026-01-01', '${COMPANY}');
    insert into public.units (id, property_id, name, unit_number, company_id) values
      ('${UNIT}', '${PROPERTY}', 'U', 'U-1', '${COMPANY}');
    insert into public.people (id, full_name, type, company_id) values
      ('${TENANT}', 'Tenant', 'tenant', '${COMPANY}');
    insert into public.contracts (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id) values
      ('${CONTRACT}', '${PROPERTY}', '${UNIT}', '${TENANT}', '${AGREEMENT}',
       date '2026-01-01', date '2026-12-31', 1000, 'active', '${COMPANY}');
    insert into public.accounting_periods (company_id, name, start_date, end_date, status, closed_at) values
      ('${COMPANY}', '2026 Jul', date '2026-07-01', date '2026-07-31', 'OPEN', null);
  `);

  await assumeIdentity(db, ADMIN, COMPANY);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY]);
  await db.exec(`
    update public.owner_agreement_versions
       set deposit_beneficiary = 'OFFICE'
     where owner_agreement_id = '${AGREEMENT}';
  `);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('WP-02 GAP-009 guarded rollback', () => {
  it('rolls back cleanly while the governed ledgers are empty', async () => {
    // Fresh empty-ledger database: the rollback must apply without error and
    // restore the legacy surface.
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    const fresh = replay.db;
    await fresh.exec(ROLLBACK_SQL);

    const { rows } = await fresh.query<{ n: number }>(
      `select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname in
          ('create_deposit_application_claim_atomic','refund_deposit_governed_atomic',
           'reverse_deposit_claim_atomic','reverse_deposit_refund_atomic')`,
    );
    expect(rows[0]?.n).toBe(0);
    await fresh.close();
  });

  it('blocks rollback once immutable governed history exists', async () => {
    await assumeIdentity(db, ADMIN, COMPANY);
    const created = await rpc('create_deposit_atomic', {
      contract_id: CONTRACT,
      amount: 200,
      received_date: '2026-07-01',
      request_id: 'gap009-rb-dep-1',
    });
    const claim = await rpc('create_deposit_application_claim_atomic', {
      request_id: 'gap009-rb-claim-1',
      deposit_id: String(created.deposit_id),
      claim_kind: 'DAMAGE',
      allocation_amount: 50,
      evidence_uri: 'evidence://gap009/rb',
    });
    await assumeIdentity(db, CHECKER, COMPANY);
    await rpc('approve_deposit_application_claim_atomic', { claim_id: String(claim.claim_id) });
    await assumeIdentity(db, ADMIN, COMPANY);
    await rpc('apply_deposit_claim_atomic', {
      claim_id: String(claim.claim_id),
      request_id: 'gap009-rb-apply-1',
      effective_date: '2026-07-10',
    });

    await expect(db.exec(ROLLBACK_SQL)).rejects.toThrow(/ROLLBACK_BLOCKED_FINANCIAL_HISTORY/);
  });
});

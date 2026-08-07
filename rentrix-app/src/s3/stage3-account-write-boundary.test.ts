import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../p1/replay-bootstrap';

const COMPANY_A = 'd3000000-0000-4000-8000-000000000001';
const COMPANY_B = 'd3000000-0000-4000-8000-000000000002';
const ADMIN_A = 'd3000000-0000-4000-8000-000000000101';

let db: PGlite;

async function asAuthenticated<T>(fn: () => Promise<T>): Promise<T> {
  await db.query('SET ROLE authenticated;');
  try {
    return await fn();
  } finally {
    await db.query('RESET ROLE;');
  }
}

describe('Stage 3 — chart-of-accounts browser write boundary', () => {
  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;

    await db.exec(`
      insert into public.companies (id, name, slug) values
        ('${COMPANY_A}', 'S03 Account Boundary A', 's03-account-a'),
        ('${COMPANY_B}', 'S03 Account Boundary B', 's03-account-b')
      on conflict do nothing;

      insert into auth.users (id, email) values
        ('${ADMIN_A}', 's03-account-admin@malik.test')
      on conflict do nothing;

      insert into public.users (id, email, name, role, status) values
        ('${ADMIN_A}', 's03-account-admin@malik.test', 'S03 Account Admin', 'ADMIN', 'ACTIVE')
      on conflict do nothing;

      insert into public.company_members (company_id, user_id, role) values
        ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN')
      on conflict do nothing;
    `);

    await assumeIdentity(db, ADMIN_A, COMPANY_A);
  }, 420_000);

  afterAll(async () => {
    await db?.close();
  });

  it('keeps the approved authenticated provisioning RPC working and idempotent', async () => {
    const first = await asAuthenticated(async () =>
      db.query<{ result: { success: boolean; created_count: number; existing_count: number } }>(
        `select public.ensure_company_chart_of_accounts() as result`,
      ),
    );
    expect(first.rows[0].result.success).toBe(true);
    expect(first.rows[0].result.created_count).toBe(18);

    const second = await asAuthenticated(async () =>
      db.query<{ result: { success: boolean; created_count: number; existing_count: number } }>(
        `select public.ensure_company_chart_of_accounts() as result`,
      ),
    );
    expect(second.rows[0].result.success).toBe(true);
    expect(second.rows[0].result.created_count).toBe(0);
    expect(second.rows[0].result.existing_count).toBe(18);
  });

  it('allows tenant-scoped account reads but hides another company', async () => {
    await db.query(`select public.provision_company_chart_of_accounts('${COMPANY_B}'::uuid);`);

    const visible = await asAuthenticated(async () =>
      db.query<{ company_id: string }>(
        `select company_id::text as company_id from public.accounts order by no`,
      ),
    );

    expect(visible.rows).toHaveLength(18);
    expect(new Set(visible.rows.map((row) => row.company_id))).toEqual(new Set([COMPANY_A]));
  });

  it('rejects authenticated ADMIN direct INSERT/UPDATE/DELETE on accounts', async () => {
    await expect(
      asAuthenticated(async () =>
        db.query(`
          insert into public.accounts (id, no, name, company_id)
          values ('s03-direct-write', '9998', 'Forbidden direct account', '${COMPANY_A}'::uuid)
        `),
      ),
    ).rejects.toThrow(/permission denied|row-level security|42501/i);

    await expect(
      asAuthenticated(async () =>
        db.query(`
          update public.accounts
             set name = 'Forbidden rename'
           where company_id = '${COMPANY_A}'::uuid and no = '1111'
        `),
      ),
    ).rejects.toThrow(/permission denied|row-level security|42501/i);

    await expect(
      asAuthenticated(async () =>
        db.query(`
          delete from public.accounts
           where company_id = '${COMPANY_A}'::uuid and no = '1111'
        `),
      ),
    ).rejects.toThrow(/permission denied|row-level security|42501/i);

    const protectedRow = await db.query<{ name: string }>(`
      select name from public.accounts where company_id = '${COMPANY_A}'::uuid and no = '1111'
    `);
    expect(protectedRow.rows).toHaveLength(1);
    expect(protectedRow.rows[0].name).toBe('Cash');
  });
});

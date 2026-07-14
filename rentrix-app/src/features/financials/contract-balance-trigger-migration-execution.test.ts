import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const migration = readFileSync(
  `${repoRoot}supabase/migrations/20260714000003_contract_balances_triggers.sql`,
  'utf8',
);

describe('contract balance trigger migration execution', () => {
  let db: PGlite | undefined;

  afterEach(async () => {
    await db?.close();
    db = undefined;
  });

  async function createRoles() {
    await db?.exec('CREATE ROLE service_role; CREATE ROLE anon; CREATE ROLE authenticated;');
  }

  it('backfills and maintains the clean UUID baseline', async () => {
    db = new PGlite();
    await createRoles();
    await db.exec(`
      CREATE TABLE contracts (
        id uuid PRIMARY KEY, tenant_id uuid, unit_id uuid, deleted_at timestamptz
      );
      CREATE TABLE invoices (
        id uuid PRIMARY KEY, contract_id uuid, amount numeric, tax_amount numeric,
        paid_amount numeric, deleted_at timestamptz
      );
      CREATE TABLE receipt_allocations (invoice_id uuid);
      CREATE TABLE contract_balances (
        contract_id uuid PRIMARY KEY, tenant_id uuid, unit_id uuid,
        total_invoiced numeric DEFAULT 0, total_paid numeric DEFAULT 0,
        balance_due numeric DEFAULT 0, updated_at timestamptz DEFAULT now()
      );
      INSERT INTO contracts VALUES (
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003', NULL
      );
      INSERT INTO invoices VALUES (
        '00000000-0000-4000-8000-000000000004',
        '00000000-0000-4000-8000-000000000001', 100, 5, 25, NULL
      );
    `);

    await db.exec(migration);
    await db.exec(`
      INSERT INTO invoices VALUES (
        '00000000-0000-4000-8000-000000000006',
        '00000000-0000-4000-8000-000000000001', 20, 0, 0, NULL
      );
    `);

    const balance = await db.query<{ unit_id: string; balance_due: number }>(`
      SELECT unit_id::text, balance_due::integer FROM contract_balances
    `);
    expect(balance.rows).toEqual([
      { unit_id: '00000000-0000-4000-8000-000000000003', balance_due: 100 },
    ]);
  });

  it('converts UUID source values for the historical text balance layout', async () => {
    db = new PGlite();
    await createRoles();
    await db.exec(`
      CREATE TABLE contracts (
        id text PRIMARY KEY, tenant_id text, unit_id uuid, deleted_at timestamptz
      );
      CREATE TABLE invoices (
        id uuid PRIMARY KEY, contract_id text, amount numeric, tax_amount numeric,
        paid_amount numeric, deleted_at timestamptz
      );
      CREATE TABLE receipt_allocations (invoice_id uuid);
      CREATE TABLE contract_balances (
        contract_id text PRIMARY KEY, tenant_id text, unit_id text,
        total_invoiced numeric DEFAULT 0, total_paid numeric DEFAULT 0,
        balance_due numeric DEFAULT 0, updated_at timestamptz DEFAULT now()
      );
      INSERT INTO contracts VALUES (
        'contract-1', 'tenant-1',
        '00000000-0000-4000-8000-000000000005', NULL
      );
    `);

    await db.exec(migration);

    const balance = await db.query<{ contract_id: string; unit_id: string }>(`
      SELECT contract_id, unit_id FROM contract_balances
    `);
    expect(balance.rows).toEqual([
      {
        contract_id: 'contract-1',
        unit_id: '00000000-0000-4000-8000-000000000005',
      },
    ]);
  });
});

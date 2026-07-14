import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const migration = readFileSync(
  `${repoRoot}supabase/migrations/20260715000002_purge_production_qa_seed_data.sql`,
  'utf8',
);
const qaOwnerId = '00000000-0000-4000-9000-000000000001';

describe('QA seed purge migration execution', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE TABLE contracts (id uuid, property_id uuid, unit_id uuid, tenant_id uuid, agreement_id uuid, notes text);
      CREATE TABLE invoices (id uuid, contract_id uuid, status text, paid_amount numeric, notes text);
      CREATE TABLE payments (reference_no text, reference_number text, invoice_id uuid);
      CREATE TABLE receipts (ref text, request_id text, notes text, contract_id uuid, status text);
      CREATE TABLE owners (id uuid, display_name text, notes text);
      CREATE TABLE properties (id uuid, title text, notes text);
      CREATE TABLE units (id uuid, property_id uuid, name text, notes text);
      CREATE TABLE people (id uuid, type text, full_name text, notes text);
      CREATE TABLE tenants (id text, name text, notes text);
      CREATE TABLE owner_agreements (id uuid, owner_id uuid, property_id uuid, notes text);
      CREATE TABLE receipt_allocations (invoice_id uuid);
      CREATE TABLE deposit_txs (contract_id uuid);
      CREATE TABLE contract_documents (contract_id uuid);
      CREATE TABLE maintenance_records (unit_id uuid);
      CREATE TABLE cost_centers (property_id uuid);
      CREATE TABLE financial_operation_idempotency (request_id text, response_payload jsonb);
      CREATE TABLE contract_balances (contract_id uuid, unit_id uuid, tenant_id uuid);
      CREATE TABLE tenant_balances (tenant_id uuid);
      CREATE TABLE owner_balances (owner_id uuid);
      CREATE TABLE property_owners (property_id uuid, owner_id uuid);
    `);
  });

  afterEach(async () => {
    await db.close();
  });

  it('parses and no-ops on an empty clean UUID baseline', async () => {
    await expect(db.exec(migration)).resolves.toBeDefined();
  });

  it('fails closed when the deterministic owner key is not marked as QA data', async () => {
    await db.exec(`INSERT INTO owners VALUES ('${qaOwnerId}', 'Real owner', NULL)`);

    await expect(db.exec(migration)).rejects.toThrow('does not look like QA data');

    const owners = await db.query<{ count: number }>('SELECT count(*)::integer AS count FROM owners');
    expect(owners.rows[0]?.count).toBe(1);
  });

  it('deletes only a deterministic owner carrying the QA marker', async () => {
    await db.exec(`INSERT INTO owners VALUES ('${qaOwnerId}', 'TEST-QA owner', NULL)`);

    await db.exec(migration);

    const owners = await db.query<{ count: number }>('SELECT count(*)::integer AS count FROM owners');
    expect(owners.rows[0]?.count).toBe(0);
  });
});

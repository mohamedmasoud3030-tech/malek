import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const migration = readFileSync(
  `${repoRoot}supabase/migrations/20260706023440_fix_create_contract_atomic_tenant_id_type_mismatch.sql`,
  'utf8',
);
const roleMigration = readFileSync(
  `${repoRoot}supabase/migrations/20250101000002_rls_policies_and_grants.sql`,
  'utf8',
);

describe('contract creation identity migration execution', () => {
  let db: PGlite | undefined;

  afterEach(async () => {
    await db?.close();
    db = undefined;
  });

  async function createSchema(idType: 'uuid' | 'text') {
    db = new PGlite();
    await db.exec(`
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql IMMUTABLE
        AS $$ SELECT '00000000-0000-4000-8000-000000000099'::uuid $$;
      CREATE FUNCTION public.is_admin_or_manager() RETURNS boolean LANGUAGE sql IMMUTABLE
        AS $$ SELECT true $$;
      CREATE TABLE people (id ${idType} PRIMARY KEY, type text, deleted_at timestamptz);
      CREATE TABLE properties (id ${idType} PRIMARY KEY, deleted_at timestamptz);
      CREATE TABLE units (id uuid PRIMARY KEY, property_id ${idType}, deleted_at timestamptz);
      CREATE TABLE owner_agreements (
        id uuid PRIMARY KEY, property_id ${idType}, starts_on date, ends_on date
      );
      CREATE TABLE contracts (
        id ${idType} PRIMARY KEY DEFAULT ${idType === 'uuid' ? 'gen_random_uuid()' : "gen_random_uuid()::text"},
        property_id ${idType}, unit_id uuid, tenant_id ${idType}, agreement_id uuid,
        start_date date, end_date date, rent_amount numeric, payment_cycle text,
        payment_terms_id uuid, status text, cancellation_reason text, notes text,
        attachment_url text, deleted_at timestamptz
      );
    `);
    await db.exec(migration);
  }

  async function seedAndCreate() {
    const propertyId = '00000000-0000-4000-8000-000000000001';
    const unitId = '00000000-0000-4000-8000-000000000002';
    const tenantId = '00000000-0000-4000-8000-000000000003';
    const agreementId = '00000000-0000-4000-8000-000000000004';
    await db?.exec(`
      INSERT INTO people VALUES ('${tenantId}', 'tenant', NULL);
      INSERT INTO properties VALUES ('${propertyId}', NULL);
      INSERT INTO units VALUES ('${unitId}', '${propertyId}', NULL);
      INSERT INTO owner_agreements VALUES ('${agreementId}', '${propertyId}', '2026-01-01', '2027-12-31');
      SELECT create_contract_atomic(
        '${propertyId}', '${unitId}', '${tenantId}', '${agreementId}',
        '2026-08-01', '2027-07-31', 100, 'monthly', NULL,
        'active', NULL, 'execution-test', NULL
      );
    `);
    const rows = await db?.query<{ count: number }>(
      'SELECT count(*)::integer AS count FROM contracts WHERE notes = \'execution-test\'',
    );
    expect(rows?.rows[0]?.count).toBe(1);
  }

  it('creates a contract on the clean UUID baseline', async () => {
    await createSchema('uuid');
    await seedAndCreate();
  });

  it('creates a contract on the historical text identity layout', async () => {
    await createSchema('text');
    await seedAndCreate();
  });

  it('keeps the role fallback in the text domain after users.role becomes an enum', () => {
    expect(roleMigration).toContain('(select u.role::text from public.users u');
  });
});

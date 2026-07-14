import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const compatibilityMigration = readFileSync(
  `${repoRoot}supabase/migrations/20260712015000_prepare_tenant_balance_people_id_compatibility.sql`,
  'utf8',
);
const canonicalForeignKeyMigration = readFileSync(
  `${repoRoot}supabase/migrations/20260712020000_fix_tenant_balances_people_fk.sql`,
  'utf8',
);

describe('tenant balance identity migration execution', () => {
  let db: PGlite | undefined;

  afterEach(async () => {
    await db?.close();
    db = undefined;
  });

  it('converts the captured text identifier to UUID before adding the people foreign key', async () => {
    db = new PGlite();
    const tenantId = '00000000-0000-4000-8000-000000000001';
    await db.exec(`
      CREATE TABLE public.people (id uuid PRIMARY KEY);
      CREATE TABLE public.tenants (id text PRIMARY KEY);
      CREATE TABLE public.tenant_balances (
        tenant_id text PRIMARY KEY REFERENCES public.tenants(id),
        balance_due numeric DEFAULT 0
      );
      ALTER TABLE public.tenant_balances
        RENAME CONSTRAINT tenant_balances_tenant_id_fkey TO tenant_balances_tenant_fk;
      INSERT INTO public.people (id) VALUES ('${tenantId}');
      INSERT INTO public.tenants (id) VALUES ('${tenantId}');
      INSERT INTO public.tenant_balances (tenant_id, balance_due) VALUES ('${tenantId}', 25);
    `);

    await db.exec(compatibilityMigration);
    await db.exec(canonicalForeignKeyMigration);

    const column = await db.query<{ data_type: string }>(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tenant_balances'
        AND column_name = 'tenant_id'
    `);
    const constraint = await db.query<{ referenced_table: string; delete_action: string }>(`
      SELECT referenced.relname AS referenced_table, constraint_row.confdeltype AS delete_action
      FROM pg_constraint AS constraint_row
      JOIN pg_class AS referenced ON referenced.oid = constraint_row.confrelid
      WHERE constraint_row.conname = 'tenant_balances_tenant_id_people_fkey'
    `);

    expect(column.rows).toEqual([{ data_type: 'uuid' }]);
    expect(constraint.rows).toEqual([{ referenced_table: 'people', delete_action: 'r' }]);
  });

  it('leaves matching text identifiers unchanged for the historical live layout', async () => {
    db = new PGlite();
    await db.exec(`
      CREATE TABLE public.people (id text PRIMARY KEY);
      CREATE TABLE public.tenants (id text PRIMARY KEY);
      CREATE TABLE public.tenant_balances (
        tenant_id text PRIMARY KEY REFERENCES public.tenants(id)
      );
      ALTER TABLE public.tenant_balances
        RENAME CONSTRAINT tenant_balances_tenant_id_fkey TO tenant_balances_tenant_fk;
      INSERT INTO public.people (id) VALUES ('tenant-1');
      INSERT INTO public.tenants (id) VALUES ('tenant-1');
      INSERT INTO public.tenant_balances (tenant_id) VALUES ('tenant-1');
    `);

    await db.exec(compatibilityMigration);
    await db.exec(canonicalForeignKeyMigration);

    const column = await db.query<{ data_type: string }>(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tenant_balances'
        AND column_name = 'tenant_id'
    `);
    expect(column.rows).toEqual([{ data_type: 'text' }]);
  });

  it('rejects an invalid UUID without dropping the legacy constraint', async () => {
    db = new PGlite();
    await db.exec(`
      CREATE TABLE public.people (id uuid PRIMARY KEY);
      CREATE TABLE public.tenants (id text PRIMARY KEY);
      CREATE TABLE public.tenant_balances (
        tenant_id text PRIMARY KEY REFERENCES public.tenants(id)
      );
      ALTER TABLE public.tenant_balances
        RENAME CONSTRAINT tenant_balances_tenant_id_fkey TO tenant_balances_tenant_fk;
      INSERT INTO public.tenants (id) VALUES ('not-a-uuid');
      INSERT INTO public.tenant_balances (tenant_id) VALUES ('not-a-uuid');
    `);

    await expect(db.exec(compatibilityMigration)).rejects.toThrow('not valid UUIDs');

    const legacyConstraint = await db.query<{ count: number }>(`
      SELECT count(*)::integer AS count
      FROM pg_constraint
      WHERE conname = 'tenant_balances_tenant_fk'
    `);
    expect(legacyConstraint.rows[0]?.count).toBe(1);
  });
});

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const migration = readFileSync(
  `${repoRoot}supabase/migrations/20260713000002_fix_owner_balances_cascade.sql`,
  'utf8',
);

describe('owner balance delete guard migration execution', () => {
  let db: PGlite | undefined;

  afterEach(async () => {
    await db?.close();
    db = undefined;
  });

  it('replaces the clean-baseline UUID cascade with a hard-delete guard', async () => {
    db = new PGlite();
    const ownerId = '00000000-0000-4000-8000-000000000001';
    await db.exec(`
      CREATE ROLE service_role;
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE TABLE public.owners (id uuid PRIMARY KEY);
      CREATE TABLE public.owner_balances (
        owner_id uuid PRIMARY KEY REFERENCES public.owners(id) ON DELETE CASCADE
      );
      INSERT INTO public.owners (id) VALUES ('${ownerId}');
      INSERT INTO public.owner_balances (owner_id) VALUES ('${ownerId}');
    `);

    await db.exec(migration);

    const legacyConstraint = await db.query<{ count: number }>(`
      SELECT count(*)::integer AS count
      FROM pg_constraint
      WHERE conname = 'owner_balances_owner_id_fkey'
    `);
    expect(legacyConstraint.rows[0]?.count).toBe(0);
    await expect(db.exec(`DELETE FROM public.owners WHERE id = '${ownerId}'`)).rejects.toThrow(
      'Cannot hard-delete owner',
    );
  });

  it('supports the historical mixed UUID/text layout', async () => {
    db = new PGlite();
    const ownerId = '00000000-0000-4000-8000-000000000002';
    await db.exec(`
      CREATE ROLE service_role;
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE TABLE public.owners (id uuid PRIMARY KEY);
      CREATE TABLE public.owner_balances (owner_id text PRIMARY KEY);
      INSERT INTO public.owners (id) VALUES ('${ownerId}');
      INSERT INTO public.owner_balances (owner_id) VALUES ('${ownerId}');
    `);

    await db.exec(migration);

    await expect(db.exec(`DELETE FROM public.owners WHERE id = '${ownerId}'`)).rejects.toThrow(
      'Cannot hard-delete owner',
    );
  });

  it('rejects orphan balances before installing the delete guard', async () => {
    db = new PGlite();
    await db.exec(`
      CREATE ROLE service_role;
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE TABLE public.owners (id uuid PRIMARY KEY);
      CREATE TABLE public.owner_balances (owner_id text PRIMARY KEY);
      INSERT INTO public.owner_balances (owner_id)
      VALUES ('00000000-0000-4000-8000-000000000003');
    `);

    await expect(db.exec(migration)).rejects.toThrow('found 1 orphan row');

    const trigger = await db.query<{ count: number }>(`
      SELECT count(*)::integer AS count
      FROM pg_trigger
      WHERE tgname = 'trg_prevent_owner_delete_with_balances'
    `);
    expect(trigger.rows[0]?.count).toBe(0);
  });
});

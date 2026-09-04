/**
 * P0-1 regression: permission-catalog parity between the two bootstrap shapes.
 *
 * Hosted environments are created by `supabase db push`
 * (.github/workflows/supabase-production-migrations.yml), which never applies
 * supabase/seed.sql, while `supabase db reset` and the PGlite/CI replays do.
 * Before migration 20260901000069, 40 of the 61 permission codes the frontend
 * declares existed only on the reset path. public
 * .current_user_has_effective_app_permission() consults the catalog before any
 * role logic and returns false for an unknown name — including for ADMIN — so
 * those codes were silently denied in production only, while the ADMIN client
 * side short circuit in effective-permissions.ts hid it from every developer.
 *
 * The oracle here is the database's own role map
 * (public.role_has_app_permission), not a copied expectation: these assertions
 * require the effective resolver to return exactly the role map for every
 * catalog code, on both bootstrap shapes. Do not repair a failure below with a
 * role fallback or by relaxing the catalog gate — the fix is a new migration
 * that carries the missing reference row.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase } from '../../p1/replay-bootstrap';
import { appPermissions, type AuthorizationRole } from './permissions';

/**
 * The replay harness applies supabase/seed.sql only for an optionless full
 * canonical replay (see p1/replay-bootstrap.ts). Passing an exclusion marker
 * that matches no migration file is the supported way to request the
 * migrations-only chain, i.e. exactly what `supabase db push` produces.
 */
const MIGRATIONS_ONLY = 'migrations-only-production-shape';

const COMPANY = 'f1000000-0000-4000-8000-0000000000fe';
const ADMIN = 'f1000000-0000-4000-8000-0000000000a1';
const MANAGER = 'f1000000-0000-4000-8000-0000000000b1';
const ACCOUNTANT = 'f1000000-0000-4000-8000-0000000000c1';
const OPERATIONS = 'f1000000-0000-4000-8000-0000000000e1';
const USER = 'f1000000-0000-4000-8000-0000000000d1';
const VIEWER = 'f1000000-0000-4000-8000-0000000000f1';

const ACTORS: ReadonlyArray<readonly [AuthorizationRole, string]> = [
  ['ADMIN', ADMIN],
  ['MANAGER', MANAGER],
  ['ACCOUNTANT', ACCOUNTANT],
  ['OPERATIONS', OPERATIONS],
  ['USER', USER],
  ['VIEWER', VIEWER],
];

type CatalogRow = { permission: string; admin_only: boolean; requestable: boolean };

async function setClaims(db: PGlite, userId: string) {
  await db.query(
    `select set_config('request.jwt.claims',
        json_build_object('sub', '${userId}', 'role', 'authenticated',
                          'app_metadata', json_build_object('company_id', '${COMPANY}'))::text, false);`,
  );
}

async function catalog(db: PGlite): Promise<CatalogRow[]> {
  const result = await db.query<CatalogRow>(
    'select permission, admin_only, requestable from public.app_permission_catalog order by permission',
  );
  return (result as { rows: CatalogRow[] }).rows;
}

/** What the database's own role map declares for a role, over the live catalog. */
async function roleMapSet(db: PGlite, role: AuthorizationRole): Promise<Set<string>> {
  const result = await db.query<{ permission: string }>(
    `select c.permission
       from public.app_permission_catalog c
      where $1 = 'ADMIN'
         or public.role_has_app_permission($1, c.permission)
      order by c.permission`,
    [role],
  );
  return new Set((result as { rows: { permission: string }[] }).rows.map((row) => row.permission));
}

/** What a signed-in caller actually resolves, through the canonical resolver. */
async function effectiveSet(db: PGlite, userId: string, codes: string[]): Promise<Set<string>> {
  await setClaims(db, userId);
  const result = await db.query<{ permission: string }>(
    `select c.permission
       from jsonb_array_elements_text($1::jsonb) as c(permission)
      where public.current_user_has_effective_app_permission(c.permission)
      order by c.permission`,
    [JSON.stringify(codes)],
  );
  return new Set((result as { rows: { permission: string }[] }).rows.map((row) => row.permission));
}

async function hasPermission(db: PGlite, userId: string, permission: string): Promise<boolean> {
  return (await effectiveSet(db, userId, [permission])).has(permission);
}

async function seedActors(db: PGlite) {
  const users = ACTORS.map(([, id], i) =>
    `('${id}', 'parity-${i}@malek.test', '{"company_id":"${COMPANY}"}'::jsonb)`,
  ).join(',');
  const members = ACTORS.map(([role, id]) => `('${COMPANY}', '${id}', '${role}')`).join(',');
  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY}', 'Catalog Parity Co', 'catalog-parity-co');

    insert into auth.users (id, email, raw_app_meta_data) values ${users};
    insert into public.users (id, email, name, role, status, is_active) values
      ${ACTORS.map(([role, id], i) => `('${id}', 'parity-${i}@malek.test', 'Parity ${role}', '${role}', 'ACTIVE', true)`).join(',')};

    -- Role authority is company_members.role only: public.current_app_role()
    -- never consults users.role, and there is no default-role fallback.
    insert into public.company_members (company_id, user_id, role) values ${members};
  `);
}

describe('permission catalog parity (P0-1)', () => {
  let production: PGlite;
  let seeded: PGlite;

  beforeAll(async () => {
    const productionReplay = await createFullReplayedDatabase({ excludeMigrations: [MIGRATIONS_ONLY] });
    expect(productionReplay.failed).toEqual([]);
    production = productionReplay.db;

    const seededReplay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(seededReplay.failed).toEqual([]);
    seeded = seededReplay.db;

    await seedActors(production);
    await seedActors(seeded);
  }, 300_000);

  afterAll(async () => {
    await production?.close();
    await seeded?.close();
  });

  it('carries every declared permission code in the migrations-only catalog', async () => {
    const declared = [...appPermissions].sort();
    expect(declared.length).toBeGreaterThan(50);
    const present = new Set((await catalog(production)).map((row) => row.permission));
    // A declared code missing from the catalog is denied forever, for ADMIN too.
    expect(declared.filter((code) => !present.has(code))).toEqual([]);
  });

  it('produces an identical catalog on both bootstrap shapes', async () => {
    // Anti-drift guard: seed.sql may only re-assert rows the migrations already
    // created, never quietly change a flag (the 000051 requestable hardening was
    // reverted on `db reset` exactly this way before it was reconciled).
    expect(await catalog(production)).toEqual(await catalog(seeded));
  });

  it('also carries the tax code catalog the tax authority path depends on', async () => {
    // company_tax_profiles.tax_code has a foreign key into this catalog. While it
    // was seed-only, a db push environment could not create any tax profile, so
    // every browser-side tax read failed with TAX_PROFILE_MISSING for reasons
    // unrelated to its own permission boundary.
    const codes = async (db: PGlite) =>
      (await db.query<{ code: string }>('select code from public.tax_code_catalog order by code'))
        .rows.map((row) => row.code);
    expect(await codes(production)).toEqual(['NON_TAXABLE', 'VAT', 'VAT_ZERO']);
    expect(await codes(production)).toEqual(await codes(seeded));
  });

  it('keeps non-delegable and compatibility-parent flags identical in both shapes', async () => {
    for (const db of [production, seeded]) {
      const byCode = new Map((await catalog(db)).map((row) => [row.permission, row]));
      // Broad parents are role-matrix aliases only; they must never be
      // employee-requestable, on either bootstrap path.
      for (const parent of ['properties.write', 'contracts.write', 'maintenance.write']) {
        expect(byCode.get(parent)?.requestable, parent).toBe(false);
      }
      // Self-service and review actions stay non-delegable.
      expect(byCode.get('permission_requests.review')?.requestable).toBe(false);
      expect(byCode.get('auth.password.change')?.requestable).toBe(false);
      expect(byCode.get('app.dashboard.view')?.requestable).toBe(false);
      // These resolve through the ADMIN bypass rather than a role grant.
      for (const adminOnly of ['users.manage', 'integrity.view', 'company.settings.manage']) {
        expect(byCode.get(adminOnly)?.admin_only, adminOnly).toBe(true);
      }
    }
  });

  it('resolves the role map for every role on both shapes', async () => {
    for (const db of [production, seeded]) {
      const catalogRows = await catalog(db);
      const codes = catalogRows.map((row) => row.permission);
      for (const [role, userId] of ACTORS) {
        const declared = await roleMapSet(db, role);
        const actual = await effectiveSet(db, userId, codes);
        // Nothing lost: every code the role map grants must resolve true. This is
        // exactly what silently broke when the catalog row was missing.
        for (const code of declared) {
          expect(actual.has(code), `${role} / ${code}`).toBe(true);
        }
        // Nothing invented: the resolver can never answer true for a name that is
        // not in the catalog, and it may only add a granular child of a granted
        // parent (public.current_user_has_effective_app_permission inherits
        // properties.create and friends from the parent write).
        const parents = new Set(codes.map((code) => `${code.slice(0, code.lastIndexOf('.'))}.write`));
        for (const code of [...actual].filter((c) => !declared.has(c))) {
          const parent = `${code.slice(0, code.lastIndexOf('.'))}.write`;
          expect(parents.has(parent) && declared.has(parent), `${role} / ${code}`).toBe(true);
        }
        // Production shape and reset shape must agree code for code.
        if (db === seeded) {
          const other = await effectiveSet(production, userId, codes);
          expect([...other].sort(), `${role} across shapes`).toEqual([...actual].sort());
        }
        // Sanity floor only (a role map that grants nothing would make the
        // comparisons above vacuous); the concrete grants are pinned in the next
        // test instead of by a hand-counted number here.
        expect(declared.size, `role map for ${role} must not be empty`).toBeGreaterThan(role === 'USER' ? 1 : 0);
      }
    }
  });

  it('un-blocks the codes that gate RPCs and policies by name', async () => {
    // These names are referenced by server-side checks (RLS policies and RPC
    // guards in 20260901000009/15/49/58 and the service-provider policies in the
    // canonical baseline). Every one of them was permanently false in a db push
    // environment because the catalog row was missing.
    for (const code of [
      'contracts.write',
      'financial.invoices.generate',
      'financial.bank_reconciliation.match',
      'service_providers.write',
      'permission_requests.review',
    ]) {
      expect(await hasPermission(production, MANAGER, code), code).toBe(true);
    }
    expect(await hasPermission(production, ACCOUNTANT, 'financial.bank_reconciliation.view')).toBe(true);
    // users.manage is admin_only: it drives
    // app_private.can_manage_company_members() for ADMIN and nobody else.
    expect(await hasPermission(production, ADMIN, 'users.manage')).toBe(true);
    expect(await hasPermission(production, MANAGER, 'users.manage')).toBe(false);
    // Least privilege is unchanged for the narrowest role.
    expect(await hasPermission(production, USER, 'financial.payments.create')).toBe(false);
    expect(await hasPermission(production, USER, 'contracts.write')).toBe(false);
  });

  it('still fails closed for an unknown permission name, ADMIN included', async () => {
    for (const db of [production, seeded]) {
      expect(await hasPermission(db, ADMIN, 'totally.unknown.permission')).toBe(false);
      expect(await hasPermission(db, MANAGER, 'totally.unknown.permission')).toBe(false);
      expect(await hasPermission(db, USER, 'totally.unknown.permission')).toBe(false);
    }
  });

  it('keeps the catalog guard attached to both delegation surfaces', async () => {
    // The missing rows were a delegation outage, not just a hidden menu entry:
    // this BEFORE trigger raises 'Unknown permission' (22023) for any code that
    // is not in the catalog, so an administrator could not grant it either.
    const guarded = await production.query<{ rel: string }>(
      `select distinct c.relname as rel
         from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
         join pg_proc p on p.oid = t.tgfoid
        where p.proname = 'enforce_app_permission_catalog'`,
    );
    expect(guarded.rows.map((row) => row.rel).sort()).toEqual([
      'permission_requests',
      'user_permission_grants',
    ]);
  });
});
